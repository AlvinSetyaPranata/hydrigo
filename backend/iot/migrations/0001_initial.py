from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="IngestTransaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("transaction_id", models.CharField(max_length=32, unique=True)),
                ("device_id", models.CharField(max_length=100)),
                ("lettuce_bed_id", models.CharField(max_length=100)),
                ("status", models.CharField(max_length=32)),
                ("request_payload", models.TextField()),
                ("payload_hash", models.CharField(max_length=64)),
                ("reading_id", models.BigIntegerField(blank=True, null=True)),
                ("block_index", models.BigIntegerField(blank=True, null=True)),
                ("error_message", models.TextField(blank=True, null=True)),
                ("created_at", models.DateTimeField()),
                ("updated_at", models.DateTimeField()),
            ],
            options={"ordering": ["-id"]},
        ),
        migrations.CreateModel(
            name="SensorReading",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("transaction_id", models.CharField(max_length=32, unique=True)),
                ("device_id", models.CharField(max_length=100)),
                ("lettuce_bed_id", models.CharField(max_length=100)),
                ("temperature_c", models.FloatField()),
                ("humidity_pct", models.FloatField()),
                ("ph", models.FloatField()),
                ("tds_ppm", models.FloatField()),
                ("water_level_pct", models.FloatField()),
                ("light_lux", models.FloatField()),
                ("recorded_at", models.DateTimeField()),
                ("received_at", models.DateTimeField()),
                ("signature", models.TextField(blank=True, null=True)),
            ],
            options={"ordering": ["-id"]},
        ),
        migrations.CreateModel(
            name="OnchainAnchor",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("block_index", models.BigIntegerField(unique=True)),
                ("tx_hash", models.CharField(max_length=80, unique=True)),
                ("chain_id", models.BigIntegerField()),
                ("contract_address", models.CharField(max_length=64)),
                ("wallet_address", models.CharField(max_length=64)),
                ("status", models.CharField(max_length=32)),
                ("anchored_at", models.DateTimeField()),
                ("reading", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="anchors", to="iot.sensorreading")),
            ],
            options={"ordering": ["-id"]},
        ),
        migrations.CreateModel(
            name="LedgerBlock",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("block_index", models.BigIntegerField(unique=True)),
                ("previous_hash", models.CharField(max_length=64)),
                ("payload_hash", models.CharField(max_length=64)),
                ("block_hash", models.CharField(max_length=64, unique=True)),
                ("created_at", models.DateTimeField()),
                ("reading", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="block", to="iot.sensorreading")),
            ],
            options={"ordering": ["block_index"]},
        ),
    ]
