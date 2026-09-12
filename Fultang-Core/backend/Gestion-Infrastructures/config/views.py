"""
views.py — Endpoints internes de config (hors app métier).

Symétrique de `service-personnel/api/views.py::ProvisionDatabaseView` :
tenant-service appelle CET endpoint pour déclencher la création physique
réelle de la base PostgreSQL d'un tenant pour le service
Gestion-Infrastructures, puis l'initialisation de son schéma.
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsInternalService
from .tenant_routing.pool_registry import (
    DatabaseProvisioningError, deprovision_database, ensure_connection_alias, provision_database,
)
from .tenant_routing.router import TENANT_SCOPED_APPS


class ProvisionDatabaseView(APIView):
    """
    POST /api/internal/provision-database/

    Ne passe jamais par `GatewayHeaderAuthentication` (appelé directement
    par tenant-service, pas via la Gateway — communication
    service-to-service directe, décision déjà actée pour tout FullTang) :
    l'autorisation repose entièrement sur `IsInternalService` (jeton
    partagé TENANT_SERVICE_INTERNAL_TOKEN).

    Ne reçoit QUE `tenant_id` — jamais un nom de base fourni par
    l'appelant : ce service dérive lui-même le nom physique (voir
    `pool_registry.provision_database`), il ne fait jamais confiance à
    une chaîne SQL reçue par le réseau, même d'un appelant de confiance.
    """
    authentication_classes = []
    permission_classes = [IsInternalService]

    def post(self, request):
        tenant_id = request.data.get('tenant_id')
        if not tenant_id:
            return Response({'detail': "Le champ 'tenant_id' est requis."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = provision_database(tenant_id)
        except DatabaseProvisioningError as exc:
            return Response(
                {'detail': "Provisioning physique échoué.", 'error': str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(result, status=status.HTTP_200_OK)


class FunctionalServiceInvalidateView(APIView):
    """
    POST /api/internal/functional-services/invalidate/ — invalidation
    active du cache local `functional_service_cache`, symétrique de
    l'endpoint déjà déployé dans les autres microservices.
    """
    authentication_classes = []
    permission_classes = [IsInternalService]

    def post(self, request):
        from .tenant_routing.functional_service_client import functional_service_cache

        tenant_id = request.data.get('tenant_id')
        code = request.data.get('code')
        if not tenant_id or not code:
            return Response(
                {'detail': "Les champs 'tenant_id' et 'code' sont requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        functional_service_cache.invalidate(tenant_id, code)
        return Response({}, status=status.HTTP_200_OK)


class ArchiveTenantDataView(APIView):
    """
    POST .../internal/archive-tenant-data/ — Suppression définitive de
    tenant (tenant-service, `TenantDeletionService`) : exporte TOUTES les
    données de ce service pour `tenant_id`, AVANT toute suppression
    destructive.

    Endpoint interne symétrique de `ProvisionDatabaseView` (même
    protection `IsInternalService`, jamais appelé via la Gateway).

    Réutilise `ensure_connection_alias` (chemin de résolution ORDINAIRE,
    inchangé) pour obtenir l'alias du tenant, puis `dumpdata` (commande
    Django déjà intégrée, aucune nouvelle dépendance/infrastructure —
    voir service-personnel/api/views.py::ArchiveTenantDataView pour la
    vérification faite avant ce choix) sur EXACTEMENT les apps de
    `TENANT_SCOPED_APPS` (même périmètre que le Database Router lui-même).

    Ne supprime, ne modifie, ni ne verrouille RIEN — lecture seule.
    """
    authentication_classes = []
    permission_classes = [IsInternalService]

    def post(self, request):
        import io
        import json as json_module

        from django.core.management import call_command

        tenant_id = request.data.get('tenant_id')
        if not tenant_id:
            return Response({'detail': "Le champ 'tenant_id' est requis."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            alias = ensure_connection_alias(tenant_id)
        except Exception as exc:
            return Response(
                {'detail': "Résolution de la base du tenant échouée.", 'error': str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        buffer = io.StringIO()
        try:
            call_command(
                'dumpdata', *sorted(TENANT_SCOPED_APPS),
                database=alias, indent=2, stdout=buffer,
            )
        except Exception as exc:
            return Response(
                {'detail': "Export des données du tenant échoué.", 'error': str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        dump_text = buffer.getvalue()
        try:
            object_count = len(json_module.loads(dump_text)) if dump_text.strip() else 0
        except (ValueError, TypeError):
            object_count = None

        return Response(
            {
                'database_name': alias,
                'app_labels': sorted(TENANT_SCOPED_APPS),
                'object_count': object_count,
                'data': dump_text,
            },
            status=status.HTTP_200_OK,
        )


class DeprovisionTenantDataView(APIView):
    """
    POST .../internal/deprovision-tenant-data/ — Suppression définitive
    de tenant : DROP réel de la base PostgreSQL de `tenant_id` pour ce
    service.

    Endpoint interne symétrique de `ProvisionDatabaseView`/
    `ArchiveTenantDataView` (même protection `IsInternalService`).
    N'EXISTE QUE parce que `TenantDeletionService` l'appelle
    explicitement, TOUJOURS après un archivage validé.
    """
    authentication_classes = []
    permission_classes = [IsInternalService]

    def post(self, request):
        tenant_id = request.data.get('tenant_id')
        if not tenant_id:
            return Response({'detail': "Le champ 'tenant_id' est requis."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            dropped = deprovision_database(tenant_id)
        except DatabaseProvisioningError as exc:
            return Response(
                {'detail': "Suppression physique échouée.", 'error': str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({'dropped': dropped}, status=status.HTTP_200_OK)
