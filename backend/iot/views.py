import json
from html import escape
from io import BytesIO
from xml.sax.saxutils import escape as xml_escape
from zipfile import ZIP_DEFLATED, ZipFile

from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from .models import ControlMode, IngestTransaction, LedgerBlock, ManualControl, SensorReading
from .services import ingest_reading, serialize_block, serialize_reading, serialize_transaction, utc_now, verify_chain


def build_excel_table_response(filename: str, title: str, columns: list[str], rows: list[list[object]]) -> HttpResponse:
    head_cells = "".join(f"<th>{escape(column)}</th>" for column in columns)
    body_rows = []

    for row in rows:
        cells = "".join(f"<td>{escape('' if value is None else str(value))}</td>" for value in row)
        body_rows.append(f"<tr>{cells}</tr>")

    body = f"""<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>{escape(title)}</title>
  </head>
  <body>
    <table border="1">
      <thead>
        <tr>{head_cells}</tr>
      </thead>
      <tbody>
        {''.join(body_rows)}
      </tbody>
    </table>
  </body>
</html>
"""
    response = HttpResponse(body, content_type="application/vnd.ms-excel; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def build_xlsx_response(filename: str, columns: list[str], rows: list[list[object]]) -> HttpResponse:
    workbook = BytesIO()

    def make_cell(value: object) -> str:
        text = "" if value is None else str(value)
        return (
            '<c t="inlineStr">'
            f"<is><t>{xml_escape(text)}</t></is>"
            "</c>"
        )

    sheet_rows: list[str] = []
    all_rows = [columns, *rows]
    for index, row in enumerate(all_rows, start=1):
        cells = "".join(make_cell(value) for value in row)
        sheet_rows.append(f'<row r="{index}">{cells}</row>')

    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        "<sheetData>"
        f'{"".join(sheet_rows)}'
        "</sheetData>"
        "</worksheet>"
    )

    with ZipFile(workbook, "w", ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/docProps/core.xml" '
            'ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
            '<Override PartName="/docProps/app.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
            "</Types>",
        )
        archive.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
            'Target="xl/workbook.xml"/>'
            '<Relationship Id="rId2" '
            'Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" '
            'Target="docProps/core.xml"/>'
            '<Relationship Id="rId3" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" '
            'Target="docProps/app.xml"/>'
            "</Relationships>",
        )
        archive.writestr(
            "xl/workbook.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            "<sheets>"
            '<sheet name="Monitoring" sheetId="1" r:id="rId1"/>'
            "</sheets>"
            "</workbook>",
        )
        archive.writestr(
            "xl/_rels/workbook.xml.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
            'Target="worksheets/sheet1.xml"/>'
            "</Relationships>",
        )
        archive.writestr("xl/worksheets/sheet1.xml", sheet_xml)
        archive.writestr(
            "docProps/core.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/" '
            'xmlns:dcterms="http://purl.org/dc/terms/" '
            'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            "<dc:title>Hydrigo Monitoring Export</dc:title>"
            "<dc:creator>Hydrigo</dc:creator>"
            "</cp:coreProperties>",
        )
        archive.writestr(
            "docProps/app.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
            'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
            "<Application>Hydrigo</Application>"
            "</Properties>",
        )

    response = HttpResponse(
        workbook.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def ensure_manual_controls():
    defaults_by_control = {
        "water-pump": {
            "name": "Pompa Air",
            "description": "Kontrol manual pompa air utama untuk sirkulasi nutrisi.",
            "status": False,
        },
        "nutrient-pump": {
            "name": "Pompa Nutrisi",
            "description": "Kontrol manual pompa nutrisi tanpa inferensi model.",
            "status": False,
        },
    }

    for control_id, defaults in defaults_by_control.items():
        ManualControl.objects.get_or_create(
            control_id=control_id,
            defaults=defaults,
        )


def ensure_control_mode():
    return ControlMode.objects.get_or_create(defaults={"mode": "automatic"})[0]


def serialize_manual_control(item: ManualControl):
    return {
        "id": item.control_id,
        "name": item.name,
        "description": item.description,
        "status": item.status,
        "updatedAt": item.updated_at.isoformat(),
    }


def serialize_manual_control_state() -> dict[str, bool]:
    controls = {
        item.control_id: item.status
        for item in ManualControl.objects.all()
    }
    return {
        "pompaNutrisi": bool(controls.get("nutrient-pump", False)),
        "pompaAir": bool(controls.get("water-pump", False)),
    }


def serialize_control_mode(item: ControlMode):
    normalized_mode = "manual" if item.mode == "manual" else "automatic"
    return {
        "mode": normalized_mode,
        "selectedMode": normalized_mode,
        "controlMode": 1 if normalized_mode == "manual" else 0,
        "updatedAt": item.updated_at.isoformat(),
    }


def sync_control_state_from_device(body: dict):
    ensure_manual_controls()
    control_mode = ensure_control_mode()

    raw_mode = str(body.get("mode", body.get("selectedMode", ""))).strip().lower()
    raw_control_mode = body.get("controlMode")

    normalized_mode = None
    if raw_mode in {"manual"}:
        normalized_mode = "manual"
    elif raw_mode in {"auto", "automatic", "otomatis"}:
        normalized_mode = "automatic"
    elif raw_control_mode in {0, 1, "0", "1"}:
        normalized_mode = "manual" if str(raw_control_mode) == "1" else "automatic"

    if normalized_mode is not None and control_mode.mode != normalized_mode:
        control_mode.mode = normalized_mode
        control_mode.save(update_fields=["mode", "updated_at"])

    # In manual mode, the dashboard/manual control endpoint is the source of truth.
    # Device ingest should not flip the toggle back off while it is only reporting state.
    if control_mode.mode == "manual":
        return

    if "manualPumpCommand" in body or "pump" in body or "pompa" in body or "pump_status" in body or "pompaStatus" in body:
        raw_status = body.get("manualPumpCommand", body.get("pump", body.get("pompa", body.get("pump_status", body.get("pompaStatus")))))
        manual_status = bool(raw_status)
        control = ManualControl.objects.filter(control_id="water-pump").first()
        if control is not None and control.status != manual_status:
            control.status = manual_status
            control.save(update_fields=["status", "updated_at"])


@require_GET
def health_view(request):
    return JsonResponse({"status": "ok", "timestamp": utc_now().isoformat()})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def manual_controls_view(request):
    ensure_manual_controls()

    if request.method == "GET":
        return JsonResponse(serialize_manual_control_state())

    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "body harus JSON valid"}, status=400)

    if "pompaNutrisi" in body or "pompaAir" in body:
        pompa_nutrisi = body.get("pompaNutrisi")
        pompa_air = body.get("pompaAir")

        if pompa_nutrisi is not None and not isinstance(pompa_nutrisi, bool):
            return JsonResponse({"error": "pompaNutrisi harus boolean"}, status=400)
        if pompa_air is not None and not isinstance(pompa_air, bool):
            return JsonResponse({"error": "pompaAir harus boolean"}, status=400)

        if pompa_nutrisi is not None:
            control = ManualControl.objects.filter(control_id="nutrient-pump").first()
            if control is not None and control.status != pompa_nutrisi:
                control.status = pompa_nutrisi
                control.save(update_fields=["status", "updated_at"])

        if pompa_air is not None:
            control = ManualControl.objects.filter(control_id="water-pump").first()
            if control is not None and control.status != pompa_air:
                control.status = pompa_air
                control.save(update_fields=["status", "updated_at"])

        return JsonResponse(serialize_manual_control_state())

    control_id = str(body.get("controlId", "")).strip()
    status = body.get("status")

    if not control_id:
        return JsonResponse({"error": "body harus berisi pompaNutrisi/pompaAir atau controlId"}, status=400)
    if not isinstance(status, bool):
        return JsonResponse({"error": "status harus boolean"}, status=400)

    control = ManualControl.objects.filter(control_id=control_id).first()
    if control is None:
        return JsonResponse({"error": "kontrol tidak ditemukan"}, status=404)

    control.status = status
    control.save(update_fields=["status", "updated_at"])
    return JsonResponse(serialize_manual_control_state())


