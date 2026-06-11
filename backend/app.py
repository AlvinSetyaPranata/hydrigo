from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from html import escape
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from eth_anchor import (
    AnchorConfigurationError,
    AnchorExecutionError,
    anchor_block_record,
    load_anchor_settings,
)


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "hydrigo.db"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def html_attachment_response(
    handler: BaseHTTPRequestHandler,
    status: int,
    body: str,
    filename: str,
    content_type: str = "application/vnd.ms-excel; charset=utf-8",
) -> None:
    encoded = body.encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Disposition", f'attachment; filename="{filename}"')
    handler.send_header("Content-Length", str(len(encoded)))
    handler.end_headers()
    handler.wfile.write(encoded)


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_database() -> None:
    with get_db_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS sensor_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id TEXT NOT NULL UNIQUE,
                device_id TEXT NOT NULL,
                lettuce_bed_id TEXT NOT NULL,
                temperature_c REAL NOT NULL,
                humidity_pct REAL NOT NULL,
                ph REAL NOT NULL,
                tds_ppm REAL NOT NULL,
                water_level_pct REAL NOT NULL,
                light_lux REAL NOT NULL,
                recorded_at TEXT NOT NULL,
                received_at TEXT NOT NULL,
                signature TEXT
            );

            CREATE TABLE IF NOT EXISTS blocks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reading_id INTEGER NOT NULL UNIQUE,
                block_index INTEGER NOT NULL UNIQUE,
                previous_hash TEXT NOT NULL,
                payload_hash TEXT NOT NULL,
                block_hash TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                FOREIGN KEY(reading_id) REFERENCES sensor_readings(id)
            );

            CREATE TABLE IF NOT EXISTS onchain_anchors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                block_index INTEGER NOT NULL UNIQUE,
                reading_id INTEGER NOT NULL,
                tx_hash TEXT NOT NULL UNIQUE,
                chain_id INTEGER NOT NULL,
                contract_address TEXT NOT NULL,
                wallet_address TEXT NOT NULL,
                status TEXT NOT NULL,
                anchored_at TEXT NOT NULL,
                FOREIGN KEY(reading_id) REFERENCES sensor_readings(id)
            );

            CREATE TABLE IF NOT EXISTS ingest_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id TEXT NOT NULL UNIQUE,
                device_id TEXT NOT NULL,
                lettuce_bed_id TEXT NOT NULL,
                status TEXT NOT NULL,
                request_payload TEXT NOT NULL,
                payload_hash TEXT NOT NULL,
                reading_id INTEGER,
                block_index INTEGER,
                error_message TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(reading_id) REFERENCES sensor_readings(id)
            );
            """
        )


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
    recorded_at: str
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

        recorded_at = data.get("recorded_at") or utc_now_iso()
        validate_timestamp(recorded_at)

        payload = cls(
            device_id=str(data["device_id"]).strip(),
            lettuce_bed_id=str(data["lettuce_bed_id"]).strip(),
            temperature_c=to_float(data["temperature_c"], "temperature_c"),
            humidity_pct=to_float(data["humidity_pct"], "humidity_pct"),
            ph=to_float(data["ph"], "ph"),
            tds_ppm=to_float(data["tds_ppm"], "tds_ppm"),
            water_level_pct=to_float(data["water_level_pct"], "water_level_pct"),
            light_lux=to_float(data["light_lux"], "light_lux"),
            recorded_at=recorded_at,
            signature=None if data.get("signature") is None else str(data["signature"]),
        )
        payload.validate_ranges()
        return payload

    def validate_ranges(self) -> None:
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


def to_float(value: Any, field_name: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} harus angka") from exc


def validate_timestamp(value: str) -> None:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("recorded_at harus format ISO-8601") from exc


def canonical_payload(payload: ReadingPayload) -> str:
    return json.dumps(
        {
            "device_id": payload.device_id,
            "humidity_pct": payload.humidity_pct,
            "lettuce_bed_id": payload.lettuce_bed_id,
            "light_lux": payload.light_lux,
            "ph": payload.ph,
            "recorded_at": payload.recorded_at,
            "signature": payload.signature,
            "tds_ppm": payload.tds_ppm,
            "temperature_c": payload.temperature_c,
            "water_level_pct": payload.water_level_pct,
        },
        sort_keys=True,
        separators=(",", ":"),
    )


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def make_transaction_id(device_id: str, payload_hash: str, received_at: str) -> str:
    seed = f"{device_id}|{payload_hash}|{received_at}"
    return f"txn-{sha256_hex(seed)[:16]}"


def create_ingest_transaction(
    payload: ReadingPayload,
    canonical: str,
    payload_hash: str,
    received_at: str,
) -> dict[str, Any]:
    transaction_id = make_transaction_id(payload.device_id, payload_hash, received_at)
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO ingest_transactions (
                transaction_id, device_id, lettuce_bed_id, status, request_payload,
                payload_hash, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                transaction_id,
                payload.device_id,
                payload.lettuce_bed_id,
                "received",
                canonical,
                payload_hash,
                received_at,
                received_at,
            ),
        )
    return {
        "transaction_id": transaction_id,
        "status": "received",
        "payload_hash": payload_hash,
        "created_at": received_at,
        "updated_at": received_at,
    }


def update_ingest_transaction(
    transaction_id: str,
    status: str,
    reading_id: int | None = None,
    block_index: int | None = None,
    error_message: str | None = None,
) -> None:
    updated_at = utc_now_iso()
    with get_db_connection() as conn:
        conn.execute(
            """
            UPDATE ingest_transactions
            SET status = ?,
                reading_id = COALESCE(?, reading_id),
                block_index = COALESCE(?, block_index),
                error_message = ?,
                updated_at = ?
            WHERE transaction_id = ?
            """,
            (status, reading_id, block_index, error_message, updated_at, transaction_id),
        )


def append_reading_to_chain(payload: ReadingPayload, transaction_id: str) -> dict[str, Any]:
    received_at = utc_now_iso()
    canonical = canonical_payload(payload)
    payload_hash = sha256_hex(canonical)

    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO sensor_readings (
                transaction_id, device_id, lettuce_bed_id, temperature_c, humidity_pct, ph,
                tds_ppm, water_level_pct, light_lux, recorded_at, received_at, signature
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                transaction_id,
                payload.device_id,
                payload.lettuce_bed_id,
                payload.temperature_c,
                payload.humidity_pct,
                payload.ph,
                payload.tds_ppm,
                payload.water_level_pct,
                payload.light_lux,
                payload.recorded_at,
                received_at,
                payload.signature,
            ),
        )
        reading_id = cursor.lastrowid

        previous = conn.execute(
            "SELECT block_index, block_hash FROM blocks ORDER BY block_index DESC LIMIT 1"
        ).fetchone()
        block_index = 0 if previous is None else previous["block_index"] + 1
        previous_hash = "GENESIS" if previous is None else previous["block_hash"]
        block_hash = sha256_hex(f"{block_index}|{reading_id}|{previous_hash}|{payload_hash}|{received_at}")

        conn.execute(
            """
            INSERT INTO blocks (
                reading_id, block_index, previous_hash, payload_hash, block_hash, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (reading_id, block_index, previous_hash, payload_hash, block_hash, received_at),
        )

    return {
        "transaction_id": transaction_id,
        "reading_id": reading_id,
        "block_index": block_index,
        "payload_hash": payload_hash,
        "block_hash": block_hash,
        "previous_hash": previous_hash,
        "received_at": received_at,
    }


