from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models.patient import Patient
from medical_workflow.models import Visite, Consultation, Examen

class ExamAPITest(APITestCase):
    """
    Tests pour la prescription d'examens via l'API imbriquée (Phase 3.5).
    Vérifie également la suppression de l'endpoint générique.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="doctor_house", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # 1. Création du patient
        self.patient = Patient.objects.create(
            nom="Mbarga", sexe="M", date_naissance="1979-03-14",
            statut_matrimonial="MARIE", numero_securite_sociale="SSN-EXAM-1"
        )
        
        # 2. Création de la visite et consultation
        self.visite = Visite.objects.create(patient=self.patient, motif_visite="Douleurs")
        self.consultation = Consultation.objects.create(
            patient=self.patient, visite=self.visite, motif="Checkup", medecin_charge="2"
        )
        
        # URL imbriquée : /api/medical-monitoring/consultations/{id}/examens/
        self.nested_url = reverse('consultation-prescrire-examen', args=[self.consultation.id])
        # Ancienne URL générique (devrait être inactive)
        self.generic_url = "/api/medical-monitoring/examens/"

    def test_sc_exam_01_prescribe_exam_nested(self):
        """SC_EXAM_01 : Prescrire un examen via l'URL imbriquée de la consultation."""
        payload = {
            "nom": "ECG",
            "motif": "Signes d'insuffisance coronaire",
            "anatomie": "Thorax"
        }
        
        response = self.client.post(self.nested_url, payload)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['nom'], payload['nom'])
        self.assertEqual(str(response.data['consultation']), str(self.consultation.id))
        
        # Vérifier en base
        self.assertEqual(Examen.objects.count(), 1)
        self.assertEqual(Examen.objects.first().consultation, self.consultation)

    def test_sc_exam_02_generic_endpoint_removed(self):
        """SC_EXAM_02 : Vérifier que l'endpoint générique n'existe plus."""
        payload = {"nom": "Test", "consultation": self.consultation.id}
        response = self.client.post(self.generic_url, payload)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
