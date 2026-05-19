from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("iot", "0003_manualcontrol"),
    ]

    operations = [
        migrations.CreateModel(
            name="ControlMode",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("mode", models.CharField(default="automatic", max_length=16)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["id"]},
        ),
    ]
