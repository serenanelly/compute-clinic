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
déjà injectés par l'API Gateway (voir config.authentication) : aucun
nouveau mécanisme d'authentification n'est introduit ici.
"""
from rest_framework.permissions import BasePermission

# Rôle plateforme requis pour toute opération de Tenant Management.
PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN'


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
