from datetime import datetime
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models import Patient

class MatriculeAutomationTest(APITestCase):
    """
    Tests pour l'auto-génération du matricule et l'endpoint associé.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="staffuser", password="staffpass123")
        self.client.force_authenticate(user=self.user)
        self.patient_url = reverse('patient-list')
        self.prochain_url = reverse('patient-prochain-matricule')
        
        self.year_prefix = f"{datetime.now().year % 100}F"

    def test_mat1_first_matricule_of_year(self):
        """MAT_1 : Vérifie que le premier matricule de l'année commence à 0000."""
        # On s'assure qu'il n'y a pas de patients pour cette année
        Patient.objects.filter(matricule__startswith=self.year_prefix).delete()
        
        payload = {
            "nom": "Mbarga",
            "sexe": "M",
            "date_naissance": "1979-03-14",
            "lieu_naissance": "Yaounde",
            "profession": "Technicien",
            "numero_securite_sociale": "SSN-AUTO-1",
            "statut_matrimonial": "MARIE"
        }
        response = self.client.post(self.patient_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['matricule'], f"{self.year_prefix}0000")

    def test_mat2_incrementation(self):
        """MAT_2 : Vérifie l'incrémentation séquentielle."""
        # Création du premier
        Patient.objects.create(
            nom="Test1", sexe="M", date_naissance="1990-01-01", 
            lieu_naissance="Lieu", profession="Prof", 
            numero_securite_sociale="SSN-AUTO-2", statut_matrimonial="CELIBATAIRE"
        )
        
        # Création du second via API
        payload = {
            "nom": "Test2",
            "sexe": "F",
            "date_naissance": "1992-05-05",
            "lieu_naissance": "Lieu",
            "profession": "Prof",
            "numero_securite_sociale": "SSN-AUTO-3",
            "statut_matrimonial": "CELIBATAIRE"
        }
        response = self.client.post(self.patient_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Il devrait être le 0001 (car le premier créé manuellement a pris 0000)
        self.assertEqual(response.data['matricule'], f"{self.year_prefix}0001")

    def test_mat3_ignore_provided_matricule(self):
        """MAT_3 : Le matricule fourni manuellement dans le POST doit être ignoré."""
        payload = {
            "matricule": "HACK-99", # Valeur invalide/manuelle
            "nom": "Mbarga",
            "sexe": "M",
            "date_naissance": "1979-03-14",
            "lieu_naissance": "Yaounde",
            "profession": "Technicien",
            "numero_securite_sociale": "SSN-AUTO-4",
            "statut_matrimonial": "MARIE"
        }
        response = self.client.post(self.patient_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # La valeur auto-générée doit primer
        self.assertNotEqual(response.data['matricule'], "HACK-99")
        self.assertTrue(response.data['matricule'].startswith(self.year_prefix))

    def test_mat4_prochain_matricule_endpoint(self):
        """MAT_4 : L'endpoint prochain-matricule doit être cohérent."""
        # 1. Obtenir le prochain
        resp_get = self.client.get(self.prochain_url)
        self.assertEqual(resp_get.status_code, status.HTTP_200_OK)
        next_val = resp_get.data['prochain_matricule']
        
        # 2. Créer un patient
        payload = {
            "nom": "Mbarga", "sexe": "M", "date_naissance": "1979-03-14",
            "lieu_naissance": "Yaounde", "profession": "Tech",
            "numero_securite_sociale": "SSN-AUTO-5", "statut_matrimonial": "MARIE"
        }
        resp_post = self.client.post(self.patient_url, payload)
        self.assertEqual(resp_post.data['matricule'], next_val)
        
        # 3. Vérifier que l'endpoint a incrémenté
        resp_get_after = self.client.get(self.prochain_url)
        last_num = int(next_val[3:])
        expected_next = f"{self.year_prefix}{last_num + 1:04d}"
        self.assertEqual(resp_get_after.data['prochain_matricule'], expected_next)
