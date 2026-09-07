"""
permissions.py — Frontière d'autorisation service-to-service (Phase 7).

Symétrique de `tenant-service/tenants/permissions.py::IsInternalService`
(même jeton partagé `TENANT_SERVICE_INTERNAL_TOKEN`, même technique de
comparaison en temps constant). Jusqu'à la Phase 6, service-personnel
n'était qu'APPELANT de ce mécanisme (voir tenant_routing/registry_client.py) ;
la Phase 7 en fait aussi un APPELÉ : tenant-service doit pouvoir déclencher
le provisioning physique d'une base sur ce service
(POST /api/internal/provision-database/), une opération d'infrastructure
qu'aucun utilisateur authentifié via GatewayHeaderAuthentication (même
PLATFORM_ADMIN) ne doit pouvoir déclencher directement — seul un autre
service de confiance, prouvant sa légitimité par ce jeton, le peut.
"""
import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission

INTERNAL_SERVICE_TOKEN_HEADER = 'X-Internal-Service-Token'


class IsInternalService(BasePermission):
    """
    Autorise uniquement les appels porteurs du jeton interne partagé
    entre tenant-service et service-personnel.

    Si aucun jeton n'est configuré (TENANT_SERVICE_INTERNAL_TOKEN vide),
    l'accès est refusé par défaut plutôt qu'accepté silencieusement —
    même principe que côté tenant-service.
    """

    message = "Jeton de service interne manquant ou invalide."

    def has_permission(self, request, view):
        expected = getattr(settings, 'TENANT_SERVICE_INTERNAL_TOKEN', '') or ''
        provided = request.headers.get(INTERNAL_SERVICE_TOKEN_HEADER, '') or ''

        if not expected:
            return False

        return hmac.compare_digest(provided, expected)
