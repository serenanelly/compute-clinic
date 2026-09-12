"""
pool_registry.py — Connexions par tenant et verrouillage de création
(Phase 6).

Technique de routage dynamique : Django lit ses alias de connexion
depuis `django.db.connections.databases` (un dict, initialement rempli
depuis `settings.DATABASES` au premier accès, puis conservé en mémoire —
vérifié empiriquement contre le code de `ConnectionHandler`, comme pour
service-personnel et Medical-Monitoring). On peut y AJOUTER de nouveaux
alias au runtime : Django les traite ensuite exactement comme s'ils
avaient toujours existé. Aucune bibliothèque tierce nécessaire.

Pools de connexions : Django (avec psycopg2, sans pgbouncer/psycopg3)
n'a PAS de vrai pool multi-connexions natif. Le mécanisme réellement
disponible est `CONN_MAX_AGE` : une connexion persistante réutilisée par
thread/alias, fermée seulement après CONN_MAX_AGE secondes d'inactivité
(au lieu d'ouvrir/fermer une connexion à chaque requête). Documenté
honnêtement comme tel — pas présenté comme un pool qu'il n'est pas.

Concurrence : `threading.Lock()` PAR TENANT, PAR PROCESSUS PYTHON.
  - Portée : ce verrou ne protège QUE les requêtes traitées par le MÊME
    processus/conteneur. Le déploiement actuel de FullTang n'exécute
    qu'UNE seule instance de ce service (vérifié dans docker-compose.yml
    — aucun mécanisme de scaling horizontal n'existe aujourd'hui) : cette
    portée est donc suffisante pour cette phase.
  - Limite explicite : si FullTang passe un jour à plusieurs instances
    de ce service, CE verrou ne coordonnera PAS les instances entre
    elles. Un déploiement horizontal voudrait un verrou distribué
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
from .context import reset_tenant_context, set_tenant_context
from .registry_client import TenantDatabaseInfo

logger = logging.getLogger("core.tenant_routing")


class TenantDatabaseInactiveError(Exception):
    """Le TenantDatabase existe dans le Registry mais n'est pas ACTIVE (PENDING/INACTIVE)."""

    def __init__(self, tenant_id: str, current_status: str):
        self.tenant_id = tenant_id
        self.current_status = current_status
        super().__init__(
            f"La base du tenant {tenant_id} pour COMPTA_MATIERE n'est pas active (statut={current_status})."
        )


_creation_locks: Dict[str, threading.Lock] = {}
_creation_locks_guard = threading.Lock()


def _alias_for(tenant_id: str) -> str:
    """Alias de connexion dérivé de manière déterministe du tenant_id."""
    return f"tenant_{tenant_id.replace('-', '')}_compta_matiere"


