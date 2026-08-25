from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from patient.models import Patient, PersonneAPrevenir, LienParente

class EmergencyLinkingAPITest(APITestCase):
    """
    Tests pour l'établissement de liens entre patients et personnes à prévenir.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="staffuser", password="staffpass123")
        self.client.force_authenticate(user=self.user)
        self.patient_url = reverse('patient-list')
        self.personne_url = reverse('personne-a-prevenir-list')
        self.lien_url = reverse('lien-parente-list')

    def test_sc_emer_01_nominal_flow(self):
        """SC_EMER_01 : Flux nominal de création de lien (Cas Mbarga)."""
        # 1. Création patient
        res_p = self.client.post(self.patient_url, {
            "nom": "Mbarga", "sexe": "M", "date_naissance": "1979-03-14",
            "lieu_naissance": "Yaoundé", "profession": "Tech",
            "statut_matrimonial": "MARIE", "numero_securite_sociale": "SSN-LNK-1"
        })
        patient_id = res_p.data['id']

        # 2. Création personne à prévenir
        res_s = self.client.post(self.personne_url, {"nom": "Mbarga", "prenom": "Solange"})
        solange_id = res_s.data['id']

        # 3. Création du lien
        lien_payload = {
            "patient": patient_id,
            "personne_a_prevenir": solange_id,
            "relation": "CONJOINT"
        }
        response = self.client.post(self.lien_url, lien_payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['relation'], "CONJOINT")

        # 4. Vérification dans le dossier du patient
        res_d = self.client.get(reverse('patient-dossier', args=[patient_id]))
        # Le dossier doit contenir la personne dans la liste
        self.assertEqual(len(res_d.data['personnes_a_prevenir']), 1)
        self.assertEqual(res_d.data['personnes_a_prevenir'][0]['nom'], "Mbarga")

    def test_sc_emer_02_duplicate_link(self):
        """SC_EMER_02 : Empêcher les doublons de liens identiques."""
        # Setup
        p = Patient.objects.create(
            nom="Test", sexe="M", date_naissance="1990-01-01", 
            lieu_naissance="Lieu", profession="Prof", 
            numero_securite_sociale="SSN-LNK-2", statut_matrimonial="CELIBATAIRE"
        )
        s = PersonneAPrevenir.objects.create(nom="Urgence")
        
        # Création premier lien
        payload = {"patient": p.id, "personne_a_prevenir": s.id, "relation": "AMI"}
        self.client.post(self.lien_url, payload)
        
        # Tentative doublon
        response = self.client.post(self.lien_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sc_emer_03_other_relation(self):
        """SC_EMER_03 : Utilisation de la relation 'AUTRE' avec précision."""
        p = Patient.objects.create(
            nom="Test", sexe="M", date_naissance="1990-01-01", 
            lieu_naissance="Lieu", profession="Prof", 
            numero_securite_sociale="SSN-LNK-3", statut_matrimonial="CELIBATAIRE"
        )
        s = PersonneAPrevenir.objects.create(nom="Voisin")
        
        payload = {
            "patient": p.id,
            "personne_a_prevenir": s.id,
            "relation": "AUTRE",
            "relation_autre": "Voisin de palier"
        }
        response = self.client.post(self.lien_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['relation_autre'], "Voisin de palier")

    def test_sc_emer_04_full_details(self):
        """SC_EMER_04 : Vérifier qu'une personne à prévenir peut avoir adresse et contacts."""
        # 1. Création adresse
        res_a = self.client.post(reverse('adresse-list'), {"ville": "Douala", "quartier": "Akwa"})
        addr_id = res_a.data['id']

        # 2. Création contact (non lié au départ)
        res_c = self.client.post(reverse('contact-list'), {"type": "TELEPHONE", "numero": "123456"})
        contact_id = res_c.data['id']

        # 3. Création personne à prévenir avec liaison
        payload = {
            "nom": "Tchanko",
            "prenom": "Pierre",
            "adresse": addr_id,
            "contacts": [contact_id]
        }
        res_s = self.client.post(self.personne_url, payload)
        self.assertEqual(res_s.status_code, status.HTTP_201_CREATED)
        
        # 4. Vérification détaillée
        # On vérifie que le GET renvoie les objets imbriqués (grâce à to_representation)
        res_v = self.client.get(reverse('personne-a-prevenir-detail', args=[res_s.data['id']]))
        self.assertEqual(res_v.data['adresse']['quartier'], "Akwa")
        self.assertEqual(len(res_v.data['contacts']), 1)
        self.assertEqual(res_v.data['contacts'][0]['numero'], "123456")
