from django.urls import path

from .views import blockchain_chain_view, health_view, iot_reading_ingest_view, readings_view, transaction_detail_view, transactions_view


urlpatterns = [
    path("health", health_view),
    path("api/v1/iot/readings", iot_reading_ingest_view),
    path("api/v1/readings", readings_view),
    path("api/v1/transactions", transactions_view),
    path("api/v1/transactions/<str:transaction_id>", transaction_detail_view),
    path("api/v1/blockchain/chain", blockchain_chain_view),
]