def _get_creation_lock(tenant_id: str) -> threading.Lock:
    """
    Un verrou dédié par tenant (pas un verrou global unique) : la
    création du pool du Tenant A ne bloque jamais les requêtes du
    Tenant B pendant ce temps. Le dict `_creation_locks` lui-même est
    protégé par un verrou séparé, tenu très brièvement (juste le temps
    de lire/créer l'entrée), pour éviter que deux threads créent deux
    Lock() différents pour le même tenant.
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
    Django attend — voir ConnectionHandler.configure_settings, qui ne
    s'exécute qu'une fois au démarrage et ne traite donc jamais les
    alias ajoutés dynamiquement).

    Le pool de connexions (CONN_MAX_AGE) est configurable globalement
    via l'environnement (TENANT_DB_CONN_MAX_AGE) — pas de valeur figée
    en dur.
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
        'CONN_MAX_AGE': settings.TENANT_DB_CONN_MAX_AGE,  # pool par thread — voir docstring de module
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
        # Double vérification après acquisition du verrou : une requête
        # concurrente a pu enregistrer l'alias pendant l'attente.
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
    UNIQUEMENT pour émettre `CREATE DATABASE` (opération qui ne peut pas
    passer par l'ORM Django : elle doit s'exécuter en dehors de toute
    transaction). Se connecte au serveur PostgreSQL déjà utilisé par
    `default` (Phase 6 §9.2.9 : toutes les bases tenant de ce service
    vivent, dans cette phase, sur le même serveur PostgreSQL que
    `default` — aucun nouveau serveur introduit).
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

    Idempotent par construction (§7 de la tâche) : vérifie l'existence
    AVANT de créer plutôt que de s'appuyer sur la capture d'une erreur
    "déjà existante" — un appel répété est donc un no-op silencieux côté
    PostgreSQL, jamais une erreur.

    `CREATE DATABASE` ne peut pas s'exécuter dans une transaction : la
    connexion est ouverte en `autocommit`, dédiée à cet unique usage,
    puis fermée immédiatement. Le nom est injecté via
    `psycopg2.sql.Identifier` (jamais par interpolation de chaîne) —
    défense en profondeur : `database_name` est déjà garanti déterministe
    et sûr par construction (voir `_alias_for`), mais ce module ne fait
    JAMAIS confiance à une chaîne SQL construite à la main, même une
    chaîne qu'il a lui-même générée.

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

    Ce service n'a qu'UNE seule app tenant-scopée (`comptabilite_matiere`,
    voir router.py), mais — exactement comme Medical-Monitoring — le
    provisioning appelle `migrate` SANS app_label plutôt que de coder en
    dur `migrate('comptabilite_matiere', ...)` : Django parcourt alors
    toutes les apps installées, mais c'est
    `TenantDatabaseRouter.allow_migrate` (router.py) qui décide
    RÉELLEMENT lesquelles s'appliquent sur cet alias — seule l'app
    tenant-scopée (+ `migrations`, bookkeeping) y écrit quoi que ce soit,
    exactement comme pour la base `default`. Aucune duplication de la
    liste des apps tenant-scopées entre ce module et le router : une
    seule source de vérité (router.py). Ce choix évite aussi de coder en
    dur un app_label qui pourrait ne pas correspondre exactement au label
    interne réel de Django (vérifié empiriquement avant cette phase —
    voir router.py).

    PARTICULARITÉ DE CE SERVICE (ni service-personnel ni Medical-Monitoring
    n'en ont besoin) : la migration historique
    `0004_rapport_materiel_code_materiel_lignelivraison` contient un
    RunPython (`gen_unique_codes`) qui interroge directement le modèle
    Materiel (`Materiel.objects.all()`) — une opération de DONNÉES, pas
    seulement de schéma. Contrairement aux opérations de schéma
    (CreateModel, AddField...), qui passent exclusivement par
    `TenantDatabaseRouter.allow_migrate`, une requête ORM directe comme
    celle-ci passe par `db_for_read`/`db_for_write`, qui exigent un
    Tenant Context déjà établi. Sur une base tenant TOUTE NEUVE, cette
    migration est rejouée depuis zéro par le `migrate` ci-dessous : sans
    intervention, elle lèverait TenantContextMissingError (aucune requête
    HTTP authentifiée n'est en cours ici). On établit donc explicitement
    le Tenant Context à CE `tenant_id` (jamais None ni un autre tenant)
    pour la durée du `migrate` : `ensure_connection_alias` retrouve alors
    immédiatement l'alias déjà enregistré juste au-dessus (chemin rapide,
    aucun appel réseau au Registry) — un routage explicite et correct
    vers la base en cours de provisioning, pas un repli silencieux.

    Appelée UNIQUEMENT par la vue interne protégée par IsInternalService
    (voir views.py) — jamais par le chemin de requête ordinaire (qui
    reste entièrement géré par `ensure_connection_alias`, inchangé par
    cette fonction).

    Verrouillée par le MÊME verrou par tenant que `ensure_connection_alias`
    (`_get_creation_lock`) : un provisioning et une requête ordinaire
    concurrents pour le même tenant ne peuvent jamais s'entrelacer de
    façon incohérente sur `connections.databases`.

    En cas d'échec de la migration APRÈS création physique de la base :
    l'alias est désenregistré de `connections.databases` avant de
    relever l'erreur — une requête ordinaire ultérieure sur CE PROCESSUS
    ne doit jamais trouver un alias enregistré pointant vers une base
    dont le schéma n'a pas pu être confirmé initialisé (elle repassera
    par le chemin normal Registry/cache, qui la refusera tant que
    tenant-service ne rapporte pas ACTIVE). Aucune tentative de
    `DROP DATABASE` automatique : opération destructive, non automatisée
    délibérément — la reprise se fait par nouvel appel, idempotent.

    Retourne {'database_name', 'host', 'port'} en cas de succès.
    Lève DatabaseProvisioningError en cas d'échec (création ou migration).
    """
    alias = _alias_for(tenant_id)
    database_name = alias  # nom physique = alias (voir _alias_for) : aucune saisie libre n'intervient jamais.
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

        # Voir docstring ci-dessus : nécessaire pour que le RunPython de
        # la migration 0004 (requête directe sur Materiel) route vers
        # CETTE base tenant, déjà enregistrée juste au-dessus, au lieu de
        # lever TenantContextMissingError.
        context_token = set_tenant_context(tenant_id)
        try:
            call_command('migrate', database=alias, interactive=False, verbosity=0)
        except Exception as exc:
            # Nettoyage : ne jamais laisser un alias enregistré pointer
            # vers un schéma non confirmé initialisé (voir docstring).
            connections[alias].close()
            del connections.databases[alias]
            logger.error("Échec de migration pour tenant_id=%s alias=%s : %s", tenant_id, alias, exc.__class__.__name__)
            raise DatabaseProvisioningError(f"Migration échouée : {exc.__class__.__name__}") from exc
        finally:
            reset_tenant_context(context_token)

        logger.info("Schéma initialisé pour tenant_id=%s alias=%s", tenant_id, alias)

        return {'database_name': database_name, 'host': host, 'port': int(port)}