def fetch_recent_readings(limit: int) -> list[dict[str, Any]]:
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                sr.id,
                sr.transaction_id,
                sr.device_id,
                sr.lettuce_bed_id,
                sr.temperature_c,
                sr.humidity_pct,
                sr.ph,
                sr.tds_ppm,
                sr.water_level_pct,
                sr.light_lux,
                sr.recorded_at,
                sr.signature,
                sr.received_at,
                b.block_index,
                b.block_hash,
                b.previous_hash,
                b.payload_hash
            FROM sensor_readings sr
            JOIN blocks b ON b.reading_id = sr.id
            ORDER BY sr.id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def fetch_all_readings() -> list[dict[str, Any]]:
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                sr.id,
                sr.transaction_id,
                sr.device_id,
                sr.lettuce_bed_id,
                sr.temperature_c,
                sr.humidity_pct,
                sr.ph,
                sr.tds_ppm,
                sr.water_level_pct,
                sr.light_lux,
                sr.recorded_at,
                sr.received_at,
                sr.signature,
                b.block_index,
                b.previous_hash,
                b.payload_hash,
                b.block_hash
            FROM sensor_readings sr
            LEFT JOIN blocks b ON b.reading_id = sr.id
            ORDER BY sr.recorded_at DESC, sr.id DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def build_excel_html(title: str, columns: list[str], rows: list[list[object]]) -> str:
    head_cells = "".join(f"<th>{escape(column)}</th>" for column in columns)
    body_rows = []

    for row in rows:
        cells = "".join(f"<td>{escape('' if value is None else str(value))}</td>" for value in row)
        body_rows.append(f"<tr>{cells}</tr>")

    return f"""<!DOCTYPE html>
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


def fetch_chain() -> list[dict[str, Any]]:
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                b.block_index,
                b.previous_hash,
                b.payload_hash,
                b.block_hash,
                b.created_at,
                sr.id AS reading_id,
                sr.transaction_id,
                sr.device_id,
                sr.lettuce_bed_id,
                sr.temperature_c,
                sr.humidity_pct,
                sr.ph,
                sr.tds_ppm,
                sr.water_level_pct,
                sr.light_lux,
                sr.recorded_at,
                sr.signature
            FROM blocks b
            JOIN sensor_readings sr ON sr.id = b.reading_id
            ORDER BY b.block_index ASC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def fetch_block_by_index(block_index: int) -> dict[str, Any] | None:
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT
                b.block_index,
                b.previous_hash,
                b.payload_hash,
                b.block_hash,
                b.created_at,
                sr.id AS reading_id,
                sr.transaction_id,
                sr.device_id,
                sr.lettuce_bed_id,
                sr.temperature_c,
                sr.humidity_pct,
                sr.ph,
                sr.tds_ppm,
                sr.water_level_pct,
                sr.light_lux,
                sr.recorded_at,
                sr.signature
            FROM blocks b
            JOIN sensor_readings sr ON sr.id = b.reading_id
            WHERE b.block_index = ?
            """,
            (block_index,),
        ).fetchone()
    return None if row is None else dict(row)


