from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models.patient import Patient
from medical_workflow.models import Visite, Consultation, MedicamentPrescrit

class PrescriptionListAPITest(APITestCase):
    """
    Tests pour la liste des prescriptions d'un patient (Phase 9.2).
    """

    def setUp(self):
        self.user = User.objects.create_user(username="nurse_joy", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # 1. Création du patient
        self.patient = Patient.objects.create(
            nom="Mbarga", sexe="M", date_naissance="1979-03-14",
            numero_securite_sociale="SSN-PRES-LIST-1"
        )
        
        # 2. Création de la visite et consultation
        self.visite = Visite.objects.create(patient=self.patient, motif_visite="Douleurs")
        self.consultation = Consultation.objects.create(
            patient=self.patient, visite=self.visite, motif="Checkup", medecin_charge="2"
        )
        
        # 3. Création des prescriptions
        self.clopidogrel = MedicamentPrescrit.objects.create(
            consultation=self.consultation,
            nom="Clopidogrel 75mg",
            quantite="1 par jour",
            posologie="Le soir"
        )
        self.atorvastatine = MedicamentPrescrit.objects.create(
            consultation=self.consultation,
            nom="Atorvastatine 20mg",
            quantite="1 par soir",
            posologie="Pendant le dîner"
        )
        
        self.list_url = reverse('prescription-list')

    def test_sc_pres_list_01_filter_by_patient(self):
        """SC_PRES_LIST_01 : Lister les prescriptions d'un patient spécifique."""
        response = self.client.get(f"{self.list_url}?patient={self.patient.id}")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        # Vérifier que le Clopidogrel est présent
        noms = [p['nom'] for p in response.data]
        self.assertIn("Clopidogrel 75mg", noms)

    def test_sc_pres_list_02_empty_for_other_patient(self):
        """SC_PRES_LIST_02 : Retourner une liste vide pour un patient sans prescriptions."""
        p_autre = Patient.objects.create(nom="Autre", date_naissance="1990-01-01")
        response = self.client.get(f"{self.list_url}?patient={p_autre.id}")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)
