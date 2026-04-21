from django.db import models


class IngestTransaction(models.Model):
    transaction_id = models.CharField(max_length=32, unique=True)
    device_id = models.CharField(max_length=100)
    lettuce_bed_id = models.CharField(max_length=100)
    status = models.CharField(max_length=32)
    request_payload = models.TextField()
    payload_hash = models.CharField(max_length=64)
    reading_id = models.BigIntegerField(null=True, blank=True)
    block_index = models.BigIntegerField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        ordering = ["-id"]


class SensorReading(models.Model):
    transaction_id = models.CharField(max_length=32, unique=True)
    device_id = models.CharField(max_length=100)
    lettuce_bed_id = models.CharField(max_length=100)
    temperature_c = models.FloatField()
    humidity_pct = models.FloatField()
    ph = models.FloatField()
    tds_ppm = models.FloatField()
    water_level_pct = models.FloatField()
    light_lux = models.FloatField()
    recorded_at = models.DateTimeField()
    received_at = models.DateTimeField()
    signature = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ["-id"]


class LedgerBlock(models.Model):
    reading = models.OneToOneField(SensorReading, on_delete=models.CASCADE, related_name="block")
    block_index = models.BigIntegerField(unique=True)
    previous_hash = models.CharField(max_length=64)
    payload_hash = models.CharField(max_length=64)
    block_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField()

    class Meta:
        ordering = ["block_index"]


class OnchainAnchor(models.Model):
    block_index = models.BigIntegerField(unique=True)
    reading = models.ForeignKey(SensorReading, on_delete=models.CASCADE, related_name="anchors")
    tx_hash = models.CharField(max_length=80, unique=True)
    chain_id = models.BigIntegerField()
    contract_address = models.CharField(max_length=64)
    wallet_address = models.CharField(max_length=64)
    status = models.CharField(max_length=32)
    anchored_at = models.DateTimeField()

    class Meta:
        ordering = ["-id"]
