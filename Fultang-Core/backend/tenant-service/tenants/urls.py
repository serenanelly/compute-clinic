from rest_framework.routers import DefaultRouter

from .views import PlatformServiceViewSet, TenantDatabaseViewSet, TenantViewSet

router = DefaultRouter()
router.register(r'tenants', TenantViewSet, basename='tenant')
router.register(r'platform-services', PlatformServiceViewSet, basename='platform-service')
router.register(r'tenant-databases', TenantDatabaseViewSet, basename='tenant-database')

urlpatterns = router.urls
