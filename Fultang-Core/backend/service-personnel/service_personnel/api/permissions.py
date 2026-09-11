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


class HasFunctionalServiceEnabled(BasePermission):
    """
    Autorise l'opération uniquement si un `FunctionalService` donné du
    catalogue FullTang est activé pour le tenant COURANT (Cycle de vie du
    tenant, Phase 2, §12-15 : activation/désactivation réellement
    effective, jamais un simple masquage côté frontend).

    Générique par construction : `.for_service(code)` produit une
    sous-classe paramétrée par un code (ex: 'PHARMACIE') — un seul
    mécanisme réutilisable pour n'importe quel service du catalogue,
    jamais une règle spéciale écrite pour un seul service.

    Renvoie 404 (pas 403) quand le service est désactivé — décision
    explicite de la Phase 3 : un service désactivé doit apparaître comme
    INEXISTANT pour ce tenant, jamais comme "existant mais interdit"
    (ne jamais révéler au client qu'un mécanisme d'autorisation l'a
    bloqué). AVANT ce correctif, `has_permission` retournait `False`,
    que DRF traduit automatiquement en 403 — désormais elle lève
    `NotFound` explicitement pour ce cas précis.

    `FunctionalServiceRegistryUnavailableError` n'est PAS interceptée ici
    : elle remonte telle quelle et est traduite en 503 par le gestionnaire
    d'exceptions global (voir exceptions.py), exactement comme les autres
    erreurs de résolution du Tenant Registry (Phase 6) — jamais un accès
    silencieusement autorisé faute de pouvoir vérifier.
    """

    service_code: str = None

    @classmethod
    def for_service(cls, code: str):
        return type(f'HasFunctionalServiceEnabled_{code}', (cls,), {'service_code': code})

    def has_permission(self, request, view):
        tenant_id = require_tenant_context().tenant_id
        if tenant_id is None:
            # Pool non assigné (aucun tenant) : aucune configuration de
            # service fonctionnel ne s'applique — comportement historique
            # préservé (voir GatewayHeaderAuthentication).
            return True
        try:
            enabled = functional_service_cache.get(tenant_id, self.service_code)
        except FunctionalServiceUnknownError:
            # Tenant ou code absent du Registry : incohérence de données,
            # jamais une raison d'autoriser silencieusement.
            enabled = False

        if not enabled:
            raise NotFound(detail={
                'error_type': 'SERVICE_UNAVAILABLE',
                'message': "Ce service n'existe pas pour cet établissement.",
            })
        return True
