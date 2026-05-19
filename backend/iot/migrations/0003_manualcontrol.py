from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("iot", "0002_sensorreading_device_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="ManualControl",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("control_id", models.CharField(max_length=64, unique=True)),
                ("name", models.CharField(max_length=120)),
                ("description", models.CharField(max_length=255)),
                ("status", models.BooleanField(default=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["control_id"]},
        ),
    ]
