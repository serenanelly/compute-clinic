"""
test_runner.py — Test runner tenant-aware pour ComptaMatiere.

Nécessaire UNIQUEMENT à cause d'une combinaison propre à ce service (ni
service-personnel ni Medical-Monitoring n'en ont besoin d'un équivalent) :

  1. La migration historique
     `0004_rapport_materiel_code_materiel_lignelivraison` contient un
     RunPython (`gen_unique_codes`) qui interroge directement le modèle
     Materiel (`Materiel.objects.all()`) — une opération de DONNÉES, pas
     seulement de schéma. Contrairement aux opérations de schéma
     (CreateModel, AddField...), qui passent exclusivement par
     `TenantDatabaseRouter.allow_migrate`, une requête ORM directe comme
     celle-ci passe par `db_for_read`/`db_for_write`, qui exigent un
     Tenant Context déjà établi (voir core/tenant_routing/router.py).
  2. Le test runner de Django recrée la base 'default' de test en
     REJOUANT TOUT L'HISTORIQUE DES MIGRATIONS depuis zéro — y compris
     cette migration 0004 — AVANT qu'aucun test (et donc aucune
     authentification Gateway établissant un Tenant Context) ne se soit
     exécuté. Sans intervention, `setup_databases()` lève
     TenantContextMissingError.
  3. Plusieurs tests pré-existants de ce service (écrits avant le
     chantier multitenant, ex: test_materiel.py) créent aussi des
     instances de modèles directement (`Materiel.objects.create(...)`)
     dans des `django.test.TestCase` classiques, sans passer par
     GatewayHeaderAuthentication — donc sans Tenant Context établi.

Solution : établir explicitement le Tenant Context à `None` ("pool non
assigné") pour la DURÉE COMPLÈTE de l'exécution des tests — jamais en
production (`TEST_RUNNER` n'est consulté que par `manage.py test`).
`None` est le choix cohérent avec le router (route vers 'default',
exactement le comportement attendu par ces tests pré-existants, qui
tournaient déjà contre 'default' avant ce chantier). Les tests qui
veulent réellement exercer le routing multi-tenant
(tests_tenant_routing.py) écrasent explicitement ce contexte via
`set_tenant_context(...)` le temps de leurs propres assertions — cette
valeur par défaut ne les gêne pas.

Ce mécanisme ne modifie AUCUN comportement de production : la garantie
"absence de contexte = erreur explicite" (TenantContextMissingError)
reste entièrement intacte pour toute requête réelle et pour le
provisioning (voir pool_registry.provision_database, qui établit son
propre contexte explicite le temps de la migration d'un nouveau tenant).
"""
from django.test.runner import DiscoverRunner

from .tenant_routing.context import set_tenant_context


class TenantAwareTestRunner(DiscoverRunner):
    """Établit un Tenant Context neutre ('pool non assigné') pour toute la suite de tests."""

    def setup_databases(self, **kwargs):
        # AVANT toute création de base de test (donc avant que la
        # migration 0004 ne rejoue son RunPython) — voir docstring de
        # module.
        set_tenant_context(None)
        return super().setup_databases(**kwargs)