def fetch_latest_block() -> dict[str, Any] | None:
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT
                b.block_index,
                b.previous_hash,
                b.payload_hash,
                b.block_hash,
                b.created_at,
                sr.id AS reading_id,
                sr.transaction_id,
                sr.device_id,
                sr.lettuce_bed_id,
                sr.temperature_c,
                sr.humidity_pct,
                sr.ph,
                sr.tds_ppm,
                sr.water_level_pct,
                sr.light_lux,
                sr.recorded_at,
                sr.signature
            FROM blocks b
            JOIN sensor_readings sr ON sr.id = b.reading_id
            ORDER BY b.block_index DESC
            LIMIT 1
            """
        ).fetchone()
    return None if row is None else dict(row)


def record_onchain_anchor(
    block_index: int,
    reading_id: int,
    tx_hash: str,
    chain_id: int,
    contract_address: str,
    wallet_address: str,
    status: str,
) -> dict[str, Any]:
    anchored_at = utc_now_iso()
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO onchain_anchors (
                block_index, reading_id, tx_hash, chain_id, contract_address,
                wallet_address, status, anchored_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(block_index) DO UPDATE SET
                tx_hash=excluded.tx_hash,
                chain_id=excluded.chain_id,
                contract_address=excluded.contract_address,
                wallet_address=excluded.wallet_address,
                status=excluded.status,
                anchored_at=excluded.anchored_at
            """,
            (
                block_index,
                reading_id,
                tx_hash,
                chain_id,
                contract_address,
                wallet_address,
                status,
                anchored_at,
            ),
        )
    return {
        "block_index": block_index,
        "reading_id": reading_id,
        "tx_hash": tx_hash,
        "chain_id": chain_id,
        "contract_address": contract_address,
        "wallet_address": wallet_address,
        "status": status,
        "anchored_at": anchored_at,
    }


