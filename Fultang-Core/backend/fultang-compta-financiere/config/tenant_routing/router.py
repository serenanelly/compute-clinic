"""
router.py — Dynamic Database Router pour le Service Comptabilité
Financière (Phase 6).

Détermine quelle base utiliser pour chaque requête ORM, en fonction
UNIQUEMENT du Tenant Context déjà établi (context.py) et de l'app_label
du modèle concerné. Ce router ne connaît RIEN du métier comptable :
aucune écriture, aucun compte, aucune spécificité d'un établissement —
uniquement "quel app_label" et "quel tenant".

TENANT CONTEXT vs PLATFORM/SYSTEM CONTEXT (voir tâche, §6) :
  - `TENANT_SCOPED_APPS` (comptabilite, caisse, sorties, messaging — les
    4 apps métier de ce service) est routé selon le tenant courant —
    jamais de valeur par défaut implicite.
  - Tout le reste (django.contrib.admin, auth, sessions, contenttypes —
    les tables SYSTÈME du service lui-même) continue de vivre dans
    'default', exactement comme avant ce chantier.

Le vrai Tenant Registry (associations Tenant + Service → Database) et
les opérations de plateforme au sens large vivent entièrement dans
tenant-service, un service séparé qui n'est pas concerné par ce router.

`tenant_id=None` (pool non assigné, Phase 3) route explicitement vers
'default'. L'ABSENCE de tout Tenant Context (bug, accès hors requête)
lève TenantContextMissingError — jamais de repli silencieux.
"""
import logging

from .context import require_tenant_context
from .pool_registry import ensure_connection_alias

logger = logging.getLogger("config.tenant_routing")

# Les 4 apps métier de ce service — SEULE source de vérité de cette
# liste (réutilisée par pool_registry.provision_database, qui migre
# "toutes les apps" et laisse ce router décider lesquelles s'appliquent).
TENANT_SCOPED_APPS = {"comptabilite", "caisse", "sorties", "messaging"}

# Bookkeeping Django qui doit exister sur CHAQUE alias migré (y compris
# les alias tenant) pour que `migrate --database=<alias>` fonctionne.
ALWAYS_MIGRATABLE_APPS = {"migrations"}


class TenantDatabaseRouter:
    """DATABASE_ROUTERS : route les modèles des apps métier vers la base du tenant courant."""

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
        N'autorise une relation (ex: Quittance → CompteComptable) que si
        les deux objets vivent dans la MÊME base — empêche toute
        jointure implicite entre la base d'un tenant et celle d'un
        autre, ou entre une base tenant et 'default'.
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
