"""
views.py — Endpoints HTTP du Tenant Registry.

Ces vues sont volontairement fines : elles valident/sérialisent la requête
puis délèguent au TenantService. Aucune règle métier ne doit être ajoutée
ici (elle irait dans services.py).

Endpoints exposés (Phase 1) :
    POST   /api/tenants/             → créer un tenant
    GET    /api/tenants/             → lister les tenants
    GET    /api/tenants/{id}/        → consulter un tenant
    PATCH  /api/tenants/{id}/status/ → activer / désactiver un tenant

Endpoint exposé (Phase 2.1) :
    GET    /api/tenants/resolve/?identifier=<identifier> → résoudre un
           identifier vers {id, identifier, status}, réservé à la
           communication interne Gateway → Tenant Service.

Volontairement absents à ce stade : suppression, mise à jour libre du
nom/identifier, pagination avancée, filtres au-delà du statut — ils
pourront être ajoutés sans remise en cause de cette structure.

Autorisation : le Tenant Management (CRUD) est une opération de PLATFORM
SCOPE. Tous ces endpoints exigent le rôle PLATFORM_ADMIN (voir
permissions.py) — le rôle métier "ADMIN", local à un établissement, n'y
donne pas accès.

`resolve` suit une règle différente : la résolution hostname → tenant a
lieu dans la Gateway AVANT toute authentification utilisateur (un
visiteur anonyme de hopital-central.fulltang.com doit pouvoir être
routé) — elle ne peut donc pas exiger PLATFORM_ADMIN. Elle n'est pour
autant PAS publique : elle exige le jeton de service interne partagé
Gateway ↔ Tenant Service (IsInternalService, voir permissions.py),
c'est-à-dire une preuve que l'appelant est bien la Gateway.
"""
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Tenant, TenantStatus
from .permissions import IsInternalService, IsPlatformAdmin
from .serializers import TenantResolutionSerializer, TenantSerializer, TenantStatusUpdateSerializer
from .services import TenantService


class TenantViewSet(mixins.CreateModelMixin,
                     mixins.ListModelMixin,
                     mixins.RetrieveModelMixin,
                     viewsets.GenericViewSet):
    """ViewSet du Tenant Registry, adossée à TenantService plutôt qu'à l'ORM directement.

    Réservée au PLATFORM_ADMIN : la gestion des établissements eux-mêmes
    ne relève d'aucun rôle métier local à un tenant.
    """

    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    lookup_field = 'id'
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    @property
    def service(self) -> TenantService:
        return TenantService()

    def get_queryset(self):
        status_filter = self.request.query_params.get('status')
        return self.service.list_tenants(status=status_filter)

    def perform_create(self, serializer):
        tenant = self.service.create_tenant(
            name=serializer.validated_data['name'],
            identifier=serializer.validated_data['identifier'],
        )
        serializer.instance = tenant

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, id=None):
        """PATCH /tenants/{tenant_id}/status/ — active ou désactive un tenant."""
        tenant = self.get_object()

        serializer = TenantStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data['status']

        if new_status == TenantStatus.ACTIVE:
            tenant = self.service.activate_tenant(tenant.id)
        else:
            tenant = self.service.deactivate_tenant(tenant.id)

        return Response(TenantSerializer(tenant).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='resolve', permission_classes=[IsInternalService])
    def resolve(self, request):
        """GET /tenants/resolve/?identifier=<identifier> — réservé à la Gateway (jeton interne requis)."""
        identifier = request.query_params.get('identifier')
        if not identifier:
            return Response(
                {'detail': "Le paramètre 'identifier' est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tenant = self.service.get_tenant_by_identifier(identifier)
        if tenant is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(TenantResolutionSerializer(tenant).data)
