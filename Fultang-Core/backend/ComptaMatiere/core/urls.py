from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from core.views import (
    ProvisionDatabaseView, FunctionalServiceInvalidateView,
    ArchiveTenantDataView, DeprovisionTenantDataView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # ------------------------------------------------------------
    # PROVISIONING INTERNE (tenant-service → ComptaMatiere)
    # ------------------------------------------------------------
    path(
        'api/compta_matiere/internal/provision-database/',
        ProvisionDatabaseView.as_view(),
        name='internal-provision-database',
    ),
    path(
        'api/compta_matiere/internal/functional-services/invalidate/',
        FunctionalServiceInvalidateView.as_view(),
        name='internal-functional-services-invalidate',
    ),
    path(
        'api/compta_matiere/internal/archive-tenant-data/',
        ArchiveTenantDataView.as_view(),
        name='internal-archive-tenant-data',
    ),
    path(
        'api/compta_matiere/internal/deprovision-tenant-data/',
        DeprovisionTenantDataView.as_view(),
        name='internal-deprovision-tenant-data',
    ),

    path('api/compta_matiere/', include('apps.comptabilite_matiere.urls')),

    # Authentification JWT
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Documentation API (Swagger / OpenAPI)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
