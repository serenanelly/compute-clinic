"""
seed_tenant_demo.py — Mécanisme reproductible de préparation d'un tenant
de démonstration (chantier Medical-Monitoring tenant-aware / isolation
multitenant de bout en bout).

Contrairement à `seed_data.py`/`seed_admin_only.py` (qui seedent
délibérément le pool NON ASSIGNÉ, `tenant_id=None`, comptes historiques
avant le multitenant — voir leur docstring), cette commande crée des
comptes RATTACHÉS À UN TENANT RÉEL, pour démontrer/tester l'isolation.

Usage :
    python manage.py seed_tenant_demo <tenant_id> <prefixe> [--suffix TEXTE]

Exemple :
    python manage.py seed_tenant_demo 57d9d34f-65cc-4b45-8b5f-0aa87c2c90b8 A

Crée, DANS LA BASE DE CE TENANT (via le Tenant Context, exactement comme
une vraie requête authentifiée) :
    - un Médecin      : medecin.<prefixe>@demo.fultang.local
    - une Infirmière   : infirmiere.<prefixe>@demo.fultang.local
    - un Réceptionniste : receptionniste.<prefixe>@demo.fultang.local

Mot de passe commun (dev uniquement, jamais un secret réel) :
    DemoTenant2026!

Idempotent : un second appel avec le même tenant_id ne duplique rien
(get_or_create sur email+tenant_id, déjà contraint en base — voir
Personnel.Meta.constraints).
"""
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from datetime import date

from api.models import Medecin, Infirmiere, Receptionniste, Service
from api.tenant_routing.context import reset_tenant_context, set_tenant_context

DEMO_PASSWORD = "DemoTenant2026!"


class Command(BaseCommand):
    help = "Crée un petit jeu de comptes de démonstration RATTACHÉS À UN TENANT RÉEL (pas le pool non assigné)."

    def add_arguments(self, parser):
        parser.add_argument("tenant_id", type=str, help="UUID du tenant (Tenant Registry)")
        parser.add_argument("prefixe", type=str, help="Préfixe court pour différencier les comptes (ex: A, B)")
        parser.add_argument("--service-nom", type=str, default=None, help="Nom du service hospitalier de démo (optionnel)")

    def handle(self, *args, **options):
        tenant_id = options["tenant_id"]
        prefixe = options["prefixe"]
        service_nom = options["service_nom"] or f"Service Démo {prefixe}"

        token = set_tenant_context(tenant_id)
        try:
            self._seed(tenant_id, prefixe, service_nom)
        finally:
            reset_tenant_context(token)

    def _seed(self, tenant_id, prefixe, service_nom):
        common = dict(
            date_naissance=date(1988, 1, 1),
            adresse=f"Établissement démo {prefixe}",
            contact="+237600000000",
            date_embauche=date(2024, 1, 1),
            mot_de_passe=make_password(DEMO_PASSWORD),
        )

        service, _ = Service.objects.get_or_create(
            code_analytique=f"DEMO-{prefixe}", defaults={"nom_service": service_nom},
        )

        accounts = [
            (Medecin, f"medecin.{prefixe.lower()}@demo.fultang.local", f"DEMO-MD-{prefixe}",
             {"specialite": "Médecine générale", "numero_ordre": f"DEMO-ORD-{prefixe}"}),
            (Infirmiere, f"infirmiere.{prefixe.lower()}@demo.fultang.local", f"DEMO-INF-{prefixe}",
             {"grade": "IDE"}),
            (Receptionniste, f"receptionniste.{prefixe.lower()}@demo.fultang.local", f"DEMO-REC-{prefixe}",
             {"langues_parlees": ["FRANCAIS"]}),
        ]

        for model_cls, email, matricule, extra in accounts:
            obj, created = model_cls.objects.get_or_create(
                email=email, tenant_id=tenant_id,
                defaults={
                    "nom": prefixe, "prenom": model_cls.__name__, "matricule": matricule,
                    "service": service, "tenant_id": tenant_id, **common, **extra,
                },
            )
            verb = "créé" if created else "déjà présent"
            self.stdout.write(self.style.SUCCESS(f"  {model_cls.__name__} {verb} : {email}"))

        self.stdout.write(self.style.SUCCESS(
            f"Tenant {tenant_id} : comptes de démonstration prêts (mot de passe : {DEMO_PASSWORD})."
        ))
