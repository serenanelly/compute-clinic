from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models import Patient
from patient_informations.models import Antecedent

class AntecedentAPITest(APITestCase):
    """
    Tests pour l'enregistrement et la consultation des antécédents médicaux et familiaux.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="profante", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # Création d'un patient de base
        self.patient = Patient.objects.create(
            nom="Mbarga", sexe="M", date_naissance="1979-03-14",
            statut_matrimonial="MARIE", numero_securite_sociale="SSN-ANT-1"
        )
        self.antecedent_url = reverse('antecedent-list')
        self.dossier_url = reverse('patient-dossier', args=[self.patient.id])

    def test_sc_ant_01_familial_history(self):
        """SC_ANT_01 : Enregistrement d'un antécédent familial."""
        payload = {
            "patient": self.patient.id,
            "type": "FAMILIAL",
            "nom": "Infarctus du myocarde",
            "date": "2000-01-01",
            "description": "Père décédé d'un infarctus"
        }
        response = self.client.post(self.antecedent_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['type'], "FAMILIAL")

    def test_sc_ant_02_medical_history(self):
        """SC_ANT_02 : Enregistrement d'un antécédent médical."""
        payload = {
            "patient": self.patient.id,
            "type": "MEDICAL",
            "nom": "Hypertension artérielle",
            "date": "2023-06-15",
            "description": "Diagnostiquée il y a 3 ans"
        }
        response = self.client.post(self.antecedent_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['type'], "MEDICAL")

    def test_sc_ant_03_dossier_integration(self):
        """SC_ANT_03 : Vérifier que les antécédents apparaissent dans le dossier."""
        # On en crée deux
        Antecedent.objects.create(
            patient=self.patient, type="FAMILIAL", nom="A1", date="2020-01-01"
        )
        Antecedent.objects.create(
            patient=self.patient, type="MEDICAL", nom="A2", date="2021-01-01"
        )
        
        response = self.client.get(self.dossier_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['antecedents']), 2)
        # Vérification du tri par date (Meta ordering -date)
        self.assertEqual(response.data['antecedents'][0]['nom'], "A2")
