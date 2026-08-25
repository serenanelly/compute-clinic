from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User

class AuthAPITest(APITestCase):
    """Tests des endpoints d'authentification JWT."""

    def setUp(self):
        self.username = "testuser"
        self.password = "testpass123"
        self.user = User.objects.create_user(
            username=self.username, 
            password=self.password
        )
        self.login_url = reverse('token_obtain_pair')
        self.refresh_url = reverse('token_refresh')

    def test_login_success(self):
        """Vérification : Un utilisateur valide peut obtenir ses jetons d'accès et de rafraîchissement (JWT)."""
        data = {"username": self.username, "password": self.password}
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_failure(self):
        """Vérification : Le système rejette l'authentification si le mot de passe est incorrect."""
        data = {"username": self.username, "password": "wrongpassword"}
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh(self):
        """Vérification : Un jeton de rafraîchissement valide permet d'obtenir un nouveau jeton d'accès sans se reconnecter."""
        # On se connecte d'abord
        login_data = {"username": self.username, "password": self.password}
        login_response = self.client.post(self.login_url, login_data)
        refresh_token = login_response.data['refresh']

        # On demande un nouveau access token
        refresh_data = {"refresh": refresh_token}
        response = self.client.post(self.refresh_url, refresh_data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
