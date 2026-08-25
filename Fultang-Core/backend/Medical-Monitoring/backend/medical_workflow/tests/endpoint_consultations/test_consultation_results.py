from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models.patient import Patient
from medical_workflow.models import Visite, Consultation, Examen, ResultatExamen
import uuid

class ConsultationResultsAPITest(APITestCase):
    """
    Tests pour la consultation des résultats par le médecin (Phase 5.1).
    Vérifie que l'objet Consultation agrège bien les examens et leurs résultats.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="doctor_house", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # 1. Création du patient
        self.patient = Patient.objects.create(
            nom="Mbarga", sexe="M", date_naissance="1979-03-14",
            statut_matrimonial="MARIE", numero_securite_sociale="SSN-51"
        )
        
        # 2. Création de la visite et consultation
        self.visite = Visite.objects.create(patient=self.patient, motif_visite="Douleurs")
        self.consultation = Consultation.objects.create(
            patient=self.patient, visite=self.visite, motif="Checkup", medecin_charge="2"
        )
        
        # 3. Création de l'examen et son résultat
        self.examen = Examen.objects.create(
            consultation=self.consultation,
            nom="ECG",
            motif="Douleurs",
            statut="REALISE"
        )
        self.resultat = ResultatExamen.objects.create(
            examen=self.examen,
            doctor_id=uuid.uuid4(),
            resultats="Anomalies ST+.",
            observations="Nécrose confirmée."
        )
        
        # URL : /api/medical-monitoring/consultations/{id}/
        self.consultation_url = reverse('consultation-detail', args=[self.consultation.id])

    def test_sc_cons_51_view_exam_results_in_consultation(self):
        """SC_CONS_51 : Vérifier que les résultats d'examens sont visibles dans le détail de la consultation."""
        response = self.client.get(self.consultation_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Vérification de la présence des examens
        self.assertIn('examens', response.data)
        self.assertEqual(len(response.data['examens']), 1)
        
        # Vérification des résultats imbriqués
        examen_data = response.data['examens'][0]
        self.assertEqual(examen_data['nom'], "ECG")
        self.assertIsNotNone(examen_data['resultat'])
        self.assertEqual(examen_data['resultat']['resultats'], "Anomalies ST+.")
