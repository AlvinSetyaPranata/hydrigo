from __future__ import annotations

import json
from datetime import datetime

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from .models import DripProfile, DripSchedule, DripSensorReading


DEFAULT_ZONES = [
    {
        "id": "zone-a",
        "name": "Zona A",
        "crop": "Cabai Rawit",
        "moisture": 58,
        "temperature": 27,
        "lightIntensity": 28500,
        "airHumidity": 71,
        "trendData": [52, 54, 53, 57, 58, 60],
        "initialValveOn": True,
        "status": "optimal",
    },
    {
        "id": "zone-b",
        "name": "Zona B",
        "crop": "Tomat Ceri",
        "moisture": 44,
        "temperature": 29,
        "lightIntensity": 30100,
        "airHumidity": 67,
        "trendData": [48, 47, 45, 46, 44, 43],
        "initialValveOn": False,
        "status": "warning",
    },
    {
        "id": "zone-c",
        "name": "Zona C",
        "crop": "Terong Ungu",
        "moisture": 36,
        "temperature": 30,
        "lightIntensity": 29750,
        "airHumidity": 64,
        "trendData": [41, 40, 39, 38, 37, 36],
        "initialValveOn": False,
        "status": "critical",
    },
]

DAY_LABELS = {
    "mon": "Sen",
    "tue": "Sel",
    "wed": "Rab",
    "thu": "Kam",
    "fri": "Jum",
    "sat": "Sab",
    "sun": "Min",
}


def default_profile_values() -> dict[str, str]:
    return {
        "name": "Andi Pratama",
        "role": "Petani SmartDrip",
        "location": "Bandung, Jawa Barat",
        "email": "andi.pratama@mfarm.id",
        "phone": "+62 812 3456 7890",
        "farm_name": "Kebun SmartDrip Lembang",
        "farm_area": "2,4 hektare",
        "active_since": "April 2026",
    }


def serialize_profile(profile: DripProfile) -> dict[str, str]:
    return {
        "name": profile.name,
        "role": profile.role,
        "location": profile.location,
        "email": profile.email,
        "phone": profile.phone,
        "farmName": profile.farm_name,
        "farmArea": profile.farm_area,
        "activeSince": profile.active_since,
    }


def serialize_schedule(schedule: DripSchedule) -> dict[str, object]:
    return {
        "id": schedule.schedule_id,
        "name": schedule.name,
        "zoneId": schedule.zone_id,
        "zoneName": schedule.zone_name,
        "selectedDays": schedule.selected_days,
        "days": schedule.days_label,
        "time": schedule.time,
        "duration": f"{schedule.duration_minutes} menit",
        "durationMinutes": schedule.duration_minutes,
        "triggerLogic": schedule.trigger_logic,
        "isEnabled": schedule.is_enabled,
    }


def serialize_reading(reading: DripSensorReading) -> dict[str, object]:
    return {
        "deviceId": reading.device_id,
        "zoneId": reading.zone_id,
        "soilMoisture": reading.soil_moisture_pct,
        "temperature": reading.temperature_c,
        "airHumidity": reading.humidity_pct,
        "lightIntensity": reading.light_lux,
        "aiScore": reading.ai_score,
        "pumpOn": reading.pump_on,
        "recordedAt": reading.recorded_at.isoformat(),
        "receivedAt": reading.received_at.isoformat(),
    }


def ensure_seed_data() -> None:
    if not DripProfile.objects.exists():
        DripProfile.objects.create(**default_profile_values())

    if not DripSchedule.objects.exists():
        DripSchedule.objects.bulk_create(
            [
                DripSchedule(
                    schedule_id="sch-001",
                    name="Siram Pagi",
                    zone_id="zone-a",
                    zone_name="Zona A - Cabai Rawit",
                    selected_days=["mon", "wed", "fri"],
                    days_label="Sen, Rab, Jum",
                    time="06:00",
                    duration_minutes=15,
                    trigger_logic="time_only",
                    is_enabled=True,
                ),
                DripSchedule(
                    schedule_id="sch-002",
                    name="Irigasi Sore",
                    zone_id="zone-b",
                    zone_name="Zona B - Tomat Ceri",
                    selected_days=["tue", "thu", "sat"],
                    days_label="Sel, Kam, Sab",
                    time="16:30",
                    duration_minutes=12,
                    trigger_logic="soil_below_45",
                    is_enabled=True,
                ),
            ]
        )


