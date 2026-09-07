from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ServiceViewSet, MedecinViewSet, MedecinGeneralisteViewSet, InfirmiereViewSet, ReceptionnisteViewSet,
    ComptableFinancierViewSet, ComptableMatiereViewSet, LaborantinViewSet,
    PharmacienViewSet, DirecteurViewSet, AdminViewSet, AuthVerifyView, PersonnelViewSet,
    ProvisionDatabaseView,
)

router = DefaultRouter()
router.register(r'services', ServiceViewSet)
router.register(r'medecins', MedecinViewSet)
router.register(r'medecins-generalistes', MedecinGeneralisteViewSet)
router.register(r'infirmieres', InfirmiereViewSet)
router.register(r'receptionnistes', ReceptionnisteViewSet)
router.register(r'comptables-financiers', ComptableFinancierViewSet)
router.register(r'comptables-matieres', ComptableMatiereViewSet)
router.register(r'laborantins', LaborantinViewSet)
router.register(r'pharmaciens', PharmacienViewSet)
router.register(r'directeurs', DirecteurViewSet)
router.register(r'admins', AdminViewSet)
router.register(r'personnel', PersonnelViewSet, basename='personnel')

urlpatterns = [
    path('auth/verify/', AuthVerifyView.as_view(), name='auth-verify'),
    path('internal/provision-database/', ProvisionDatabaseView.as_view(), name='internal-provision-database'),
    path('', include(router.urls)),
]
