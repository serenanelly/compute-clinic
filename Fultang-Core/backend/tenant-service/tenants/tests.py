from rest_framework import status
from rest_framework.test import APITestCase

from .models import Tenant, TenantStatus
from .services import TenantService

# Headers simulant l'injection X-User-ID / X-User-Roles par l'API Gateway.
ANONYMOUS_HEADERS = {}
ADMIN_HEADERS = {'HTTP_X_USER_ID': 'test-user', 'HTTP_X_USER_ROLES': 'Admin'}
PLATFORM_ADMIN_HEADERS = {'HTTP_X_USER_ID': 'platform-admin-test', 'HTTP_X_USER_ROLES': 'PLATFORM_ADMIN'}
OTHER_ROLE_HEADERS = {'HTTP_X_USER_ID': 'medecin-test', 'HTTP_X_USER_ROLES': 'Medecin'}
MULTI_ROLE_PLATFORM_ADMIN_HEADERS = {'HTTP_X_USER_ID': 'multi-role-test', 'HTTP_X_USER_ROLES': 'Medecin,PLATFORM_ADMIN'}


class TenantServiceUnitTests(APITestCase):
    """Vérifie le comportement du TenantService, indépendamment de l'API HTTP.

    Le TenantService ne connaît pas la notion de PLATFORM_ADMIN : l'autorisation
    est une préoccupation de la couche API (views.py / permissions.py), pas du
    service métier.
    """

    def setUp(self):
        self.service = TenantService()

    def test_create_and_get_tenant(self):
        tenant = self.service.create_tenant(name="Clinique Fultang", identifier="fultang")
        self.assertEqual(tenant.status, TenantStatus.ACTIVE)

        fetched = self.service.get_tenant(tenant.id)
        self.assertEqual(fetched.identifier, "fultang")

    def test_get_tenant_by_identifier_returns_none_when_missing(self):
        self.assertIsNone(self.service.get_tenant_by_identifier("does-not-exist"))

    def test_activate_and_deactivate_tenant(self):
        tenant = self.service.create_tenant(name="Clinique Fultang", identifier="fultang")

        deactivated = self.service.deactivate_tenant(tenant.id)
        self.assertEqual(deactivated.status, TenantStatus.INACTIVE)

        reactivated = self.service.activate_tenant(tenant.id)
        self.assertEqual(reactivated.status, TenantStatus.ACTIVE)


class TenantAPITests(APITestCase):
    """Vérifie les endpoints REST du Tenant Registry pour un appelant PLATFORM_ADMIN.

    La Gateway injecte normalement X-User-ID / X-User-Roles ; on simule cette
    injection ici pour passer l'authentification GatewayHeaderAuthentication
    et l'autorisation IsPlatformAdmin.
    """

    def setUp(self):
        self.client.credentials(**PLATFORM_ADMIN_HEADERS)

    def test_create_tenant(self):
        response = self.client.post(
            '/api/tenants/',
            {'name': 'Clinique Fultang', 'identifier': 'fultang'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Tenant.objects.count(), 1)
        self.assertEqual(response.data['status'], TenantStatus.ACTIVE)

    def test_list_tenants(self):
        Tenant.objects.create(name='Clinique Fultang', identifier='fultang')
        response = self.client.get('/api/tenants/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_retrieve_tenant(self):
        tenant = Tenant.objects.create(name='Clinique Fultang', identifier='fultang')
        response = self.client.get(f'/api/tenants/{tenant.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['identifier'], 'fultang')

    def test_retrieve_unknown_tenant_returns_404(self):
        response = self.client.get('/api/tenants/00000000-0000-0000-0000-000000000000/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_status(self):
        tenant = Tenant.objects.create(name='Clinique Fultang', identifier='fultang')
        response = self.client.patch(
            f'/api/tenants/{tenant.id}/status/',
            {'status': TenantStatus.INACTIVE},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tenant.refresh_from_db()
        self.assertEqual(tenant.status, TenantStatus.INACTIVE)


class TenantManagementAuthorizationTests(APITestCase):
    """
    Matrice d'autorisation du Tenant Management (PLATFORM_ADMIN uniquement).

    Couvre, pour chacun des 4 endpoints existants (list, create, retrieve,
    update-status) :
      A. anonyme               → 401
      B. rôle métier ADMIN     → 403
      C. rôle PLATFORM_ADMIN   → succès
      D. autre rôle métier     → 403
    """

    def setUp(self):
        self.tenant = Tenant.objects.create(name='Clinique Fultang', identifier='fultang')

    def _requests(self):
        """Une requête par endpoint réellement exposé par TenantViewSet."""
        return [
            ('list', lambda: self.client.get('/api/tenants/')),
            ('create', lambda: self.client.post(
                '/api/tenants/', {'name': 'Autre Clinique', 'identifier': 'autre-clinique'}, format='json')),
            ('retrieve', lambda: self.client.get(f'/api/tenants/{self.tenant.id}/')),
            ('update_status', lambda: self.client.patch(
                f'/api/tenants/{self.tenant.id}/status/', {'status': TenantStatus.INACTIVE}, format='json')),
        ]

    def test_anonymous_is_unauthorized_on_every_endpoint(self):
        self.client.credentials(**ANONYMOUS_HEADERS)
        for name, call in self._requests():
            with self.subTest(endpoint=name):
                response = call()
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_business_admin_role_is_forbidden_on_every_endpoint(self):
        self.client.credentials(**ADMIN_HEADERS)
        for name, call in self._requests():
            with self.subTest(endpoint=name):
                response = call()
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_other_business_role_is_forbidden_on_every_endpoint(self):
        self.client.credentials(**OTHER_ROLE_HEADERS)
        for name, call in self._requests():
            with self.subTest(endpoint=name):
                response = call()
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_platform_admin_is_authorized_on_every_endpoint(self):
        self.client.credentials(**PLATFORM_ADMIN_HEADERS)
        expected = {
            'list': status.HTTP_200_OK,
            'create': status.HTTP_201_CREATED,
            'retrieve': status.HTTP_200_OK,
            'update_status': status.HTTP_200_OK,
        }
        for name, call in self._requests():
            with self.subTest(endpoint=name):
                response = call()
                self.assertEqual(response.status_code, expected[name])

    def test_platform_admin_among_multiple_roles_is_authorized(self):
        """PLATFORM_ADMIN peut être un rôle parmi d'autres dans X-User-Roles."""
        self.client.credentials(**MULTI_ROLE_PLATFORM_ADMIN_HEADERS)
        response = self.client.get('/api/tenants/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
