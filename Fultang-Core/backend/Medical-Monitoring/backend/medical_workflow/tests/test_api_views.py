import uuid
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models import Patient
from medical_workflow.models import Consultation

class WorkflowAPITest(APITestCase):
    """Tests d'intégration de l'API Medical Workflow."""

    def setUp(self):
        # Authentification
        self.user = User.objects.create_user(username="doctor", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # Données Patient
        self.patient = Patient.objects.create(
            matricule="P_API_2",
            nom="Mballa",
            date_naissance="1988-08-08",
            lieu_naissance="Kribi",
            profession="Pêcheur",
            numero_securite_sociale="SSN-API-2"
        )
        self.doctor_id = uuid.uuid4()
        self.consultation_url = reverse('consultation-list')

    def test_create_consultation(self):
        """Vérification : Un médecin peut créer une consultation via l'API."""
        payload = {
            "patient": str(self.patient.id),
            "motif": "Consultation annuelle",
            "doctor_id": str(self.doctor_id)
        }
        response = self.client.post(self.consultation_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Consultation.objects.count(), 1)

    def test_unauthenticated_access_denied(self):
        """Vérification : L'accès à l'API est refusé sans authentification."""
        self.client.force_authenticate(user=None)
        response = self.client.get(self.consultation_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
