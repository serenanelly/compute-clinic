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

from .models import PlatformService, Tenant, TenantDatabase, TenantDatabaseStatus, TenantStatus
from .permissions import IsInternalService, IsPlatformAdmin
from .serializers import (
    PlatformServiceSerializer,
    TenantDatabaseSerializer,
    TenantDatabaseStatusUpdateSerializer,
    TenantDatabaseUpdateSerializer,
    TenantResolutionSerializer,
    TenantSerializer,
    TenantStatusUpdateSerializer,
)
from .services import PlatformServiceCatalog, TenantDatabaseService, TenantService


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


class PlatformServiceViewSet(mixins.CreateModelMixin,
                              mixins.ListModelMixin,
                              mixins.RetrieveModelMixin,
                              viewsets.GenericViewSet):
    """
    Catalogue des services de la plateforme (Phase 5).

    Endpoints exposés :
        POST   /api/platform-services/       → enregistrer un nouveau service
        GET    /api/platform-services/       → lister les services
        GET    /api/platform-services/{code}/ → consulter un service

    Réservé au PLATFORM_ADMIN : ajouter un service au catalogue est une
    opération de plateforme, jamais une action tenant-scope. Aucune
    suppression ni mise à jour exposées à ce stade — un service, une
    fois créé, n'a pas vocation à être renommé (son `code` doit rester
    stable, voir PlatformService).
    """

    queryset = PlatformService.objects.all()
    serializer_class = PlatformServiceSerializer
    lookup_field = 'code'
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    @property
    def catalog(self) -> PlatformServiceCatalog:
        return PlatformServiceCatalog()

    def get_queryset(self):
        status_filter = self.request.query_params.get('status')
        return self.catalog.list_services(status=status_filter)

    def perform_create(self, serializer):
        service = self.catalog.register_service(
            code=serializer.validated_data['code'],
            name=serializer.validated_data['name'],
        )
        serializer.instance = service


class TenantDatabaseViewSet(mixins.CreateModelMixin,
                             mixins.ListModelMixin,
                             mixins.RetrieveModelMixin,
                             mixins.UpdateModelMixin,
                             viewsets.GenericViewSet):
    """
    Association Tenant + Service → Database (Phase 5 — Tenant Database
    Management, modèle "Database per Tenant per Service").

    Endpoints exposés :
        POST   /api/tenant-databases/               → déclarer une configuration
        GET    /api/tenant-databases/                → lister (filtrable par
                                                         ?tenant=, ?service=, ?status=)
        GET    /api/tenant-databases/{id}/            → consulter une configuration
        PATCH  /api/tenant-databases/{id}/            → modifier database_name/
                                                         host/port/secret_reference
        PATCH  /api/tenant-databases/{id}/status/     → changer le statut logique

    Réservé au PLATFORM_ADMIN : ce sont des informations d'infrastructure
    sensibles (host, port, secret_reference). Un administrateur
    d'établissement (rôle ADMIN, tenant-scope) n'a accès à aucune
    opération de ce ViewSet — voir permissions.py (IsPlatformAdmin,
    réutilisée telle quelle, aucun nouveau système RBAC introduit).

    Ce que ce ViewSet ne fait PAS : créer/modifier/supprimer une base
    PostgreSQL physique, ni router une requête vers elle. Il ne fait que
    gérer l'enregistrement déclaratif.
    """

    queryset = TenantDatabase.objects.select_related('tenant', 'service').all()
    serializer_class = TenantDatabaseSerializer
    lookup_field = 'id'
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    @property
    def service(self) -> TenantDatabaseService:
        return TenantDatabaseService()

    def get_serializer_class(self):
        # tenant/service ne sont modifiables qu'à la création — voir
        # TenantDatabaseUpdateSerializer.
        if self.action in ('update', 'partial_update'):
            return TenantDatabaseUpdateSerializer
        return TenantDatabaseSerializer

    def get_queryset(self):
        params = self.request.query_params
        return self.service.list_tenant_databases(
            tenant_id=params.get('tenant'),
            service_code=params.get('service'),
            status=params.get('status'),
        )

    def perform_create(self, serializer):
        data = serializer.validated_data
        instance = self.service.create_tenant_database(
            tenant_id=data['tenant'].id,
            service_code=data['service'].code,
            database_name=data['database_name'],
            host=data['host'],
            port=data.get('port', 5432),
            secret_reference=data['secret_reference'],
        )
        serializer.instance = instance

    def perform_update(self, serializer):
        instance = self.service.update_tenant_database(serializer.instance.id, **serializer.validated_data)
        serializer.instance = instance

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, id=None):
        """PATCH /tenant-databases/{id}/status/ — change le statut logique (aucune action physique)."""
        instance = self.get_object()

        serializer = TenantDatabaseStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data['status']

        updated = self.service.set_status(instance.id, new_status)

        return Response(TenantDatabaseSerializer(updated).data, status=status.HTTP_200_OK)
