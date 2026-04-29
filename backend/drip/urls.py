from django.urls import path

from .views import farm_summary_view, health_view, history_view, profile_view, schedule_detail_view, schedules_view


urlpatterns = [
    path("health", health_view),
    path("farm-summary", farm_summary_view),
    path("schedules", schedules_view),
    path("schedules/<str:schedule_id>", schedule_detail_view),
    path("history", history_view),
    path("profile", profile_view),
]
