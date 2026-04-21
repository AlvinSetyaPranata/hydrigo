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


@dataclass
class ReadingPayload:
    device_id: str
    lettuce_bed_id: str
    temperature_c: float
    humidity_pct: float
    ph: float
    tds_ppm: float
    water_level_pct: float
    light_lux: float
    recorded_at: datetime
    signature: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ReadingPayload":
        required_fields = [
            "device_id",
            "lettuce_bed_id",
            "temperature_c",
            "humidity_pct",
            "ph",
            "tds_ppm",
            "water_level_pct",
            "light_lux",
        ]
        missing = [field for field in required_fields if field not in data]
        if missing:
            raise ValueError(f"Field wajib belum ada: {', '.join(missing)}")

        try:
            payload = cls(
                device_id=str(data["device_id"]).strip(),
                lettuce_bed_id=str(data["lettuce_bed_id"]).strip(),
                temperature_c=float(data["temperature_c"]),
                humidity_pct=float(data["humidity_pct"]),
                ph=float(data["ph"]),
                tds_ppm=float(data["tds_ppm"]),
                water_level_pct=float(data["water_level_pct"]),
                light_lux=float(data["light_lux"]),
                recorded_at=parse_iso_timestamp(data.get("recorded_at") or utc_now().isoformat()),
                signature=None if data.get("signature") is None else str(data["signature"]),
            )
        except (TypeError, ValueError) as exc:
            if str(exc) == "recorded_at harus format ISO-8601":
                raise
            raise ValueError("field numerik harus berupa angka yang valid") from exc

        payload.validate()
        return payload

    def validate(self) -> None:
        if not self.device_id:
            raise ValueError("device_id tidak boleh kosong")
        if not self.lettuce_bed_id:
            raise ValueError("lettuce_bed_id tidak boleh kosong")
        if not (-10 <= self.temperature_c <= 60):
            raise ValueError("temperature_c di luar rentang yang masuk akal")
        if not (0 <= self.humidity_pct <= 100):
            raise ValueError("humidity_pct harus 0-100")
        if not (0 <= self.ph <= 14):
            raise ValueError("ph harus 0-14")
        if not (0 <= self.tds_ppm <= 5000):
            raise ValueError("tds_ppm di luar rentang yang diizinkan")
        if not (0 <= self.water_level_pct <= 100):
            raise ValueError("water_level_pct harus 0-100")
        if self.light_lux < 0:
            raise ValueError("light_lux tidak boleh negatif")


def canonical_payload(payload: ReadingPayload) -> str:
    return json.dumps(
        {
            "device_id": payload.device_id,
            "humidity_pct": payload.humidity_pct,
            "lettuce_bed_id": payload.lettuce_bed_id,
            "light_lux": payload.light_lux,
            "ph": payload.ph,
            "recorded_at": payload.recorded_at.astimezone(timezone.utc).replace(microsecond=0).isoformat(),
            "signature": payload.signature,
            "tds_ppm": payload.tds_ppm,
            "temperature_c": payload.temperature_c,
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
        "temperature_c": item.temperature_c,
        "humidity_pct": item.humidity_pct,
        "ph": item.ph,
        "tds_ppm": item.tds_ppm,
        "water_level_pct": item.water_level_pct,
        "light_lux": item.light_lux,
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
        temperature_c=payload.temperature_c,
        humidity_pct=payload.humidity_pct,
        ph=payload.ph,
        tds_ppm=payload.tds_ppm,
        water_level_pct=payload.water_level_pct,
        light_lux=payload.light_lux,
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
            temperature_c=block.reading.temperature_c,
            humidity_pct=block.reading.humidity_pct,
            ph=block.reading.ph,
            tds_ppm=block.reading.tds_ppm,
            water_level_pct=block.reading.water_level_pct,
            light_lux=block.reading.light_lux,
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
