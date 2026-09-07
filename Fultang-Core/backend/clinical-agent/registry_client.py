# ============================================================
# Fultang — Clinical Agent
# Client du Tenant Registry (chantier Medical-Monitoring tenant-aware)
# ============================================================
"""
Le Tenant Registry (tenant-service) reste l'UNIQUE source de vérité pour
l'association tenant + service → base de données, ET pour la
configuration `allow_clinical_agent_export` d'un tenant. Ce module ne
fait qu'appeler l'API existante — il ne réimplémente aucune logique de
registre, ne décide jamais lui-même quelle base utiliser ou si un export
est autorisé en cas de doute.

Même mécanisme d'authentification interne que le reste de FullTang
(jeton partagé `X-Internal-Service-Token`, `IsInternalService` côté
tenant-service) : clinical-agent devient un quatrième appelant de
confiance du même mécanisme (après la Gateway, service-personnel,
Medical-Monitoring). Utilise `urllib` (stdlib) — même choix que
`registry_client.py` dans service-personnel/Medical-Monitoring, pas de
nouvelle dépendance HTTP alors que ce module en a déjà (httpx) mais
inutilisée ailleurs dans ce service : cohérence avec le reste de
FullTang plutôt qu'un troisième pattern d'appel HTTP interne.
"""
import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import List, Tuple

logger = logging.getLogger("agent.registry_client")

SERVICE_CODE = "MEDICAL"

TENANT_SERVICE_URL = os.getenv("TENANT_SERVICE_URL", "http://fultang-tenant-web:8000")
TENANT_SERVICE_INTERNAL_TOKEN = os.getenv("TENANT_SERVICE_INTERNAL_TOKEN", "")
TENANT_SERVICE_TIMEOUT_SECONDS = int(os.getenv("TENANT_SERVICE_TIMEOUT_SECONDS", "5"))

if not TENANT_SERVICE_INTERNAL_TOKEN:
    logger.warning("TENANT_SERVICE_INTERNAL_TOKEN n'est pas configurée — tout appel au Tenant Registry échouera.")


@dataclass(frozen=True)
class TenantDatabaseInfo:
    """Informations de connexion résolues pour (tenant, service=MEDICAL)."""
    database_name: str
    host: str
    port: int
    status: str


@dataclass(frozen=True)
class TenantConfig:
    """Configuration de plateforme d'un tenant pertinente pour clinical-agent."""
    id: str
    identifier: str
    status: str
    allow_clinical_agent_export: bool


class TenantRegistryError(Exception):
    """Erreur générique de communication avec le Tenant Registry."""


class TenantRegistryUnavailableError(TenantRegistryError):
    """Le Tenant Registry n'a pas pu être contacté (réseau, timeout, 5xx)."""


class TenantDatabaseNotFoundError(TenantRegistryError):
    """Aucune configuration TenantDatabase n'existe pour ce (tenant, service=MEDICAL)."""


class TenantNotFoundError(TenantRegistryError):
    """Aucun tenant ne correspond à cet id dans le Tenant Registry."""


def _get(url: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={"X-Internal-Service-Token": TENANT_SERVICE_INTERNAL_TOKEN},
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=TENANT_SERVICE_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def resolve_tenant_database(tenant_id: str) -> TenantDatabaseInfo:
    """
    Interroge le Tenant Registry pour connaître la base Medical-Monitoring
    de `tenant_id`. Ne met rien en cache ici (voir engine_registry.py, qui
    a sa propre couche de cache TTL, même patron que service-personnel).

    Lève TenantDatabaseNotFoundError si aucune configuration n'existe,
    TenantRegistryUnavailableError si le Registry est injoignable. Ne
    devine jamais une base de repli.
    """
    base_url = TENANT_SERVICE_URL.rstrip("/")
    query = urllib.parse.urlencode({"tenant": tenant_id, "service": SERVICE_CODE})
    url = f"{base_url}/api/tenant-databases/resolve/?{query}"

    try:
        payload = _get(url)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise TenantDatabaseNotFoundError(
                f"Aucune configuration TenantDatabase pour tenant={tenant_id}, service={SERVICE_CODE}."
            ) from exc
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


def get_tenant_config(tenant_id: str) -> TenantConfig:
    """
    Interroge le Tenant Registry pour la configuration de plateforme d'un
    tenant (statut, autorisation d'export). Utilisé AVANT toute lecture
    de données médicales destinées à l'export (voir main.py::sync_visite_endpoint
    et sync.py) — le refus doit intervenir avant la lecture inutile.

    Lève TenantNotFoundError si le tenant n'existe pas,
    TenantRegistryUnavailableError si le Registry est injoignable.
    """
    base_url = TENANT_SERVICE_URL.rstrip("/")
    query = urllib.parse.urlencode({"id": tenant_id})
    url = f"{base_url}/api/tenants/resolve/?{query}"

    try:
        payload = _get(url)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise TenantNotFoundError(f"Tenant introuvable : {tenant_id}.") from exc
        logger.error("Tenant Registry a répondu %s pour tenant_id=%s", exc.code, tenant_id)
        raise TenantRegistryUnavailableError(f"Réponse inattendue du Tenant Registry ({exc.code}).") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        logger.warning("Tenant Registry injoignable pour tenant_id=%s : %s", tenant_id, exc)
        raise TenantRegistryUnavailableError(f"Tenant Registry injoignable : {exc}") from exc

    return TenantConfig(
        id=payload["id"],
        identifier=payload["identifier"],
        status=payload["status"],
        allow_clinical_agent_export=bool(payload["allow_clinical_agent_export"]),
    )


def list_active_tenant_databases() -> List[Tuple[str, TenantDatabaseInfo]]:
    """
    Énumère les tenants ayant une base MEDICAL ACTIVE — utilisé
    UNIQUEMENT par le rattrapage périodique interne (voir main.py::
    scheduled_sync_job), jamais par un endpoint public. Chaque entrée
    porte aussi `tenant_id` (attribut dynamique, hors dataclass stricte)
    pour permettre l'itération côté appelant.
    """
    base_url = TENANT_SERVICE_URL.rstrip("/")
    query = urllib.parse.urlencode({"service": SERVICE_CODE})
    url = f"{base_url}/api/tenant-databases/resolve-active/?{query}"

    try:
        payload = _get(url)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
        logger.warning("Impossible d'énumérer les tenants MEDICAL actifs : %s", exc)
        raise TenantRegistryUnavailableError(f"Tenant Registry injoignable : {exc}") from exc

    results = []
    for row in payload:
        info = TenantDatabaseInfo(
            database_name=row["database_name"], host=row["host"],
            port=int(row["port"]), status=row["status"],
        )
        # Attaché dynamiquement : TenantDatabaseInfo (frozen) ne porte pas
        # le tenant_id par conception (registry_client.py de service-personnel
        # n'en a jamais besoin, résolu par le seul tenant courant) — ici
        # l'énumération EST le point de la fonction, donc on l'expose via
        # un tuple plutôt que de modifier la dataclass partagée.
        results.append((row["tenant_id"], info))
    return results
