from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models.patient import Patient
from patient_informations.models import DonneesCliniques
from medical_workflow.models import Visite, Consultation
import datetime

class MedicalExportAPITest(APITestCase):
    """
    Tests pour l'exportation anonymisée des données médicales.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="data_analyst", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # 1. Création d'un patient avec données médicales
        # Date naissance il y a exactement 30 ans pour tester l'âge
        today = datetime.date.today()
        birth_date = today.replace(year=today.year - 30)
        self.patient = Patient.objects.create(
            nom="Mbarga", prenom="Joseph", matricule="M111", 
            date_naissance=birth_date, sexe="M", statut_matrimonial="MARIE",
            nombre_enfants=3, profession="Ingénieur"
        )
        
        DonneesCliniques.objects.create(
            patient=self.patient, groupe_sanguin="A", facteur_rhesus="POSITIF",
            poids="80kg", taille="180cm", pouls="75", taux_oxygene="98%"
        )
        
        self.visite = Visite.objects.create(patient=self.patient, motif_visite="Checkup")
        Consultation.objects.create(
            patient=self.patient, visite=self.visite, motif="Consultation Test", medecin_charge="2"
        )
        
        self.export_url = reverse('patient-exporter-donnees-medicales')

    def test_sc_export_01_anonymized_download(self):
        """SC_EXPORT_01 : L'export JSON doit être anonymisé et contenir l'âge."""
        response = self.client.get(self.export_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.has_header('Content-Disposition'))
        self.assertIn('export_medical_systeme.json', response['Content-Disposition'])
        
        data = response.data
        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 1)
        
        patient_data = data[0]
        # Vérifier les exclusions PII
        self.assertNotIn('nom', patient_data)
        self.assertNotIn('prenom', patient_data)
        self.assertNotIn('matricule', patient_data)
        
        # Vérifier les inclusions demandées
        self.assertEqual(patient_data['age'], 30)
        self.assertEqual(patient_data['nombre_enfants'], 3)
        self.assertEqual(patient_data['sexe'], "M")
        
        # Vérifier les données médicales
        self.assertIn('donnees_cliniques', patient_data)
        self.assertIn('consultations', patient_data)
        self.assertGreaterEqual(len(patient_data['consultations']), 1)
        
        # Vérifier l'anonymisation dans les consultations
        consult = patient_data['consultations'][0]
        self.assertNotIn('patient', consult)
        self.assertNotIn('visite', consult)
        self.assertEqual(consult['motif'], "Consultation Test")
