from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models.patient import Patient
from medical_workflow.models import Visite, Consultation

class ConsultationAPITest(APITestCase):
    """
    Tests pour l'ouverture des consultations rattachées à une visite (Phase 3.2).
    """

    def setUp(self):
        self.user = User.objects.create_user(username="doctor_house", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # 1. Création du patient
        self.patient = Patient.objects.create(
            nom="Mbarga", sexe="M", date_naissance="1979-03-14",
            statut_matrimonial="MARIE", numero_securite_sociale="SSN-CON-1"
        )
        
        # 2. Création de la visite (Phase 1.6 simulée)
        self.visite = Visite.objects.create(
            patient=self.patient,
            motif_visite="Douleurs thoraciques",
            statut="EN_COURS"
        )
        
        self.consultation_url = reverse('visite-ouvrir-consultation', args=[self.visite.id])

    def test_sc_con_01_ouvrir_consultation(self):
        """SC_CON_01 : Ouverture d'une consultation via une visite existante."""
        payload = {
            "motif": "Douleurs thoraciques récurrentes depuis 3 semaines",
            "medecin_charge": "2",
            "date_heure": "2026-04-12T09:30:00Z"
        }
        
        response = self.client.post(self.consultation_url, payload)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['motif'], payload['motif'])
        self.assertEqual(str(response.data['visite']), str(self.visite.id))
        self.assertEqual(str(response.data['patient']), str(self.patient.id))
        self.assertEqual(response.data['medecin_charge'], "2")

    def test_sc_con_02_rejet_visite_invalide(self):
        """SC_CON_02 : Erreur si on essaie d'ouvrir une consultation sur une visite inexistante."""
        invalid_url = "/api/medical-monitoring/visites/00000000-0000-0000-0000-000000000000/consultations/"
        payload = {"motif": "Test", "medecin_charge": "1"}
        
        response = self.client.post(invalid_url, payload)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
