"""
seed_tenant_demo.py — Mécanisme reproductible de données médicales de
démonstration pour UN TENANT RÉEL (chantier Medical-Monitoring
tenant-aware).

Usage :
    python manage.py seed_tenant_demo <tenant_id> <prefixe>

Exemple :
    python manage.py seed_tenant_demo 57d9d34f-65cc-4b45-8b5f-0aa87c2c90b8 A

Crée, DANS LA BASE DE CE TENANT (via le Tenant Context, exactement comme
une vraie requête authentifiée passée par la Gateway) :
    - un Patient clairement identifié par le préfixe
    - une Visite TERMINE pour ce patient (déclenche le signal de
      synchronisation vers clinical-agent, comme une vraie consultation)

Idempotent : get_or_create sur le numéro de sécurité sociale (unique).
"""
from datetime import date

from django.core.management.base import BaseCommand

from core.tenant_routing.context import reset_tenant_context, set_tenant_context
from patient.models import Patient
from medical_workflow.models import Visite


class Command(BaseCommand):
    help = "Crée un patient + une visite TERMINE de démonstration DANS LA BASE d'un tenant réel."

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
        nss = f"DEMO-NSS-{prefixe}"
        patient, created = Patient.objects.get_or_create(
            numero_securite_sociale=nss,
            defaults=dict(
                nom=f"PatientDemo{prefixe}",
                prenom=prefixe,
                sexe="M",
                date_naissance=date(1990, 1, 1),
                lieu_naissance="Yaoundé",
                profession="Démonstration",
                statut_matrimonial="CELIBATAIRE",
            ),
        )
        verb = "créé" if created else "déjà présent"
        self.stdout.write(self.style.SUCCESS(f"  Patient {verb} : {patient.nom} (id={patient.id})"))

        visite, v_created = Visite.objects.get_or_create(
            patient=patient,
            motif_visite=f"Consultation de démonstration — tenant {prefixe}",
            defaults={"statut": "EN_COURS"},
        )
        if visite.statut != "TERMINE":
            visite.statut = "TERMINE"
            visite.save()  # déclenche le signal → clinical-agent, comme une vraie consultation
        self.stdout.write(self.style.SUCCESS(f"  Visite TERMINE prête : {visite.id}"))

        self.stdout.write(self.style.SUCCESS(f"Tenant {tenant_id} : données médicales de démonstration prêtes."))
