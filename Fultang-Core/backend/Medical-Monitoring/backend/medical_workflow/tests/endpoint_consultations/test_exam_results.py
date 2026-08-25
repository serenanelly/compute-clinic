from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models.patient import Patient
from medical_workflow.models import Visite, Consultation, Examen, ResultatExamen
import uuid

class ExamResultAPITest(APITestCase):
    """
    Tests pour la saisie des résultats d'examens (Phase 4.2).
    Vérifie l'enregistrement et la mise à jour automatique du statut.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="lab_tech", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # 1. Création du patient
        self.patient = Patient.objects.create(
            nom="Mbarga", sexe="M", date_naissance="1979-03-14",
            statut_matrimonial="MARIE", numero_securite_sociale="SSN-RES-1"
        )
        
        # 2. Création de la visite et consultation
        self.visite = Visite.objects.create(patient=self.patient, motif_visite="Douleurs")
        self.consultation = Consultation.objects.create(
            patient=self.patient, visite=self.visite, motif="Checkup", medecin_charge="2"
        )
        
        # 3. Création de l'examen à réaliser
        self.examen = Examen.objects.create(
            consultation=self.consultation,
            nom="ECG",
            motif="Signes d'insuffisance coronaire",
            statut="EN_ATTENTE"
        )
        
        # URL : /api/medical-monitoring/examens/{id}/resultat/
        # Note: L'action a été renommée de 'enregistrer_resultat' à 'resultat'
        self.result_url = reverse('examen-resultat', args=[self.examen.id])

    def test_sc_res_01_record_result_and_update_status(self):
        """SC_RES_01 : Enregistrer le résultat et vérifier le passage au statut 'REALISE'."""
        doctor_id = str(uuid.uuid4())
        payload = {
            "doctor_id": doctor_id,
            "resultats": "Rythme sinusal régulier, pas de sus-décalage du segment ST.",
            "observations": "Légère inversion de l'onde T en V4-V6.",
            "interpretation": "A corréler avec la clinique (Angor probable)."
        }
        
        response = self.client.post(self.result_url, payload)
        
        # Vérification de la création
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ResultatExamen.objects.count(), 1)
        
        # Vérification du lien
        resultat = ResultatExamen.objects.first()
        self.assertEqual(resultat.examen, self.examen)
        
        # Vérification du changement de statut de l'examen
        self.examen.refresh_from_db()
        self.assertEqual(self.examen.statut, 'REALISE')

    def test_sc_res_02_fail_if_nested_result_exists(self):
        """SC_RES_02 : Empêcher la création de deux résultats pour un même examen (OneToOne)."""
        doctor_id = str(uuid.uuid4())
        payload = {"doctor_id": doctor_id, "resultats": "Test 1"}
        
        # Premier enregistrement
        self.client.post(self.result_url, payload)
        
        # Deuxième enregistrement (devrait échouer car OneToOneField)
        response = self.client.post(self.result_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sc_res_03_get_result_details(self):
        """SC_RES_03 : Récupérer les détails d'un résultat existant via GET."""
        # 1. Enregistrement préalable
        doctor_id = str(uuid.uuid4())
        payload = {"doctor_id": doctor_id, "resultats": "Données ECG"}
        self.client.post(self.result_url, payload)
        
        # 2. Récupération via GET
        response = self.client.get(self.result_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['resultats'], "Données ECG")

    def test_sc_res_04_get_result_not_found(self):
        """SC_RES_04 : Retourner 404 si aucun résultat n'est encore saisi."""
        # Création d'un nouvel examen sans résultat
        examen_vide = Examen.objects.create(
            consultation=self.consultation,
            nom="Test vide",
            motif="Test"
        )
        url_vide = reverse('examen-resultat', args=[examen_vide.id])
        
        response = self.client.get(url_vide)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
