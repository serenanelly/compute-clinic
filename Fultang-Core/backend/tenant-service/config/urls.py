from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('tenants.urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

# Logo des établissements (Cycle de vie du tenant, Phase 2). MEDIA_URL
# vaut '/api/media/' (voir settings.py) précisément pour rester joignable
# via la Gateway, qui reconstruit /tenants/<sub_path> → /api/<sub_path>.
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
