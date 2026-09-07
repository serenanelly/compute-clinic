# ============================================================
# Fultang — Clinical Agent
# Engines SQLAlchemy par tenant (chantier Medical-Monitoring tenant-aware)
# ============================================================
"""
Avant ce chantier, `database.py` n'ouvrait qu'UN SEUL moteur SQLAlchemy
(`main_engine`) vers "la" base Medical-Monitoring. Une fois
Medical-Monitoring passé en Database per Tenant, ce module résout un
moteur DIFFÉRENT par tenant, en réutilisant le Tenant Registry existant
(`registry_client.py`) — jamais de logique de résolution dupliquée.

Principe (équivalent SQLAlchemy de `pool_registry.py` côté
service-personnel/Medical-Monitoring, structure volontairement plus
simple : "un registry simple par tenant" suffit ici, pas besoin de
réimplémenter tout `django.db.connections`) :

    tenant_id → Tenant Registry (registry_client.resolve_tenant_database)
             → TenantDatabaseInfo (database_name, host, port, status)
             → SQLAlchemy engine, mis en cache pour ce tenant

Cache : un dict `{tenant_id: Engine}` par PROCESSUS Python — un engine
créé une fois est réutilisé pour tous les appels suivants concernant ce
tenant (évite de recréer un pool de connexions à chaque appel). Verrouillé
par tenant (pas un verrou global) pour éviter que deux threads créent
deux engines différents pour le même tenant en cas d'appels concurrents.

Ce N'EST PAS un vrai pool applicatif : SQLAlchemy gère lui-même un pool
de connexions PAR ENGINE (`QueuePool`, taille par défaut 5 + 10
overflow) — documenté honnêtement, pas présenté comme plus que cela.

Limite explicite (même famille que pool_registry.py/§9.2.10 de
MULTITENANT_ARCHITECTURE.md) : un engine déjà créé n'est jamais
réévalué automatiquement si le tenant est désactivé ou sa base changée
côté Registry — seul un redémarrage du processus le referait. Acceptable
ici car chaque appel de synchronisation revérifie de toute façon
`allow_clinical_agent_export` et le statut du tenant à CHAQUE fois (voir
sync.py), indépendamment du cache d'engine.
"""
import logging
import os
import threading
from typing import Dict

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from registry_client import TenantDatabaseInfo, resolve_tenant_database

logger = logging.getLogger("agent.engine_registry")

# Credentials PostgreSQL pour TOUTES les bases tenant MEDICAL — même
# compte partagé que Medical-Monitoring lui-même utilise pour créer ces
# bases (TENANT_DB_USER/PASSWORD, voir Medical-Monitoring/core/settings.py) ;
# clinical-agent n'a besoin que de LIRE, mais réutilise le même compte
# plutôt que d'introduire un second jeu de credentials pour cette phase.
_MAIN_DB_USER = os.getenv("TENANT_DB_USER", "fultang_user")
_MAIN_DB_PASSWORD = os.getenv("TENANT_DB_PASSWORD", "")


class TenantDatabaseInactiveError(Exception):
    """Le TenantDatabase existe dans le Registry mais n'est pas ACTIVE."""

    def __init__(self, tenant_id: str, current_status: str):
        self.tenant_id = tenant_id
        self.current_status = current_status
        super().__init__(f"La base MEDICAL du tenant {tenant_id} n'est pas active (statut={current_status}).")


_engines: Dict[str, Engine] = {}
_engines_guard = threading.Lock()
_creation_locks: Dict[str, threading.Lock] = {}
_creation_locks_guard = threading.Lock()


def _get_creation_lock(tenant_id: str) -> threading.Lock:
    with _creation_locks_guard:
        lock = _creation_locks.get(tenant_id)
        if lock is None:
            lock = threading.Lock()
            _creation_locks[tenant_id] = lock
        return lock


def _build_engine(info: TenantDatabaseInfo) -> Engine:
    url = f"postgresql://{_MAIN_DB_USER}:{_MAIN_DB_PASSWORD}@{info.host}:{info.port}/{info.database_name}"
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        connect_args={"connect_timeout": 10},
    )


def get_engine_for_tenant(tenant_id: str) -> Engine:
    """
    Retourne le moteur SQLAlchemy pour la base Medical-Monitoring de
    `tenant_id`, en le créant si nécessaire.

    Lève TenantDatabaseInactiveError si le TenantDatabase existe mais
    n'est pas ACTIVE, ou toute exception de `registry_client` si la
    résolution échoue — jamais de repli silencieux vers une autre base.
    """
    with _engines_guard:
        engine = _engines.get(tenant_id)
    if engine is not None:
        return engine

    lock = _get_creation_lock(tenant_id)
    with lock:
        with _engines_guard:
            engine = _engines.get(tenant_id)
        if engine is not None:
            return engine

        info = resolve_tenant_database(tenant_id)
        if info.status != "ACTIVE":
            raise TenantDatabaseInactiveError(tenant_id, info.status)

        engine = _build_engine(info)
        with _engines_guard:
            _engines[tenant_id] = engine
        logger.info("Engine créé pour tenant_id=%s (base=%s)", tenant_id, info.database_name)
        return engine
