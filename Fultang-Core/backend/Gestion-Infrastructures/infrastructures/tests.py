from rest_framework.test import APITestCase
from rest_framework import status
from .models import Batiment, Etage, Salle, TypeBatiment, TypeSalle

class InfrastructuresAPITests(APITestCase):

    def setUp(self):
        self.type_bat = TypeBatiment.objects.create(nom="HOPITAL_PRINCIPAL", description="Bâtiment principal")
        self.type_salle = TypeSalle.objects.create(nom="REPOS", description="Salle de repos")

        self.batiment = Batiment.objects.create(
            nom='Hôpital Central',
            type=self.type_bat,
            nb_etages=2,
            date_construction='1990-01-01',
            responsable_id=1
        )
        
        self.etage = Etage.objects.create(
            numero=1,
            batiment=self.batiment
        )

        self.salle = Salle.objects.create(
            nom='Salle de repos',
            type=self.type_salle,
            capacite=10,
            numero='101A',
            statut='DISPONIBLE',
            etage=self.etage
        )

    def test_create_type_batiment(self):
        response = self.client.post('/api/types-batiment/', {'nom': 'ANNEXE'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_batiments(self):
        response = self.client.get('/api/batiments/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_create_batiment(self):
        nouveau_type = TypeBatiment.objects.create(nom="PAVILLON")
        nouveau_batiment = {
            'nom': 'Annexe Nord',
            'type': nouveau_type.id,
            'nb_etages': 1,
            'date_construction': '2005-06-15'
        }
        response = self.client.post('/api/batiments/', nouveau_batiment, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Batiment.objects.count(), 2) 

    def test_update_batiment(self):
        donnees_modifiees = {
            'nom': 'Hôpital Central Rénové',
            'type': self.type_bat.id,
            'nb_etages': 5,
            'date_construction': '1990-01-01'
        }
        url = f'/api/batiments/{self.batiment.id}/'
        response = self.client.put(url, donnees_modifiees, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.batiment.refresh_from_db()
        self.assertEqual(self.batiment.nom, 'Hôpital Central Rénové')
        self.assertEqual(self.batiment.nb_etages, 5)

    def test_delete_batiment(self):
        url = f'/api/batiments/{self.batiment.id}/'
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Batiment.objects.count(), 0)

    def test_create_etage(self):
        data = {
            'numero': 2,
            'batiment': self.batiment.id
        }
        response = self.client.post('/api/etages/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_salle(self):
        data = {
            'nom': 'Chambre 102',
            'type': self.type_salle.id,
            'capacite': 2,
            'numero': '102B',
            'statut': 'OCCUPEE',
            'etage': self.etage.id
        }
        response = self.client.post('/api/salles/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
