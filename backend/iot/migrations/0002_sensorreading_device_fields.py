from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("iot", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="sensorreading",
            name="air_temperature_c",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="sensorreading",
            name="pump_prediction",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="sensorreading",
            name="pump_status",
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="sensorreading",
            name="water_distance_cm",
            field=models.FloatField(blank=True, null=True),
        ),
    ]
