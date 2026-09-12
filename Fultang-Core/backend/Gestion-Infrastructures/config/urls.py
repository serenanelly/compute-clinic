from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from config.views import (
    ProvisionDatabaseView, FunctionalServiceInvalidateView,
    ArchiveTenantDataView, DeprovisionTenantDataView,
)

urlpatterns = [
    path('api/internal/provision-database/', ProvisionDatabaseView.as_view(), name='internal-provision-database'),
    path('api/internal/functional-services/invalidate/', FunctionalServiceInvalidateView.as_view(), name='internal-functional-services-invalidate'),
    path('api/internal/archive-tenant-data/', ArchiveTenantDataView.as_view(), name='internal-archive-tenant-data'),
    path('api/internal/deprovision-tenant-data/', DeprovisionTenantDataView.as_view(), name='internal-deprovision-tenant-data'),
    path('admin/', admin.site.urls),
    path('api/', include('infrastructures.urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]
