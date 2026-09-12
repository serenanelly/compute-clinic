"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from core.views import (
    ProvisionDatabaseView, FunctionalServiceInvalidateView,
    ArchiveTenantDataView, DeprovisionTenantDataView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # ------------------------------------------------------------
    # AUTHENTICATION (JWT)
    # ------------------------------------------------------------
    path('api/medical-monitoring/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/medical-monitoring/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # ------------------------------------------------------------
    # PROVISIONING INTERNE (tenant-service → Medical-Monitoring)
    # ------------------------------------------------------------
    path(
        'api/medical-monitoring/internal/provision-database/',
        ProvisionDatabaseView.as_view(),
        name='internal-provision-database',
    ),
    path(
        'api/medical-monitoring/internal/functional-services/invalidate/',
        FunctionalServiceInvalidateView.as_view(),
        name='internal-functional-services-invalidate',
    ),
    path(
        'api/medical-monitoring/internal/archive-tenant-data/',
        ArchiveTenantDataView.as_view(),
        name='internal-archive-tenant-data',
    ),
    path(
        'api/medical-monitoring/internal/deprovision-tenant-data/',
        DeprovisionTenantDataView.as_view(),
        name='internal-deprovision-tenant-data',
    ),

    # ------------------------------------------------------------
    # DOCUMENTATION (Swagger/OpenAPI)
    # ------------------------------------------------------------
    path('api/medical-monitoring/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/medical-monitoring/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/medical-monitoring/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # ------------------------------------------------------------
    # API ENDPOINTS
    # ------------------------------------------------------------
    path('api/medical-monitoring/', include('core.api')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
