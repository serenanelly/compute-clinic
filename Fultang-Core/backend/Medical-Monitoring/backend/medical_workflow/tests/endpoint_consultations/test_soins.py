from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models.patient import Patient
from medical_workflow.models import SoinAdministre
import uuid

class SoinAPITest(APITestCase):
    """
    Tests pour l'enregistrement des soins via l'API imbriquée dans Patient (Phase 3.7).
    Le soin n'est pas lié à une consultation.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="nurse_betty", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # 1. Création du patient
        self.patient = Patient.objects.create(
            nom="Mbarga", sexe="M", date_naissance="1979-03-14",
            statut_matrimonial="MARIE", numero_securite_sociale="SSN-SOIN-1"
        )
        
        # URL imbriquée : /api/patients/{id}/soins/
        self.nested_url = reverse('patient-enregistrer-soin', args=[self.patient.id])
        # Ancienne URL générique (devrait être inactive)
        self.generic_url = "/api/medical-monitoring/soins/"

    def test_sc_soin_01_create_soin_nested(self):
        """SC_SOIN_01 : Enregistrer un soin via l'URL imbriquée du patient."""
        payload = {
            "nom": "Pansement compressif",
            "type_soin": "Infirmier",
            "motif": "Saignement léger localisé",
            "responsible_person_id": str(uuid.uuid4())
        }
        
        response = self.client.post(self.nested_url, payload)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['nom'], payload['nom'])
        # Le serializer SoinAdministreSerializer renvoie l'ID du patient sous forme de UUID ou string
        self.assertEqual(str(response.data['patient']), str(self.patient.id))
        
        # Vérifier en base
        self.assertEqual(SoinAdministre.objects.count(), 1)
        self.assertEqual(SoinAdministre.objects.first().patient, self.patient)
        self.assertIsNone(SoinAdministre.objects.first().visite)

    def test_sc_soin_02_generic_endpoint_removed(self):
        """SC_SOIN_02 : Vérifier que l'endpoint générique n'existe plus."""
        payload = {
            "nom": "Test", 
            "patient": self.patient.id, 
            "responsible_person_id": str(uuid.uuid4()),
            "type_soin": "Test",
            "motif": "Test"
        }
        response = self.client.post(self.generic_url, payload)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
