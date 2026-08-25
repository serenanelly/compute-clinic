from django.test import TestCase
from django.utils import timezone
from decimal import Decimal
from ..models.materiel import Materiel
from ..models.sortie import Sortie
from ..models.ligne_sortie import LigneSortie

class SortieTest(TestCase):
    def setUp(self):
        self.materiel = Materiel.objects.create(
            code_materiel="SORT-MAT",
            nom_Materiel="Matériel de test sortie",
            prix_achat_unitaire=Decimal("100.00"),
            quantite_stock=100
        )

    def test_sortie_decreases_stock(self):
        """Vérifie qu'une sortie diminue le stock."""
        sortie = Sortie.objects.create(
            numero_sortie="S-001",
            motif_sortie="UTILISATION_SERVICE",
            date_sortie=timezone.now(),
            idPersonnel=1
        )
        LigneSortie.objects.create(
            id_sortie=sortie,
            id_materiel=self.materiel,
            code_materiel=self.materiel.code_materiel,
            nom_materiel=self.materiel.nom_Materiel,
            type_materiel="MEDICAL",
            quantite=30
        )
        self.materiel.refresh_from_db()
        self.assertEqual(self.materiel.quantite_stock, 70)

    def test_stock_insufficient_error(self):
        """Vérifie qu'une erreur est levée si le stock est insuffisant."""
        sortie = Sortie.objects.create(
            numero_sortie="S-002",
            motif_sortie="UTILISATION_SERVICE",
            date_sortie=timezone.now(),
            idPersonnel=1
        )
        with self.assertRaises(ValueError):
            LigneSortie.objects.create(
                id_sortie=sortie,
                id_materiel=self.materiel,
                code_materiel=self.materiel.code_materiel,
                nom_materiel=self.materiel.nom_Materiel,
                type_materiel="MEDICAL",
                quantite=150 # Supérieur au stock de 100
            )
