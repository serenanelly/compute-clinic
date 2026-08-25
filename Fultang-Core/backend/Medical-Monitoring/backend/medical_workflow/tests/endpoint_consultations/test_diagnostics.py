from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models.patient import Patient
from medical_workflow.models import Visite, Consultation, Diagnostic

class DiagnosticAPITest(APITestCase):
    """
    Tests pour l'enregistrement des diagnostics via l'API imbriquée (Phase 3.4).
    Vérifie également la suppression de l'endpoint générique.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="doctor_house", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # 1. Création du patient
        self.patient = Patient.objects.create(
            nom="Mbarga", sexe="M", date_naissance="1979-03-14",
            statut_matrimonial="MARIE", numero_securite_sociale="SSN-DIAG-1"
        )
        
        # 2. Création de la visite et consultation
        self.visite = Visite.objects.create(patient=self.patient, motif_visite="Douleurs")
        self.consultation = Consultation.objects.create(
            patient=self.patient, visite=self.visite, motif="Checkup", medecin_charge="2"
        )
        
        # URL imbriquée : /api/medical-monitoring/consultations/{id}/diagnostics/
        self.nested_url = reverse('consultation-enregistrer-diagnostic', args=[self.consultation.id])
        # Ancienne URL générique (devrait être inactive)
        self.generic_url = "/api/medical-monitoring/diagnostics/"

    def test_sc_diag_01_create_diagnostic_nested(self):
        """SC_DIAG_01 : Enregistrer un diagnostic via l'URL imbriquée de la consultation."""
        payload = {
            "libelle": "Suspicition d'Infarctus du Myocarde",
            "description": "Douleurs thoraciques typiques avec essoufflement",
            "niveau_certitude": "Élevé"
        }
        
        response = self.client.post(self.nested_url, payload)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['libelle'], payload['libelle'])
        self.assertEqual(str(response.data['consultation']), str(self.consultation.id))
        
        # Vérifier en base
        self.assertEqual(Diagnostic.objects.count(), 1)
        self.assertEqual(Diagnostic.objects.first().consultation, self.consultation)

    def test_sc_diag_02_generic_endpoint_removed(self):
        """SC_DIAG_02 : Vérifier que l'endpoint générique n'existe plus."""
        payload = {"libelle": "Test", "consultation": self.consultation.id}
        response = self.client.post(self.generic_url, payload)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
