import uuid
from django.test import TestCase
from patient.models.patient import Patient
from medical_workflow.models import Hospitalisation, Examen, ResultatExamen, StatutExamen

class WorkflowModelTest(TestCase):
    """Tests des Hospitalisations et des Examens."""

    def setUp(self):
        self.patient = Patient.objects.create(
            matricule="P111",
            nom="WorkflowTest",
            date_naissance="1985-05-05",
            numero_securite_sociale="SSN111"
        )
        self.doctor_id = uuid.uuid4()
        self.room_id = uuid.uuid4()

    def test_hospitalization_creation(self):
        """Vérification : L'ID de chambre est obligatoire, l'ID docteur externe est enregistré, et le statut par défaut est 'EN_COURS'."""
        hosp = Hospitalisation.objects.create(
            patient=self.patient,
            motif="Chirurgie",
            room_id=self.room_id,
            doctor_id=self.doctor_id
        )
        self.assertEqual(hosp.room_id, self.room_id)
        self.assertEqual(hosp.statut, 'EN_COURS')

    def test_examination_and_result_link(self):
        """Vérification : Un examen peut être créé et lié à un résultat via une relation de type Un-à-Un (OneToOne)."""
        # On a d'abord besoin d'une consultation (requis par Examen)
        from medical_workflow.models import Consultation
        consult = Consultation.objects.create(
            patient=self.patient,
            motif="Init",
            medecin_charge=self.doctor_id
        )
        
        examen = Examen.objects.create(
            consultation=consult,
            nom="Scanner",
            motif="Douleur"
        )
        
        resultat = ResultatExamen.objects.create(
            examen=examen,
            doctor_id=self.doctor_id,
            resultats="Rien à signaler"
        )
        
        self.assertEqual(examen.resultat, resultat)
        self.assertEqual(resultat.examen, examen)
