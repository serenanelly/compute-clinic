"""
authentication.py — Authentification par confiance envers l'API Gateway.

Les microservices situés derrière la Gateway n'ont pas besoin de vérifier
le JWT eux-mêmes. La Gateway a déjà validé le token et injecte l'identité
de l'utilisateur dans les headers HTTP :
  - X-User-ID    : ID de l'utilisateur
  - X-User-Roles : Rôles de l'utilisateur (séparés par des virgules)
  - X-User-Email : Email de l'utilisateur (Logs d'administration, Phase 2
                    du cycle de vie du tenant — la Gateway l'envoie déjà
                    depuis sa mise en JWT des claims PlatformAdmin, voir
                    api-gateway/app/main.py::_build_user_headers ; ce
                    service ne le lisait pas jusqu'ici, d'où un acteur
                    de log réduit à un id opaque)
  - X-Tenant-ID  : Tenant de l'utilisateur authentifié (absent pour un
                    PLATFORM_ADMIN ou un compte du pool non assigné) —
                    lu pour la première fois ici (Cycle de vie du tenant,
                    Phase 2) afin qu'un utilisateur tenant-scope (Admin,
                    personnel...) puisse consulter, en libre-service, SA
                    PROPRE configuration de services fonctionnels — voir
                    TenantViewSet.my_functional_services (views.py).

Cette classe lit ces headers et construit un objet "utilisateur" léger
que DRF peut utiliser via request.user.

Note (Phase 1 — Tenant Management) : ce service ne fait, pour l'instant,
aucune vérification de tenant sur l'utilisateur authentifié. L'association
d'un utilisateur à un tenant (Tenant Context Propagation) est traitée dans
une phase ultérieure de la roadmap multitenant.
"""
from rest_framework.authentication import BaseAuthentication


class GatewayUser:
    """Représentation légère d'un utilisateur authentifié par la Gateway."""
    is_authenticated = True
    is_active = True

    def __init__(self, user_id: str, roles: list, email: str = '', tenant_id: str = None):
        self.id = user_id
        self.pk = user_id  # Alias attendu par certains composants DRF
        self.roles = roles
        self.email = email
        self.tenant_id = tenant_id

    def __str__(self):
        return f"GatewayUser(id={self.id}, roles={self.roles}, email={self.email}, tenant_id={self.tenant_id})"

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
        user_email = request.META.get("HTTP_X_USER_EMAIL", "") or ""
        tenant_id = request.META.get("HTTP_X_TENANT_ID") or None

        if not user_id:
            # Pas de header → on laisse DRF gérer (renverra 401 si IsAuthenticated)
            return None

        roles = [r.strip() for r in user_roles_raw.split(",") if r.strip()]
        user = GatewayUser(user_id=user_id, roles=roles, email=user_email, tenant_id=tenant_id)
        return (user, None)  # (user, auth_token)

    def authenticate_header(self, request):
        return 'X-User-ID (injected by API Gateway)'
