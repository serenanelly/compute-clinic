from rest_framework.routers import DefaultRouter
from .views import TypeBatimentViewSet, TypeSalleViewSet, BatimentViewSet, EtageViewSet, SalleViewSet

router = DefaultRouter()
router.register(r'types-batiment', TypeBatimentViewSet)
router.register(r'types-salle', TypeSalleViewSet)
router.register(r'batiments', BatimentViewSet)
router.register(r'etages', EtageViewSet)
router.register(r'salles', SalleViewSet)

urlpatterns = router.urls
