from django.test import TestCase
from ..models.besoin import Besoin

class BesoinTest(TestCase):
    def test_besoin_default_status(self):
        """Vérifie que le statut par défaut d'un besoin est NON_TRAITE."""
        besoin = Besoin.objects.create(
            motif="Manque de gants",
            idPersonnel_emetteur=1
        )
        self.assertEqual(besoin.statut, "NON_TRAITE")
        self.assertIn("Non Traité", str(besoin))
        self.assertIn("1", str(besoin))
