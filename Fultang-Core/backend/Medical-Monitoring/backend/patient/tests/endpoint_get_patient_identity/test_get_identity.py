from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models import Patient, Adresse, Contact
from patient_informations.models import Allergie

class PatientIdentityAPITest(APITestCase):
    """
    Test garantissant que l'endpoint /patients/{id}/ renvoie bien l'identité complète
    (avec les contacts/adresses) mais ne divulgue AUCUNE information médicale.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="staffuser", password="staffpass123")
        self.client.force_authenticate(user=self.user)

        # Création des dépendances satellites d'identité
        self.adresse = Adresse.objects.create(ville="Edea", quartier="Gare")
        
        # Création du patient
        self.patient = Patient.objects.create(
            nom="Nkotto", sexe="F", date_naissance="1995-10-10",
            lieu_naissance="Edea", profession="Etudiante",
            statut_matrimonial="CELIBATAIRE",
            numero_securite_sociale="SSN-IDENT-1",
            adresse=self.adresse
        )
        
        # Ajout d'un contact
        self.contact = Contact.objects.create(type="TELEPHONE", numero="67000000", patient=self.patient)

        # Ajout de données médicales au patient (pour vérifier l'étanchéité)
        self.allergie = Allergie.objects.create(
            patient=self.patient,
            declencheur="Pénicilline",
            manifestation="Eruption cutanée"
        )

        self.patient_detail_url = reverse('patient-detail', args=[self.patient.id])
        self.patient_dossier_url = reverse('patient-dossier', args=[self.patient.id])

    def test_sc_get_id_01_identity_isolation(self):
        """SC_GET_ID_01 : Isolation stricte des données identitaires vs médicales."""
        
        # 1. Requête vers le détail standard (IDENTITÉ SEULE)
        response_id = self.client.get(self.patient_detail_url)
        self.assertEqual(response_id.status_code, status.HTTP_200_OK)
        
        data_id = response_id.data
        
        # A. Vérification de la présence des données d'identité (imbriquées)
        self.assertIn('nom', data_id)
        self.assertIn('adresse', data_id)
        self.assertEqual(data_id['adresse']['ville'], "Edea")
        self.assertIn('contacts', data_id)
        self.assertEqual(data_id['contacts'][0]['numero'], "67000000")
        
        # B. Vérification de L'ABSENCE TOTALE des données médicales
        self.assertNotIn('allergies', data_id)
        self.assertNotIn('donnees_cliniques', data_id)
        self.assertNotIn('consultations', data_id)
        self.assertNotIn('maladies', data_id)

        # 2. Requête vers le endpoint dossier (POUR COMPARER)
        response_dossier = self.client.get(self.patient_dossier_url)
        self.assertEqual(response_dossier.status_code, status.HTTP_200_OK)
        
        data_dossier = response_dossier.data
        
        # C. Vérification que le dossier, lui, contient bien la médicale
        self.assertIn('allergies', data_dossier)
        self.assertEqual(len(data_dossier['allergies']), 1)
        self.assertEqual(data_dossier['allergies'][0]['declencheur'], "Pénicilline")

    def test_sc_get_id_02_list_endpoint_is_flat(self):
        """Vérifie que /patients/ retourne une liste simple sans imbrications."""
        response = self.client.get(reverse('patient-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # S'il y a pagination, on intercepte les résultats
        results = response.data['results'] if 'results' in response.data else response.data
        self.assertTrue(len(results) > 0)
        
        first_patient = results[0]
        # Vérification qu'il y a bien les clés de base
        self.assertIn('nom', first_patient)
        self.assertIn('matricule', first_patient)
        
        # Vérification de L'ABSENCE des dépendances complexes
        self.assertNotIn('adresse', first_patient)
        self.assertNotIn('contacts', first_patient)
        self.assertNotIn('personnes_a_prevenir', first_patient)
