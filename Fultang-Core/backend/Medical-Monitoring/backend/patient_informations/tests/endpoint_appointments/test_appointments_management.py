from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models.patient import Patient
from patient_informations.models import RendezVous

class AppointmentManagementAPITest(APITestCase):
    """
    Tests pour la gestion globale et les statuts par défaut des rendez-vous (Phase 11.2).
    """

    def setUp(self):
        self.user = User.objects.create_user(username="admin_rdv", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # 1. Création du patient
        self.patient = Patient.objects.create(
            nom="Mbarga", sexe="M", date_naissance="1979-03-14",
            numero_securite_sociale="SSN-RDV-MGT"
        )
        
        self.nested_url = reverse('patient-fixer-rendez-vous', args=[self.patient.id])
        self.global_url = reverse('rendez-vous-list')

    def test_sc_rdv_03_default_status_handled(self):
        """SC_RDV_03 : Vérifier que le statut par défaut ('PROGRAMME') est appliqué si omis."""
        payload = {
            "motif": "Contrôle routine",
            "personnel_concerne": "Dr. Smith",
            "date_heure": "2026-06-10T10:00:00Z"
            # statut omis intentionnellement
        }
        
        response = self.client.post(self.nested_url, payload)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['statut'], 'PROGRAMME') # Valeur par défaut
        
        # Vérifier en base
        rdv = RendezVous.objects.get(id=response.data['id'])
        self.assertEqual(rdv.statut, 'PROGRAMME')

    def test_sc_rdv_04_global_list_and_search(self):
        """SC_RDV_04 : Liste globale et recherche par nom de patient."""
        # Créer un RDV
        RendezVous.objects.create(
            patient=self.patient, 
            motif="Test Search", 
            personnel_concerne="Doc", 
            date_heure="2026-06-11T10:00:00Z"
        )
        
        response = self.client.get(f"{self.global_url}?search=Mbarga")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['motif'], "Test Search")

    def test_sc_rdv_05_update_status(self):
        """SC_RDV_05 : Changer l'état d'un rendez-vous (PATCH)."""
        rdv = RendezVous.objects.create(
            patient=self.patient, 
            motif="A annuler", 
            personnel_concerne="Doc", 
            date_heure="2026-06-12T10:00:00Z"
        )
        url = reverse('rendez-vous-detail', args=[rdv.id])
        
        payload = {"statut": "ANNULE"}
        response = self.client.patch(url, payload)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['statut'], 'ANNULE')
        
        rdv.refresh_from_db()
        self.assertEqual(rdv.statut, 'ANNULE')
