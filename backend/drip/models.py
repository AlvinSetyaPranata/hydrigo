from django.db import models


class DripProfile(models.Model):
    name = models.CharField(max_length=120)
    role = models.CharField(max_length=120)
    location = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=64)
    farm_name = models.CharField(max_length=160)
    farm_area = models.CharField(max_length=64)
    active_since = models.CharField(max_length=64)
    updated_at = models.DateTimeField(auto_now=True)


class DripSchedule(models.Model):
    schedule_id = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=120)
    zone_id = models.CharField(max_length=64)
    zone_name = models.CharField(max_length=160)
    selected_days = models.JSONField(default=list)
    days_label = models.CharField(max_length=120)
    time = models.CharField(max_length=5)
    duration_minutes = models.PositiveIntegerField()
    trigger_logic = models.CharField(max_length=64, default="time_only")
    is_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]


class DripSensorReading(models.Model):
    device_id = models.CharField(max_length=100)
    zone_id = models.CharField(max_length=64)
    soil_moisture_pct = models.FloatField()
    temperature_c = models.FloatField()
    humidity_pct = models.FloatField()
    light_lux = models.FloatField()
    ai_score = models.FloatField()
    pump_on = models.BooleanField(default=False)
    recorded_at = models.DateTimeField()
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-recorded_at", "-id"]
