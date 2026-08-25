from django.test import TestCase
from decimal import Decimal
from django.core.exceptions import ValidationError
from ..models.materiel import Materiel
from ..models.besoin import Besoin

class MaterielModelTest(TestCase):
    """Tests unitaires pour le modèle Materiel."""
    
    def setUp(self):
        self.materiel = Materiel.objects.create(
            code_materiel="TEST-MOD-001",
            nom_Materiel="Scanner Pro",
            prix_achat_unitaire=Decimal("500000.00"),
            quantite_stock=5
        )

    def test_materiel_str(self):
        """Cas Normal: Test de la représentation textuelle."""
        self.assertEqual(str(self.materiel), "Scanner Pro (Stock: 5)")

    def test_quantite_negative_validation(self):
        """Cas Limite/Erreur: Le stock ne doit pas être négatif au niveau modèle."""
        self.materiel.quantite_stock = -1
        with self.assertRaises(Exception): # Django level validation
            self.materiel.full_clean()
            self.materiel.save()

class BesoinModelTest(TestCase):
    """Tests unitaires pour le modèle Besoin."""

    def test_default_status(self):
        """Cas Normal: Vérifie que le statut initial est 'NON_TRAITE'."""
        besoin = Besoin.objects.create(
            motif="Panne d'imprimante",
            idPersonnel_emetteur=123
        )
        self.assertEqual(besoin.statut, "NON_TRAITE")
