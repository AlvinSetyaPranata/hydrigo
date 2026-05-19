from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from django.db import transaction
from django.utils import timezone as dj_timezone

from .models import IngestTransaction, LedgerBlock, SensorReading


def utc_now():
    return dj_timezone.now()


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def parse_iso_timestamp(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("recorded_at harus format ISO-8601") from exc


def first_present(data: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in data and data[key] is not None:
            return data[key]
    return None


def water_level_from_distance(distance_cm: float, max_distance_cm: float) -> float:
    if max_distance_cm <= 0:
        raise ValueError("water_level_max_distance_cm harus lebih besar dari 0")
    fill_ratio = 1.0 - (distance_cm / max_distance_cm)
    return max(0.0, min(fill_ratio * 100.0, 100.0))


def parse_optional_bool(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)

    normalized = str(value).strip().lower()
    if normalized in {"true", "1", "on"}:
        return True
    if normalized in {"false", "0", "off"}:
        return False
    raise ValueError("pump_status harus boolean")


@dataclass
class ReadingPayload:
    device_id: str
    lettuce_bed_id: str
    air_temperature_c: float | None
    temperature_c: float
    humidity_pct: float
    ph: float
    tds_ppm: float
    water_distance_cm: float | None
    water_level_pct: float
    light_lux: float
    pump_prediction: int | None
    pump_status: bool | None
    device_phase: str | None
    recorded_at: datetime
    signature: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ReadingPayload":
        field_candidates = {
            "device_id": ("device_id",),
            "lettuce_bed_id": ("lettuce_bed_id", "bed_id"),
            "temperature_c": ("temperature_c", "suhu_air", "suhuAir"),
            "humidity_pct": ("humidity_pct", "kelembapan", "humidity"),
            "ph": ("ph", "phValue", "ph_value"),
            "tds_ppm": ("tds_ppm", "tds", "tdsValue"),
        }
        missing = [field for field, keys in field_candidates.items() if first_present(data, *keys) is None]
        if missing:
            raise ValueError(f"Field wajib belum ada: {', '.join(missing)}")

        try:
            water_level_pct = first_present(data, "water_level_pct", "waterLevelPct")
            if water_level_pct is None:
                distance_cm = first_present(data, "jarak", "distance_cm", "water_distance_cm")
                if distance_cm is None:
                    raise ValueError("Field wajib belum ada: water_level_pct")
                max_distance_cm = first_present(data, "water_level_max_distance_cm", "tank_depth_cm")
                if max_distance_cm is None:
                    max_distance_cm = 35.0
                water_level_pct = water_level_from_distance(float(distance_cm), float(max_distance_cm))

            light_lux = first_present(data, "light_lux", "lightLux", "lux")
            if light_lux is None:
                light_lux = 0.0

            air_temperature_c = first_present(data, "air_temperature_c", "suhu")
            water_distance_cm = first_present(data, "water_distance_cm", "jarak", "distance_cm", "water_distance_cm")
            pump_prediction = first_present(data, "pump_prediction", "prediksiRelay")
            pump_status = first_present(data, "pump_status", "pompaStatus")
            device_phase = first_present(data, "device_phase", "devicePhase")

            payload = cls(
                device_id=str(first_present(data, "device_id")).strip(),
                lettuce_bed_id=str(first_present(data, "lettuce_bed_id", "bed_id")).strip(),
                air_temperature_c=None if air_temperature_c is None else float(air_temperature_c),
                temperature_c=float(first_present(data, "temperature_c", "suhu_air", "suhuAir")),
                humidity_pct=float(first_present(data, "humidity_pct", "kelembapan", "humidity")),
                ph=float(first_present(data, "ph", "phValue", "ph_value")),
                tds_ppm=float(first_present(data, "tds_ppm", "tds", "tdsValue")),
                water_distance_cm=None if water_distance_cm is None else float(water_distance_cm),
                water_level_pct=float(water_level_pct),
                light_lux=float(light_lux),
                pump_prediction=None if pump_prediction is None else int(pump_prediction),
                pump_status=parse_optional_bool(pump_status),
                device_phase=None if device_phase is None else str(device_phase).strip(),
                recorded_at=parse_iso_timestamp(data.get("recorded_at") or utc_now().isoformat()),
                signature=None if data.get("signature") is None else str(data["signature"]),
            )
        except (TypeError, ValueError) as exc:
            if str(exc) == "recorded_at harus format ISO-8601":
                raise
            if str(exc).startswith("Field wajib belum ada:") or str(exc) in {"water_level_max_distance_cm harus lebih besar dari 0", "pump_status harus boolean"}:
                raise
            raise ValueError("field numerik harus berupa angka yang valid") from exc

        payload.validate()
        return payload

    def validate(self) -> None:
        if not self.device_id:
            raise ValueError("device_id tidak boleh kosong")
        if not self.lettuce_bed_id:
            raise ValueError("lettuce_bed_id tidak boleh kosong")
        if self.air_temperature_c is not None and not (-10 <= self.air_temperature_c <= 80):
            raise ValueError("air_temperature_c di luar rentang yang masuk akal")
        if not (-10 <= self.temperature_c <= 60):
            raise ValueError("temperature_c di luar rentang yang masuk akal")
        if not (0 <= self.humidity_pct <= 100):
            raise ValueError("humidity_pct harus 0-100")
        if not (0 <= self.ph <= 14):
            raise ValueError("ph harus 0-14")
        if not (0 <= self.tds_ppm <= 5000):
            raise ValueError("tds_ppm di luar rentang yang diizinkan")
        if self.water_distance_cm is not None and self.water_distance_cm < 0:
            raise ValueError("water_distance_cm tidak boleh negatif")
        if not (0 <= self.water_level_pct <= 100):
            raise ValueError("water_level_pct harus 0-100")
        if self.light_lux < 0:
            raise ValueError("light_lux tidak boleh negatif")
        if self.pump_prediction is not None and self.pump_prediction not in (0, 1):
            raise ValueError("pump_prediction harus 0 atau 1")


def canonical_payload(payload: ReadingPayload) -> str:
    return json.dumps(
        {
            "air_temperature_c": payload.air_temperature_c,
            "device_id": payload.device_id,
            "humidity_pct": payload.humidity_pct,
            "lettuce_bed_id": payload.lettuce_bed_id,
            "light_lux": payload.light_lux,
            "ph": payload.ph,
            "device_phase": payload.device_phase,
            "pump_prediction": payload.pump_prediction,
            "pump_status": payload.pump_status,
            "recorded_at": payload.recorded_at.astimezone(timezone.utc).replace(microsecond=0).isoformat(),
            "signature": payload.signature,
            "tds_ppm": payload.tds_ppm,
            "temperature_c": payload.temperature_c,
            "water_distance_cm": payload.water_distance_cm,
            "water_level_pct": payload.water_level_pct,
        },
        sort_keys=True,
        separators=(",", ":"),
    )


def make_transaction_id(device_id: str, payload_hash: str, received_at: datetime) -> str:
    seed = f"{device_id}|{payload_hash}|{received_at.isoformat()}"
    return f"txn-{sha256_hex(seed)[:16]}"


def serialize_transaction(item: IngestTransaction) -> dict[str, Any]:
    return {
        "transaction_id": item.transaction_id,
        "device_id": item.device_id,
        "lettuce_bed_id": item.lettuce_bed_id,
        "status": item.status,
        "request_payload": item.request_payload,
        "payload_hash": item.payload_hash,
        "reading_id": item.reading_id,
        "block_index": item.block_index,
        "error_message": item.error_message,
        "created_at": item.created_at.isoformat(),
        "updated_at": item.updated_at.isoformat(),
    }


def serialize_reading(item: SensorReading) -> dict[str, Any]:
    return {
        "id": item.id,
        "transaction_id": item.transaction_id,
        "device_id": item.device_id,
        "lettuce_bed_id": item.lettuce_bed_id,
        "air_temperature_c": item.air_temperature_c,
        "temperature_c": item.temperature_c,
        "humidity_pct": item.humidity_pct,
        "ph": item.ph,
        "tds_ppm": item.tds_ppm,
        "water_distance_cm": item.water_distance_cm,
        "water_level_pct": item.water_level_pct,
        "light_lux": item.light_lux,
        "pump_prediction": item.pump_prediction,
        "pump_status": item.pump_status,
        "device_phase": item.device_phase,
        "recorded_at": item.recorded_at.isoformat(),
        "received_at": item.received_at.isoformat(),
        "signature": item.signature,
        "block_index": item.block.block_index,
        "block_hash": item.block.block_hash,
        "previous_hash": item.block.previous_hash,
        "payload_hash": item.block.payload_hash,
    }


def serialize_block(item: LedgerBlock) -> dict[str, Any]:
    return {
        "block_index": item.block_index,
        "reading_id": item.reading_id,
        "transaction_id": item.reading.transaction_id,
        "device_id": item.reading.device_id,
        "lettuce_bed_id": item.reading.lettuce_bed_id,
        "payload_hash": item.payload_hash,
        "previous_hash": item.previous_hash,
        "block_hash": item.block_hash,
        "created_at": item.created_at.isoformat(),
    }


@transaction.atomic
def ingest_reading(data: dict[str, Any]) -> dict[str, Any]:
    payload = ReadingPayload.from_dict(data)
    canonical = canonical_payload(payload)
    payload_hash = sha256_hex(canonical)
    received_at = utc_now()
    transaction_id = make_transaction_id(payload.device_id, payload_hash, received_at)

    ingest_tx = IngestTransaction.objects.create(
        transaction_id=transaction_id,
        device_id=payload.device_id,
        lettuce_bed_id=payload.lettuce_bed_id,
        status="received",
        request_payload=canonical,
        payload_hash=payload_hash,
        created_at=received_at,
        updated_at=received_at,
    )

    ingest_tx.status = "validated"
    ingest_tx.updated_at = utc_now()
    ingest_tx.save(update_fields=["status", "updated_at"])

    reading = SensorReading.objects.create(
        transaction_id=transaction_id,
        device_id=payload.device_id,
        lettuce_bed_id=payload.lettuce_bed_id,
        air_temperature_c=payload.air_temperature_c,
        temperature_c=payload.temperature_c,
        humidity_pct=payload.humidity_pct,
        ph=payload.ph,
        tds_ppm=payload.tds_ppm,
        water_distance_cm=payload.water_distance_cm,
        water_level_pct=payload.water_level_pct,
        light_lux=payload.light_lux,
        pump_prediction=payload.pump_prediction,
        pump_status=payload.pump_status,
        device_phase=payload.device_phase,
        recorded_at=payload.recorded_at,
        received_at=received_at,
        signature=payload.signature,
    )

    previous_block = LedgerBlock.objects.order_by("-block_index").first()
    block_index = 0 if previous_block is None else previous_block.block_index + 1
    previous_hash = "GENESIS" if previous_block is None else previous_block.block_hash
    block_hash = sha256_hex(f"{block_index}|{reading.id}|{previous_hash}|{payload_hash}|{received_at.isoformat()}")

    block = LedgerBlock.objects.create(
        reading=reading,
        block_index=block_index,
        previous_hash=previous_hash,
        payload_hash=payload_hash,
        block_hash=block_hash,
        created_at=received_at,
    )

    ingest_tx.status = "stored"
    ingest_tx.reading_id = reading.id
    ingest_tx.block_index = block.block_index
    ingest_tx.updated_at = utc_now()
    ingest_tx.save(update_fields=["status", "reading_id", "block_index", "updated_at"])

    return {
        "transaction": serialize_transaction(ingest_tx),
        "reading": serialize_reading(reading),
        "ledger": serialize_block(block),
    }


def verify_chain() -> dict[str, Any]:
    blocks = list(LedgerBlock.objects.select_related("reading").order_by("block_index"))
    expected_previous_hash = "GENESIS"
    for expected_index, block in enumerate(blocks):
        if block.block_index != expected_index:
            return {"valid": False, "reason": f"block_index tidak urut pada blok {block.block_index}"}
        if block.previous_hash != expected_previous_hash:
            return {"valid": False, "reason": f"previous_hash tidak cocok pada blok {block.block_index}"}
        payload = ReadingPayload(
            device_id=block.reading.device_id,
            lettuce_bed_id=block.reading.lettuce_bed_id,
            air_temperature_c=block.reading.air_temperature_c,
            temperature_c=block.reading.temperature_c,
            humidity_pct=block.reading.humidity_pct,
            ph=block.reading.ph,
            tds_ppm=block.reading.tds_ppm,
            water_distance_cm=block.reading.water_distance_cm,
            water_level_pct=block.reading.water_level_pct,
            light_lux=block.reading.light_lux,
            pump_prediction=block.reading.pump_prediction,
            pump_status=block.reading.pump_status,
            device_phase=block.reading.device_phase,
            recorded_at=block.reading.recorded_at,
            signature=block.reading.signature,
        )
        rebuilt_payload_hash = sha256_hex(canonical_payload(payload))
        if rebuilt_payload_hash != block.payload_hash:
            return {"valid": False, "reason": f"payload_hash tidak cocok pada blok {block.block_index}"}
        rebuilt_block_hash = sha256_hex(
            f"{block.block_index}|{block.reading_id}|{block.previous_hash}|{block.payload_hash}|{block.created_at.isoformat()}"
        )
        if rebuilt_block_hash != block.block_hash:
            return {"valid": False, "reason": f"block_hash tidak cocok pada blok {block.block_index}"}
        expected_previous_hash = block.block_hash
    return {"valid": True, "length": len(blocks)}
