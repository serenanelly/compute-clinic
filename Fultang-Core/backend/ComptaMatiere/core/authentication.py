"""
authentication.py — Authentification par confiance envers l'API Gateway.

Les microservices situés derrière la Gateway n'ont pas besoin de vérifier
le JWT eux-mêmes. La Gateway a déjà validé le token et injecte l'identité
de l'utilisateur dans les headers HTTP (X-User-ID, X-User-Roles,
X-Tenant-ID — ce dernier absent si le compte n'est rattaché à aucun tenant).

Cette classe lit ces headers et reconstruit un objet User abstrait
pour que Django REST Framework (permissions, requêtes) fonctionne normalement.
Elle ne revalide pas le JWT : elle fait confiance à la Gateway, seule
responsable de garantir que ces headers ne reflètent jamais une valeur
fournie librement par le client.
"""

from rest_framework import authentication
from rest_framework import exceptions
from django.contrib.auth.models import AnonymousUser

class GatewayUser:
    """
    Objet utilisateur abstrait représentant l'identité transmise par la Gateway.
    Permet à request.user.is_authenticated de valoir True.
    """
    def __init__(self, user_id, roles, tenant_id=None):
        self.id = user_id
        self.roles = roles
        self.tenant_id = tenant_id
        self.is_authenticated = True

    def __str__(self):
        return f"GatewayUser(id={self.id}, roles={self.roles}, tenant_id={self.tenant_id})"


class GatewayHeaderAuthentication(authentication.BaseAuthentication):
    """
    Lit les headers HTTP_X_USER_ID, HTTP_X_USER_ROLES et HTTP_X_TENANT_ID
    injectés par la Gateway. Si X-User-ID est absent, refuse l'authentification.
    """
    def authenticate(self, request):
        user_id = request.META.get('HTTP_X_USER_ID')
        user_roles_str = request.META.get('HTTP_X_USER_ROLES')
        tenant_id = request.META.get('HTTP_X_TENANT_ID') or None

        if not user_id:
            # Aucun identifiant fourni par la Gateway = accès anonyme ou non autorisé
            return None

        # Reconstruire la liste des rôles
        roles = user_roles_str.split(',') if user_roles_str else []

        user = GatewayUser(user_id=user_id, roles=roles, tenant_id=tenant_id)

        # Retourne (user, auth_info)
        return (user, None)
