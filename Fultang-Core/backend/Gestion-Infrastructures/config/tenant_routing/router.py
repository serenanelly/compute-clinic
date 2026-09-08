"""
router.py — Dynamic Database Router (Phase 6).

Détermine quelle base utiliser pour chaque requête ORM, en fonction
UNIQUEMENT du Tenant Context déjà établi (context.py) et de l'app_label
du modèle concerné. Ce router ne connaît RIEN du métier hospitalier :
aucun bâtiment, aucune salle, aucune spécificité d'un établissement —
uniquement "quel app_label" et "quel tenant".

TENANT CONTEXT vs PLATFORM/SYSTEM CONTEXT (voir tâche, §6) :
  - `TENANT_SCOPED_APPS` ('infrastructures', qui contient tous les
    modèles métier de ce service — TypeBatiment/Batiment/TypeSalle/
    Etage/Salle) est routé selon le tenant courant — jamais de valeur
    par défaut implicite.
  - Tout le reste (django.contrib.admin, auth, sessions, contenttypes —
    les tables SYSTÈME du service lui-même) continue de vivre dans
    'default', comme avant cette phase. Ce sont des opérations de
    PLATEFORME AU SENS DE CE SERVICE (fonctionnement interne de
    Gestion-Infrastructures), pas des données métier d'un tenant — un
    "contexte plateforme" ne donne ACCÈS À AUCUNE base tenant : il ne
    fait que continuer d'utiliser 'default', exactement comme
    aujourd'hui. Il n'existe aucun mécanisme permettant à un code
    "plateforme" de choisir arbitrairement la base d'un tenant.

Le vrai Tenant Registry (associations Tenant + Service → Database) et
les opérations de plateforme au sens large (gestion des tenants,
provisioning...) vivent entièrement dans tenant-service, un service
séparé qui n'est pas concerné par ce router.

`tenant_id=None` (pool non assigné, Phase 3) route explicitement vers
'default' — voir context.py et la documentation de cette décision dans
MULTITENANT_ARCHITECTURE.md (réconciliation Phase 3 / Phase 6).
L'ABSENCE de tout Tenant Context (bug, accès hors requête) lève
TenantContextMissingError — jamais de repli silencieux.
"""
import logging

from .context import require_tenant_context
from .pool_registry import ensure_connection_alias

logger = logging.getLogger("config.tenant_routing")

# Seul app_label métier de ce service — voir docstring de module.
TENANT_SCOPED_APPS = {"infrastructures"}

# Bookkeeping Django qui doit exister sur CHAQUE alias migré (y compris
# les alias tenant) pour que `migrate --database=<alias>` fonctionne
# correctement (table de suivi des migrations appliquées).
ALWAYS_MIGRATABLE_APPS = {"migrations"}


class TenantDatabaseRouter:
    """DATABASE_ROUTERS : route les modèles de l'app `infrastructures` vers la base du tenant courant."""

    def _resolve_alias(self) -> str:
        tenant_context = require_tenant_context()  # lève TenantContextMissingError si absent

        if tenant_context.tenant_id is None:
            # Pool non assigné (Phase 3) — route explicite, documentée,
            # vers la base historique. Ce n'est jamais un tenant "au
            # hasard" : c'est LA destination désignée pour cet état.
            return "default"

        # Lève TenantDatabaseInactiveError / TenantDatabaseNotFoundError /
        # TenantRegistryUnavailableError selon le cas — jamais de repli.
        return ensure_connection_alias(tenant_context.tenant_id)

    def db_for_read(self, model, **hints):
        if model._meta.app_label not in TENANT_SCOPED_APPS:
            return None  # laisse Django utiliser 'default' pour tout le reste
        return self._resolve_alias()

    def db_for_write(self, model, **hints):
        if model._meta.app_label not in TENANT_SCOPED_APPS:
            return None
        return self._resolve_alias()

    def allow_relation(self, obj1, obj2, **hints):
        """
        N'autorise une relation (ex: Salle.etage) que si les deux
        objets vivent dans la MÊME base — empêche toute jointure
        implicite entre la base d'un tenant et celle d'un autre, ou
        entre une base tenant et 'default'.
        """
        db1, db2 = obj1._state.db, obj2._state.db
        if db1 and db2:
            return db1 == db2
        return None  # laisse Django décider si l'un des objets n'est pas encore sauvegardé

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label in TENANT_SCOPED_APPS or app_label in ALWAYS_MIGRATABLE_APPS:
            return True  # migrable partout où on le demande explicitement (default OU un alias tenant)
        if db == "default":
            return None  # comportement normal de Django pour les apps système sur 'default'
        return False  # apps système (auth, admin, sessions, contenttypes) jamais sur un alias tenant
