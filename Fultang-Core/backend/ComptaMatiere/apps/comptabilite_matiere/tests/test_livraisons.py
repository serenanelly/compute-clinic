from django.test import TestCase
from django.utils import timezone
from decimal import Decimal
from ..models.materiel import Materiel
from ..models.livraison import Livraison
from ..models.ligne_livraison import LigneLivraison

class LivraisonTest(TestCase):
    def setUp(self):
        self.materiel = Materiel.objects.create(
            code_materiel="LIV-MAT",
            nom_Materiel="Matériel de test livraison",
            prix_achat_unitaire=Decimal("100.00"),
            quantite_stock=0
        )

    def test_livraison_increases_stock(self):
        """Vérifie que l'ajout d'une ligne de livraison augmente le stock."""
        livraison = Livraison.objects.create(
            bon_livraison_numero="BL-001",
            nom_fournisseur="Fournisseur A",
            contact_fournisseur="600000000",
            date_reception=timezone.now(),
            montant_total=Decimal("0.00")
        )
        
        LigneLivraison.objects.create(
            id_livraison=livraison,
            materiel=self.materiel,
            type_materiel="MEDICAL",
            quantite_conforme=100,
            prix_unitaire_achat=Decimal("100.00")
        )
        
        self.materiel.refresh_from_db()
        self.assertEqual(self.materiel.quantite_stock, 100)

    def test_update_delivery_adjusts_stock(self):
        """Vérifie que la modification d'une livraison ajuste le stock correctement."""
        livraison = Livraison.objects.create(
            bon_livraison_numero="BL-002",
            nom_fournisseur="Fournisseur B",
            contact_fournisseur="600000000",
            date_reception=timezone.now(),
            montant_total=Decimal("0.00")
        )
        ligne = LigneLivraison.objects.create(
            id_livraison=livraison,
            materiel=self.materiel,
            type_materiel="MEDICAL",
            quantite_conforme=50,
            prix_unitaire_achat=Decimal("100.00")
        )
        
        # Stock est à 50
        ligne.quantite_conforme = 80
        ligne.save()
        
        self.materiel.refresh_from_db()
        self.assertEqual(self.materiel.quantite_stock, 80)
