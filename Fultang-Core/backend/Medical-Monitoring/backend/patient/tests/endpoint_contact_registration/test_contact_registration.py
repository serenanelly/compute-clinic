from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models import Patient, Contact

class ContactRegistrationAPITest(APITestCase):
    """
    Tests pour l'enregistrement des contacts des patients.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="staffuser", password="staffpass123")
        self.client.force_authenticate(user=self.user)
        self.contact_url = reverse('contact-list')
        self.patient_url = reverse('patient-list')

    def test_sc_con_01_multi_contacts(self):
        """SC_CON_01 : Ajout de plusieurs contacts à un patient."""
        # 1. Création patient
        res_p = self.client.post(self.patient_url, {
            "nom": "Mbarga", "sexe": "M", "date_naissance": "1979-03-14",
            "lieu_naissance": "Yaoundé", "profession": "Tech",
            "statut_matrimonial": "MARIE", "numero_securite_sociale": "SSN-CON-1"
        })
        patient_id = res_p.data['id']

        # 2. Création de deux contacts distincts
        res_c1 = self.client.post(self.contact_url, {
            "type": "TELEPHONE", "numero": "+237 600 001", "patient": patient_id
        })
        self.assertEqual(res_c1.status_code, status.HTTP_201_CREATED)

        res_c2 = self.client.post(self.contact_url, {
            "type": "WHATSAPP", "numero": "+237 600 002", "patient": patient_id
        })
        self.assertEqual(res_c2.status_code, status.HTTP_201_CREATED)

        # 3. Vérification via le dossier du patient
        res_d = self.client.get(reverse('patient-dossier', args=[patient_id]))
        self.assertEqual(len(res_d.data['contacts']), 2)
        
        # Vérification des types
        types = [c['type'] for c in res_d.data['contacts']]
        self.assertIn("TELEPHONE", types)
        self.assertIn("WHATSAPP", types)

    def test_con_err_1_invalid_type(self):
        """CON_ERR_1 : Type de contact invalide."""
        response = self.client.post(self.contact_url, {
            "type": "FAX", # Non autorisé dans choices
            "numero": "123456"
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
