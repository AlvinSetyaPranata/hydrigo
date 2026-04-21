import json

from django.test import Client, TestCase

from .models import IngestTransaction, SensorReading
from .services import verify_chain


class IoTIngestTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.payload = {
            "device_id": "esp32-selada-01",
            "lettuce_bed_id": "bed-a1",
            "temperature_c": 24.6,
            "humidity_pct": 77.2,
            "ph": 6.4,
            "tds_ppm": 812,
            "water_level_pct": 68,
            "light_lux": 14200,
            "recorded_at": "2026-04-19T04:00:00Z",
        }

    def test_ingest_creates_transaction_reading_and_block(self):
        response = self.client.post(
            "/api/v1/iot/readings",
            data=json.dumps(self.payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["transaction"]["status"], "stored")
        self.assertTrue(body["transaction"]["transaction_id"].startswith("txn-"))
        self.assertEqual(IngestTransaction.objects.count(), 1)
        self.assertEqual(SensorReading.objects.count(), 1)
        self.assertEqual(verify_chain()["valid"], True)

    def test_transactions_endpoint_returns_history(self):
        self.client.post("/api/v1/iot/readings", data=json.dumps(self.payload), content_type="application/json")
        response = self.client.get("/api/v1/transactions?limit=10")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["data"]), 1)

    def test_invalid_payload_returns_400(self):
        bad_payload = dict(self.payload)
        bad_payload["ph"] = 99
        response = self.client.post(
            "/api/v1/iot/readings",
            data=json.dumps(bad_payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(IngestTransaction.objects.count(), 0)
