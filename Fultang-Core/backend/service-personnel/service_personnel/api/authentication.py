"""
authentication.py — Authentification par confiance envers l'API Gateway.

Les microservices situés derrière la Gateway n'ont pas besoin de vérifier
le JWT eux-mêmes. La Gateway a déjà validé le token et injecte l'identité
de l'utilisateur dans les headers HTTP :
  - X-User-ID    : ID de l'utilisateur
  - X-User-Roles : Rôles de l'utilisateur (séparés par des virgules)

Cette classe lit ces headers et construit un objet "utilisateur" léger
que DRF peut utiliser via request.user.
"""
from rest_framework.authentication import BaseAuthentication


class GatewayUser:
    """Représentation légère d'un utilisateur authentifié par la Gateway."""
    is_authenticated = True
    is_active = True

    def __init__(self, user_id: str, roles: list):
        self.id = user_id
        self.pk = user_id  # Alias attendu par certains composants DRF
        self.roles = roles

    def __str__(self):
        return f"GatewayUser(id={self.id}, roles={self.roles})"

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
            'DEFAULT_AUTHENTICATION_CLASSES': [
                'api.authentication.GatewayHeaderAuthentication',
            ],
        }
    """

    def authenticate(self, request):
        # Django transforme 'X-User-ID' en 'HTTP_X_USER_ID'
        user_id = request.META.get("HTTP_X_USER_ID")
        user_roles_raw = request.META.get("HTTP_X_USER_ROLES", "")

        if not user_id:
            # Pas de header → on laisse DRF gérer (renverra 401 si IsAuthenticated)
            return None

        roles = [r.strip() for r in user_roles_raw.split(",") if r.strip()]
        user = GatewayUser(user_id=user_id, roles=roles)
        return (user, None)  # (user, auth_token)

    def authenticate_header(self, request):
        return 'X-User-ID (injected by API Gateway)'
