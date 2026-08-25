from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models.patient import Patient
from medical_workflow.models import Visite, Consultation, Symptome

class SymptomAPITest(APITestCase):
    """
    Tests pour l'enregistrement des symptômes via l'API imbriquée (Phase 3.3).
    Vérifie également la suppression de l'endpoint générique.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="doctor_house", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # 1. Création du patient
        self.patient = Patient.objects.create(
            nom="Mbarga", sexe="M", date_naissance="1979-03-14",
            statut_matrimonial="MARIE", numero_securite_sociale="SSN-SYM-1"
        )
        
        # 2. Création de la visite et consultation
        self.visite = Visite.objects.create(patient=self.patient, motif_visite="Douleurs")
        self.consultation = Consultation.objects.create(
            patient=self.patient, visite=self.visite, motif="Checkup", medecin_charge="2"
        )
        
        # URL imbriquée : /api/medical-monitoring/consultations/{id}/symptomes/
        self.nested_url = reverse('consultation-enregistrer-symptome', args=[self.consultation.id])
        # Ancienne URL générique (devrait être inactive)
        self.generic_url = "/api/medical-monitoring/symptomes/"

    def test_sc_sym_01_create_symptom_nested(self):
        """SC_SYM_01 : Enregistrer un symptôme via l'URL imbriquée de la consultation."""
        payload = {
            "nom": "Douleur thoracique",
            "localisation": "Centre de la poitrine",
            "date_debut": "2026-03-22",
            "frequence": "A l'effort physique",
            "evolution": "Stable"
        }
        
        response = self.client.post(self.nested_url, payload)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['nom'], payload['nom'])
        self.assertEqual(str(response.data['consultation']), str(self.consultation.id))
        
        # Vérifier en base
        self.assertEqual(Symptome.objects.count(), 1)
        self.assertEqual(Symptome.objects.first().consultation, self.consultation)

    def test_sc_sym_02_generic_endpoint_removed(self):
        """SC_SYM_02 : Vérifier que l'endpoint générique n'existe plus."""
        payload = {"nom": "Test", "consultation": self.consultation.id}
        response = self.client.post(self.generic_url, payload)
        
        # Le router DefaultRouter renvoie 404 si le ViewSet n'est plus enregistré
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_sc_sym_03_create_multiple_symptoms(self):
        """SC_SYM_03 : Enregistrer plusieurs symptômes pour la même consultation."""
        self.client.post(self.nested_url, {"nom": "Symptome 1"})
        self.client.post(self.nested_url, {"nom": "Symptome 2"})
        
        self.assertEqual(Symptome.objects.filter(consultation=self.consultation).count(), 2)
