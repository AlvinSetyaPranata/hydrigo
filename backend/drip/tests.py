import json

from django.test import Client, TestCase

from .models import DripProfile, DripSchedule


class DripApiTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_farm_summary_returns_zone_data(self):
        response = self.client.get("/api/drip/farm-summary")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["zones"]), 3)

    def test_create_schedule_persists_record(self):
        response = self.client.post(
            "/api/drip/schedules",
            data=json.dumps(
                {
                    "name": "Siram Malam",
                    "selectedZone": "zone-c",
                    "selectedDays": ["sun"],
                    "startTime": "19:00",
                    "duration": 10,
                    "triggerLogic": "time_only",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(DripSchedule.objects.filter(name="Siram Malam").exists())

    def test_ingest_drip_reading_persists_record(self):
        response = self.client.post(
            "/api/drip/iot/readings",
            data=json.dumps(
                {
                    "device_id": "esp32-drip-01",
                    "zone_id": "zone-a",
                    "soil_moisture_pct": 51.2,
                    "temperature_c": 29.4,
                    "humidity_pct": 73.1,
                    "light_lux": 12345.0,
                    "ai_score": 0.81,
                    "pump_on": True,
                    "recorded_at": "2026-04-29T10:00:00Z",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["reading"]["deviceId"], "esp32-drip-01")

    def test_farm_summary_uses_latest_sensor_data(self):
        self.client.post(
            "/api/drip/iot/readings",
            data=json.dumps(
                {
                    "device_id": "esp32-drip-01",
                    "zone_id": "zone-a",
                    "soil_moisture_pct": 35.0,
                    "temperature_c": 31.0,
                    "humidity_pct": 70.0,
                    "light_lux": 15000.0,
                    "ai_score": 0.9,
                    "pump_on": True,
                    "recorded_at": "2026-04-29T10:00:00Z",
                }
            ),
            content_type="application/json",
        )
        response = self.client.get("/api/drip/farm-summary")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["zones"][0]["status"], "critical")

    def test_profile_update_persists(self):
        response = self.client.put(
            "/api/drip/profile",
            data=json.dumps(
                {
                    "name": "Budi",
                    "role": "Operator",
                    "location": "Pontianak",
                    "email": "budi@example.com",
                    "phone": "0812",
                    "farmName": "Kebun Budi",
                    "farmArea": "1 hektare",
                    "activeSince": "Mei 2026",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(DripProfile.objects.first().name, "Budi")
