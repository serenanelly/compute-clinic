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
from .tenant_routing.pool_registry import DatabaseProvisioningError, provision_database


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
