from django.contrib.auth.models import User
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.urls import reverse
from decimal import Decimal
from ..models.materiel import Materiel

class MaterialAPITest(APITestCase):
    """Tests d'intégration pour les endpoints du Matériel."""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password')
        self.client.force_authenticate(user=self.user)
        self.materiel = Materiel.objects.create(
            code_materiel="API-001",
            nom_Materiel="Seringue",
            prix_achat_unitaire=Decimal("100.00"),
            quantite_stock=500
        )
        self.list_url = "/api/compta_matiere/materiels/" 
        self.detail_url = f"/api/compta_matiere/materiels/{self.materiel.idMateriel}/"

    def test_get_material_list(self):
        """Cas Normal: Liste des matériels via API."""
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_create_material_via_api(self):
        """Cas Normal: Création d'un matériel via POST."""
        data = {
            "code_materiel": "API-NEW",
            "nom_Materiel": "Nouveau Matériel",
            "prix_achat_unitaire": "250.00",
            "quantite_stock": 10
        }
        response = self.client.post(self.list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Materiel.objects.filter(code_materiel="API-NEW").count(), 1)

    def test_invalid_material_data(self):
        """Cas Erreur: Envoi de données invalides (prix négatif)."""
        data = {
            "code_materiel": "API-ERR",
            "nom_Materiel": "Erreur",
            "prix_achat_unitaire": "-10.00", # Invalide
            "quantite_stock": 10
        }
        response = self.client.post(self.list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