@csrf_exempt
@require_http_methods(["GET", "POST"])
def control_mode_view(request):
    control_mode = ensure_control_mode()

    if request.method == "GET":
        return JsonResponse({"data": serialize_control_mode(control_mode), **serialize_control_mode(control_mode)})

    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "body harus JSON valid"}, status=400)

    requested_mode = str(body.get("mode", "")).strip().lower()
    if requested_mode in {"auto", "otomatis"}:
        requested_mode = "automatic"

    if requested_mode not in {"manual", "automatic"}:
        return JsonResponse({"error": "mode harus manual atau automatic"}, status=400)

    control_mode.mode = requested_mode
    control_mode.save(update_fields=["mode", "updated_at"])
    payload = serialize_control_mode(control_mode)
    return JsonResponse({"data": payload, **payload})


@csrf_exempt
@require_POST
def iot_reading_ingest_view(request):
    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "body harus JSON valid"}, status=400)

    try:
        result = ingest_reading(body)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    sync_control_state_from_device(body)

    return JsonResponse(
        {
            "message": "transaksi ingest berhasil disimpan",
            "transaction": result["transaction"],
            "reading": result["reading"],
            "ledger": result["ledger"],
        },
        status=201,
    )


@require_GET
def readings_view(request):
    try:
        limit = int(request.GET.get("limit", "20"))
        page = int(request.GET.get("page", "1"))
    except ValueError:
        return JsonResponse({"error": "limit dan page harus integer"}, status=400)
    limit = max(1, min(limit, 100))
    page = max(1, page)
    offset = (page - 1) * limit
    queryset = SensorReading.objects.select_related("block").all()
    total = queryset.count()
    rows = queryset[offset:offset + limit]
    return JsonResponse({
        "data": [serialize_reading(item) for item in rows],
        "limit": limit,
        "page": page,
        "total": total,
        "total_pages": (total + limit - 1) // limit,
    })


