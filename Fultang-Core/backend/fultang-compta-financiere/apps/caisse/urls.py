"""URLs de l'app caisse."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.caisse.views import (
    QuittanceViewSet, ChequeViewSet,
    CaisseJournaliereViewSet, InventaireCaisseViewSet, DepenseMenueViewSet,
)
from apps.caisse.views.caissier_views import CaissierViewSet

app_name = 'caisse'
router = DefaultRouter()
router.register(r'quittances', QuittanceViewSet, basename='quittance')
router.register(r'cheques', ChequeViewSet, basename='cheque')
router.register(r'caisse-journaliere', CaisseJournaliereViewSet, basename='caisse-journaliere')
router.register(r'inventaires-caisse', InventaireCaisseViewSet, basename='inventaire-caisse')
router.register(r'depenses-menues', DepenseMenueViewSet, basename='depense-menue')
router.register(r'caissier', CaissierViewSet, basename='caissier')

urlpatterns = [
    path('', include(router.urls)),
]
