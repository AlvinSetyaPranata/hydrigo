import os
import tempfile
import unittest

import app
import deploy_contract
from eth_anchor import AnchorConfigurationError


class HydrigoBackendTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        app.DB_PATH = app.Path(self.temp_dir.name) / "test.db"
        app.initialize_database()

    def tearDown(self) -> None:
        self.temp_dir.cleanup()
        for key in [
            "ETH_RPC_URL",
            "ETH_CHAIN_ID",
            "ETH_PRIVATE_KEY",
            "ETH_WALLET_ADDRESS",
            "ETH_CONTRACT_ADDRESS",
            "ETH_GAS_LIMIT",
            "ETH_DEPLOY_GAS_LIMIT",
        ]:
            os.environ.pop(key, None)

    def test_append_reading_creates_block(self) -> None:
        payload = app.ReadingPayload.from_dict(
            {
                "device_id": "esp32-1",
                "lettuce_bed_id": "bed-1",
                "temperature_c": 24.5,
                "humidity_pct": 70,
                "ph": 6.2,
                "tds_ppm": 900,
                "water_level_pct": 55,
                "light_lux": 13000,
                "recorded_at": "2026-04-19T04:00:00Z",
            }
        )
        canonical = app.canonical_payload(payload)
        payload_hash = app.sha256_hex(canonical)
        received_at = app.utc_now_iso()
        transaction = app.create_ingest_transaction(payload, canonical, payload_hash, received_at)
        result = app.append_reading_to_chain(payload, transaction["transaction_id"])
        app.update_ingest_transaction(
            transaction["transaction_id"],
            "stored",
            reading_id=result["reading_id"],
            block_index=result["block_index"],
        )

        self.assertEqual(result["block_index"], 0)
        self.assertEqual(result["previous_hash"], "GENESIS")
        self.assertTrue(result["block_hash"])
        self.assertTrue(result["transaction_id"].startswith("txn-"))
        persisted = app.fetch_transaction_by_id(transaction["transaction_id"])
        self.assertEqual(persisted["status"], "stored")
        self.assertEqual(persisted["reading_id"], result["reading_id"])
        self.assertEqual(app.verify_chain()["valid"], True)

    def test_chain_detects_data_tampering(self) -> None:
        payload = app.ReadingPayload.from_dict(
            {
                "device_id": "esp32-1",
                "lettuce_bed_id": "bed-1",
                "temperature_c": 24.5,
                "humidity_pct": 70,
                "ph": 6.2,
                "tds_ppm": 900,
                "water_level_pct": 55,
                "light_lux": 13000,
                "recorded_at": "2026-04-19T04:00:00Z",
            }
        )
        canonical = app.canonical_payload(payload)
        payload_hash = app.sha256_hex(canonical)
        transaction = app.create_ingest_transaction(payload, canonical, payload_hash, app.utc_now_iso())
        app.append_reading_to_chain(payload, transaction["transaction_id"])

        with app.get_db_connection() as conn:
            conn.execute("UPDATE sensor_readings SET temperature_c = 99 WHERE id = 1")

        verification = app.verify_chain()
        self.assertEqual(verification["valid"], False)
        self.assertIn("payload_hash", verification["reason"])

    def test_anchor_block_records_metadata(self) -> None:
        payload = app.ReadingPayload.from_dict(
            {
                "device_id": "esp32-1",
                "lettuce_bed_id": "bed-1",
                "temperature_c": 24.5,
                "humidity_pct": 70,
                "ph": 6.2,
                "tds_ppm": 900,
                "water_level_pct": 55,
                "light_lux": 13000,
                "recorded_at": "2026-04-19T04:00:00Z",
            }
        )
        canonical = app.canonical_payload(payload)
        payload_hash = app.sha256_hex(canonical)
        transaction = app.create_ingest_transaction(payload, canonical, payload_hash, app.utc_now_iso())
        app.append_reading_to_chain(payload, transaction["transaction_id"])
        block = app.fetch_latest_block()

        original_anchor = app.anchor_block_record
        original_load = app.load_anchor_settings

        class FakeSettings:
            chain_id = 11155111
            contract_address = "0x1234567890abcdef1234567890abcdef12345678"
            wallet_address = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"

        try:
            app.anchor_block_record = lambda settings, record: "0xtesthash"
            app.load_anchor_settings = lambda: FakeSettings()
            result = app.anchor_block_to_ethereum(block)
        finally:
            app.anchor_block_record = original_anchor
            app.load_anchor_settings = original_load

        self.assertEqual(result["tx_hash"], "0xtesthash")
        self.assertEqual(result["block_index"], 0)
        self.assertEqual(len(app.fetch_onchain_anchors(10)), 1)

    def test_anchor_requires_configuration(self) -> None:
        payload = app.ReadingPayload.from_dict(
            {
                "device_id": "esp32-1",
                "lettuce_bed_id": "bed-1",
                "temperature_c": 24.5,
                "humidity_pct": 70,
                "ph": 6.2,
                "tds_ppm": 900,
                "water_level_pct": 55,
                "light_lux": 13000,
                "recorded_at": "2026-04-19T04:00:00Z",
            }
        )
        canonical = app.canonical_payload(payload)
        payload_hash = app.sha256_hex(canonical)
        transaction = app.create_ingest_transaction(payload, canonical, payload_hash, app.utc_now_iso())
        app.append_reading_to_chain(payload, transaction["transaction_id"])
        block = app.fetch_latest_block()

        original_load = app.load_anchor_settings
        try:
            app.load_anchor_settings = lambda: (_ for _ in ()).throw(AnchorConfigurationError("missing"))
            with self.assertRaises(AnchorConfigurationError):
                app.anchor_block_to_ethereum(block)
        finally:
            app.load_anchor_settings = original_load

    def test_deploy_settings_uses_private_key_address_by_default(self) -> None:
        os.environ["ETH_RPC_URL"] = "https://rpc.example"
        os.environ["ETH_PRIVATE_KEY"] = "0x59c6995e998f97a5a0044966f0945382d7b0a0f0c7d4f3b8e6d3db0d2ad8b8a7"
        os.environ["ETH_CHAIN_ID"] = "11155111"

        settings = deploy_contract.load_deploy_settings()

        self.assertEqual(settings["rpc_url"], "https://rpc.example")
        self.assertEqual(settings["chain_id"], 11155111)
        self.assertTrue(settings["wallet_address"].startswith("0x"))

    def test_deploy_settings_requires_rpc(self) -> None:
        os.environ["ETH_PRIVATE_KEY"] = "0x59c6995e998f97a5a0044966f0945382d7b0a0f0c7d4f3b8e6d3db0d2ad8b8a7"
        with self.assertRaises(deploy_contract.DeployConfigurationError):
            deploy_contract.load_deploy_settings()

    def test_fetch_transactions_returns_ingest_history(self) -> None:
        payload = app.ReadingPayload.from_dict(
            {
                "device_id": "esp32-2",
                "lettuce_bed_id": "bed-2",
                "temperature_c": 23.1,
                "humidity_pct": 72,
                "ph": 6.1,
                "tds_ppm": 850,
                "water_level_pct": 60,
                "light_lux": 12000,
                "recorded_at": "2026-04-19T04:10:00Z",
            }
        )
        canonical = app.canonical_payload(payload)
        payload_hash = app.sha256_hex(canonical)
        tx = app.create_ingest_transaction(payload, canonical, payload_hash, app.utc_now_iso())

        rows = app.fetch_transactions(10)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["transaction_id"], tx["transaction_id"])
        self.assertEqual(rows[0]["status"], "received")


if __name__ == "__main__":
    unittest.main()
