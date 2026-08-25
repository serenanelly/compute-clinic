from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models import Patient

class PatientCreateAPITest(APITestCase):
    """
    Tests de l'endpoint de création de patients (POST).
    Couverture des classes d'équivalences définies dans scenarios.md.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="staffuser", password="staffpass123")
        self.client.force_authenticate(user=self.user)
        self.patient_url = reverse('patient-list')

        # Payload de base valide
        self.base_payload = {
            "nom": "Mbarga",
            "prenom": "Jean",
            "sexe": "M",
            "date_naissance": "1979-03-14",
            "lieu_naissance": "Yaoundé",
            "profession": "Technicien",
            "statut_matrimonial": "MARIE",
            "numero_securite_sociale": "SSN-UNIQUE-101",
            "nombre_enfants": 2
        }

    def test_val1_minimal_data(self):
        """VAL_1 : Création avec uniquement les données obligatoires."""
        payload = {
            "nom": "Eko",
            "sexe": "M",
            "date_naissance": "1990-01-01",
            "lieu_naissance": "Ebolowa",
            "profession": "Enseignant",
            "statut_matrimonial": "CELIBATAIRE",
            "numero_securite_sociale": "SSN-MINIMAL"
        }
        response = self.client.post(self.patient_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Patient.objects.filter(nom="Eko").count(), 1)

    def test_val2_complete_data(self):
        """VAL_2 : Création avec toutes les données (requis + optionnels)."""
        payload = self.base_payload.copy()
        payload["courriel"] = "jean.mbarga@example.com"
        response = self.client.post(self.patient_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['courriel'], "jean.mbarga@example.com")

    def test_val3_boundary_limits(self):
        """VAL_3 : Limites de caractères (100 caractères)."""
        long_name = "A" * 100
        payload = self.base_payload.copy()
        payload["nom"] = long_name
        payload["numero_securite_sociale"] = "SSN-LONG"
        response = self.client.post(self.patient_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['nom'], long_name)

    def test_err_1_missing_required_field(self):
        """ERR_1 : Champ requis manquant (nom)."""
        payload = self.base_payload.copy()
        del payload["nom"]
        response = self.client.post(self.patient_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("nom", response.data)

    def test_err_2_invalid_date_format(self):
        """ERR_2 : Format de date invalide."""
        payload = self.base_payload.copy()
        payload["date_naissance"] = "14/03/1979" # Mauvais format
        response = self.client.post(self.patient_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date_naissance", response.data)

    def test_err_3_invalid_email_format(self):
        """ERR_3 : Format d'email invalide."""
        payload = self.base_payload.copy()
        payload["courriel"] = "pas-un-email"
        response = self.client.post(self.patient_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("courriel", response.data)

    def test_err_4_invalid_choice(self):
        """ERR_4 : Choix invalide pour le sexe."""
        payload = self.base_payload.copy()
        payload["sexe"] = "X"
        response = self.client.post(self.patient_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("sexe", response.data)

    def test_err_5_length_overflow(self):
        """ERR_5 : Longueur excessive (> 100)."""
        payload = self.base_payload.copy()
        payload["nom"] = "A" * 101
        response = self.client.post(self.patient_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("nom", response.data)

    def test_err_6_invalid_type(self):
        """ERR_6 : Type de donnée erroné (string au lieu de int)."""
        payload = self.base_payload.copy()
        payload["nombre_enfants"] = "beaucoup"
        response = self.client.post(self.patient_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("nombre_enfants", response.data)

    def test_err_7_negative_integer(self):
        """ERR_7 : Entier négatif pour nombre_enfants."""
        payload = self.base_payload.copy()
        payload["nombre_enfants"] = -1
        response = self.client.post(self.patient_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("nombre_enfants", response.data)

    def test_con_1_duplicate_ssn(self):
        """CON_1 : Doublon de numéro de sécurité sociale."""
        # On crée un premier patient
        self.client.post(self.patient_url, self.base_payload)
        
        # On tente d'en créer un second avec le même SSN
        payload = self.base_payload.copy()
        payload["nom"] = "Autre Nom"
        response = self.client.post(self.patient_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("numero_securite_sociale", response.data)
