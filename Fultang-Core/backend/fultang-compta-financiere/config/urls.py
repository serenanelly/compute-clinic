"""
URLs principales du Service Comptabilité Financière.
"""
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from config.views import (
    ProvisionDatabaseView, FunctionalServiceInvalidateView,
    ArchiveTenantDataView, DeprovisionTenantDataView,
)


@api_view(['GET'])
def health_check(request):
    """Endpoint de santé de l'API."""
    return Response({
        'service': 'Comptabilité Financière',
        'status': 'ok',
        'version': '1.0.0'
    })


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health-check'),
    # JWT
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # Provisioning interne (tenant-service → compta-financiere)
    path(
        'api/internal/provision-database/',
        ProvisionDatabaseView.as_view(),
        name='internal-provision-database',
    ),
    path(
        'api/internal/functional-services/invalidate/',
        FunctionalServiceInvalidateView.as_view(),
        name='internal-functional-services-invalidate',
    ),
    path('api/internal/archive-tenant-data/', ArchiveTenantDataView.as_view(), name='internal-archive-tenant-data'),
    path(
        'api/internal/deprovision-tenant-data/', DeprovisionTenantDataView.as_view(),
        name='internal-deprovision-tenant-data',
    ),
    # Apps
    path('api/', include('apps.comptabilite.urls')),
    path('api/', include('apps.caisse.urls')),
    path('api/', include('apps.sorties.urls')),
    # Documentation Swagger
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]
