import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .models import IngestTransaction, LedgerBlock, SensorReading
from .services import ingest_reading, serialize_block, serialize_reading, serialize_transaction, utc_now, verify_chain


@require_GET
def health_view(request):
    return JsonResponse({"status": "ok", "timestamp": utc_now().isoformat()})


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
    except ValueError:
        return JsonResponse({"error": "limit harus integer"}, status=400)
    limit = max(1, min(limit, 100))
    rows = SensorReading.objects.select_related("block").all()[:limit]
    return JsonResponse({"data": [serialize_reading(item) for item in rows], "limit": limit})


@require_GET
def transactions_view(request):
    try:
        limit = int(request.GET.get("limit", "20"))
    except ValueError:
        return JsonResponse({"error": "limit harus integer"}, status=400)
    limit = max(1, min(limit, 100))
    rows = IngestTransaction.objects.all()[:limit]
    return JsonResponse({"data": [serialize_transaction(item) for item in rows], "limit": limit})


@require_GET
def transaction_detail_view(request, transaction_id: str):
    item = IngestTransaction.objects.filter(transaction_id=transaction_id).first()
    if item is None:
        return JsonResponse({"error": "transaksi tidak ditemukan"}, status=404)
    return JsonResponse({"data": serialize_transaction(item)})


@require_GET
def blockchain_chain_view(request):
    rows = LedgerBlock.objects.select_related("reading").all()
    return JsonResponse({"data": [serialize_block(item) for item in rows], "verification": verify_chain()})
