from django.test import TestCase
from django.utils import timezone
from decimal import Decimal
from ..models.materiel import Materiel
from ..models.livraison import Livraison
from ..models.ligne_livraison import LigneLivraison
from ..models.sortie import Sortie
from ..models.ligne_sortie import LigneSortie

class InventoryFlowLogicTest(TestCase):
    """
    Tests de la logique métier (Business Logic) du système d'inventaire.
    Vérifie les interactions automatiques entre les modèles.
    """

    def setUp(self):
        self.materiel = Materiel.objects.create(
            code_materiel="LOG-001",
            nom_Materiel="Ordinateur Dell",
            prix_achat_unitaire=Decimal("300000.00"),
            quantite_stock=10
        )

    def test_stock_increase_on_delivery(self):
        """Cas Normal: La livraison doit augmenter le stock."""
        livraison = Livraison.objects.create(
            bon_livraison_numero="BL-LOG-01",
            nom_fournisseur="Dell Cameroon",
            contact_fournisseur="677000000",
            date_reception=timezone.now(),
            montant_total=Decimal("0.00")
        )
        LigneLivraison.objects.create(
            id_livraison=livraison,
            materiel=self.materiel,
            type_materiel="DURABLE",
            quantite_conforme=5,
            prix_unitaire_achat=Decimal("300000.00")
        )
        self.materiel.refresh_from_db()
        self.assertEqual(self.materiel.quantite_stock, 15)

    def test_stock_decrease_on_output(self):
        """Cas Normal: La sortie doit diminuer le stock."""
        sortie = Sortie.objects.create(
            numero_sortie="S-LOG-01",
            motif_sortie="UTILISATION_SERVICE",
            date_sortie=timezone.now(),
            idPersonnel=1
        )
        LigneSortie.objects.create(
            id_sortie=sortie,
            id_materiel=self.materiel,
            code_materiel=self.materiel.code_materiel,
            nom_materiel=self.materiel.nom_Materiel,
            type_materiel="DURABLE",
            quantite=3
        )
        self.materiel.refresh_from_db()
        self.assertEqual(self.materiel.quantite_stock, 7)

    def test_prevent_negative_stock(self):
        """Cas Erreur: Impossible de sortir plus que le stock disponible."""
        sortie = Sortie.objects.create(
            numero_sortie="S-ERR-01",
            motif_sortie="UTILISATION_SERVICE",
            date_sortie=timezone.now(),
            idPersonnel=1
        )
        with self.assertRaises(ValueError) as cm:
            LigneSortie.objects.create(
                id_sortie=sortie,
                id_materiel=self.materiel,
                code_materiel=self.materiel.code_materiel,
                nom_materiel=self.materiel.nom_Materiel,
                type_materiel="DURABLE",
                quantite=100 # > 10 disponible
            )
        self.assertIn("Stock insuffisant", str(cm.exception))

    def test_automatic_total_amount_calculation(self):
        """Validation Métier: Calcul automatique du montant total d'une livraison."""
        livraison = Livraison.objects.create(
            bon_livraison_numero="BL-TOTAL-01",
            nom_fournisseur="Global Tech",
            contact_fournisseur="699000000",
            date_reception=timezone.now(),
            montant_total=Decimal("0.00")
        )
        LigneLivraison.objects.create(
            id_livraison=livraison,
            materiel=self.materiel,
            type_materiel="DURABLE",
            quantite_conforme=2,
            prix_unitaire_achat=Decimal("1500.00")
        )
        LigneLivraison.objects.create(
            id_livraison=livraison,
            materiel=self.materiel,
            type_materiel="DURABLE",
            quantite_conforme=3,
            prix_unitaire_achat=Decimal("2000.00")
        )
        livraison.refresh_from_db()
        # (2*1500) + (3*2000) = 3000 + 6000 = 9000
        self.assertEqual(livraison.montant_total, Decimal("9000.00"))
