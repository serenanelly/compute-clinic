from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

from .tenant_routing.context import TenantContextMissingError
from .tenant_routing.pool_registry import TenantDatabaseInactiveError
from .tenant_routing.registry_client import TenantDatabaseNotFoundError, TenantRegistryUnavailableError

# Phase 6 (Dynamic Database Routing) : ces exceptions signalent toutes
# "la base de ce tenant n'est pas utilisable actuellement" — jamais un
# repli vers une autre base. Traduites en 503 explicite plutôt que de
# tomber dans le 500 générique ci-dessous (qui exposerait str(exc)).
_TENANT_ROUTING_ERRORS = (
    TenantContextMissingError,
    TenantDatabaseInactiveError,
    TenantDatabaseNotFoundError,
    TenantRegistryUnavailableError,
)


def fultang_exception_handler(exc, context):
    """
    Gestionnaire d'exceptions personnalisé pour l'Hôpital Fultang.
    Formate toutes les erreurs sous forme standardisée.
    """
    if isinstance(exc, _TENANT_ROUTING_ERRORS):
        return Response({
            "success": False,
            "error_type": exc.__class__.__name__,
            "status_code": status.HTTP_503_SERVICE_UNAVAILABLE,
            "message": "Établissement temporairement indisponible.",
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    # Appel du gestionnaire d'exceptions par défaut de DRF pour obtenir la réponse de base
    response = exception_handler(exc, context)

    if response is not None:
        # Standardisation de l'objet d'erreur
        error_payload = {
            "success": False,
            "error_type": exc.__class__.__name__,
            "status_code": response.status_code,
            "message": "Une erreur est survenue lors du traitement de votre demande.",
            "details": response.data
        }
        
        # Messages plus conviviaux pour certains types d'erreurs
        if response.status_code == status.HTTP_404_NOT_FOUND:
            error_payload["message"] = "La ressource demandée ou le membre du personnel est introuvable."
        elif response.status_code == status.HTTP_400_BAD_REQUEST:
            error_payload["message"] = "Les données fournies sont invalides ou incomplètes."
        elif response.status_code == status.HTTP_403_FORBIDDEN:
            error_payload["message"] = "Vous n'avez pas la permission d'effectuer cette action."
            
        response.data = error_payload
    else:
        # Cas des erreurs non gérées par DRF (Erreurs 500 Serveur)
        return Response({
            "success": False,
            "error_type": "ServerError",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "message": "Erreur interne du serveur de l'hôpital. Veuillez contacter l'administrateur système.",
            "details": str(exc)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return response
