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

Endpoint exposé (Phase 6) :
    GET    /api/tenant-databases/resolve/?tenant=<uuid>&service=<code> →
           résoudre (tenant, service) vers {database_name, host, port,
           status}, réservé à la communication interne (n'importe quel
           microservice FullTang faisant du Dynamic Database Routing —
           pas seulement la Gateway).

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
from django.contrib.auth.hashers import check_password
from django.core.exceptions import ValidationError
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PlatformAdmin, PlatformService, Tenant, TenantDatabase, TenantDatabaseStatus, TenantStatus
from .permissions import IsInternalService, IsPlatformAdmin
from .provisioning import (
    ProvisioningOrchestrator,
    ServiceNotActiveError,
    TenantNotActiveForProvisioningError,
    TenantNotFoundForProvisioningError,
    UnknownServiceError,
)
from .serializers import (
    PlatformServiceSerializer,
    TenantDatabaseResolutionSerializer,
    TenantDatabaseSerializer,
    TenantDatabaseStatusUpdateSerializer,
    TenantDatabaseUpdateSerializer,
    TenantProvisionRequestSerializer,
    TenantResolutionSerializer,
    TenantSerializer,
    TenantStatusUpdateSerializer,
    TenantUpdateSerializer,
)
from .services import PlatformServiceCatalog, TenantDatabaseService, TenantService


