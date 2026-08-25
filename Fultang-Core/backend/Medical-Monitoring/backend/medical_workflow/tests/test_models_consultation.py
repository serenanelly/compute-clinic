import uuid
from django.test import TestCase
from patient.models.patient import Patient
from medical_workflow.models import Consultation, Symptome

class ConsultationModelTest(TestCase):
    """Tests du cycle Consultation -> Symptômes."""

    def setUp(self):
        # Création d'un patient pour la relation
        self.patient = Patient.objects.create(
            matricule="P999",
            nom="Test",
            date_naissance="2000-01-01",
            numero_securite_sociale="SSN999"
        )
        self.doctor_id = uuid.uuid4()

    def test_consultation_creation(self):
        """Vérification : Une consultation est correctement liée à un Patient et enregistre l'identifiant du médecin externe."""
        consultation = Consultation.objects.create(
            patient=self.patient,
            motif="Fièvre persistante",
            doctor_id=self.doctor_id
        )
        self.assertIsInstance(consultation.id, uuid.UUID)
        self.assertEqual(consultation.doctor_id, self.doctor_id)

    def test_symptome_cascade_deletion(self):
        """Vérification : La suppression d'une consultation entraîne automatiquement la suppression de tous les symptômes associés (Intégrité CASCADE)."""
        consultation = Consultation.objects.create(
            patient=self.patient,
            motif="Checkup",
            doctor_id=self.doctor_id
        )
        Symptome.objects.create(
            consultation=consultation,
            nom="Toux"
        )
        self.assertEqual(Symptome.objects.count(), 1)
        
        # Suppression de la consultation
        consultation.delete()
        self.assertEqual(Symptome.objects.count(), 0)