def resolve_zone(zone_id: str):
    return next((zone for zone in DEFAULT_ZONES if zone["id"] == zone_id), None)


def format_days(values: list[str]) -> str:
    return ", ".join(DAY_LABELS[item] for item in values if item in DAY_LABELS)


def apply_latest_readings_to_zones():
    zones = [dict(zone) for zone in DEFAULT_ZONES]

    for zone in zones:
        latest = DripSensorReading.objects.filter(zone_id=zone["id"]).first()
        if latest is None:
            continue

        zone["moisture"] = round(latest.soil_moisture_pct, 1)
        zone["temperature"] = round(latest.temperature_c, 1)
        zone["airHumidity"] = round(latest.humidity_pct, 1)
        zone["lightIntensity"] = round(latest.light_lux, 1)
        zone["initialValveOn"] = latest.pump_on

        if latest.soil_moisture_pct <= 40:
            zone["status"] = "critical"
        elif latest.soil_moisture_pct <= 55:
            zone["status"] = "warning"
        else:
            zone["status"] = "optimal"

    return zones


@require_GET
def health_view(request):
    ensure_seed_data()
    return JsonResponse({"status": "ok", "service": "drip", "timestamp": timezone.now().isoformat()})


@require_GET
def farm_summary_view(request):
    ensure_seed_data()
    zones = apply_latest_readings_to_zones()
    active_zones = sum(1 for zone in zones if zone["initialValveOn"])
    return JsonResponse(
        {
            "lastUpdated": timezone.now().isoformat(),
            "stats": {
                "soilMoisture": round(sum(zone["moisture"] for zone in zones) / len(zones)),
                "temperature": round(sum(zone["temperature"] for zone in zones) / len(zones)),
                "lightIntensity": round(sum(zone["lightIntensity"] for zone in zones) / len(zones)),
                "waterTank": 78,
                "activeZones": active_zones,
            },
            "zones": zones,
        }
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def schedules_view(request):
    ensure_seed_data()

    if request.method == "GET":
        return JsonResponse([serialize_schedule(item) for item in DripSchedule.objects.all()], safe=False)

    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"message": "body harus JSON valid"}, status=400)

    name = str(body.get("name", "")).strip()
    selected_zone = str(body.get("selectedZone", "")).strip()
    start_time = str(body.get("startTime", "")).strip()
    selected_days = body.get("selectedDays") or []
    trigger_logic = str(body.get("triggerLogic", "time_only")).strip() or "time_only"

    if not name:
        return JsonResponse({"message": "Nama jadwal wajib diisi."}, status=400)
    if not isinstance(selected_days, list) or not selected_days:
        return JsonResponse({"message": "Pilih minimal satu hari."}, status=400)
    if len(start_time) != 5 or start_time[2] != ":":
        return JsonResponse({"message": "Format waktu harus JJ:MM."}, status=400)

    zone = resolve_zone(selected_zone)
    if zone is None:
        return JsonResponse({"message": "Zona tidak ditemukan."}, status=400)

    try:
        duration_minutes = int(body.get("duration", 0))
    except (TypeError, ValueError):
        duration_minutes = 0
    if duration_minutes <= 0:
        return JsonResponse({"message": "Durasi harus lebih dari 0."}, status=400)

    schedule = DripSchedule.objects.create(
        schedule_id=f"sch-{int(timezone.now().timestamp())}",
        name=name,
        zone_id=zone["id"],
        zone_name=f"{zone['name']} - {zone['crop']}",
        selected_days=selected_days,
        days_label=format_days(selected_days),
        time=start_time,
        duration_minutes=duration_minutes,
        trigger_logic=trigger_logic,
        is_enabled=True,
    )
    return JsonResponse(serialize_schedule(schedule), status=201)


@csrf_exempt
@require_http_methods(["PATCH"])
def schedule_detail_view(request, schedule_id: str):
    ensure_seed_data()
    schedule = DripSchedule.objects.filter(schedule_id=schedule_id).first()
    if schedule is None:
        return JsonResponse({"message": "Jadwal tidak ditemukan."}, status=404)

    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"message": "body harus JSON valid"}, status=400)

    if "isEnabled" not in body:
        return JsonResponse({"message": "Field isEnabled wajib diisi."}, status=400)

    schedule.is_enabled = bool(body["isEnabled"])
    schedule.save(update_fields=["is_enabled", "updated_at"])
    return JsonResponse(serialize_schedule(schedule))


