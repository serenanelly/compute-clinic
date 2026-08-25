from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models import Patient

class ClinicalDataAPITest(APITestCase):
    """
    Tests pour l'enregistrement initial des constantes vitales d'un patient.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="infirmiere", password="infirmieresoins")
        self.client.force_authenticate(user=self.user)
        self.clinique_url = reverse('donnees-cliniques-list')
        self.patient_url = reverse('patient-list')
        
        # Création d'un patient de base via l'ORM pour éviter les erreurs de validation API
        self.patient = Patient.objects.create(
            nom="Mbarga", sexe="M", date_naissance="1979-03-14",
            statut_matrimonial="MARIE", numero_securite_sociale="SSN-CLIN-1",
            lieu_naissance="Yaounde", profession="Tech"
        )
        self.patient_id = self.patient.id
        self.dossier_url = reverse('patient-dossier', args=[self.patient_id])

    def test_sc_clin_01_nominal_flow(self):
        """SC_CLIN_01 : Flux nominal (Mbarga) - Création de fiches de constantes."""
        # 1. Vérification avant
        res_d_avant = self.client.get(self.dossier_url)
        self.assertIsNone(res_d_avant.data['donnees_cliniques'])

        # 2. Création des constantes
        payload = {
            "patient": self.patient_id,
            "groupe_sanguin": "A", # Choix Valide (si GroupeSanguin est bien défini, sinon on mettra O+)
            "facteur_rhesus": "POSITIF",
            "electrophorese_hb": "AA",
            "poids": "82.5 kg",
            "taille": "175 cm",
            "pouls": "88 bpm",
            "taux_oxygene": "97%"
        }
        response = self.client.post(self.clinique_url, payload)
        
        # Vérification qu'il y a pas d'erreur de choix
        if response.status_code == 400:
            print("Erreur 400 possible (choix) :", response.data)
            
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['groupe_sanguin'], "A")

        # 3. Vérification dans le dossier de Mbarga
        res_d_apres = self.client.get(self.dossier_url)
        self.assertIsNotNone(res_d_apres.data['donnees_cliniques'])
        self.assertEqual(res_d_apres.data['donnees_cliniques']['pouls'], "88 bpm")

    def test_sc_clin_02_duplicate_denied(self):
        """SC_CLIN_02 : Bloquer la création de deux fiches de constantes pour le même patient."""
        payload = {
            "patient": self.patient_id,
            "groupe_sanguin": "O",
            "facteur_rhesus": "NEGATIF",
            "poids": "70", "taille": "170", "pouls": "60", "taux_oxygene": "99"
        }
        # 1er POST (Doit réussir)
        self.client.post(self.clinique_url, payload)
        
        # 2eme POST (Doit échouer)
        response = self.client.post(self.clinique_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # DRF renvoie généralement dans dict la clé du champ OneToOne
        self.assertIn("patient", response.data)

    def test_sc_clin_03_invalid_choices(self):
        """SC_CLIN_03 : Rejet sur mauvaises constantes (ex: Groupe Z)."""
        payload = {
            "patient": self.patient_id,
            "groupe_sanguin": "Z", # INVALIDE
            "facteur_rhesus": "INCONNU", # INVALIDE
            "poids": "70", "taille": "170", "pouls": "60", "taux_oxygene": "99"
        }
        response = self.client.post(self.clinique_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("groupe_sanguin", response.data)
        self.assertIn("facteur_rhesus", response.data)
