from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("iot", "0004_controlmode"),
    ]

    operations = [
        migrations.AddField(
            model_name="sensorreading",
            name="device_phase",
            field=models.CharField(blank=True, max_length=32, null=True),
        ),
    ]
