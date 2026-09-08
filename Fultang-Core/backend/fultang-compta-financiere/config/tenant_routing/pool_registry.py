"""
pool_registry.py — Connexions par tenant et verrouillage de création
(Phase 6).

Technique de routage dynamique : Django lit ses alias de connexion
depuis `django.db.connections.databases` (un dict, initialement rempli
depuis `settings.DATABASES` au premier accès, puis conservé en mémoire).
On peut y AJOUTER de nouveaux alias au runtime : Django les traite
ensuite exactement comme s'ils avaient toujours existé. Aucune
bibliothèque tierce nécessaire (même technique déjà vérifiée
empiriquement lors des chantiers service-personnel et Medical-Monitoring).

Pools de connexions : Django (avec psycopg2, sans pgbouncer/psycopg3)
n'a PAS de vrai pool multi-connexions natif. Le mécanisme réellement
disponible est `CONN_MAX_AGE` : une connexion persistante réutilisée par
thread/alias (au lieu d'ouvrir/fermer une connexion à chaque requête).
Documenté honnêtement comme tel — pas présenté comme un pool qu'il n'est
pas. Même mécanisme et mêmes limites que les autres services FullTang.

Concurrence : `threading.Lock()` PAR TENANT, PAR PROCESSUS PYTHON.
  - Portée : ce verrou ne protège QUE les requêtes traitées par le MÊME
    processus/conteneur. Ce service n'exécute qu'UNE seule instance
    (vérifié dans docker-compose.yml — aucun mécanisme de scaling
    horizontal) : cette portée est donc suffisante.
  - Limite explicite (identique aux autres services) : un déploiement
    multi-instance futur nécessiterait un verrou distribué
    (`pg_advisory_lock`/Redis), non implémenté ici, non justifié
    aujourd'hui.
"""
import logging
import threading
from typing import Dict

import psycopg2
import psycopg2.sql
from django.conf import settings
from django.core.management import call_command
from django.db import connections

from .cache import tenant_database_cache
from .registry_client import TenantDatabaseInfo

logger = logging.getLogger("config.tenant_routing")


class TenantDatabaseInactiveError(Exception):
    """Le TenantDatabase existe dans le Registry mais n'est pas ACTIVE (PENDING/INACTIVE)."""

    def __init__(self, tenant_id: str, current_status: str):
        self.tenant_id = tenant_id
        self.current_status = current_status
        super().__init__(
            f"La base du tenant {tenant_id} pour COMPTA n'est pas active (statut={current_status})."
        )


_creation_locks: Dict[str, threading.Lock] = {}
_creation_locks_guard = threading.Lock()


def _alias_for(tenant_id: str) -> str:
    """Alias de connexion dérivé de manière déterministe du tenant_id."""
    return f"tenant_{tenant_id.replace('-', '')}_compta"


def _get_creation_lock(tenant_id: str) -> threading.Lock:
    """
    Un verrou dédié par tenant (pas un verrou global unique) : la
    création du pool du Tenant A ne bloque jamais les requêtes du
    Tenant B pendant ce temps. Le dict `_creation_locks` lui-même est
    protégé par un verrou séparé, tenu très brièvement.
    """
    with _creation_locks_guard:
        lock = _creation_locks.get(tenant_id)
        if lock is None:
            lock = threading.Lock()
            _creation_locks[tenant_id] = lock
        return lock


def _build_connection_settings(info: TenantDatabaseInfo) -> dict:
    """
    Construit un dict de configuration complet (toutes les clés que
    Django attend). Le pool de connexions (CONN_MAX_AGE) est
    configurable globalement via l'environnement (TENANT_DB_CONN_MAX_AGE).
    """
    return {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': info.database_name,
        'USER': settings.TENANT_DB_USER,
        'PASSWORD': settings.TENANT_DB_PASSWORD,
        'HOST': info.host,
        'PORT': info.port,
        'ATOMIC_REQUESTS': False,
        'AUTOCOMMIT': True,
        'CONN_MAX_AGE': settings.TENANT_DB_CONN_MAX_AGE,
        'CONN_HEALTH_CHECKS': True,
        'OPTIONS': {},
        'TIME_ZONE': None,
        'TEST': {'CHARSET': None, 'COLLATION': None, 'MIGRATE': True, 'MIRROR': None, 'NAME': None},
    }


def ensure_connection_alias(tenant_id: str) -> str:
    """
    Retourne l'alias de connexion Django pour `tenant_id`, en
    l'enregistrant dans `django.db.connections` s'il n'existe pas
    encore.

    Lève TenantDatabaseInactiveError si le TenantDatabase existe mais
    n'est pas ACTIVE, ou toute exception de registry_client/cache si la
    résolution échoue — jamais de repli silencieux vers une autre base.
    """
    alias = _alias_for(tenant_id)

    # Chemin rapide : la grande majorité des requêtes trouvent l'alias
    # déjà enregistré et n'acquièrent jamais de verrou.
    if alias in connections.databases:
        return alias

    lock = _get_creation_lock(tenant_id)
    with lock:
        # Double vérification après acquisition du verrou.
        if alias in connections.databases:
            return alias

        info = tenant_database_cache.get(tenant_id)

        if info.status != "ACTIVE":
            raise TenantDatabaseInactiveError(tenant_id, info.status)

        connections.databases[alias] = _build_connection_settings(info)
        logger.info("Connexion tenant enregistrée : tenant_id=%s alias=%s", tenant_id, alias)

        return alias


