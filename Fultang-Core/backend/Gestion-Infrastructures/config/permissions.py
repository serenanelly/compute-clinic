"""
permissions.py — Frontière d'autorisation service-to-service.

Symétrique de `tenant-service/tenants/permissions.py::IsInternalService`
et de `service-personnel/api/permissions.py::IsInternalService` (même
jeton partagé `TENANT_SERVICE_INTERNAL_TOKEN`, même comparaison en temps
constant). Gestion-Infrastructures devient ici un service exposant un
endpoint interne protégé par ce mécanisme déjà établi — aucun nouveau
protocole d'authentification introduit :

  - `POST /api/internal/provision-database/` : appelé par tenant-service
    pour déclencher le provisioning physique.
"""
import hmac

from django.conf import settings
from rest_framework.exceptions import NotFound
from rest_framework.permissions import BasePermission

from .tenant_routing.context import require_tenant_context
from .tenant_routing.functional_service_client import (
    FunctionalServiceUnknownError,
    functional_service_cache,
)

INTERNAL_SERVICE_TOKEN_HEADER = 'X-Internal-Service-Token'


class IsInternalService(BasePermission):
    """
    Autorise uniquement les appels porteurs du jeton interne partagé
    entre tenant-service et les microservices FullTang.

    Si aucun jeton n'est configuré (TENANT_SERVICE_INTERNAL_TOKEN vide),
    l'accès est refusé par défaut plutôt qu'accepté silencieusement —
    même principe que côté tenant-service/service-personnel.
    """

    message = "Jeton de service interne manquant ou invalide."

    def has_permission(self, request, view):
        expected = getattr(settings, 'TENANT_SERVICE_INTERNAL_TOKEN', '') or ''
        provided = request.headers.get(INTERNAL_SERVICE_TOKEN_HEADER, '') or ''

        if not expected:
            return False

        return hmac.compare_digest(provided, expected)


class HasFunctionalServiceEnabled(BasePermission):
    """
    Autorise l'opération uniquement si le `FunctionalService`
    GESTION_INFRASTRUCTURES est activé pour le tenant COURANT — même
    mécanisme générique déjà déployé dans les autres microservices.

    `.for_service(code)` produit une sous-classe paramétrée par un code.
    Renvoie 404 (pas 403) quand le service est désactivé.
    """

    service_code: str = None

    @classmethod
    def for_service(cls, code: str):
        return type(f'HasFunctionalServiceEnabled_{code}', (cls,), {'service_code': code})

    def has_permission(self, request, view):
        tenant_id = require_tenant_context().tenant_id
        if tenant_id is None:
            return True
        try:
            enabled = functional_service_cache.get(tenant_id, self.service_code)
        except FunctionalServiceUnknownError:
            enabled = False

        if not enabled:
            raise NotFound(detail={
                'error_type': 'SERVICE_UNAVAILABLE',
                'message': "Ce service n'existe pas pour cet établissement.",
            })
        return True
