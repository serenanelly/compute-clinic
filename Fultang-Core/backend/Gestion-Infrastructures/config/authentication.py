"""
authentication.py — Authentification par confiance envers l'API Gateway.

Les microservices situés derrière la Gateway n'ont pas besoin de vérifier
le JWT eux-mêmes. La Gateway a déjà validé le token et injecte l'identité
de l'utilisateur dans les headers HTTP :
  - X-User-ID    : ID de l'utilisateur
  - X-User-Roles : Rôles de l'utilisateur (séparés par des virgules)
  - X-Tenant-ID  : Tenant associé à l'utilisateur (Phase Tenant Context
                   Propagation) — absent si le compte n'est rattaché à
                   aucun tenant (pool non assigné).

Cette classe lit ces headers et construit un objet "utilisateur" léger
que DRF peut utiliser via request.user. Elle ne revalide pas le JWT : elle
fait confiance à la Gateway, seule responsable de garantir que ces headers
ne reflètent jamais une valeur fournie librement par le client.
"""
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class GatewayUser:
    """Représentation légère d'un utilisateur authentifié par la Gateway."""
    is_authenticated = True
    is_active = True

    def __init__(self, user_id: str, roles: list, tenant_id: str = None):
        self.id = user_id
        self.pk = user_id  # Alias attendu par certains composants DRF
        self.roles = roles
        self.tenant_id = tenant_id

    def __str__(self):
        return f"GatewayUser(id={self.id}, roles={self.roles}, tenant_id={self.tenant_id})"

    # Méthodes factices requises par Django/DRF pour la compatibilité
    def has_perm(self, perm, obj=None):
        return True

    def has_module_perms(self, app_label):
        return True


class GatewayHeaderAuthentication(BaseAuthentication):
    """
    Backend d'authentification basé sur les headers injectés par l'API Gateway.

    Utilisation dans settings.py :
        REST_FRAMEWORK = {
            'DEFAULT_AUTHENTICATION_CLASSES': (
                'config.authentication.GatewayHeaderAuthentication',
            ),
        }
    """

    def authenticate(self, request):
        # Django transforme 'X-User-ID' en 'HTTP_X_USER_ID'
        user_id = request.META.get("HTTP_X_USER_ID")
        user_roles_raw = request.META.get("HTTP_X_USER_ROLES", "")
        tenant_id = request.META.get("HTTP_X_TENANT_ID") or None

        if not user_id:
            # Pas de header → on laisse DRF gérer (renverra 401 si IsAuthenticated)
            return None

        roles = [r.strip() for r in user_roles_raw.split(",") if r.strip()]
        user = GatewayUser(user_id=user_id, roles=roles, tenant_id=tenant_id)
        return (user, None)  # (user, auth_token)

    def authenticate_header(self, request):
        return 'X-User-ID (injected by API Gateway)'
