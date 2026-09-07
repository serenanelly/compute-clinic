"""
middleware.py — Nettoyage du Tenant Context.

Le Tenant Context (context.py) est établi PENDANT le traitement de la
requête (par GatewayHeaderAuthentication), pas par un middleware
classique : au moment où le middleware Django "avant vue" s'exécute,
l'authentification DRF n'a pas encore eu lieu (elle se produit à
l'intérieur du dispatch de la vue). Ce middleware n'a donc qu'UN rôle :
garantir qu'un contexte établi pendant une requête ne survit JAMAIS
jusqu'à la requête suivante traitée par le même thread — isolation
stricte entre requêtes.

Le `try/finally` couvre aussi les cas d'exception non gérée dans la vue :
le nettoyage a lieu quoi qu'il arrive.
"""
from .context import reset_tenant_context, set_tenant_context


class TenantContextCleanupMiddleware:
    """
    À placer en DERNIER dans MIDDLEWARE (le plus proche de la vue) pour
    englober tout le cycle de la requête, y compris l'authentification
    DRF qui a lieu pendant `get_response`.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Toujours repartir d'un état neutre — au cas où un contexte
        # d'une requête précédente aurait, par erreur, échappé à son
        # propre nettoyage (défense en profondeur : ne devrait jamais
        # arriver grâce au `finally` ci-dessous).
        token = set_tenant_context(None)
        try:
            return self.get_response(request)
        finally:
            reset_tenant_context(token)