@require_GET
def readings_export_excel_view(request):
    queryset = SensorReading.objects.select_related("block").all()
    columns = [
        "Waktu",
        "Suhu Air (°C)",
        "pH",
        "TDS (ppm)",
        "Status Pompa",
    ]
    rows = []

    for item in queryset:
        rows.append([
            item.recorded_at.isoformat(),
            item.temperature_c,
            item.ph,
            item.tds_ppm,
            "ON" if item.pump_status else "OFF",
        ])

    return build_xlsx_response(
        filename="hydrigo-dataset.xlsx",
        columns=columns,
        rows=rows,
    )


@require_GET
def transactions_view(request):
    try:
        limit = int(request.GET.get("limit", "20"))
        page = int(request.GET.get("page", "1"))
    except ValueError:
        return JsonResponse({"error": "limit dan page harus integer"}, status=400)
    limit = max(1, min(limit, 100))
    page = max(1, page)
    offset = (page - 1) * limit
    queryset = IngestTransaction.objects.all()
    total = queryset.count()
    rows = queryset[offset:offset + limit]
    return JsonResponse({
        "data": [serialize_transaction(item) for item in rows],
        "limit": limit,
        "page": page,
        "total": total,
        "total_pages": (total + limit - 1) // limit,
    })


@require_GET
def transaction_detail_view(request, transaction_id: str):
    item = IngestTransaction.objects.filter(transaction_id=transaction_id).first()
    if item is None:
        return JsonResponse({"error": "transaksi tidak ditemukan"}, status=404)
    return JsonResponse({"data": serialize_transaction(item)})


@require_GET
def blockchain_chain_view(request):
    try:
        limit = int(request.GET.get("limit", "20"))
        page = int(request.GET.get("page", "1"))
    except ValueError:
        return JsonResponse({"error": "limit dan page harus integer"}, status=400)

    limit = max(1, min(limit, 100))
    page = max(1, page)
    offset = (page - 1) * limit
    queryset = LedgerBlock.objects.select_related("reading").all()
    total = queryset.count()
    rows = queryset[offset:offset + limit]
    return JsonResponse({
        "data": [serialize_block(item) for item in rows],
        "verification": verify_chain(),
        "limit": limit,
        "page": page,
        "total": total,
        "total_pages": (total + limit - 1) // limit,
    })
