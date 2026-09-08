"""
seed_tenant_demo.py — Mécanisme reproductible de préparation d'un tenant
de démonstration (chantier Gestion-Infrastructures tenant-aware /
isolation multitenant de bout en bout).

Contrairement à `seed_infrastructure.py` (script historique, standalone,
qui seed délibérément le pool NON ASSIGNÉ, `tenant_id=None` — voir sa
propre docstring), cette commande crée des données RATTACHÉES À UN
TENANT RÉEL, dans la base PHYSIQUE de ce tenant (via le Tenant Context,
exactement comme une vraie requête authentifiée passerait par
`TenantDatabaseRouter`), pour démontrer/tester l'isolation entre bases.

Usage :
    python manage.py seed_tenant_demo <tenant_id> <prefixe>

Exemple :
    python manage.py seed_tenant_demo 57d9d34f-65cc-4b45-8b5f-0aa87c2c90b8 A

Crée, DANS LA BASE DE CE TENANT :
    - un TypeBatiment : "TYPE-BAT-DEMO-<prefixe>"
    - un Batiment      : "Bâtiment Démo <prefixe>"
    - un Etage         : numéro 1 du bâtiment ci-dessus
    - un TypeSalle     : "TYPE-SALLE-DEMO-<prefixe>"
    - une Salle        : numéro "DEMO-<prefixe>-101"

Idempotent : un second appel avec le même tenant_id/prefixe ne duplique
rien (get_or_create sur un champ déterministe dérivé de `prefixe` pour
chaque modèle).
"""
from datetime import date

from django.core.management.base import BaseCommand

from infrastructures.models import Batiment, Etage, Salle, StatutSalle, TypeBatiment, TypeSalle
from config.tenant_routing.context import reset_tenant_context, set_tenant_context


class Command(BaseCommand):
    help = "Crée un petit jeu de données de démonstration RATTACHÉ À UN TENANT RÉEL (pas le pool non assigné)."

    def add_arguments(self, parser):
        parser.add_argument("tenant_id", type=str, help="UUID du tenant (Tenant Registry)")
        parser.add_argument("prefixe", type=str, help="Préfixe court pour différencier les données (ex: A, B)")

    def handle(self, *args, **options):
        tenant_id = options["tenant_id"]
        prefixe = options["prefixe"]

        token = set_tenant_context(tenant_id)
        try:
            self._seed(tenant_id, prefixe)
        finally:
            reset_tenant_context(token)

    def _seed(self, tenant_id, prefixe):
        type_batiment, created = TypeBatiment.objects.get_or_create(
            nom=f"TYPE-BAT-DEMO-{prefixe}",
            defaults={"description": f"Type de bâtiment de démonstration {prefixe}"},
        )
        self._log(TypeBatiment, type_batiment, created)

        batiment, created = Batiment.objects.get_or_create(
            nom=f"Bâtiment Démo {prefixe}",
            defaults={
                "type": type_batiment,
                "nb_etages": 1,
                "date_construction": date(2024, 1, 1),
            },
        )
        self._log(Batiment, batiment, created)

        etage, created = Etage.objects.get_or_create(
            numero=1,
            batiment=batiment,
        )
        self._log(Etage, etage, created)

        type_salle, created = TypeSalle.objects.get_or_create(
            nom=f"TYPE-SALLE-DEMO-{prefixe}",
            defaults={"description": f"Type de salle de démonstration {prefixe}"},
        )
        self._log(TypeSalle, type_salle, created)

        salle, created = Salle.objects.get_or_create(
            numero=f"DEMO-{prefixe}-101",
            defaults={
                "nom": f"Salle Démo {prefixe}",
                "type": type_salle,
                "capacite": 1,
                "statut": StatutSalle.DISPONIBLE,
                "etage": etage,
            },
        )
        self._log(Salle, salle, created)

        self.stdout.write(self.style.SUCCESS(
            f"Tenant {tenant_id} : données de démonstration prêtes (préfixe={prefixe})."
        ))

    def _log(self, model_cls, obj, created):
        verb = "créé" if created else "déjà présent"
        self.stdout.write(self.style.SUCCESS(f"  {model_cls.__name__} {verb} : {obj}"))
