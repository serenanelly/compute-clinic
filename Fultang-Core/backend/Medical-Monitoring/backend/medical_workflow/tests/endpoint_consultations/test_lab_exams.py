from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models.patient import Patient
from medical_workflow.models import Visite, Consultation, Examen

class LabExamsAPITest(APITestCase):
    """
    Tests pour la consultation des examens par le laboratoire (Phase 4.1).
    Focalisé sur la vue patient.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="lab_tech", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # 1. Création du patient
        self.patient = Patient.objects.create(
            nom="Mbarga", sexe="M", date_naissance="1979-03-14",
            statut_matrimonial="MARIE", numero_securite_sociale="SSN-LAB-1"
        )
        
        # 2. Création de la visite et consultation
        self.visite = Visite.objects.create(patient=self.patient, motif_visite="Douleurs")
        self.consultation = Consultation.objects.create(
            patient=self.patient, visite=self.visite, motif="Checkup", medecin_charge="2"
        )
        
        # 3. Création des examens
        self.ecg = Examen.objects.create(
            consultation=self.consultation,
            nom="ECG",
            motif="Signes d'insuffisance coronaire",
            statut="EN_ATTENTE"
        )
        self.bilan = Examen.objects.create(
            consultation=self.consultation,
            nom="Bilan Sanguin",
            motif="Troponines",
            statut="TERMINE"
        )
        
        # URL : /api/patients/{id}/examens/
        self.patient_exams_url = reverse('patient-obtenir-examens', args=[self.patient.id])

    def test_sc_lab_01_list_all_patient_exams(self):
        """SC_LAB_01 : Lister tous les examens prescrits pour un patient."""
        response = self.client.get(self.patient_exams_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_sc_lab_02_filter_exams_by_status(self):
        """SC_LAB_02 : Filtrer les examens du patient par statut (EN_ATTENTE)."""
        response = self.client.get(f"{self.patient_exams_url}?statut=EN_ATTENTE")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['nom'], "ECG")
        self.assertEqual(response.data[0]['statut'], "EN_ATTENTE")

    def test_sc_lab_03_empty_list_for_invalid_status(self):
        """SC_LAB_03 : Retourner une liste vide pour un statut inexistant ou sans match."""
        response = self.client.get(f"{self.patient_exams_url}?statut=ANNULE")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)
