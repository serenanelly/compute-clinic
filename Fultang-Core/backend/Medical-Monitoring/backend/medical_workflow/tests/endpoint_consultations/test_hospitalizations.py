from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models.patient import Patient
from medical_workflow.models import Visite, Hospitalisation
import uuid

class HospitalizationAPITest(APITestCase):
    """
    Tests pour la décision d'hospitalisation via l'API imbriquée dans Visite (Phase 5.3).
    """

    def setUp(self):
        self.user = User.objects.create_user(username="doctor_house", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # 1. Création du patient
        self.patient = Patient.objects.create(
            nom="Mbarga", sexe="M", date_naissance="1979-03-14",
            statut_matrimonial="MARIE", numero_securite_sociale="SSN-HOSP-1"
        )
        
        # 2. Création de la visite
        self.visite = Visite.objects.create(patient=self.patient, motif_visite="Douleurs")
        
        # URL imbriquée : /api/visites/{id}/hospitalisations/
        self.hospitalize_url = reverse('visite-hospitaliser', args=[self.visite.id])
        # Ancienne URL générique
        self.generic_url = "/api/medical-monitoring/hospitalisations/"

    def test_sc_hosp_01_create_hospitalization_nested(self):
        """SC_HOSP_01 : Hospitaliser un patient via l'URL imbriquée de la visite."""
        doctor_id = str(uuid.uuid4())
        room_id = str(uuid.uuid4())
        
        payload = {
            "doctor_id": doctor_id,   # Correspond au 'medecin_charge' mentionné par l'utilisateur
            "room_id": room_id,
            "motif": "NSTEMI confirmé. Surveillance rapprochée en cardiologie.",
            "duree_prevue": "5 jours",
            "statut": "EN_COURS"
        }
        
        response = self.client.post(self.hospitalize_url, payload)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['motif'], payload['motif'])
        self.assertEqual(str(response.data['visite']), str(self.visite.id))
        self.assertEqual(str(response.data['patient']), str(self.patient.id))
        self.assertEqual(str(response.data['doctor_id']), doctor_id)
        
        # Vérifier en base
        self.assertEqual(Hospitalisation.objects.count(), 1)
        hosp = Hospitalisation.objects.first()
        self.assertEqual(hosp.visite, self.visite)
        self.assertEqual(hosp.patient, self.patient)

    def test_sc_hosp_02_generic_endpoint_removed(self):
        """SC_HOSP_02 : Vérifier que l'endpoint générique n'existe plus."""
        payload = {"motif": "Test", "visite": self.visite.id}
        response = self.client.post(self.generic_url, payload)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
