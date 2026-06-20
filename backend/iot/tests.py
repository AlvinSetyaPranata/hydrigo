import json
from datetime import timezone as dt_timezone
from io import BytesIO
from zipfile import ZipFile

from django.test import Client, TestCase
from django.utils import timezone

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
        self.assertEqual(body["pompaNutrisi"], False)
        self.assertEqual(body["pompaAir"], False)
        self.assertEqual(ManualControl.objects.count(), 2)

    def test_manual_controls_endpoint_updates_pump_status(self):
        self.client.get("/api/v1/controls/manual")

        response = self.client.post(
            "/api/v1/controls/manual",
            data=json.dumps({"pompaAir": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["pompaAir"], True)
        self.assertEqual(body["pompaNutrisi"], False)
        self.assertEqual(ManualControl.objects.get(control_id="water-pump").status, True)

    def test_manual_controls_endpoint_updates_nutrient_pump_status(self):
        self.client.get("/api/v1/controls/manual")

        response = self.client.post(
            "/api/v1/controls/manual",
            data=json.dumps({"pompaNutrisi": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["pompaNutrisi"], True)
        self.assertEqual(ManualControl.objects.get(control_id="nutrient-pump").status, True)

    def test_manual_controls_endpoint_updates_both_pumps_status(self):
        self.client.get("/api/v1/controls/manual")

        response = self.client.post(
            "/api/v1/controls/manual",
            data=json.dumps({"pompaNutrisi": True, "pompaAir": False}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["pompaNutrisi"], True)
        self.assertEqual(body["pompaAir"], False)

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

    def test_ingest_does_not_turn_off_manual_toggle_while_mode_is_manual(self):
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
            "controlMode": 1,
            "mode": "manual",
            "manualPumpCommand": False,
            "pump_status": False,
        }
        response = self.client.post(
            "/api/v1/iot/readings",
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(ControlMode.objects.first().mode, "manual")
        self.assertEqual(ManualControl.objects.get(control_id="water-pump").status, True)

    def test_export_excel_filters_by_date_range(self):
        SensorReading.objects.create(
            transaction_id="txn-old",
            device_id="esp32-selada-01",
            lettuce_bed_id="bed-a1",
            temperature_c=21.5,
            air_temperature_c=29.0,
            humidity_pct=70.0,
            ph=6.1,
            tds_ppm=780.0,
            water_level_pct=60.0,
            pump_prediction=0,
            pump_status=False,
            light_lux=0.0,
            recorded_at=timezone.datetime(2026, 4, 18, 9, 0, tzinfo=dt_timezone.utc),
            received_at=timezone.datetime(2026, 4, 18, 9, 0, tzinfo=dt_timezone.utc),
        )
        SensorReading.objects.create(
            transaction_id="txn-in-range",
            device_id="esp32-selada-01",
            lettuce_bed_id="bed-a1",
            temperature_c=22.2,
            air_temperature_c=29.5,
            humidity_pct=71.0,
            ph=6.3,
            tds_ppm=800.0,
            water_level_pct=62.0,
            pump_prediction=1,
            pump_status=True,
            light_lux=0.0,
            recorded_at=timezone.datetime(2026, 4, 19, 10, 0, tzinfo=dt_timezone.utc),
            received_at=timezone.datetime(2026, 4, 19, 10, 0, tzinfo=dt_timezone.utc),
        )

        response = self.client.get("/api/v1/readings/export.xls?start_date=2026-04-19&end_date=2026-04-19")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        workbook = ZipFile(BytesIO(response.content))
        sheet_xml = workbook.read("xl/worksheets/sheet1.xml")
        self.assertIn(b"2026-04-19T10:00:00+00:00", sheet_xml)
        self.assertNotIn(b"2026-04-18T09:00:00+00:00", sheet_xml)

    def test_export_excel_rejects_invalid_date_range(self):
        response = self.client.get("/api/v1/readings/export.xls?start_date=2026-04-20&end_date=2026-04-19")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "start_date tidak boleh lebih besar dari end_date")