class DatabaseProvisioningError(Exception):
    """La création physique de la base ou l'initialisation de son schéma a échoué."""


def _admin_connection_params() -> dict:
    """
    Paramètres pour une connexion PostgreSQL "administrative" — utilisée
    UNIQUEMENT pour émettre `CREATE DATABASE` (ne peut pas passer par
    l'ORM Django : doit s'exécuter hors de toute transaction). Se
    connecte au serveur PostgreSQL déjà utilisé par `default` — toutes
    les bases tenant de ce service vivent, à ce stade, sur le même
    serveur PostgreSQL que `default`, aucun nouveau serveur introduit.
    """
    default_db = settings.DATABASES['default']
    return {
        'dbname': default_db['NAME'],
        'user': settings.TENANT_DB_USER,
        'password': settings.TENANT_DB_PASSWORD,
        'host': default_db['HOST'],
        'port': default_db['PORT'],
    }


def _create_database_if_missing(database_name: str) -> bool:
    """
    Crée la base PostgreSQL `database_name` si elle n'existe pas encore.

    Idempotent par construction : vérifie l'existence AVANT de créer.
    `CREATE DATABASE` ne peut pas s'exécuter dans une transaction : la
    connexion est ouverte en `autocommit`, dédiée à cet unique usage,
    puis fermée immédiatement. Le nom est injecté via
    `psycopg2.sql.Identifier` (jamais par interpolation de chaîne) —
    défense en profondeur, même si `database_name` est déjà garanti
    déterministe et sûr par construction (voir `_alias_for`).

    Retourne True si la base a été créée, False si elle existait déjà.
    """
    conn = psycopg2.connect(**_admin_connection_params())
    try:
        conn.autocommit = True
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (database_name,))
            if cursor.fetchone() is not None:
                return False

            create_statement = psycopg2.sql.SQL("CREATE DATABASE {}").format(
                psycopg2.sql.Identifier(database_name)
            )
            cursor.execute(create_statement)
            return True
    finally:
        conn.close()


def provision_database(tenant_id: str) -> dict:
    """
    Provisioning physique réel (Phase 7) : crée la base PostgreSQL de
    `tenant_id` pour CE service si nécessaire, puis y initialise le
    schéma.

    Ce service a QUATRE apps tenant-scopées (comptabilite, caisse,
    sorties, messaging) — pas une seule comme service-personnel.
    Plutôt que d'enchaîner 4 appels `migrate` explicites (fragile si une
    5e app tenant-scopée est ajoutée plus tard), on appelle `migrate`
    SANS app_label : Django parcourt alors toutes les apps installées,
    mais c'est `TenantDatabaseRouter.allow_migrate` (router.py) qui
    décide RÉELLEMENT lesquelles s'appliquent sur cet alias — seules les
    4 apps tenant-scopées (+ `migrations`, bookkeeping) y écrivent quoi
    que ce soit, exactement comme pour la base `default`. Aucune
    duplication de la liste des apps tenant-scopées entre ce module et
    le router : une seule source de vérité (router.py). Même patron que
    Medical-Monitoring (3 apps tenant-scopées).

    Appelée UNIQUEMENT par la vue interne protégée par IsInternalService
    — jamais par le chemin de requête ordinaire (géré par
    `ensure_connection_alias`, inchangé par cette fonction).

    Verrouillée par le MÊME verrou par tenant que `ensure_connection_alias`.

    En cas d'échec de la migration APRÈS création physique de la base :
    l'alias est désenregistré de `connections.databases` avant de
    relever l'erreur — aucun alias enregistré ne doit pointer vers un
    schéma non confirmé initialisé. Aucune tentative de `DROP DATABASE`
    automatique (opération destructive non automatisée délibérément —
    la reprise se fait par nouvel appel, idempotent).

    Retourne {'database_name', 'host', 'port'} en cas de succès.
    Lève DatabaseProvisioningError en cas d'échec (création ou migration).
    """
    alias = _alias_for(tenant_id)
    database_name = alias
    default_db = settings.DATABASES['default']
    host, port = default_db['HOST'], default_db['PORT']

    lock = _get_creation_lock(tenant_id)
    with lock:
        try:
            created = _create_database_if_missing(database_name)
        except psycopg2.Error as exc:
            logger.error("Échec de création de la base pour tenant_id=%s : %s", tenant_id, exc.__class__.__name__)
            raise DatabaseProvisioningError(f"Création de la base échouée : {exc.__class__.__name__}") from exc

        logger.info(
            "Base %s pour tenant_id=%s : %s", database_name, tenant_id,
            "créée" if created else "déjà existante (idempotent)",
        )

        info = TenantDatabaseInfo(database_name=database_name, host=host, port=int(port), status="ACTIVE")
        connections.databases[alias] = _build_connection_settings(info)

        try:
            call_command('migrate', database=alias, interactive=False, verbosity=0)
        except Exception as exc:
            connections[alias].close()
            del connections.databases[alias]
            logger.error("Échec de migration pour tenant_id=%s alias=%s : %s", tenant_id, alias, exc.__class__.__name__)
            raise DatabaseProvisioningError(f"Migration échouée : {exc.__class__.__name__}") from exc

        logger.info("Schéma initialisé pour tenant_id=%s alias=%s", tenant_id, alias)

        return {'database_name': database_name, 'host': host, 'port': int(port)}
