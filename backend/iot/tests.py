import json

from django.test import Client, TestCase

from .models import ControlMode, IngestTransaction, ManualControl, SensorReading
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

    def test_ingest_accepts_esp32_field_names(self):
        esp32_payload = {
            "device_id": "esp32-selada-01",
            "bed_id": "bed-a1",
            "suhu": 30.4,
            "suhuAir": 23.9,
            "kelembapan": 79.5,
            "phValue": 6.3,
            "tdsValue": 845.2,
            "jarak": 7.0,
            "water_level_max_distance_cm": 35.0,
            "recorded_at": "2026-04-19T04:00:00Z",
            "pompaStatus": True,
            "prediksiRelay": 1,
        }

        response = self.client.post(
            "/api/v1/iot/readings",
            data=json.dumps(esp32_payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["reading"]["temperature_c"], 23.9)
        self.assertEqual(body["reading"]["humidity_pct"], 79.5)
        self.assertEqual(body["reading"]["ph"], 6.3)
        self.assertEqual(body["reading"]["tds_ppm"], 845.2)
        self.assertEqual(body["reading"]["air_temperature_c"], 30.4)
        self.assertEqual(body["reading"]["water_distance_cm"], 7.0)
        self.assertEqual(body["reading"]["light_lux"], 0.0)
        self.assertEqual(body["reading"]["water_level_pct"], 80.0)
        self.assertEqual(body["reading"]["pump_prediction"], 1)
        self.assertEqual(body["reading"]["pump_status"], True)
        self.assertIn("\"pump_status\":true", body["transaction"]["request_payload"])
        self.assertIn("\"water_distance_cm\":7.0", body["transaction"]["request_payload"])

    def test_manual_controls_endpoint_returns_default_pump_control(self):
        response = self.client.get("/api/v1/controls/manual")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["data"]), 1)
        self.assertEqual(body["data"][0]["id"], "water-pump")
        self.assertEqual(body["data"][0]["name"], "Pompa Air")
        self.assertEqual(ManualControl.objects.count(), 1)

    def test_manual_controls_endpoint_updates_pump_status(self):
        self.client.get("/api/v1/controls/manual")

        response = self.client.post(
            "/api/v1/controls/manual",
            data=json.dumps({"controlId": "water-pump", "status": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["data"][0]["status"], True)
        self.assertEqual(ManualControl.objects.get(control_id="water-pump").status, True)

    def test_control_mode_endpoint_returns_default_mode(self):
        response = self.client.get("/api/v1/controls/mode")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["mode"], "automatic")
        self.assertEqual(body["selectedMode"], "automatic")
        self.assertEqual(body["controlMode"], 0)
        self.assertEqual(ControlMode.objects.count(), 1)

    def test_control_mode_endpoint_updates_mode(self):
        response = self.client.post(
            "/api/v1/controls/mode",
            data=json.dumps({"mode": "manual"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["mode"], "manual")
        self.assertEqual(body["controlMode"], 1)
        self.assertEqual(ControlMode.objects.first().mode, "manual")

    def test_ingest_syncs_manual_override_back_to_automatic(self):
        self.client.post(
            "/api/v1/controls/manual",
            data=json.dumps({"controlId": "water-pump", "status": True}),
            content_type="application/json",
        )
        self.client.post(
            "/api/v1/controls/mode",
            data=json.dumps({"mode": "manual"}),
            content_type="application/json",
        )

        payload = {
            **self.payload,
            "controlMode": 0,
            "mode": "AUTO",
            "manualPumpCommand": False,
            "pump_status": False,
        }
        response = self.client.post(
            "/api/v1/iot/readings",
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(ControlMode.objects.first().mode, "automatic")
        self.assertEqual(ManualControl.objects.get(control_id="water-pump").status, False)
