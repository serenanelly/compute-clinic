from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models import Patient

class PatientAPITest(APITestCase):
    """Tests d'intégration de l'API Patient."""

    def setUp(self):
        # Création d'un utilisateur et authentification
        self.username = "staffuser"
        self.password = "staffpass123"
        self.user = User.objects.create_user(username=self.username, password=self.password)
        self.client.force_authenticate(user=self.user)
        
        # Données de base pour les tests
        # Le router génère le nom 'app_name:model_name-list' ou juste 'model_name-list'
        self.patient_url = reverse('patient-list') 
        
        self.valid_payload = {
            "nom": "Kouam",
            "prenom": "Cyrille",
            "sexe": "M",
            "date_naissance": "1992-03-20",
            "lieu_naissance": "Bafoussam",
            "profession": "Artisan",
            "numero_securite_sociale": "SSN-API-1",
            "statut_matrimonial": "CELIBATAIRE"
        }

    def test_list_patients_authenticated(self):
        """Vérification : Un utilisateur authentifié peut lister les patients."""
        response = self.client.get(self.patient_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_patient_authenticated(self):
        """Vérification : La création d'un patient via l'API fonctionne."""
        response = self.client.post(self.patient_url, self.valid_payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Patient.objects.count(), 1)
        self.assertEqual(Patient.objects.get().nom, "Kouam")

