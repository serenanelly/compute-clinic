"""
functional_service_client.py — Activation/désactivation de service
fonctionnel (Cycle de vie du tenant, Phase 2, §12-15).

Interroge le Tenant Registry (tenant-service) pour savoir si un
`FunctionalService` donné (ex: PHARMACIE) est activé pour le tenant
courant, AVANT d'autoriser une opération métier qui en dépend (créer un
pharmacien, utiliser une fonctionnalité pharmacie...).

Même mécanique que `registry_client.py`/`cache.py` (Phase 6, résolution
de base de données) : `urllib` (stdlib), jeton de service interne
partagé, cache TTL en mémoire de processus — volontairement dupliqué
plutôt que factorisé avec `TenantDatabaseCache` (clé et donnée mise en
cache différentes : ici `(tenant_id, service_code) -> bool`, pas une
`TenantDatabaseInfo`), cohérent avec la duplication déjà assumée entre
`cache.py` et son équivalent Medical-Monitoring.
"""
import json
import logging
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Dict, Tuple

from django.conf import settings

logger = logging.getLogger("api.tenant_routing")


class FunctionalServiceRegistryError(Exception):
    """Erreur générique de résolution d'un service fonctionnel."""


class FunctionalServiceRegistryUnavailableError(FunctionalServiceRegistryError):
    """Le Tenant Registry n'a pas pu être contacté (réseau, timeout, 5xx)."""


class FunctionalServiceUnknownError(FunctionalServiceRegistryError):
    """Le tenant ou le code de service fonctionnel est inconnu du Registry."""


def resolve_functional_service_enabled(tenant_id: str, code: str) -> bool:
    """
    Interroge le Tenant Registry : ce service fonctionnel est-il activé
    pour ce tenant ? Ne met rien en cache ici (voir cache ci-dessous).
    """
    base_url = settings.TENANT_SERVICE_URL.rstrip("/")
    query = urllib.parse.urlencode({"tenant": tenant_id, "code": code})
    url = f"{base_url}/api/tenants/functional-services/resolve/?{query}"

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
            raise FunctionalServiceUnknownError(
                f"Tenant ou service fonctionnel inconnu : tenant={tenant_id}, code={code}."
            ) from exc
        logger.error("Tenant Registry a répondu %s pour tenant_id=%s, code=%s", exc.code, tenant_id, code)
        raise FunctionalServiceRegistryUnavailableError(f"Réponse inattendue du Tenant Registry ({exc.code}).") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        logger.warning("Tenant Registry injoignable pour tenant_id=%s, code=%s : %s", tenant_id, code, exc)
        raise FunctionalServiceRegistryUnavailableError(f"Tenant Registry injoignable : {exc}") from exc

    return bool(payload["enabled"])


@dataclass
class _CacheEntry:
    enabled: bool
    cached_at: float


class FunctionalServiceCache:
    """Cache TTL, thread-safe, en mémoire de processus — voir docstring du module."""

    def __init__(self):
        self._entries: Dict[Tuple[str, str], _CacheEntry] = {}
        self._lock = threading.Lock()

    def _ttl_seconds(self) -> int:
        return getattr(settings, 'FUNCTIONAL_SERVICE_CACHE_TTL_SECONDS', 60)

    def get(self, tenant_id: str, code: str) -> bool:
        """Retourne l'état activé/désactivé, via le cache si valide.

        Lève FunctionalServiceRegistryError si aucune information n'est
        disponible et le Registry est injoignable — ne devine jamais un
        état par défaut ici (contrairement à
        `TenantFunctionalServiceService.list_for_tenant`, en amont, qui
        porte légitimement la règle "absent = activé par défaut" : cette
        règle est déjà appliquée côté Registry, cette couche ne fait que
        relayer/mettre en cache sa réponse).
        """
        key = (tenant_id, code)
        with self._lock:
            entry = self._entries.get(key)

        if entry is not None and (time.monotonic() - entry.cached_at) < self._ttl_seconds():
            return entry.enabled

        try:
            enabled = resolve_functional_service_enabled(tenant_id, code)
        except FunctionalServiceRegistryUnavailableError:
            if entry is not None:
                logger.warning(
                    "Tenant Registry indisponible pour (tenant=%s, code=%s) — "
                    "réutilisation de l'entrée en cache (potentiellement expirée).",
                    tenant_id, code,
                )
                return entry.enabled
            raise

        with self._lock:
            self._entries[key] = _CacheEntry(enabled=enabled, cached_at=time.monotonic())

        return enabled

    def invalidate(self, tenant_id: str, code: str) -> None:
        """
        Supprime une entrée du cache.

        Cycle de vie du tenant, Phase 3 : appelée en PRODUCTION par
        `FunctionalServiceInvalidateView` (views.py) — poussée par
        tenant-service juste après un `toggle`/`bulk-set` réussi, pour ne
        plus dépendre uniquement de l'expiration du TTL
        (`FUNCTIONAL_SERVICE_CACHE_TTL_SECONDS`, filet de sécurité
        conservé). Aussi utilisée par les tests.
        """
        with self._lock:
            self._entries.pop((tenant_id, code), None)

    def clear(self) -> None:
        """Vide entièrement le cache (tests uniquement)."""
        with self._lock:
            self._entries.clear()


# Instance unique du cache pour ce processus.
functional_service_cache = FunctionalServiceCache()
