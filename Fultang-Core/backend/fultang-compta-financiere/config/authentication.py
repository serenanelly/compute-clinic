"""
authentication.py — Authentification par confiance envers l'API Gateway.

Les microservices situés derrière la Gateway n'ont pas besoin de vérifier
le JWT eux-mêmes. La Gateway a déjà validé le token et injecte l'identité
de l'utilisateur dans les headers HTTP (X-User-ID, X-User-Roles, X-Tenant-ID, …).
X-Tenant-ID est absent si le compte n'est rattaché à aucun tenant.

Fallback : si le client appelle le service avec un Bearer JWT Gateway
(sans headers X-User-*), on décode le token localement (même secret que la
Gateway) — le JWT porte lui aussi `tenant_id` (voir api-gateway/app/main.py::login()).
"""

import logging

from django.conf import settings
from rest_framework import authentication

logger = logging.getLogger(__name__)


class GatewayUser:
    """
    Objet utilisateur abstrait représentant l'identité transmise par la Gateway.
    Permet à request.user.is_authenticated de valoir True.
    """
    def __init__(self, user_id, roles, tenant_id=None, email='', nom='', prenom=''):
        self.id = user_id
        self.roles = roles if isinstance(roles, list) else []
        self.tenant_id = tenant_id
        self.email = email or ''
        self.nom = nom or ''
        self.prenom = prenom or ''
        self.is_authenticated = True

    def __str__(self):
        return f"GatewayUser(id={self.id}, roles={self.roles}, tenant_id={self.tenant_id}, email={self.email})"


class GatewayHeaderAuthentication(authentication.BaseAuthentication):
    """
    1. Headers X-User-* injectés par la Gateway (prod).
    2. Sinon Bearer JWT Gateway (dev direct ou proxy sans injection).
    """
    def authenticate(self, request):
        user_id = request.META.get('HTTP_X_USER_ID')
        user_roles_str = request.META.get('HTTP_X_USER_ROLES')

        if user_id:
            roles = user_roles_str.split(',') if user_roles_str else []
            roles = [r.strip() for r in roles if r.strip()]
            return (GatewayUser(
                user_id=user_id,
                roles=roles,
                tenant_id=request.META.get('HTTP_X_TENANT_ID') or None,
                email=request.META.get('HTTP_X_USER_EMAIL', ''),
                nom=request.META.get('HTTP_X_USER_NOM', ''),
                prenom=request.META.get('HTTP_X_USER_PRENOM', ''),
            ), None)

        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1].strip()
            if token and not token.startswith('fake-'):
                payload = self._decode_gateway_jwt(token)
                if payload and payload.get('sub'):
                    roles = payload.get('roles') or []
                    if isinstance(roles, str):
                        roles = [roles]
                    return (GatewayUser(
                        user_id=str(payload['sub']),
                        roles=roles,
                        tenant_id=payload.get('tenant_id'),
                        email=payload.get('email') or '',
                        nom=payload.get('nom') or '',
                        prenom=payload.get('prenom') or '',
                    ), None)

        return None

    def _decode_gateway_jwt(self, token):
        secret = getattr(settings, 'GATEWAY_JWT_SECRET', None)
        if not secret:
            return None
        try:
            import jwt
            return jwt.decode(token, secret, algorithms=['HS256'])
        except Exception as exc:
            logger.debug('[Auth] JWT Gateway invalide: %s', exc)
            return None