def deprovision_database(tenant_id: str) -> bool:
    """
    Suppression physique réelle (Suppression définitive de tenant) : DROP
    de la base PostgreSQL de 'tenant_id' pour CE service, si elle existe.

    Symétrique de 'provision_database' ci-dessus, réutilisant les mêmes
    briques ('_alias_for', '_admin_connection_params', même verrou par
    tenant) — jamais une seconde logique de résolution de nom/connexion.
    C'EST l'opération délibérément non automatisée mentionnée dans la
    docstring de 'provision_database' : elle n'existe QUE parce que
    'TenantDeletionService' (tenant-service) l'appelle explicitement,
    APRÈS archivage validé — jamais depuis le chemin de requête ordinaire
    ni depuis le provisioning.

    1. Désenregistre et ferme l'alias s'il est présent dans
       'connections.databases' de CE PROCESSUS (même pattern que le
       nettoyage d'échec de migration dans 'provision_database') —
       nécessaire : PostgreSQL refuse 'DROP DATABASE' tant qu'une
       connexion reste ouverte dessus.
    2. Termine, via la connexion admin, toute AUTRE connexion active
       encore ouverte sur cette base ('pg_terminate_backend' — un autre
       processus/thread a pu enregistrer son propre alias) : sans cela,
       'DROP DATABASE' échouerait avec "database is being accessed by
       other users" même après l'étape 1.
    3. 'DROP DATABASE IF EXISTS' — idempotent par construction, comme
       '_create_database_if_missing' (vérifie l'existence avant d'agir).

    Retourne True si la base a été supprimée, False si elle n'existait
    déjà plus (idempotent : un appel répété n'est jamais une erreur).
    Lève DatabaseProvisioningError en cas d'échec réel.
    """
    alias = _alias_for(tenant_id)
    database_name = alias  # nom physique = alias (voir _alias_for).

    lock = _get_creation_lock(tenant_id)
    with lock:
        if alias in connections.databases:
            try:
                connections[alias].close()
            except Exception:  # noqa: BLE001 — best-effort, la connexion peut déjà être fermée
                pass
            del connections.databases[alias]

        try:
            conn = psycopg2.connect(**_admin_connection_params())
            try:
                conn.autocommit = True
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (database_name,))
                    if cursor.fetchone() is None:
                        logger.info("Base %s pour tenant_id=%s déjà absente (idempotent).", database_name, tenant_id)
                        return False

                    cursor.execute(
                        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                        "WHERE datname = %s AND pid <> pg_backend_pid()",
                        (database_name,),
                    )
                    drop_statement = psycopg2.sql.SQL("DROP DATABASE IF EXISTS {}").format(
                        psycopg2.sql.Identifier(database_name)
                    )
                    cursor.execute(drop_statement)
                    logger.info("Base %s pour tenant_id=%s supprimée.", database_name, tenant_id)
                    return True
            finally:
                conn.close()
        except psycopg2.Error as exc:
            logger.error("Échec de suppression de la base pour tenant_id=%s : %s", tenant_id, exc.__class__.__name__)
            raise DatabaseProvisioningError(f"Suppression de la base échouée : {exc.__class__.__name__}") from exc

