"""
cache.py — Cache TTL du mapping tenant → base de données (Phase 6).

Objectif : éviter d'interroger le Tenant Registry à chaque requête. Le
Registry reste la seule SOURCE DE VÉRITÉ — ce cache n'est qu'une
optimisation reconstructible, jamais une donnée persistante.

Ce qui est mis en cache : `TenantDatabaseInfo` (database_name, host,
port, status) par tenant_id, tel que renvoyé par le Registry pour le
service PERSONNEL.

Durée de vie : configurable via `TENANT_DB_CACHE_TTL_SECONDS` (défaut
300s). Après expiration, la prochaine requête pour ce tenant redemande
l'information au Registry.

Comment une entrée est créée : au premier accès pour un tenant donné
(lazy), jamais en pré-chargement.

Comment elle est invalidée : uniquement par expiration du TTL. Aucune
invalidation active (webhook, signal) n'est implémentée dans cette
phase — si un administrateur change la configuration d'un tenant côté
Registry, le changement met jusqu'à TENANT_DB_CACHE_TTL_SECONDS avant
d'être pris en compte ici. Documenté comme limite connue (voir
MULTITENANT_ARCHITECTURE.md).

Après redémarrage du service : ce cache est un simple dict Python en
mémoire de PROCESSUS — un redémarrage le vide entièrement. Ce n'est
jamais un problème de correction : la prochaine requête de chaque tenant
reconstruit son entrée depuis le Registry (source de vérité), au prix
d'un aller-retour réseau supplémentaire, une seule fois par tenant.

Si le Registry est temporairement indisponible : décision explicite —
- s'il existe une entrée en cache pour ce tenant, même expirée, elle est
  réutilisée (dégradation gracieuse : mieux vaut continuer à router
  correctement avec une information légèrement obsolète que de refuser
  tout le trafic d'un tenant à cause d'un blip réseau), avec un
  avertissement loggué ;
- s'il n'existe AUCUNE entrée (premier accès de ce tenant), l'appel est
  refusé explicitement (TenantRegistryUnavailableError propagée) —
  deviner une base ici serait exactement le risque de fuite que cette
  phase doit éliminer.

Portée : un dict par PROCESSUS Python (donc par conteneur/worker). En
déploiement mono-instance actuel de FullTang, c'est équivalent à "un
cache par service". Si FullTang passe à plusieurs instances de
service-personnel, chaque instance aura son propre cache indépendant
(pas de cohérence inter-instances) — acceptable ici car le cache ne
contient que des métadonnées de connexion peu volatiles, jamais des
données métier ; voir pool_registry.py pour la même limite appliquée au
verrouillage de création de connexion.
"""
import logging
import threading
import time
from dataclasses import dataclass
from typing import Dict, Optional

from django.conf import settings

from .registry_client import TenantDatabaseInfo, TenantRegistryUnavailableError, resolve_tenant_database

logger = logging.getLogger("api.tenant_routing")


@dataclass
class _CacheEntry:
    info: TenantDatabaseInfo
    cached_at: float


class TenantDatabaseCache:
    """Cache TTL, thread-safe, en mémoire de processus."""

    def __init__(self):
        self._entries: Dict[str, _CacheEntry] = {}
        self._lock = threading.Lock()

    def _ttl_seconds(self) -> int:
        return settings.TENANT_DB_CACHE_TTL_SECONDS

    def get(self, tenant_id: str) -> TenantDatabaseInfo:
        """Retourne les informations de connexion pour `tenant_id`, via le cache si valide.

        Lève TenantRegistryUnavailableError ou TenantDatabaseNotFoundError
        (voir registry_client) si aucune information n'est disponible.
        """
        with self._lock:
            entry = self._entries.get(tenant_id)

        if entry is not None and (time.monotonic() - entry.cached_at) < self._ttl_seconds():
            return entry.info

        try:
            info = resolve_tenant_database(tenant_id)
        except TenantRegistryUnavailableError:
            if entry is not None:
                logger.warning(
                    "Tenant Registry indisponible pour tenant_id=%s — réutilisation "
                    "de l'entrée en cache (potentiellement expirée).", tenant_id,
                )
                return entry.info
            raise

        with self._lock:
            self._entries[tenant_id] = _CacheEntry(info=info, cached_at=time.monotonic())

        return info

    def invalidate(self, tenant_id: str) -> None:
        """Supprime une entrée du cache (utilisé par les tests ; aucune invalidation active en production à ce stade)."""
        with self._lock:
            self._entries.pop(tenant_id, None)

    def clear(self) -> None:
        """Vide entièrement le cache (utilisé par les tests)."""
        with self._lock:
            self._entries.clear()


# Instance unique du cache pour ce processus — importée par le router.
tenant_database_cache = TenantDatabaseCache()