@require_GET
def history_view(request):
    ensure_seed_data()
    now = timezone.localtime()
    month = int(request.GET.get("month", now.month))
    year = int(request.GET.get("year", now.year))
    return JsonResponse(
        {
            "chartData": [
                {"day": "01", "value": 180},
                {"day": "05", "value": 220},
                {"day": "10", "value": 260},
                {"day": "15", "value": 210},
                {"day": "20", "value": 310},
                {"day": "25", "value": 280},
            ],
            "lastCycle": {
                "date": f"{year}-{month:02d}-25",
                "zone": "Zona B - Tomat Ceri",
                "duration": "12 menit",
                "water": "280 liter",
            },
            "pastEvents": [
                {
                    "id": "evt-001",
                    "date": f"{year}-{month:02d}-25",
                    "time": "16:30",
                    "zone": "Zona B",
                    "duration": "12 menit",
                    "water": "280 L",
                },
                {
                    "id": "evt-002",
                    "date": f"{year}-{month:02d}-23",
                    "time": "06:00",
                    "zone": "Zona A",
                    "duration": "15 menit",
                    "water": "320 L",
                },
            ],
            "selectedMonth": {
                "month": month,
                "year": year,
                "label": datetime(year, month, 1).strftime("%b %Y"),
            },
        }
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def iot_readings_view(request):
    ensure_seed_data()

    if request.method == "GET":
        try:
            limit = int(request.GET.get("limit", "20"))
        except ValueError:
            return JsonResponse({"message": "limit harus integer"}, status=400)
        limit = max(1, min(limit, 100))
        rows = DripSensorReading.objects.all()[:limit]
        return JsonResponse({"data": [serialize_reading(item) for item in rows], "limit": limit})

    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"message": "body harus JSON valid"}, status=400)

    device_id = str(body.get("device_id", "")).strip()
    zone_id = str(body.get("zone_id", "")).strip()

    if not device_id:
        return JsonResponse({"message": "device_id wajib diisi"}, status=400)
    if resolve_zone(zone_id) is None:
        return JsonResponse({"message": "zone_id tidak dikenal"}, status=400)

    try:
        soil_moisture_pct = float(body.get("soil_moisture_pct"))
        temperature_c = float(body.get("temperature_c"))
        humidity_pct = float(body.get("humidity_pct"))
        light_lux = float(body.get("light_lux"))
        ai_score = float(body.get("ai_score"))
    except (TypeError, ValueError):
        return JsonResponse({"message": "nilai sensor harus numerik"}, status=400)

    pump_on = bool(body.get("pump_on"))
    recorded_at_raw = str(body.get("recorded_at", "")).strip()
    try:
        recorded_at = datetime.fromisoformat(recorded_at_raw.replace("Z", "+00:00")) if recorded_at_raw else timezone.now()
    except ValueError:
        return JsonResponse({"message": "recorded_at harus ISO-8601"}, status=400)

    reading = DripSensorReading.objects.create(
        device_id=device_id,
        zone_id=zone_id,
        soil_moisture_pct=soil_moisture_pct,
        temperature_c=temperature_c,
        humidity_pct=humidity_pct,
        light_lux=light_lux,
        ai_score=ai_score,
        pump_on=pump_on,
        recorded_at=recorded_at,
    )
    return JsonResponse(
        {
            "message": "data drip berhasil disimpan",
            "reading": serialize_reading(reading),
        },
        status=201,
    )


@csrf_exempt
@require_http_methods(["GET", "PUT"])
def profile_view(request):
    ensure_seed_data()
    profile = DripProfile.objects.first()

    if request.method == "GET":
        return JsonResponse(serialize_profile(profile))

    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"message": "body harus JSON valid"}, status=400)

    name = str(body.get("name", "")).strip()
    if not name:
        return JsonResponse({"message": "Nama tidak boleh kosong."}, status=400)

    profile.name = name
    profile.role = str(body.get("role", "")).strip()
    profile.location = str(body.get("location", "")).strip()
    profile.email = str(body.get("email", "")).strip()
    profile.phone = str(body.get("phone", "")).strip()
    profile.farm_name = str(body.get("farmName", "")).strip()
    profile.farm_area = str(body.get("farmArea", "")).strip()
    profile.active_since = str(body.get("activeSince", "")).strip()
    profile.save()
    return JsonResponse(serialize_profile(profile))
