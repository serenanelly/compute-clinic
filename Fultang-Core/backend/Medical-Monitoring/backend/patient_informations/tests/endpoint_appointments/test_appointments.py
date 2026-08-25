from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models.patient import Patient
from patient_informations.models import RendezVous

class AppointmentAPITest(APITestCase):
    """
    Tests pour l'enregistrement de rendez-vous via l'API imbriquée dans Patient (Phase 11.1).
    """

    def setUp(self):
        self.user = User.objects.create_user(username="receptionist", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # 1. Création du patient
        self.patient = Patient.objects.create(
            nom="Mbarga", sexe="M", date_naissance="1979-03-14",
            numero_securite_sociale="SSN-RDV-1"
        )
        
        # URL imbriquée : /api/patients/{id}/rendez-vous/
        self.appointment_url = reverse('patient-fixer-rendez-vous', args=[self.patient.id])
        # Ancienne URL générique (si elle existait encore dans les tests)
        self.generic_url = "/api/patient/rendez-vous/"

    def test_sc_rdv_01_create_appointment_nested(self):
        """SC_RDV_01 : Fixer un rendez-vous via l'URL imbriquée du patient."""
        payload = {
            "motif": "Contrôle post-hospitalisation cardiologie",
            "personnel_concerne": "Dr. House",
            "date_heure": "2026-05-15T10:00:00Z",
            "statut": "PROGRAMME"
        }
        
        response = self.client.post(self.appointment_url, payload)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['motif'], payload['motif'])
        self.assertEqual(str(response.data['patient']), str(self.patient.id))
        
        # Vérifier en base
        self.assertEqual(RendezVous.objects.count(), 1)
        rdv = RendezVous.objects.first()
        self.assertEqual(rdv.patient, self.patient)
        self.assertEqual(rdv.personnel_concerne, "Dr. House")

    def test_sc_rdv_02_generic_endpoint_removed(self):
        """SC_RDV_02 : Vérifier que l'endpoint générique n'existe plus."""
        payload = {"motif": "Test", "patient": self.patient.id}
        response = self.client.post(self.generic_url, payload)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
