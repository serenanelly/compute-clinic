import uuid

from django.contrib.auth.hashers import make_password
from django.test import RequestFactory, TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from .authentication import GatewayHeaderAuthentication
from .models import Medecin

TENANT_A = uuid.uuid4()
TENANT_B = uuid.uuid4()


def _create_medecin(email, password, tenant_id):
    return Medecin.objects.create(
        nom="Dupont",
        prenom="Jean",
        date_naissance="1980-01-01",
        adresse="Yaoundé",
        email=email,
        contact="+237600000000",
        matricule=f"MED-{uuid.uuid4().hex[:8]}",
        date_embauche="2020-01-01",
        mot_de_passe=make_password(password),
        specialite="Cardiologie",
        numero_ordre="ONMC-0001",
        tenant_id=tenant_id,
    )


class AuthVerifyTenantScopingTests(APITestCase):
    """
    AuthVerifyView doit chercher l'utilisateur strictement dans le tenant
    fourni par la Gateway (jamais un pool global d'utilisateurs).
    """

    def test_login_succeeds_for_user_in_requested_tenant(self):
        _create_medecin("jean.dupont@fultang.local", "secret123", TENANT_A)

        response = self.client.post(
            "/api/auth/verify/",
            {"email": "jean.dupont@fultang.local", "password": "secret123", "tenant_id": str(TENANT_A)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "jean.dupont@fultang.local")

    def test_login_fails_when_user_exists_only_in_a_different_tenant(self):
        """CAS 5/9 : le même email existe dans le Tenant A ; une requête sur le Tenant B doit échouer."""
        _create_medecin("jean.dupont@fultang.local", "secret123", TENANT_A)

        response = self.client.post(
            "/api/auth/verify/",
            {"email": "jean.dupont@fultang.local", "password": "secret123", "tenant_id": str(TENANT_B)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_same_email_in_two_tenants_are_two_distinct_accounts(self):
        """CAS 9 : une même personne dans 2 établissements = 2 comptes, avec des mots de passe indépendants."""
        _create_medecin("jean.dupont@fultang.local", "password-tenant-a", TENANT_A)
        _create_medecin("jean.dupont@fultang.local", "password-tenant-b", TENANT_B)

        response_a = self.client.post(
            "/api/auth/verify/",
            {"email": "jean.dupont@fultang.local", "password": "password-tenant-a", "tenant_id": str(TENANT_A)},
            format="json",
        )
        self.assertEqual(response_a.status_code, status.HTTP_200_OK)

        # Le mot de passe du compte Tenant A ne doit jamais authentifier le compte Tenant B.
        response_wrong_password = self.client.post(
            "/api/auth/verify/",
            {"email": "jean.dupont@fultang.local", "password": "password-tenant-a", "tenant_id": str(TENANT_B)},
            format="json",
        )
        self.assertEqual(response_wrong_password.status_code, status.HTTP_401_UNAUTHORIZED)

        response_b = self.client.post(
            "/api/auth/verify/",
            {"email": "jean.dupont@fultang.local", "password": "password-tenant-b", "tenant_id": str(TENANT_B)},
            format="json",
        )
        self.assertEqual(response_b.status_code, status.HTTP_200_OK)

    def test_unassigned_pool_login_when_no_tenant_resolved(self):
        """CAS D (Gateway) : hostname hors convention → tenant_id=None → pool non assigné (dev/legacy)."""
        _create_medecin("legacy.user@fultang.local", "secret123", tenant_id=None)

        response = self.client.post(
            "/api/auth/verify/",
            {"email": "legacy.user@fultang.local", "password": "secret123"},  # pas de tenant_id
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unassigned_pool_user_cannot_login_under_a_tenant(self):
        """Un compte non rattaché à un tenant ne doit pas être trouvable sous un tenant réel."""
        _create_medecin("legacy.user@fultang.local", "secret123", tenant_id=None)

        response = self.client.post(
            "/api/auth/verify/",
            {"email": "legacy.user@fultang.local", "password": "secret123", "tenant_id": str(TENANT_A)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_credentials_returns_400(self):
        response = self.client.post("/api/auth/verify/", {"tenant_id": str(TENANT_A)}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PersonnelTenantUniquenessTests(TestCase):
    """L'unicité email/matricule est désormais scopée par tenant (Meta.constraints)."""

    def test_same_email_allowed_across_two_tenants(self):
        _create_medecin("dup@fultang.local", "pw1", TENANT_A)
        _create_medecin("dup@fultang.local", "pw2", TENANT_B)  # ne doit pas lever IntegrityError
        self.assertEqual(Medecin.objects.filter(email="dup@fultang.local").count(), 2)

    def test_duplicate_email_within_same_tenant_is_rejected(self):
        from django.db import IntegrityError

        _create_medecin("dup@fultang.local", "pw1", TENANT_A)
        with self.assertRaises(IntegrityError):
            _create_medecin("dup@fultang.local", "pw2", TENANT_A)


class GatewayHeaderAuthenticationTenantTests(TestCase):
    """
    8 : le service reçoit bien user_id + roles + tenant_id, extraits des
    headers injectés par la Gateway (X-User-ID, X-User-Roles, X-Tenant-ID).
    """

    def setUp(self):
        self.factory = RequestFactory()
        self.auth = GatewayHeaderAuthentication()

    def test_authenticate_extracts_user_id_roles_and_tenant_id(self):
        request = self.factory.get(
            "/api/medecins/",
            HTTP_X_USER_ID="9b914558-975f-4b3a-bdaa-d67e95740837",
            HTTP_X_USER_ROLES="Medecin,Directeur",
            HTTP_X_TENANT_ID=str(TENANT_A),
        )

        user, auth = self.auth.authenticate(request)

        self.assertEqual(user.id, "9b914558-975f-4b3a-bdaa-d67e95740837")
        self.assertEqual(user.roles, ["Medecin", "Directeur"])
        self.assertEqual(user.tenant_id, str(TENANT_A))
        self.assertIsNone(auth)

    def test_authenticate_without_tenant_header_leaves_tenant_id_none(self):
        """Pool non assigné : pas de X-Tenant-ID → GatewayUser.tenant_id = None."""
        request = self.factory.get(
            "/api/medecins/",
            HTTP_X_USER_ID="9b914558-975f-4b3a-bdaa-d67e95740837",
            HTTP_X_USER_ROLES="Medecin",
        )

        user, _ = self.auth.authenticate(request)

        self.assertIsNone(user.tenant_id)

    def test_authenticate_without_user_id_header_returns_none(self):
        """Comportement inchangé : sans X-User-ID, pas d'authentification (401 en amont via IsAuthenticated)."""
        request = self.factory.get("/api/medecins/")
        self.assertIsNone(self.auth.authenticate(request))
