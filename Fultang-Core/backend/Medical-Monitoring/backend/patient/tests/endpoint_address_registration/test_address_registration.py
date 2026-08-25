import uuid
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models import Patient, Adresse

class AddressRegistrationAPITest(APITestCase):
    """
    Tests pour la création d'adresses et leur liaison aux patients.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="staffuser", password="staffpass123")
        self.client.force_authenticate(user=self.user)
        self.address_url = reverse('adresse-list')
        self.patient_url = reverse('patient-list')

    def test_sc_addr_01_nominal_flow(self):
        """SC_ADDR_01 : Flux nominal de création et liaison d'adresse (Cas Mbarga)."""
        # 1. Création du patient
        patient_payload = {
            "nom": "Mbarga", "sexe": "M", "date_naissance": "1979-03-14",
            "lieu_naissance": "Yaoundé", "profession": "Technicien",
            "statut_matrimonial": "MARIE", "numero_securite_sociale": "SSN-ADDR-1"
        }
        res_p = self.client.post(self.patient_url, patient_payload)
        patient_id = res_p.data['id']

        # 2. Création de l'adresse
        addr_payload = {
            "pays": "Cameroun",
            "ville": "Yaoundé",
            "quartier": "Bastos",
            "rue": "Rue des Palmiers"
        }
        res_a = self.client.post(self.address_url, addr_payload)
        self.assertEqual(res_a.status_code, status.HTTP_201_CREATED)
        addr_id = res_a.data['id']

        # 3. Liaison au patient via PATCH
        # On utilise reverse('patient-detail', args=[id])
        res_patch = self.client.patch(reverse('patient-detail', args=[patient_id]), {"adresse": addr_id})
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)

        # 4. Vérification finale
        res_v = self.client.get(reverse('patient-detail', args=[patient_id]))
        # L'adresse dans la réponse doit être l'objet complet car AdresseSerializer est utilisé
        self.assertEqual(res_v.data['adresse']['id'], addr_id)
        self.assertEqual(res_v.data['adresse']['quartier'], "Bastos")

    def test_adr_err_1_missing_fields(self):
        """ADR_ERR_1 : Rejet si ville ou quartier manquent."""
        payload = {"pays": "Cameroun"} # ville et quartier manquants
        response = self.client.post(self.address_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ville", response.data)
        self.assertIn("quartier", response.data)

    def test_lnk_err_1_invalid_address_uuid(self):
        """LNK_ERR_1 : Liaison avec un UUID d'adresse inexistant."""
        # Création du patient
        patient_payload = {
            "nom": "Test", "sexe": "M", "date_naissance": "1990-01-01",
            "lieu_naissance": "Lieu", "profession": "Prof",
            "statut_matrimonial": "CELIBATAIRE", "numero_securite_sociale": "SSN-ADDR-2"
        }
        res_p = self.client.post(self.patient_url, patient_payload)
        patient_id = res_p.data['id']

        # Tentative de liaison avec un UUID bidon
        fake_uuid = str(uuid.uuid4())
        response = self.client.patch(reverse('patient-detail', args=[patient_id]), {"adresse": fake_uuid})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
