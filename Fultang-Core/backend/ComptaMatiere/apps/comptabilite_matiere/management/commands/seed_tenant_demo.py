"""
seed_tenant_demo.py — Mécanisme reproductible de préparation d'un tenant
de démonstration (chantier ComptaMatiere tenant-aware / isolation
multitenant de bout en bout).

Contrairement aux commandes de seed historiques de ce service (qui
seedent délibérément le pool NON ASSIGNÉ, tenant_id=None — comptes/
données créés avant le multitenant), cette commande crée un
enregistrement RATTACHÉ À UN TENANT RÉEL, dans la base PHYSIQUE de ce
tenant (via le Tenant Context, exactement comme une vraie requête
authentifiée passant par GatewayHeaderAuthentication), pour démontrer/
tester l'isolation entre tenants.

Usage :
    python manage.py seed_tenant_demo <tenant_id> <prefixe>

Exemple :
    python manage.py seed_tenant_demo 57d9d34f-65cc-4b45-8b5f-0aa87c2c90b8 A

Crée, DANS LA BASE DE CE TENANT, un Materiel de démonstration dont le
`code_materiel` est dérivé de manière déterministe du préfixe fourni
(ex: "DEMO-A") — c'est ce champ, contraint `unique=True` en base, qui
rend la commande idempotente (`get_or_create`) : un second appel avec le
même préfixe pour le même tenant ne duplique rien.

Aucun champ `tenant_id` n'existe (ni ne doit exister) sur le modèle
Materiel : l'isolation entre tenants est assurée entièrement par le
Database Router (core/tenant_routing/router.py), pas par une colonne
applicative — voir MULTITENANT_ARCHITECTURE.md.
"""
from django.core.management.base import BaseCommand

from apps.comptabilite_matiere.models import Materiel
from core.tenant_routing.context import reset_tenant_context, set_tenant_context


class Command(BaseCommand):
    help = "Crée un Materiel de démonstration RATTACHÉ À UN TENANT RÉEL (pas le pool non assigné)."

    def add_arguments(self, parser):
        parser.add_argument("tenant_id", type=str, help="UUID du tenant (Tenant Registry)")
        parser.add_argument("prefixe", type=str, help="Préfixe court pour différencier les enregistrements (ex: A, B)")

    def handle(self, *args, **options):
        tenant_id = options["tenant_id"]
        prefixe = options["prefixe"]

        token = set_tenant_context(tenant_id)
        try:
            self._seed(tenant_id, prefixe)
        finally:
            reset_tenant_context(token)

    def _seed(self, tenant_id, prefixe):
        code_materiel = f"DEMO-{prefixe}"

        materiel, created = Materiel.objects.get_or_create(
            code_materiel=code_materiel,
            defaults={
                "nom_Materiel": f"Matériel démo {prefixe}",
                "prix_achat_unitaire": 1000,
                "quantite_stock": 10,
            },
        )

        verb = "créé" if created else "déjà présent"
        self.stdout.write(self.style.SUCCESS(f"  Materiel {verb} : {code_materiel}"))
        self.stdout.write(self.style.SUCCESS(
            f"Tenant {tenant_id} : enregistrement de démonstration prêt (code_materiel={code_materiel})."
        ))