def fetch_onchain_anchors(limit: int) -> list[dict[str, Any]]:
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                oa.id,
                oa.block_index,
                oa.reading_id,
                oa.tx_hash,
                oa.chain_id,
                oa.contract_address,
                oa.wallet_address,
                oa.status,
                oa.anchored_at
            FROM onchain_anchors oa
            ORDER BY oa.id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def fetch_transactions(limit: int) -> list[dict[str, Any]]:
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                transaction_id,
                device_id,
                lettuce_bed_id,
                status,
                payload_hash,
                reading_id,
                block_index,
                error_message,
                created_at,
                updated_at
            FROM ingest_transactions
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def fetch_transaction_by_id(transaction_id: str) -> dict[str, Any] | None:
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT
                transaction_id,
                device_id,
                lettuce_bed_id,
                status,
                request_payload,
                payload_hash,
                reading_id,
                block_index,
                error_message,
                created_at,
                updated_at
            FROM ingest_transactions
            WHERE transaction_id = ?
            """,
            (transaction_id,),
        ).fetchone()
    return None if row is None else dict(row)


def verify_chain() -> dict[str, Any]:
    chain = fetch_chain()
    expected_previous_hash = "GENESIS"

    for expected_index, block in enumerate(chain):
        if block["block_index"] != expected_index:
            return {"valid": False, "reason": f"block_index tidak urut pada blok {block['block_index']}"}
        if block["previous_hash"] != expected_previous_hash:
            return {"valid": False, "reason": f"previous_hash tidak cocok pada blok {block['block_index']}"}

        payload = ReadingPayload(
            device_id=block["device_id"],
            lettuce_bed_id=block["lettuce_bed_id"],
            temperature_c=block["temperature_c"],
            humidity_pct=block["humidity_pct"],
            ph=block["ph"],
            tds_ppm=block["tds_ppm"],
            water_level_pct=block["water_level_pct"],
            light_lux=block["light_lux"],
            recorded_at=block["recorded_at"],
            signature=block["signature"],
        )
        payload_hash = sha256_hex(canonical_payload(payload))
        if payload_hash != block["payload_hash"]:
            return {"valid": False, "reason": f"payload_hash tidak cocok pada blok {block['block_index']}"}

        rebuilt_hash = sha256_hex(
            f"{block['block_index']}|{block['reading_id']}|{block['previous_hash']}|{block['payload_hash']}|{block['created_at']}"
        )
        if rebuilt_hash != block["block_hash"]:
            return {"valid": False, "reason": f"block_hash tidak cocok pada blok {block['block_index']}"}

        expected_previous_hash = block["block_hash"]

    return {"valid": True, "length": len(chain)}


def anchor_block_to_ethereum(block: dict[str, Any]) -> dict[str, Any]:
    settings = load_anchor_settings()
    tx_hash = anchor_block_record(settings, block)
    return record_onchain_anchor(
        block_index=block["block_index"],
        reading_id=block["reading_id"],
        tx_hash=tx_hash,
        chain_id=settings.chain_id,
        contract_address=settings.contract_address,
        wallet_address=settings.wallet_address,
        status="confirmed",
    )


class HydrigoHandler(BaseHTTPRequestHandler):
    server_version = "HydrigoBackend/0.1"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)

        if parsed.path == "/health":
            json_response(self, HTTPStatus.OK, {"status": "ok", "timestamp": utc_now_iso()})
            return

        if parsed.path == "/api/v1/readings":
            params = parse_qs(parsed.query)
            try:
                limit = int(params.get("limit", ["20"])[0])
            except ValueError:
                json_response(self, HTTPStatus.BAD_REQUEST, {"error": "limit harus integer"})
                return
            limit = max(1, min(limit, 100))
            json_response(self, HTTPStatus.OK, {"data": fetch_recent_readings(limit), "limit": limit})
            return

        if parsed.path == "/api/v1/readings/export.xls":
            columns = [
                "reading_id",
                "transaction_id",
                "device_id",
                "lettuce_bed_id",
                "temperature_c",
                "humidity_pct",
                "ph",
                "tds_ppm",
                "water_level_pct",
                "light_lux",
                "recorded_at",
                "received_at",
                "signature",
                "block_index",
                "block_hash",
                "previous_hash",
                "payload_hash",
            ]
            readings = fetch_all_readings()
            rows = [
                [
                    item["id"],
                    item["transaction_id"],
                    item["device_id"],
                    item["lettuce_bed_id"],
                    item["temperature_c"],
                    item["humidity_pct"],
                    item["ph"],
                    item["tds_ppm"],
                    item["water_level_pct"],
                    item["light_lux"],
                    item["recorded_at"],
                    item["received_at"],
                    item["signature"],
                    item["block_index"],
                    item["block_hash"],
                    item["previous_hash"],
                    item["payload_hash"],
                ]
                for item in readings
            ]
            html_attachment_response(
                self,
                HTTPStatus.OK,
                build_excel_html("Hydrigo Dataset", columns, rows),
                "hydrigo-dataset.xls",
            )
            return

        if parsed.path == "/api/v1/blockchain/chain":
            json_response(self, HTTPStatus.OK, {"data": fetch_chain(), "verification": verify_chain()})
            return

        if parsed.path == "/api/v1/blockchain/anchors":
            params = parse_qs(parsed.query)
            try:
                limit = int(params.get("limit", ["20"])[0])
            except ValueError:
                json_response(self, HTTPStatus.BAD_REQUEST, {"error": "limit harus integer"})
                return
            limit = max(1, min(limit, 100))
            json_response(self, HTTPStatus.OK, {"data": fetch_onchain_anchors(limit), "limit": limit})
            return

        if parsed.path == "/api/v1/transactions":
            params = parse_qs(parsed.query)
            try:
                limit = int(params.get("limit", ["20"])[0])
            except ValueError:
                json_response(self, HTTPStatus.BAD_REQUEST, {"error": "limit harus integer"})
                return
            limit = max(1, min(limit, 100))
            json_response(self, HTTPStatus.OK, {"data": fetch_transactions(limit), "limit": limit})
            return

        if parsed.path.startswith("/api/v1/transactions/"):
            transaction_id = parsed.path.rsplit("/", 1)[-1]
            transaction = fetch_transaction_by_id(transaction_id)
            if transaction is None:
                json_response(self, HTTPStatus.NOT_FOUND, {"error": "transaksi tidak ditemukan"})
                return
            json_response(self, HTTPStatus.OK, {"data": transaction})
            return

        json_response(self, HTTPStatus.NOT_FOUND, {"error": "route tidak ditemukan"})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/api/v1/iot/readings":
            if parsed.path == "/api/v1/blockchain/anchor/latest":
                block = fetch_latest_block()
                if block is None:
                    json_response(self, HTTPStatus.BAD_REQUEST, {"error": "belum ada block untuk di-anchor"})
                    return

                try:
                    anchor_result = anchor_block_to_ethereum(block)
                except AnchorConfigurationError as exc:
                    json_response(self, HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                    return
                except AnchorExecutionError as exc:
                    json_response(self, HTTPStatus.BAD_GATEWAY, {"error": str(exc)})
                    return

                json_response(
                    self,
                    HTTPStatus.CREATED,
                    {
                        "message": "block terbaru berhasil di-anchor ke Ethereum",
                        "anchor": anchor_result,
                        "block": block,
                    },
                )
                return

            if parsed.path.startswith("/api/v1/blockchain/anchor/"):
                try:
                    block_index = int(parsed.path.rsplit("/", 1)[-1])
                except ValueError:
                    json_response(self, HTTPStatus.BAD_REQUEST, {"error": "block index tidak valid"})
                    return

                block = fetch_block_by_index(block_index)
                if block is None:
                    json_response(self, HTTPStatus.NOT_FOUND, {"error": "block tidak ditemukan"})
                    return

                try:
                    anchor_result = anchor_block_to_ethereum(block)
                except AnchorConfigurationError as exc:
                    json_response(self, HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                    return
                except AnchorExecutionError as exc:
                    json_response(self, HTTPStatus.BAD_GATEWAY, {"error": str(exc)})
                    return

                json_response(
                    self,
                    HTTPStatus.CREATED,
                    {
                        "message": "block berhasil di-anchor ke Ethereum",
                        "anchor": anchor_result,
                        "block": block,
                    },
                )
                return

            json_response(self, HTTPStatus.NOT_FOUND, {"error": "route tidak ditemukan"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "Content-Length tidak valid"})
            return

        if content_length <= 0:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "body wajib diisi"})
            return

        raw_body = self.rfile.read(content_length)
        try:
            body = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "body harus JSON valid"})
            return

        try:
            payload = ReadingPayload.from_dict(body)
        except ValueError as exc:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return

        canonical = canonical_payload(payload)
        payload_hash = sha256_hex(canonical)
        received_at = utc_now_iso()
        transaction = create_ingest_transaction(payload, canonical, payload_hash, received_at)

        try:
            update_ingest_transaction(transaction["transaction_id"], "validated")
            result = append_reading_to_chain(payload, transaction["transaction_id"])
            update_ingest_transaction(
                transaction["transaction_id"],
                "stored",
                reading_id=result["reading_id"],
                block_index=result["block_index"],
            )
        except Exception as exc:
            update_ingest_transaction(transaction["transaction_id"], "failed", error_message=str(exc))
            json_response(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {
                    "error": "gagal menyimpan transaksi ingest",
                    "transaction_id": transaction["transaction_id"],
                },
            )
            return

        json_response(
            self,
            HTTPStatus.CREATED,
            {
                "message": "transaksi ingest berhasil disimpan",
                "transaction": fetch_transaction_by_id(transaction["transaction_id"]),
                "reading": body,
                "ledger": result,
            },
        )

    def log_message(self, format: str, *args: Any) -> None:
        return


def run() -> None:
    initialize_database()
    host = os.environ.get("HYDRIGO_HOST", "127.0.0.1")
    port = int(os.environ.get("HYDRIGO_PORT", "8000"))
    server = ThreadingHTTPServer((host, port), HydrigoHandler)
    print(f"Hydrigo backend berjalan di http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
