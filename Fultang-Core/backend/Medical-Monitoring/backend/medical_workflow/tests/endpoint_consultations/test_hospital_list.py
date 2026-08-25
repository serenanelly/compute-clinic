from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models.patient import Patient
from medical_workflow.models import Visite, Hospitalisation
import uuid

class HospitalListAPITest(APITestCase):
    """
    Tests pour la liste globale des hospitalisations (Phase 8.1).
    """

    def setUp(self):
        self.user = User.objects.create_user(username="nurse_joy", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # 1. Création des patients
        self.patient_mbarga = Patient.objects.create(
            nom="Mbarga", sexe="M", date_naissance="1979-03-14",
            numero_securite_sociale="SSN-HOSP-LIST-1"
        )
        self.patient_autre = Patient.objects.create(
            nom="Autre", sexe="F", date_naissance="1990-01-01",
            numero_securite_sociale="SSN-HOSP-LIST-2"
        )
        
        # 2. Création des visites
        self.visite_mbarga = Visite.objects.create(patient=self.patient_mbarga, motif_visite="Infarctus")
        self.visite_autre = Visite.objects.create(patient=self.patient_autre, motif_visite="Routine")
        
        # 3. Création des hospitalisations
        self.hosp_mbarga = Hospitalisation.objects.create(
            patient=self.patient_mbarga,
            visite=self.visite_mbarga,
            doctor_id=uuid.uuid4(),
            room_id=uuid.uuid4(),
            motif="Surveillance NSTEMI",
            statut="EN_COURS"
        )
        self.hosp_autre = Hospitalisation.objects.create(
            patient=self.patient_autre,
            visite=self.visite_autre,
            doctor_id=uuid.uuid4(),
            room_id=uuid.uuid4(),
            motif="Observation terminée",
            statut="TERMINE"
        )
        
        self.list_url = reverse('hospitalisation-list')

    def test_sc_hosp_list_01_filter_by_active_status(self):
        """SC_HOSP_LIST_01 : Lister uniquement les patients actuellement hospitalisés (EN_COURS)."""
        response = self.client.get(f"{self.list_url}?statut=EN_COURS")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['motif'], "Surveillance NSTEMI")
        self.assertEqual(response.data[0]['statut'], "EN_COURS")

    def test_sc_hosp_list_02_all_hospitalizations(self):
        """SC_HOSP_LIST_02 : Lister toutes les hospitalisations sans filtre."""
        response = self.client.get(self.list_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Note: Depending on project history, there might be more, but at least ours are there.
        # We check at least 2 for our setup.
        self.assertGreaterEqual(len(response.data), 2)

    def test_sc_hosp_list_03_no_results_for_empty_status(self):
        """SC_HOSP_LIST_03 : Retourner une liste vide pour un statut sans match."""
        response = self.client.get(f"{self.list_url}?statut=ANNULE")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_sc_hosp_list_04_search_by_patient_name(self):
        """SC_HOSP_LIST_04 : Rechercher un patient par son nom (Mbarga)."""
        response = self.client.get(f"{self.list_url}?search=Mbarga")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['motif'], "Surveillance NSTEMI")

    def test_sc_hosp_list_05_search_no_match(self):
        """SC_HOSP_LIST_05 : Rechercher un terme inexistant."""
        response = self.client.get(f"{self.list_url}?search=Inconnu")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)
