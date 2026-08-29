"""
permissions.py — Frontière d'autorisation du Tenant Management.

FullTang distingue désormais deux niveaux d'identité :

  - PLATFORM SCOPE : le Platform Admin est HORS des tenants. C'est lui qui
    gère l'existence même des établissements (création, consultation,
    activation/désactivation d'un tenant). C'est le seul niveau qui a le
    droit de parler au Tenant Registry.

  - TENANT SCOPE : toute autre identité (Hospital Admin, personnel
    médical, etc.) appartient à un tenant précis. Le rôle métier
    générique "ADMIN" est un rôle *local* à un établissement — il ne
    donne AUCUN accès au Tenant Registry, même s'il porte un nom proche
    de "administrateur". Un tenant existe avant l'Hospital Admin qui y
    est rattaché ; si le tenant disparaît, cette identité ne doit jamais
    devenir un administrateur global de la plateforme.

    L'association explicite Hospital Admin ↔ tenant (et la propagation
    d'un tenant_id dans le JWT / le contexte de requête) sera traitée
    dans les phases ultérieures de la roadmap multitenant (Tenant-Aware
    Authentication, Tenant Context Propagation). Ce fichier ne fait que
    fermer la porte du Tenant Management aux rôles non PLATFORM_ADMIN —
    il n'introduit aucune notion de tenant courant.

Ce module s'appuie exclusivement sur les headers X-User-ID / X-User-Roles
déjà injectés par l'API Gateway (voir config.authentication) pour le CRUD
Tenant Management, et sur un jeton interne partagé pour la communication
service-to-service (résolution hostname → tenant, voir IsInternalService
ci-dessous) : aucun nouveau protocole d'authentification n'est introduit,
seulement une deuxième vérification par header, dans le même esprit que
GatewayHeaderAuthentication.
"""
import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission

# Rôle plateforme requis pour toute opération de Tenant Management.
PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN'

# Header transportant le jeton interne Gateway → Tenant Service.
INTERNAL_SERVICE_TOKEN_HEADER = 'X-Internal-Service-Token'


class IsPlatformAdmin(BasePermission):
    """
    Autorise uniquement les identités possédant le rôle PLATFORM_ADMIN
    parmi les rôles transmis par la Gateway (X-User-Roles).

    Le rôle métier "ADMIN" (administrateur d'un établissement) est
    volontairement exclu : il n'a pas de portée plateforme.
    """

    message = "Seul un administrateur de la plateforme (PLATFORM_ADMIN) peut gérer le Tenant Registry."

    def has_permission(self, request, view):
        roles = getattr(request.user, 'roles', None) or []
        return PLATFORM_ADMIN_ROLE in roles


class IsInternalService(BasePermission):
    """
    Autorise uniquement les appels porteurs du jeton interne partagé entre
    la Gateway et le Tenant Service — utilisé exclusivement par
    GET /tenants/resolve/ (Phase 2.1).

    Ce jeton ne représente PAS un utilisateur : il prouve que l'appelant
    est la Gateway elle-même (communication service-to-service), pas un
    rôle métier. Comparaison en temps constant (hmac.compare_digest) pour
    éviter les attaques par timing. Si aucun jeton n'est configuré côté
    Tenant Service (TENANT_SERVICE_INTERNAL_TOKEN vide), l'accès est
    refusé par défaut plutôt qu'accepté silencieusement.
    """

    message = "Jeton de service interne manquant ou invalide."

    def has_permission(self, request, view):
        expected = getattr(settings, 'TENANT_SERVICE_INTERNAL_TOKEN', '') or ''
        provided = request.headers.get(INTERNAL_SERVICE_TOKEN_HEADER, '') or ''

        if not expected:
            return False

        return hmac.compare_digest(provided, expected)
