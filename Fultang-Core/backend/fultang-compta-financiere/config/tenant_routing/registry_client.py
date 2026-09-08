"""
registry_client.py — Client du Tenant Registry (Phase 6).

Le Tenant Registry (tenant-service) reste l'UNIQUE source de vérité pour
l'association tenant + service → base de données (TenantDatabase, Phase
5). Ce module ne fait qu'appeler l'API existante — il ne réimplémente
aucune logique de registre, ne décide jamais lui-même quelle base
utiliser en cas de doute (voir `resolve_tenant_database`).

Communication service-to-service directe (compta-financiere →
tenant-service), cohérente avec la décision déjà actée (Phase 4 :
"les communications service-to-service restent directes", Phase 2.1 :
authentification par jeton interne partagé `X-Internal-Service-Token`,
déjà utilisé par la Gateway pour `GET /tenants/resolve/`). Aucun nouveau
protocole introduit : ce service devient simplement un appelant de
confiance supplémentaire du même mécanisme `IsInternalService` (après
la Gateway, service-personnel et Medical-Monitoring).

Utilise `urllib` (bibliothèque standard, déjà utilisé ailleurs dans
FullTang pour ce type d'appel interne — voir Medical-Monitoring
signals.py) plutôt que d'ajouter une nouvelle dépendance HTTP.
"""
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Optional

from django.conf import settings

logger = logging.getLogger("config.tenant_routing")

# Code du service dans le catalogue PlatformService (Phase 5) — stable,
# ce service EST "Comptabilité Financière" (COMPTA), il n'y a pas
# d'ambiguïté possible (voir tenant-service/tenants/migrations/0003_seed_platform_services.py).
SERVICE_CODE = "COMPTA"


@dataclass(frozen=True)
class TenantDatabaseInfo:
    """Informations de connexion résolues pour un (tenant, service) donné."""
    database_name: str
    host: str
    port: int
    status: str


class TenantRegistryError(Exception):
    """Erreur générique de communication avec le Tenant Registry."""


class TenantRegistryUnavailableError(TenantRegistryError):
    """Le Tenant Registry n'a pas pu être contacté (réseau, timeout, 5xx)."""


class TenantDatabaseNotFoundError(TenantRegistryError):
    """Aucune configuration TenantDatabase n'existe pour ce (tenant, service)."""


def resolve_tenant_database(tenant_id: str) -> TenantDatabaseInfo:
    """
    Interroge le Tenant Registry pour connaître la base PostgreSQL du
    service COMPTA pour `tenant_id`.

    Ne met RIEN en cache ici (voir cache.py, couche au-dessus) — cette
    fonction reflète toujours l'état actuel du Registry au moment de
    l'appel.

    Lève TenantDatabaseNotFoundError si aucune configuration n'existe,
    TenantRegistryUnavailableError si le Registry est injoignable.
    Ne devine jamais une base de repli.
    """
    base_url = settings.TENANT_SERVICE_URL.rstrip("/")
    query = urllib.parse.urlencode({"tenant": tenant_id, "service": SERVICE_CODE})
    url = f"{base_url}/api/tenant-databases/resolve/?{query}"

    request = urllib.request.Request(
        url,
        headers={"X-Internal-Service-Token": settings.TENANT_SERVICE_INTERNAL_TOKEN},
        method="GET",
    )

    try:
        with urllib.request.urlopen(request, timeout=settings.TENANT_SERVICE_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise TenantDatabaseNotFoundError(
                f"Aucune configuration TenantDatabase pour tenant={tenant_id}, service={SERVICE_CODE}."
            ) from exc
        # 401/403 (jeton interne mal configuré) et toute autre erreur HTTP :
        # un problème de configuration/registre, jamais une raison de
        # deviner une base — on ne loggue jamais le jeton lui-même.
        logger.error("Tenant Registry a répondu %s pour tenant_id=%s", exc.code, tenant_id)
        raise TenantRegistryUnavailableError(f"Réponse inattendue du Tenant Registry ({exc.code}).") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        logger.warning("Tenant Registry injoignable pour tenant_id=%s : %s", tenant_id, exc)
        raise TenantRegistryUnavailableError(f"Tenant Registry injoignable : {exc}") from exc

    return TenantDatabaseInfo(
        database_name=payload["database_name"],
        host=payload["host"],
        port=int(payload["port"]),
        status=payload["status"],
    )
