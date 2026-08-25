from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models import Patient

class PatientSearchAPITest(APITestCase):
    """
    Tests de l'endpoint de recherche de patients.
    Couverture des classes d'équivalences définies dans scenarios.md.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="staffuser", password="staffpass123")
        self.client.force_authenticate(user=self.user)
        self.patient_url = reverse('patient-list') 

        # Création d'un dataset de test robuste
        Patient.objects.create(
            matricule="MBA-001", nom="Mbarga", prenom="Jean", sexe="M", 
            date_naissance="1979-03-14", lieu_naissance="Yaounde", profession="Technicien",
            numero_securite_sociale="SSN-1", statut_matrimonial="MARIE"
        )
        Patient.objects.create(
            matricule="NKO-002", nom="Nkoa", prenom="Paul", sexe="M", 
            date_naissance="1985-05-10", lieu_naissance="Douala", profession="Commerçant",
            numero_securite_sociale="SSN-2", statut_matrimonial="CELIBATAIRE"
        )
        Patient.objects.create(
            matricule="EKO-003", nom="Eko", prenom="Jean-Claude", sexe="M", 
            date_naissance="1990-01-01", lieu_naissance="Ebolowa", profession="Enseignant",
            numero_securite_sociale="SSN-3", statut_matrimonial="MARIE"
        )

    def test_ce1_empty_search(self):
        """CE_1 : Chaîne vide ou paramètre absent."""
        # Comme l'API est paginée, la structure de réponse est "count" + "results"
        # Si on n'a pas configuré la pagination globale dans les settings, "count" n'existera pas
        # Vérifions si elle est activée en regardant la taille de la réponse
        response = self.client.get(self.patient_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # S'il y a pagination, response.data sera un dict avec 'results'. Sinon, c'est une liste.
        data_list = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        self.assertEqual(len(data_list), 3)
        
        response2 = self.client.get(self.patient_url, {'search': ''})
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        data_list2 = response2.data['results'] if isinstance(response2.data, dict) and 'results' in response2.data else response2.data
        self.assertEqual(len(data_list2), 3)

    def test_ce2_exact_name(self):
        """CE_2 : Correspondance exacte sur le NOM, insensible à la casse."""
        response = self.client.get(self.patient_url, {'search': 'MBARGA'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data_list = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(data_list), 1)
        self.assertEqual(data_list[0]['nom'], "Mbarga")

    def test_ce3_first_name(self):
        """CE_3 : Correspondance exacte ou partielle sur le PRÉNOM."""
        response = self.client.get(self.patient_url, {'search': 'Paul'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data_list = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(data_list), 1)
        self.assertEqual(data_list[0]['prenom'], "Paul")

    def test_ce4_exact_matricule(self):
        """CE_4 : Correspondance exacte sur le MATRICULE."""
        response = self.client.get(self.patient_url, {'search': 'NKO-002'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data_list = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(data_list), 1)
        self.assertEqual(data_list[0]['matricule'], "NKO-002")

    def test_ce5_multiple_fields(self):
        """CE_5 : Correspondance croisée sur champs multiples."""
        # Recherche 'Jean Mbarga', le DRF SearchFilter coupera par mots
        response = self.client.get(self.patient_url, {'search': 'Jean Mbarga'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data_list = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(data_list), 1)
        self.assertEqual(data_list[0]['matricule'], "MBA-001")

        # 'Jean' devrait retourner Mbarga et Eko
        response_jean = self.client.get(self.patient_url, {'search': 'Jean'})
        self.assertEqual(response_jean.status_code, status.HTTP_200_OK)
        data_list_jean = response_jean.data['results'] if isinstance(response_jean.data, dict) else response_jean.data
        self.assertEqual(len(data_list_jean), 2)

    def test_ce6_partial_match(self):
        """CE_6 : Correspondance stricte partielle."""
        response = self.client.get(self.patient_url, {'search': 'Mbar'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data_list = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(data_list), 1)
        self.assertEqual(data_list[0]['nom'], "Mbarga")

    def test_ce7_no_result(self):
        """CE_7 : Requête sans résultat (Absurdité)."""
        response = self.client.get(self.patient_url, {'search': 'ZxyW123'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data_list = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(data_list), 0)

    def test_ce8_special_chars(self):
        """CE_8 : Caractères spéciaux et encodage."""
        response = self.client.get(self.patient_url, {'search': 'Jean-Claude'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data_list = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(data_list), 1)
        self.assertEqual(data_list[0]['prenom'], "Jean-Claude")
