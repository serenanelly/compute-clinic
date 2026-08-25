import uuid
from django.test import TestCase
from patient.models.patient import Patient
from medical_workflow.models import Consultation, Symptome
from medical_workflow.serializers import ConsultationSerializer

class WorkflowSerializerTest(TestCase):
    """Tests des serializers de l'application medical_workflow."""

    def setUp(self):
        # Création d'un patient et d'une consultation pour le test
        self.patient = Patient.objects.create(
            matricule="P_API",
            nom="ApiTest",
            date_naissance="1995-10-10",
            lieu_naissance="Yaoundé",
            profession="Chercheur",
            numero_securite_sociale="999-API"
        )
        self.consultation = Consultation.objects.create(
            patient=self.patient,
            motif="Douleurs abdominales",
            doctor_id=uuid.uuid4()
        )
        # Ajout de symptômes
        Symptome.objects.create(consultation=self.consultation, nom="Crampes")
        Symptome.objects.create(consultation=self.consultation, nom="Nausées")

    def test_consultation_nested_serialization(self):
        """Vérification : Le ConsultationSerializer inclut bien la liste des symptômes associés."""
        serializer = ConsultationSerializer(instance=self.consultation)
        
        # Le champ 'symptomes' doit être présent et contenir 2 éléments
        self.assertIn('symptomes', serializer.data)
        self.assertEqual(len(serializer.data['symptomes']), 2)
        
        # Vérification du contenu du premier symptôme
        self.assertEqual(serializer.data['symptomes'][0]['nom'], "Crampes")
