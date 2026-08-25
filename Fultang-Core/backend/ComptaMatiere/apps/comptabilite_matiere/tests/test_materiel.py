from django.test import TestCase
from decimal import Decimal
from ..models.materiel import Materiel
from ..models.materiel_medical import MaterielMedical
from ..models.materiel_durable import MaterielDurable

class MaterielTest(TestCase):
    def test_create_materiel_base(self):
        """Teste la création d'un matériel générique."""
        materiel = Materiel.objects.create(
            code_materiel="MAT-001",
            nom_Materiel="Article Test",
            prix_achat_unitaire=Decimal("500.00"),
            quantite_stock=10
        )
        self.assertEqual(str(materiel), "Article Test (Stock: 10)")

    def test_materiel_medical_inheritance(self):
        """Teste que le matériel médical hérite bien des propriétés de base."""
        med = MaterielMedical.objects.create(
            code_materiel="MED-001",
            nom_Materiel="Paracétamol",
            prix_achat_unitaire=Decimal("100.00"),
            quantite_stock=50,
            categorie="MEDICAMENT",
            unite_mesure="BOITE",
            prix_vente_unitaire=Decimal("150.00")
        )
        self.assertEqual(med.nom_Materiel, "Paracétamol")
        self.assertEqual(med.categorie, "MEDICAMENT")
