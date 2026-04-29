from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="DripProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("role", models.CharField(max_length=120)),
                ("location", models.CharField(max_length=255)),
                ("email", models.EmailField(max_length=254)),
                ("phone", models.CharField(max_length=64)),
                ("farm_name", models.CharField(max_length=160)),
                ("farm_area", models.CharField(max_length=64)),
                ("active_since", models.CharField(max_length=64)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="DripSchedule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("schedule_id", models.CharField(max_length=32, unique=True)),
                ("name", models.CharField(max_length=120)),
                ("zone_id", models.CharField(max_length=64)),
                ("zone_name", models.CharField(max_length=160)),
                ("selected_days", models.JSONField(default=list)),
                ("days_label", models.CharField(max_length=120)),
                ("time", models.CharField(max_length=5)),
                ("duration_minutes", models.PositiveIntegerField()),
                ("trigger_logic", models.CharField(default="time_only", max_length=64)),
                ("is_enabled", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["created_at"]},
        ),
    ]
