from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models import Patient
from patient_informations.models import Maladie, Traitement

class TraitementAPITest(APITestCase):
    """
    Tests pour l'enregistrement des traitements liés aux maladies (Phase 2.6).
    """

    def setUp(self):
        self.user = User.objects.create_user(username="profmed", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # 1. Création du patient
        self.patient = Patient.objects.create(
            nom="Mbarga", sexe="M", date_naissance="1979-03-14",
            statut_matrimonial="MARIE", numero_securite_sociale="SSN-TRT-1"
        )
        
        # 2. Création de la maladie obligatoire
        self.maladie = Maladie.objects.create(
            patient=self.patient,
            nom="Hypertension artérielle",
            debut="2023-06-15",
            description="Maladie chronique"
        )
        
        self.traitement_url = reverse('traitement-list')
        self.dossier_url = reverse('patient-dossier', args=[self.patient.id])

    def test_sc_trt_01_create_treatment(self):
        """SC_TRT_01 : Enregistrer un traitement lié à une maladie."""
        payload = {
            "maladie": self.maladie.id,
            "nom_medicament": "Amlodipine",
            "type": "Oral",
            "duree": "Indéterminée",
            "posologie": "5mg par jour, le matin",
            "observation": "Bien toléré"
        }
        response = self.client.post(self.traitement_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['nom_medicament'], "Amlodipine")

    def test_sc_trt_02_mandatory_maladie(self):
        """SC_TRT_02 : Vérifier que le lien maladie est obligatoire."""
        payload = {
            "nom_medicament": "Amlodipine",
            "posologie": "5mg"
        }
        response = self.client.post(self.traitement_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('maladie', response.data)

    def test_sc_trt_03_dossier_nesting(self):
        """SC_TRT_03 : Vérifier que les traitements apparaissent imbriqués dans les maladies du dossier."""
        Traitement.objects.create(
            maladie=self.maladie,
            nom_medicament="Amlodipine",
            type="Oral",
            duree="30 jours",
            posologie="1/jour"
        )
        
        response = self.client.get(self.dossier_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Dans le dossier, on a la liste des maladies
        maladies = response.data['maladies']
        self.assertEqual(len(maladies), 1)
        # Et chaque maladie doit avoir ses traitements (via MaladieSerializer)
        self.assertEqual(len(maladies[0]['traitements']), 1)
        self.assertEqual(maladies[0]['traitements'][0]['nom_medicament'], "Amlodipine")
