from django.test import TestCase
from patient.serializers import PatientSerializer

class PatientSerializerTest(TestCase):
    """Tests unitaires du PatientSerializer."""

    def setUp(self):
        self.valid_data = {
            "matricule": "P_001",
            "nom": "Kollo",
            "prenom": "Jean",
            "sexe": "M",
            "date_naissance": "1980-05-15",
            "lieu_naissance": "Douala",
            "profession": "Medecin",
            "numero_securite_sociale": "1234567890",
            "statut_matrimonial": "MARIE"
        }

    def test_serializer_with_valid_data(self):
        """Vérification : Le serializer valide correctement les données complètes."""
        serializer = PatientSerializer(data=self.valid_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['nom'], "Kollo")

    def test_serializer_missing_required_field(self):
        """Vérification : Le serializer rejette les données quand un champ requis (ex: nom) est manquant."""
        invalid_data = self.valid_data.copy()
        del invalid_data['nom']
        serializer = PatientSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('nom', serializer.errors)
