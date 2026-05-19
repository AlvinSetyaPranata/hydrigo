import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from .models import ControlMode, IngestTransaction, LedgerBlock, ManualControl, SensorReading
from .services import ingest_reading, serialize_block, serialize_reading, serialize_transaction, utc_now, verify_chain


def ensure_manual_controls():
    ManualControl.objects.get_or_create(
        control_id="water-pump",
        defaults={
            "name": "Pompa Air",
            "description": "Kontrol manual pompa air utama untuk sirkulasi nutrisi.",
            "status": False,
        },
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


def serialize_control_mode(item: ControlMode):
    normalized_mode = "manual" if item.mode == "manual" else "automatic"
    return {
        "mode": normalized_mode,
        "selectedMode": normalized_mode,
        "controlMode": 1 if normalized_mode == "manual" else 0,
        "updatedAt": item.updated_at.isoformat(),
    }


@require_GET
def health_view(request):
    return JsonResponse({"status": "ok", "timestamp": utc_now().isoformat()})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def manual_controls_view(request):
    ensure_manual_controls()

    if request.method == "GET":
        controls = [serialize_manual_control(item) for item in ManualControl.objects.all()]
        return JsonResponse({"data": controls})

    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "body harus JSON valid"}, status=400)

    control_id = str(body.get("controlId", "")).strip()
    status = body.get("status")

    if not control_id:
        return JsonResponse({"error": "controlId wajib diisi"}, status=400)
    if not isinstance(status, bool):
        return JsonResponse({"error": "status harus boolean"}, status=400)

    control = ManualControl.objects.filter(control_id=control_id).first()
    if control is None:
        return JsonResponse({"error": "kontrol tidak ditemukan"}, status=404)

    control.status = status
    control.save(update_fields=["status", "updated_at"])
    controls = [serialize_manual_control(item) for item in ManualControl.objects.all()]
    return JsonResponse({"data": controls})


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
