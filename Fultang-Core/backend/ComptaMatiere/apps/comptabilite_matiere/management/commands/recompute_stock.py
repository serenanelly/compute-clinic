"""
Recalcule le stock de chaque matériel selon la règle métier :

    stock = Σ(quantite_conforme des lignes de livraison)
          − Σ(quantite des lignes de sortie NON défectueuses)

Le matériel non conforme n'entre jamais en stock ; les sorties « DEFECTUEUX »
issues de l'ancien flux de livraison ne doivent donc pas le diminuer.

Usage :
  python manage.py recompute_stock
  python manage.py recompute_stock --dry-run
  python manage.py recompute_stock --code MED-015
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum

from apps.comptabilite_matiere.models import (
    Materiel,
    LigneLivraison,
    LigneSortie,
)

MOTIFS_NON_DECREMENTANTS = {"DEFECTUEUX"}


class Command(BaseCommand):
    help = "Recalcule le stock des matériels (conforme reçu − sorties légitimes)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true",
                            help="Affiche les changements sans les appliquer.")
        parser.add_argument("--code", type=str, default=None,
                            help="Ne traiter qu'un seul matériel (code_materiel).")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        code = options["code"]

        materiels = Materiel.objects.all()
        if code:
            materiels = materiels.filter(code_materiel=code)

        changes = 0
        with transaction.atomic():
            for materiel in materiels:
                conforme = LigneLivraison.objects.filter(
                    materiel_id=materiel.pk
                ).aggregate(s=Sum("quantite_conforme"))["s"] or 0

                sorties = LigneSortie.objects.filter(
                    id_materiel_id=materiel.pk
                ).exclude(
                    id_sortie__motif_sortie__in=MOTIFS_NON_DECREMENTANTS
                ).aggregate(s=Sum("quantite"))["s"] or 0

                # Un matériel jamais livré (ex. stock initial de démo saisi
                # directement) et sans sortie garde sa valeur actuelle.
                if conforme == 0 and not LigneLivraison.objects.filter(materiel_id=materiel.pk).exists():
                    continue

                nouveau = conforme - sorties
                if nouveau < 0:
                    nouveau = 0

                if nouveau != materiel.quantite_stock:
                    self.stdout.write(
                        f"  {materiel.code_materiel} ({materiel.nom_Materiel}): "
                        f"{materiel.quantite_stock} → {nouveau} "
                        f"[conforme={conforme}, sorties={sorties}]"
                    )
                    changes += 1
                    if not dry_run:
                        materiel.quantite_stock = nouveau
                        materiel.save(update_fields=["quantite_stock"])

            if dry_run:
                transaction.set_rollback(True)
                self.stdout.write(self.style.WARNING(f"Dry-run : {changes} matériel(s) à corriger."))
            else:
                self.stdout.write(self.style.SUCCESS(f"Terminé : {changes} matériel(s) corrigé(s)."))
