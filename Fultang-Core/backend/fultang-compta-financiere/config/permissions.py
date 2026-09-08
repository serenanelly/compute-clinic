"""
permissions.py — Frontière d'autorisation service-to-service.

Symétrique de `tenant-service/tenants/permissions.py::IsInternalService`
et des équivalents déjà déployés dans service-personnel et
Medical-Monitoring (même jeton partagé `TENANT_SERVICE_INTERNAL_TOKEN`,
même comparaison en temps constant). Ce service devient ici un
quatrième service exposant un endpoint interne protégé par ce mécanisme
déjà établi — aucun nouveau protocole d'authentification introduit :

  - `POST /api/internal/provision-database/` : appelé par tenant-service
    (Phase 7 étendue) pour déclencher le provisioning physique.
"""
import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission

INTERNAL_SERVICE_TOKEN_HEADER = 'X-Internal-Service-Token'


class IsInternalService(BasePermission):
    """
    Autorise uniquement les appels porteurs du jeton interne partagé
    entre tenant-service et les microservices FullTang.

    Si aucun jeton n'est configuré (TENANT_SERVICE_INTERNAL_TOKEN vide),
    l'accès est refusé par défaut plutôt qu'accepté silencieusement —
    même principe que côté tenant-service/service-personnel/Medical-Monitoring.
    """

    message = "Jeton de service interne manquant ou invalide."

    def has_permission(self, request, view):
        expected = getattr(settings, 'TENANT_SERVICE_INTERNAL_TOKEN', '') or ''
        provided = request.headers.get(INTERNAL_SERVICE_TOKEN_HEADER, '') or ''

        if not expected:
            return False

        return hmac.compare_digest(provided, expected)