class TenantViewSet(mixins.CreateModelMixin,
                     mixins.ListModelMixin,
                     mixins.RetrieveModelMixin,
                     mixins.UpdateModelMixin,
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

    def get_serializer_class(self):
        # `name`/`identifier`/`status` restent hors d'une mise à jour
        # générale (status a sa propre action dédiée, voir update_status) —
        # seule l'autorisation d'export clinical-agent est modifiable via
        # PATCH/PUT général, cohérent avec TenantDatabaseUpdateSerializer.
        if self.action in ('update', 'partial_update'):
            return TenantUpdateSerializer
        return TenantSerializer

    def perform_create(self, serializer):
        tenant = self.service.create_tenant(
            name=serializer.validated_data['name'],
            identifier=serializer.validated_data['identifier'],
            allow_clinical_agent_export=serializer.validated_data.get('allow_clinical_agent_export'),
        )
        serializer.instance = tenant

    def perform_update(self, serializer):
        tenant = self.service.set_clinical_agent_export_authorization(
            serializer.instance.id,
            serializer.validated_data['allow_clinical_agent_export'],
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

    @action(detail=True, methods=['post'], url_path='provision')
    def provision(self, request, id=None):
        """
        POST /tenants/{id}/provision/ — Tenant Provisioning (Phase 7).

        Réservé au PLATFORM_ADMIN (permission de classe, comme le reste
        de ce ViewSet) : c'est une opération d'infrastructure, jamais
        accessible à un rôle métier tenant-scope (§14 de la tâche).

        Corps attendu : `{"services": ["PERSONNEL", ...]}`. Toujours
        200 si la demande elle-même est valide (tenant + tous les
        services existent et sont ACTIVE) — le corps de la réponse
        détaille alors le résultat PAR service (ACTIVE/FAILED/SKIPPED),
        un échec physique sur un service n'étant jamais une raison de
        renvoyer une erreur HTTP globale (voir §10 de la tâche).
        400/404/409 uniquement si la demande elle-même est invalide
        (tenant introuvable, tenant inactif, service inconnu/inactif) —
        dans ce cas, AUCUNE ressource n'est créée.
        """
        tenant = self.get_object()

        body_serializer = TenantProvisionRequestSerializer(data=request.data)
        body_serializer.is_valid(raise_exception=True)
        service_codes = body_serializer.validated_data['services']

        orchestrator = ProvisioningOrchestrator()
        try:
            results = orchestrator.provision(tenant.id, service_codes)
        except TenantNotFoundForProvisioningError:
            return Response(status=status.HTTP_404_NOT_FOUND)
        except TenantNotActiveForProvisioningError as exc:
            return Response(
                {'detail': str(exc)}, status=status.HTTP_409_CONFLICT,
            )
        except UnknownServiceError as exc:
            return Response(
                {'detail': str(exc), 'service': exc.service_code}, status=status.HTTP_400_BAD_REQUEST,
            )
        except ServiceNotActiveError as exc:
            return Response(
                {'detail': str(exc), 'service': exc.service_code}, status=status.HTTP_409_CONFLICT,
            )

        return Response(
            {
                'tenant': str(tenant.id),
                'results': [
                    {
                        'service': result.service_code,
                        'status': result.status,
                        'database_name': result.database_name,
                        'detail': result.detail,
                    }
                    for result in results
                ],
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['get'], url_path='resolve', permission_classes=[IsInternalService])
    def resolve(self, request):
        """
        GET /tenants/resolve/?identifier=<identifier>  — utilisé par la Gateway
        GET /tenants/resolve/?id=<uuid>                — utilisé par tout appelant
             interne qui connaît déjà le tenant_id mais pas l'identifier (ex:
             clinical-agent, qui reçoit tenant_id via X-Tenant-ID, jamais un
             hostname). Un seul des deux paramètres doit être fourni.

        Réservé à la communication interne (jeton interne requis, IsInternalService).
        """
        identifier = request.query_params.get('identifier')
        tenant_id = request.query_params.get('id')

        if not identifier and not tenant_id:
            return Response(
                {'detail': "Le paramètre 'identifier' ou 'id' est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if identifier:
            tenant = self.service.get_tenant_by_identifier(identifier)
        else:
            try:
                tenant = self.service.get_tenant(tenant_id)
            except (Tenant.DoesNotExist, ValueError, ValidationError):
                tenant = None

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

    @action(detail=False, methods=['get'], url_path='resolve', permission_classes=[IsInternalService])
    def resolve(self, request):
        """
        GET /tenant-databases/resolve/?tenant=<uuid>&service=<code>

        Réservé aux microservices FullTang (Phase 6 : Dynamic Database
        Routing) — même mécanisme que GET /tenants/resolve/ (jeton
        interne partagé). Retourne 404 si aucune configuration n'existe
        pour ce couple ; ne devine jamais une base de repli.
        """
        tenant_id = request.query_params.get('tenant')
        service_code = request.query_params.get('service')
        if not tenant_id or not service_code:
            return Response(
                {'detail': "Les paramètres 'tenant' et 'service' sont requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tenant_database = self.service.get_for_tenant_and_service(tenant_id, service_code)
        if tenant_database is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(TenantDatabaseResolutionSerializer(tenant_database).data)

    @action(detail=False, methods=['get'], url_path='resolve-active', permission_classes=[IsInternalService])
    def resolve_active(self, request):
        """
        GET /tenant-databases/resolve-active/?service=<code>

        Énumère toutes les configurations ACTIVE pour un service donné —
        nécessaire au rattrapage périodique de clinical-agent
        (`/sync/all`), qui doit savoir explicitement quels tenants ont une
        base MEDICAL active plutôt que de deviner ou de parcourir un
        registre auquel il n'a pas accès directement. Réservé à la
        communication interne (même jeton partagé que `resolve`).

        Ne remplace PAS `resolve` (résolution ponctuelle d'un couple
        tenant+service) : cette action sert uniquement l'énumération
        explicite et contrôlée décrite par la tâche (Phase 10 — jamais un
        parcours implicite de "toutes les bases").
        """
        service_code = request.query_params.get('service')
        if not service_code:
            return Response(
                {'detail': "Le paramètre 'service' est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tenant_databases = self.service.list_tenant_databases(
            service_code=service_code, status=TenantDatabaseStatus.ACTIVE,
        )
        return Response([
            {
                'tenant_id': str(td.tenant_id),
                **TenantDatabaseResolutionSerializer(td).data,
            }
            for td in tenant_databases
        ])


class PlatformAdminAuthVerifyView(APIView):
    """
    POST /api/platform-admin/login/ — vérifie des identifiants PLATFORM_ADMIN.

    Symétrique de `service-personnel/api/views.py::AuthVerifyView` : appelée
    par la Gateway (jamais directement par un client), précède toute
    authentification DRF (pas de jeton à ce stade), ne fait confiance à
    aucun rôle fourni par l'appelant — le rôle `PLATFORM_ADMIN` n'est
    renvoyé QUE si l'email/mot de passe correspondent à un `PlatformAdmin`
    actif. Réponse au même format que `AuthVerifyView` ({id, email, roles,
    nom, prenom}) pour que la Gateway puisse minter le JWT de la même
    façon, sans code spécifique.

    Un PLATFORM_ADMIN n'a et n'aura jamais de `tenant_id` — ce champ est
    absent de la réponse (la Gateway construit alors un JWT sans
    `tenant_id`, exactement comme pour un compte du pool non assigné).
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        password = request.data.get('password')

        if not email or not password:
            return Response(
                {'detail': "Email et mot de passe requis."}, status=status.HTTP_400_BAD_REQUEST,
            )

        admin = PlatformAdmin.objects.filter(email=email, is_active=True).first()
        if admin is None or not check_password(password, admin.password):
            return Response({'detail': "Identifiants invalides"}, status=status.HTTP_401_UNAUTHORIZED)

        return Response({
            'id': str(admin.id),
            'email': admin.email,
            'roles': ['PLATFORM_ADMIN'],
            'nom': admin.nom,
            'prenom': admin.prenom,
        })
