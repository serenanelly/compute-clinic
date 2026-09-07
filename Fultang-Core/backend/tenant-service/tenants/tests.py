import uuid

from rest_framework import status
from rest_framework.test import APITestCase
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings

from .models import PlatformService, Tenant, TenantDatabase, TenantDatabaseStatus, TenantStatus
from .services import TenantService

# Headers simulant l'injection X-User-ID / X-User-Roles par l'API Gateway.
ANONYMOUS_HEADERS = {}
ADMIN_HEADERS = {'HTTP_X_USER_ID': 'test-user', 'HTTP_X_USER_ROLES': 'Admin'}
PLATFORM_ADMIN_HEADERS = {'HTTP_X_USER_ID': 'platform-admin-test', 'HTTP_X_USER_ROLES': 'PLATFORM_ADMIN'}
OTHER_ROLE_HEADERS = {'HTTP_X_USER_ID': 'medecin-test', 'HTTP_X_USER_ROLES': 'Medecin'}
MULTI_ROLE_PLATFORM_ADMIN_HEADERS = {'HTTP_X_USER_ID': 'multi-role-test', 'HTTP_X_USER_ROLES': 'Medecin,PLATFORM_ADMIN'}

# Jeton de test pour la communication interne Gateway → Tenant Service.
TEST_INTERNAL_TOKEN = 'test-internal-service-token'


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

    def test_new_tenant_defaults_to_export_allowed(self):
        """§6 de la tâche : la valeur par défaut doit être True, y compris via l'API de création."""
        response = self.client.post(
            '/api/tenants/', {'name': 'Clinique Fultang', 'identifier': 'fultang'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['allow_clinical_agent_export'])

    def test_create_tenant_can_explicitly_disable_export(self):
        response = self.client.post(
            '/api/tenants/',
            {'name': 'Clinique Fultang', 'identifier': 'fultang', 'allow_clinical_agent_export': False},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data['allow_clinical_agent_export'])

    def test_update_export_authorization(self):
        tenant = Tenant.objects.create(name='Clinique Fultang', identifier='fultang')
        self.assertTrue(tenant.allow_clinical_agent_export)

        response = self.client.patch(
            f'/api/tenants/{tenant.id}/', {'allow_clinical_agent_export': False}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tenant.refresh_from_db()
        self.assertFalse(tenant.allow_clinical_agent_export)

    def test_update_export_authorization_does_not_touch_status_or_identifier(self):
        """TenantUpdateSerializer n'expose que allow_clinical_agent_export — le reste est ignoré, pas une erreur 400."""
        tenant = Tenant.objects.create(name='Clinique Fultang', identifier='fultang')
        response = self.client.patch(
            f'/api/tenants/{tenant.id}/',
            {'allow_clinical_agent_export': False, 'status': TenantStatus.INACTIVE, 'identifier': 'hacked'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tenant.refresh_from_db()
        self.assertFalse(tenant.allow_clinical_agent_export)
        self.assertEqual(tenant.status, TenantStatus.ACTIVE)
        self.assertEqual(tenant.identifier, 'fultang')


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


@override_settings(TENANT_SERVICE_INTERNAL_TOKEN=TEST_INTERNAL_TOKEN)
class TenantResolveEndpointTests(APITestCase):
    """
    GET /api/tenants/resolve/ — réservé à la communication interne
    Gateway → Tenant Service (Phase 2.1, correction post-review).

    N'est PAS protégé par PLATFORM_ADMIN (la résolution a lieu avant toute
    authentification utilisateur) mais n'est PAS public pour autant : il
    exige le jeton de service interne partagé (IsInternalService).
    """

    def setUp(self):
        self.tenant = Tenant.objects.create(name='Clinique Fultang', identifier='fultang')

    def _resolve(self, identifier, token=None):
        credentials = {}
        if token is not None:
            credentials['HTTP_X_INTERNAL_SERVICE_TOKEN'] = token
        self.client.credentials(**credentials)
        return self.client.get('/api/tenants/resolve/', {'identifier': identifier})

    def test_valid_internal_token_is_authorized(self):
        response = self._resolve('fultang', token=TEST_INTERNAL_TOKEN)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_missing_token_is_rejected(self):
        response = self._resolve('fultang', token=None)
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_wrong_token_is_rejected(self):
        response = self._resolve('fultang', token='wrong-token')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_resolve_returns_minimal_fields_only(self):
        response = self._resolve('fultang', token=TEST_INTERNAL_TOKEN)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # allow_clinical_agent_export : champ de PLATEFORME (comme status),
        # ajouté pour les appelants internes qui doivent appliquer cette
        # règle (clinical-agent) — voir TenantResolutionSerializer.
        self.assertEqual(set(response.data.keys()), {'id', 'identifier', 'status', 'allow_clinical_agent_export'})
        self.assertNotIn('name', response.data)

    def test_resolve_by_id_returns_same_fields(self):
        """?id=<uuid> — utilisé par un appelant qui ne connaît pas l'identifier (ex: clinical-agent)."""
        response = self.client.get(
            '/api/tenants/resolve/', {'id': str(self.tenant.id)},
            HTTP_X_INTERNAL_SERVICE_TOKEN=TEST_INTERNAL_TOKEN,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], str(self.tenant.id))

    def test_resolve_unknown_id_returns_404(self):
        response = self.client.get(
            '/api/tenants/resolve/', {'id': str(uuid.uuid4())},
            HTTP_X_INTERNAL_SERVICE_TOKEN=TEST_INTERNAL_TOKEN,
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_resolve_malformed_id_returns_404_not_500(self):
        response = self.client.get(
            '/api/tenants/resolve/', {'id': 'not-a-uuid'},
            HTTP_X_INTERNAL_SERVICE_TOKEN=TEST_INTERNAL_TOKEN,
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_resolve_unknown_identifier_returns_404(self):
        response = self._resolve('does-not-exist', token=TEST_INTERNAL_TOKEN)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_resolve_without_identifier_param_returns_400(self):
        self.client.credentials(HTTP_X_INTERNAL_SERVICE_TOKEN=TEST_INTERNAL_TOKEN)
        response = self.client.get('/api/tenants/resolve/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resolve_reports_inactive_status_without_refusing(self):
        """resolve() renvoie le statut tel quel : la politique d'accès est du ressort de l'appelant (Gateway)."""
        self.tenant.status = TenantStatus.INACTIVE
        self.tenant.save(update_fields=['status'])

        response = self._resolve('fultang', token=TEST_INTERNAL_TOKEN)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], TenantStatus.INACTIVE)


class TenantResolveWithoutConfiguredTokenTests(APITestCase):
    """
    Si TENANT_SERVICE_INTERNAL_TOKEN n'est pas configuré côté Tenant
    Service (valeur par défaut : chaîne vide), resolve() doit refuser
    l'accès — jamais accepter par défaut faute de configuration.
    """

    @override_settings(TENANT_SERVICE_INTERNAL_TOKEN='')
    def test_resolve_denied_when_no_token_configured(self):
        Tenant.objects.create(name='Clinique Fultang', identifier='fultang')
        self.client.credentials(HTTP_X_INTERNAL_SERVICE_TOKEN='anything')
        response = self.client.get('/api/tenants/resolve/', {'identifier': 'fultang'})
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))


# =============================================================================
# Phase 5 — Tenant Database Management
# =============================================================================

def _make_tenant(identifier='hopital-central', name='Hôpital Central'):
    return Tenant.objects.create(name=name, identifier=identifier)


def _make_service(code='PERSONNEL', name='Service Personnel'):
    """Les codes PERSONNEL/INFRASTRUCTURE/COMPTA/... sont déjà peuplés par la
    migration de seed (0003) — on les réutilise plutôt que d'entrer en
    conflit avec le catalogue réel de la plateforme."""
    service, _ = PlatformService.objects.get_or_create(code=code, defaults={'name': name})
    return service


class PlatformServiceModelTests(TestCase):
    """Le catalogue PlatformService est la référence contrôlée pour TenantDatabase.service."""

    def test_create_service(self):
        service = _make_service()
        self.assertEqual(service.status, 'ACTIVE')

    def test_code_must_be_unique(self):
        PlatformService.objects.get_or_create(code='UNIQUE_TEST_CODE', defaults={'name': 'X'})
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PlatformService.objects.create(code='UNIQUE_TEST_CODE', name='Doublon')


class PlatformServiceAPITests(APITestCase):
    """CRUD du catalogue plateforme — réservé PLATFORM_ADMIN, comme le Tenant Registry."""

    def test_platform_admin_can_register_service(self):
        self.client.credentials(**PLATFORM_ADMIN_HEADERS)
        response = self.client.post('/api/platform-services/', {'code': 'PHARMACIE', 'name': 'Pharmacie'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'ACTIVE')

    def test_anonymous_cannot_list_services(self):
        self.client.credentials(**ANONYMOUS_HEADERS)
        response = self.client.get('/api/platform-services/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_business_admin_cannot_register_service(self):
        self.client.credentials(**ADMIN_HEADERS)
        response = self.client.post('/api/platform-services/', {'code': 'PHARMACIE', 'name': 'Pharmacie'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_invalid_code_format_is_rejected(self):
        self.client.credentials(**PLATFORM_ADMIN_HEADERS)
        response = self.client.post('/api/platform-services/', {'code': 'lower-case', 'name': 'X'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TenantDatabaseModelTests(TestCase):
    """
    Contraintes d'intégrité du modèle TenantDatabase :
      - Un tenant peut avoir plusieurs services (multi-lignes) ;
      - Plusieurs tenants peuvent utiliser le même service (des lignes distinctes) ;
      - (tenant, service) est unique ;
      - `service` doit référencer une entrée existante du catalogue (FK).
    """

    def setUp(self):
        self.tenant_a = _make_tenant('hopital-central', 'Hôpital Central')
        self.tenant_b = _make_tenant('clinique-paix', 'Clinique de la Paix')
        self.personnel = _make_service('PERSONNEL', 'Service Personnel')
        self.infrastructure = _make_service('INFRASTRUCTURE', 'Infrastructure')
        self.compta = _make_service('COMPTA', 'Comptabilité')

    def test_tenant_with_multiple_services_is_valid(self):
        """Tenant A : Personnel + Infrastructure + Comptabilité → valide."""
        TenantDatabase.objects.create(
            tenant=self.tenant_a, service=self.personnel,
            database_name='db_hc_personnel', host='db-personnel', secret_reference='ref-1',
        )
        TenantDatabase.objects.create(
            tenant=self.tenant_a, service=self.infrastructure,
            database_name='db_hc_infra', host='db-infra', secret_reference='ref-2',
        )
        TenantDatabase.objects.create(
            tenant=self.tenant_a, service=self.compta,
            database_name='db_hc_compta', host='db-compta', secret_reference='ref-3',
        )
        self.assertEqual(TenantDatabase.objects.filter(tenant=self.tenant_a).count(), 3)

    def test_multiple_tenants_can_use_the_same_service(self):
        """Tenant A + Personnel et Tenant B + Personnel → deux configurations distinctes valides."""
        TenantDatabase.objects.create(
            tenant=self.tenant_a, service=self.personnel,
            database_name='db_a_personnel', host='db-a', secret_reference='ref-a',
        )
        TenantDatabase.objects.create(
            tenant=self.tenant_b, service=self.personnel,
            database_name='db_b_personnel', host='db-b', secret_reference='ref-b',
        )
        self.assertEqual(TenantDatabase.objects.filter(service=self.personnel).count(), 2)

    def test_duplicate_tenant_service_pair_is_rejected(self):
        """Tenant A + Personnel → DB_1 puis Tenant A + Personnel → DB_2 : refusé (contrainte d'unicité)."""
        TenantDatabase.objects.create(
            tenant=self.tenant_a, service=self.personnel,
            database_name='db_1', host='db-a', secret_reference='ref-1',
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                TenantDatabase.objects.create(
                    tenant=self.tenant_a, service=self.personnel,
                    database_name='db_2', host='db-a', secret_reference='ref-2',
                )

    def test_default_status_is_pending(self):
        """Aucune création physique n'a lieu ici : le statut par défaut n'est pas ACTIVE."""
        tdb = TenantDatabase.objects.create(
            tenant=self.tenant_a, service=self.personnel,
            database_name='db_1', host='db-a', secret_reference='ref-1',
        )
        self.assertEqual(tdb.status, TenantDatabaseStatus.PENDING)


class TenantDatabaseAPITests(APITestCase):
    """
    Endpoints CRUD de TenantDatabase — réservés PLATFORM_ADMIN, informations
    d'infrastructure sensibles (host, port, secret_reference).
    """

    def setUp(self):
        self.tenant_a = _make_tenant('hopital-central', 'Hôpital Central')
        self.tenant_b = _make_tenant('clinique-paix', 'Clinique de la Paix')
        self.personnel = _make_service('PERSONNEL', 'Service Personnel')
        self.infrastructure = _make_service('INFRASTRUCTURE', 'Infrastructure')

    def _create_payload(self, tenant, service, **overrides):
        payload = {
            'tenant': str(tenant.id),
            'service': service.code,
            'database_name': f'db_{tenant.identifier}_{service.code.lower()}',
            'host': 'fultang-tenant-db',
            'port': 5432,
            'secret_reference': f'vault://tenant-db/{tenant.identifier}/{service.code.lower()}',
        }
        payload.update(overrides)
        return payload

    # --- Cas fonctionnels ---------------------------------------------------

    def test_platform_admin_can_create_tenant_database(self):
        self.client.credentials(**PLATFORM_ADMIN_HEADERS)
        response = self.client.post(
            '/api/tenant-databases/',
            self._create_payload(self.tenant_a, self.personnel),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], TenantDatabaseStatus.PENDING)

    def test_tenant_with_multiple_services_via_api(self):
        self.client.credentials(**PLATFORM_ADMIN_HEADERS)
        r1 = self.client.post('/api/tenant-databases/', self._create_payload(self.tenant_a, self.personnel), format='json')
        r2 = self.client.post('/api/tenant-databases/', self._create_payload(self.tenant_a, self.infrastructure), format='json')
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)

    def test_multiple_tenants_same_service_via_api(self):
        self.client.credentials(**PLATFORM_ADMIN_HEADERS)
        r1 = self.client.post('/api/tenant-databases/', self._create_payload(self.tenant_a, self.personnel), format='json')
        r2 = self.client.post('/api/tenant-databases/', self._create_payload(self.tenant_b, self.personnel), format='json')
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)

    def test_duplicate_tenant_service_via_api_returns_400(self):
        self.client.credentials(**PLATFORM_ADMIN_HEADERS)
        self.client.post('/api/tenant-databases/', self._create_payload(self.tenant_a, self.personnel), format='json')
        response = self.client.post('/api/tenant-databases/', self._create_payload(self.tenant_a, self.personnel), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unknown_service_code_is_rejected(self):
        """Un TenantDatabase ne peut pas référencer un service absent du catalogue."""
        self.client.credentials(**PLATFORM_ADMIN_HEADERS)
        payload = self._create_payload(self.tenant_a, self.personnel)
        payload['service'] = 'DOES_NOT_EXIST'
        response = self.client.post('/api/tenant-databases/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('service', response.data)

    def test_status_transitions(self):
        self.client.credentials(**PLATFORM_ADMIN_HEADERS)
        create_resp = self.client.post('/api/tenant-databases/', self._create_payload(self.tenant_a, self.personnel), format='json')
        tdb_id = create_resp.data['id']
        self.assertEqual(create_resp.data['status'], TenantDatabaseStatus.PENDING)

        active_resp = self.client.patch(f'/api/tenant-databases/{tdb_id}/status/', {'status': 'ACTIVE'}, format='json')
        self.assertEqual(active_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(active_resp.data['status'], TenantDatabaseStatus.ACTIVE)

        inactive_resp = self.client.patch(f'/api/tenant-databases/{tdb_id}/status/', {'status': 'INACTIVE'}, format='json')
        self.assertEqual(inactive_resp.data['status'], TenantDatabaseStatus.INACTIVE)

        pending_resp = self.client.patch(f'/api/tenant-databases/{tdb_id}/status/', {'status': 'PENDING'}, format='json')
        self.assertEqual(pending_resp.data['status'], TenantDatabaseStatus.PENDING)

    def test_list_filterable_by_tenant_and_service(self):
        self.client.credentials(**PLATFORM_ADMIN_HEADERS)
        self.client.post('/api/tenant-databases/', self._create_payload(self.tenant_a, self.personnel), format='json')
        self.client.post('/api/tenant-databases/', self._create_payload(self.tenant_b, self.personnel), format='json')

        response = self.client.get('/api/tenant-databases/', {'tenant': str(self.tenant_a.id)})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['tenant'], self.tenant_a.id)

    # --- Modification des champs d'infrastructure ---------------------------

    def test_platform_admin_can_update_infrastructure_fields(self):
        self.client.credentials(**PLATFORM_ADMIN_HEADERS)
        create_resp = self.client.post('/api/tenant-databases/', self._create_payload(self.tenant_a, self.personnel), format='json')
        tdb_id = create_resp.data['id']

        response = self.client.patch(f'/api/tenant-databases/{tdb_id}/', {'host': 'new-db-host'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(TenantDatabase.objects.get(id=tdb_id).host, 'new-db-host')

    def test_reassigning_tenant_via_update_has_no_effect(self):
        """
        Rôle 7 : réassigner un tenant vers la config d'un autre tenant doit
        être impossible — le serializer de mise à jour n'expose pas `tenant`.
        """
        self.client.credentials(**PLATFORM_ADMIN_HEADERS)
        create_resp = self.client.post('/api/tenant-databases/', self._create_payload(self.tenant_a, self.personnel), format='json')
        tdb_id = create_resp.data['id']

        response = self.client.patch(
            f'/api/tenant-databases/{tdb_id}/',
            {'tenant': str(self.tenant_b.id), 'host': 'still-updatable'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        refreshed = TenantDatabase.objects.get(id=tdb_id)
        self.assertEqual(refreshed.tenant_id, self.tenant_a.id)  # inchangé
        self.assertEqual(refreshed.host, 'still-updatable')  # le reste s'applique bien

    def test_status_is_not_editable_via_general_update(self):
        self.client.credentials(**PLATFORM_ADMIN_HEADERS)
        create_resp = self.client.post('/api/tenant-databases/', self._create_payload(self.tenant_a, self.personnel), format='json')
        tdb_id = create_resp.data['id']

        self.client.patch(f'/api/tenant-databases/{tdb_id}/', {'status': 'ACTIVE'}, format='json')
        self.assertEqual(TenantDatabase.objects.get(id=tdb_id).status, TenantDatabaseStatus.PENDING)

    # --- Permissions ----------------------------------------------------------

    def test_anonymous_cannot_access_tenant_databases(self):
        self.client.credentials(**ANONYMOUS_HEADERS)
        response = self.client.get('/api/tenant-databases/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_business_admin_cannot_create_tenant_database(self):
        """Un utilisateur du tenant (rôle ADMIN local) ne peut pas déclarer d'infrastructure."""
        self.client.credentials(**ADMIN_HEADERS)
        response = self.client.post('/api/tenant-databases/', self._create_payload(self.tenant_a, self.personnel), format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_business_admin_cannot_update_infrastructure_fields(self):
        tdb = TenantDatabase.objects.create(
            tenant=self.tenant_a, service=self.personnel,
            database_name='db_1', host='db-a', secret_reference='ref-1',
        )
        self.client.credentials(**ADMIN_HEADERS)
        response = self.client.patch(f'/api/tenant-databases/{tdb.id}/', {'host': 'hacked-host'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(TenantDatabase.objects.get(id=tdb.id).host, 'db-a')

    def test_business_admin_cannot_read_tenant_databases(self):
        TenantDatabase.objects.create(
            tenant=self.tenant_a, service=self.personnel,
            database_name='db_1', host='db-a', secret_reference='ref-1',
        )
        self.client.credentials(**ADMIN_HEADERS)
        response = self.client.get('/api/tenant-databases/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # --- Secrets ----------------------------------------------------------

    def test_secret_reference_is_an_opaque_string_not_a_credential(self):
        """
        secret_reference est une référence (ex: chemin vault), jamais un mot
        de passe — aucun champ credential/password n'existe sur ce modèle.
        """
        self.client.credentials(**PLATFORM_ADMIN_HEADERS)
        response = self.client.post('/api/tenant-databases/', self._create_payload(self.tenant_a, self.personnel), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        field_names = set(response.data.keys())
        self.assertIn('secret_reference', field_names)
        self.assertFalse({'password', 'credential', 'credentials', 'db_password'} & field_names)

    def test_model_has_no_password_field(self):
        model_field_names = {f.name for f in TenantDatabase._meta.get_fields()}
        self.assertFalse({'password', 'credential', 'credentials', 'db_password'} & model_field_names)


@override_settings(TENANT_SERVICE_INTERNAL_TOKEN=TEST_INTERNAL_TOKEN)
class TenantDatabaseResolveEndpointTests(APITestCase):
    """
    GET /api/tenant-databases/resolve/ — Phase 6, utilisé par le Dynamic
    Database Router de chaque microservice. Réservé au jeton interne
    partagé (IsInternalService), pas public, pas PLATFORM_ADMIN.
    """

    def setUp(self):
        self.tenant = _make_tenant('hopital-central', 'Hôpital Central')
        self.personnel = _make_service('PERSONNEL', 'Service Personnel')
        self.tdb = TenantDatabase.objects.create(
            tenant=self.tenant, service=self.personnel,
            database_name='db_hc_personnel', host='fultang-tenant-db',
            secret_reference='ref-1',
        )
        self.tdb.status = TenantDatabaseStatus.ACTIVE
        self.tdb.save(update_fields=['status'])

    def _resolve(self, tenant_id, service_code, token=None):
        credentials = {}
        if token is not None:
            credentials['HTTP_X_INTERNAL_SERVICE_TOKEN'] = token
        self.client.credentials(**credentials)
        return self.client.get('/api/tenant-databases/resolve/', {'tenant': tenant_id, 'service': service_code})

    def test_valid_internal_token_resolves_database(self):
        response = self._resolve(str(self.tenant.id), 'PERSONNEL', token=TEST_INTERNAL_TOKEN)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['database_name'], 'db_hc_personnel')
        self.assertEqual(response.data['status'], TenantDatabaseStatus.ACTIVE)

    def test_response_never_includes_secret_reference(self):
        response = self._resolve(str(self.tenant.id), 'PERSONNEL', token=TEST_INTERNAL_TOKEN)
        self.assertNotIn('secret_reference', response.data)
        self.assertNotIn('id', response.data)

    def test_missing_token_is_rejected(self):
        response = self._resolve(str(self.tenant.id), 'PERSONNEL', token=None)
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_wrong_token_is_rejected(self):
        response = self._resolve(str(self.tenant.id), 'PERSONNEL', token='wrong-token')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_platform_admin_role_alone_is_not_sufficient(self):
        """IsInternalService exige le jeton — un simple rôle PLATFORM_ADMIN ne suffit pas."""
        self.client.credentials(**PLATFORM_ADMIN_HEADERS)
        response = self.client.get(
            '/api/tenant-databases/resolve/', {'tenant': str(self.tenant.id), 'service': 'PERSONNEL'},
        )
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_unknown_tenant_service_pair_returns_404(self):
        other_tenant = _make_tenant('clinique-paix', 'Clinique de la Paix')
        response = self._resolve(str(other_tenant.id), 'PERSONNEL', token=TEST_INTERNAL_TOKEN)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_missing_query_params_returns_400(self):
        self.client.credentials(HTTP_X_INTERNAL_SERVICE_TOKEN=TEST_INTERNAL_TOKEN)
        response = self.client.get('/api/tenant-databases/resolve/', {'tenant': str(self.tenant.id)})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@override_settings(TENANT_SERVICE_INTERNAL_TOKEN=TEST_INTERNAL_TOKEN)
class TenantDatabaseResolveActiveEndpointTests(APITestCase):
    """
    GET /api/tenant-databases/resolve-active/?service=<code> — énumération
    explicite des tenants ACTIVE pour un service (Medical-Monitoring
    tenant-aware, §10 : rattrapage périodique clinical-agent).
    """

    def setUp(self):
        self.tenant_a = _make_tenant('hopital-central', 'Hôpital Central')
        self.tenant_b = _make_tenant('clinique-paix', 'Clinique de la Paix')
        self.medical = _make_service('MEDICAL', 'Medical Monitoring')
        self.personnel = _make_service('PERSONNEL', 'Service Personnel')

        self.tdb_a = TenantDatabase.objects.create(
            tenant=self.tenant_a, service=self.medical,
            database_name='db_a_medical', host='fultang-medical-backend', secret_reference='ref-a',
        )
        self.tdb_a.status = TenantDatabaseStatus.ACTIVE
        self.tdb_a.save(update_fields=['status'])

        # PENDING : ne doit jamais apparaître dans l'énumération ACTIVE.
        TenantDatabase.objects.create(
            tenant=self.tenant_b, service=self.medical,
            database_name='db_b_medical', host='fultang-medical-backend', secret_reference='ref-b',
        )

        # Autre service : ne doit jamais apparaître dans un filtre ?service=MEDICAL.
        tdb_personnel = TenantDatabase.objects.create(
            tenant=self.tenant_a, service=self.personnel,
            database_name='db_a_personnel', host='fultang-postgres', secret_reference='ref-c',
        )
        tdb_personnel.status = TenantDatabaseStatus.ACTIVE
        tdb_personnel.save(update_fields=['status'])

    def _resolve_active(self, service_code, token=None):
        credentials = {}
        if token is not None:
            credentials['HTTP_X_INTERNAL_SERVICE_TOKEN'] = token
        self.client.credentials(**credentials)
        return self.client.get('/api/tenant-databases/resolve-active/', {'service': service_code})

    def test_returns_only_active_databases_for_the_requested_service(self):
        response = self._resolve_active('MEDICAL', token=TEST_INTERNAL_TOKEN)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tenant_ids = {row['tenant_id'] for row in response.data}
        self.assertEqual(tenant_ids, {str(self.tenant_a.id)})  # tenant_b est PENDING, exclu

    def test_response_never_includes_secret_reference(self):
        response = self._resolve_active('MEDICAL', token=TEST_INTERNAL_TOKEN)
        for row in response.data:
            self.assertNotIn('secret_reference', row)

    def test_missing_service_param_returns_400(self):
        response = self._resolve_active('', token=TEST_INTERNAL_TOKEN)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_token_is_rejected(self):
        response = self._resolve_active('MEDICAL', token=None)
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_unknown_service_returns_empty_list_not_error(self):
        response = self._resolve_active('DOES_NOT_EXIST', token=TEST_INTERNAL_TOKEN)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])


# =============================================================================
# Phase 7 — Tenant Provisioning
# =============================================================================

from unittest.mock import patch

from .provisioning import (
    PROVISIONING_CAPABLE_SERVICES,
    PhysicalProvisioningError,
    ProvisioningOrchestrator,
    ServiceNotActiveError,
    TenantNotActiveForProvisioningError,
    TenantNotFoundForProvisioningError,
    UnknownServiceError,
    _deterministic_database_name,
)


class DeterministicDatabaseNamingTests(TestCase):
    """§5 : noms de base déterministes, sûrs, sans collision, jamais dérivés d'une entrée libre."""

    def test_name_is_deterministic_for_same_inputs(self):
        tenant = _make_tenant()
        self.assertEqual(
            _deterministic_database_name(tenant.id, 'PERSONNEL'),
            _deterministic_database_name(tenant.id, 'PERSONNEL'),
        )

    def test_different_tenants_never_collide(self):
        tenant_a = _make_tenant('hopital-central', 'Hôpital Central')
        tenant_b = _make_tenant('clinique-paix', 'Clinique de la Paix')
        self.assertNotEqual(
            _deterministic_database_name(tenant_a.id, 'PERSONNEL'),
            _deterministic_database_name(tenant_b.id, 'PERSONNEL'),
        )

    def test_different_services_for_same_tenant_never_collide(self):
        tenant = _make_tenant()
        self.assertNotEqual(
            _deterministic_database_name(tenant.id, 'PERSONNEL'),
            _deterministic_database_name(tenant.id, 'INFRASTRUCTURE'),
        )

    def test_name_contains_no_dash_and_is_a_safe_sql_identifier_shape(self):
        tenant = _make_tenant()
        name = _deterministic_database_name(tenant.id, 'PERSONNEL')
        self.assertRegex(name, r'^tenant_[0-9a-f]{32}_[a-z0-9_]+$')


class ProvisioningOrchestratorTests(TestCase):
    """
    §7/§8/§10/§15 : orchestration du provisioning, indépendante du
    transport HTTP (testée directement contre `ProvisioningOrchestrator`).
    L'appel physique réel (`_call_physical_provisioning`) est mocké ici —
    la preuve avec un vrai service-personnel est faite séparément
    (validation pilote Docker, voir rapport final Phase 7).
    """

    def setUp(self):
        self.tenant = _make_tenant()
        _make_service('PERSONNEL', 'Service Personnel')
        _make_service('INFRASTRUCTURE', 'Infrastructure')
        self.orchestrator = ProvisioningOrchestrator()

    def _physical_success(self, service_code, callback_url, tenant_id):
        return {'database_name': f'tenant_x_{service_code.lower()}', 'host': 'fultang-personnel', 'port': 5432}

    def test_unknown_tenant_raises(self):
        with self.assertRaises(TenantNotFoundForProvisioningError):
            self.orchestrator.provision(uuid.uuid4(), ['PERSONNEL'])

    def test_inactive_tenant_raises_and_creates_nothing(self):
        self.tenant.status = TenantStatus.INACTIVE
        self.tenant.save(update_fields=['status'])

        with self.assertRaises(TenantNotActiveForProvisioningError):
            self.orchestrator.provision(self.tenant.id, ['PERSONNEL'])

        self.assertEqual(TenantDatabase.objects.filter(tenant=self.tenant).count(), 0)

    def test_unknown_service_raises_and_creates_nothing(self):
        with self.assertRaises(UnknownServiceError):
            self.orchestrator.provision(self.tenant.id, ['PERSONNEL', 'DOES_NOT_EXIST'])

        # Aucune ligne créée, pas même pour PERSONNEL (le service valide) :
        # la validation amont refuse la demande ENTIÈRE (§15 de la tâche).
        self.assertEqual(TenantDatabase.objects.filter(tenant=self.tenant).count(), 0)

    def test_inactive_service_raises(self):
        inactive_service = _make_service('COMPTA_MATIERE', 'Comptabilité Matière')
        inactive_service.status = 'INACTIVE'
        inactive_service.save(update_fields=['status'])

        with self.assertRaises(ServiceNotActiveError):
            self.orchestrator.provision(self.tenant.id, ['COMPTA_MATIERE'])

    def test_capable_service_is_physically_provisioned(self):
        with patch('tenants.provisioning._call_physical_provisioning', side_effect=self._physical_success):
            results = self.orchestrator.provision(self.tenant.id, ['PERSONNEL'])

        self.assertEqual(results[0].status, TenantDatabaseStatus.ACTIVE)
        tenant_database = TenantDatabase.objects.get(tenant=self.tenant, service_id='PERSONNEL')
        self.assertEqual(tenant_database.status, TenantDatabaseStatus.ACTIVE)

    def test_each_capable_service_has_its_own_url_prefix(self):
        """
        Régression : chaque service expose ses endpoints internes sous son
        PROPRE préfixe d'URL (service-personnel: /api, Medical-Monitoring:
        /api/medical-monitoring — même préfixe que son routage Gateway).
        Un préfixe supposé uniforme entre services a déjà causé un 404 réel
        lors de la validation pilote Medical-Monitoring.
        """
        self.assertTrue(PROVISIONING_CAPABLE_SERVICES['PERSONNEL'].endswith('/api'))
        self.assertTrue(PROVISIONING_CAPABLE_SERVICES['MEDICAL'].endswith('/api/medical-monitoring'))

    def test_physical_provisioning_call_targets_the_correct_url(self):
        """Vérifie l'URL RÉELLEMENT appelée, pas seulement le résultat mocké — aurait détecté le bug de préfixe."""
        captured = {}

        def fake_urlopen(request, timeout=None):
            captured['url'] = request.full_url
            import io
            import json as _json
            return io.BytesIO(_json.dumps({'database_name': 'x', 'host': 'h', 'port': 5432}).encode())

        _make_service('MEDICAL', 'Medical Monitoring')
        with patch('tenants.provisioning.urllib.request.urlopen', side_effect=fake_urlopen):
            self.orchestrator.provision(self.tenant.id, ['MEDICAL'])

        self.assertEqual(
            captured['url'],
            f"{PROVISIONING_CAPABLE_SERVICES['MEDICAL']}/internal/provision-database/",
        )
        self.assertIn('/api/medical-monitoring/internal/provision-database/', captured['url'])

    def test_non_capable_service_is_skipped_and_creates_no_row(self):
        """§4 de la tâche : ne pas fabriquer une TenantDatabase PENDING qui ne progressera jamais."""
        results = self.orchestrator.provision(self.tenant.id, ['INFRASTRUCTURE'])

        self.assertEqual(results[0].status, "SKIPPED")
        self.assertEqual(TenantDatabase.objects.filter(tenant=self.tenant, service_id='INFRASTRUCTURE').count(), 0)

    def test_multiple_services_are_independent(self):
        """§4/§10 : plusieurs services demandés ensemble, chacun avec son propre résultat indépendant."""
        with patch('tenants.provisioning._call_physical_provisioning', side_effect=self._physical_success):
            results = self.orchestrator.provision(self.tenant.id, ['PERSONNEL', 'INFRASTRUCTURE'])

        by_service = {r.service_code: r.status for r in results}
        self.assertEqual(by_service['PERSONNEL'], TenantDatabaseStatus.ACTIVE)
        self.assertEqual(by_service['INFRASTRUCTURE'], "SKIPPED")

    def test_idempotent_reprovisioning_of_already_active_service_is_a_noop(self):
        with patch('tenants.provisioning._call_physical_provisioning', side_effect=self._physical_success) as mock_call:
            self.orchestrator.provision(self.tenant.id, ['PERSONNEL'])
            self.orchestrator.provision(self.tenant.id, ['PERSONNEL'])

        mock_call.assert_called_once()  # jamais un second appel physique pour un service déjà ACTIVE
        self.assertEqual(TenantDatabase.objects.filter(tenant=self.tenant, service_id='PERSONNEL').count(), 1)

    def test_physical_failure_marks_failed_with_reason_and_creates_no_duplicate_row(self):
        with patch('tenants.provisioning._call_physical_provisioning', side_effect=PhysicalProvisioningError("injoignable")):
            results = self.orchestrator.provision(self.tenant.id, ['PERSONNEL'])

        self.assertEqual(results[0].status, TenantDatabaseStatus.FAILED)
        tenant_database = TenantDatabase.objects.get(tenant=self.tenant, service_id='PERSONNEL')
        self.assertEqual(tenant_database.status, TenantDatabaseStatus.FAILED)
        self.assertIn("injoignable", tenant_database.last_error)

    def test_retry_after_failure_succeeds_and_clears_error(self):
        with patch('tenants.provisioning._call_physical_provisioning', side_effect=PhysicalProvisioningError("injoignable")):
            self.orchestrator.provision(self.tenant.id, ['PERSONNEL'])

        with patch('tenants.provisioning._call_physical_provisioning', side_effect=self._physical_success):
            results = self.orchestrator.provision(self.tenant.id, ['PERSONNEL'])

        self.assertEqual(results[0].status, TenantDatabaseStatus.ACTIVE)
        tenant_database = TenantDatabase.objects.get(tenant=self.tenant, service_id='PERSONNEL')
        self.assertEqual(tenant_database.status, TenantDatabaseStatus.ACTIVE)
        self.assertEqual(tenant_database.last_error, '')

    def test_concurrent_provisioning_claims_exactly_once(self):
        """
        §8 : simule la course entre deux appels concurrents pour le même
        (tenant, service) — seul celui qui gagne le CAS
        (claim_for_provisioning) déclenche l'appel physique.
        """
        tenant_database, _ = self.orchestrator._tenant_databases.get_or_create_declarative(
            tenant_id=self.tenant.id, service_code='PERSONNEL',
            database_name='tenant_x_personnel', host='', port=5432, secret_reference='shared:x',
        )

        first_claim = self.orchestrator._tenant_databases.claim_for_provisioning(tenant_database.id)
        second_claim = self.orchestrator._tenant_databases.claim_for_provisioning(tenant_database.id)

        self.assertTrue(first_claim)
        self.assertFalse(second_claim)


@override_settings(TENANT_SERVICE_INTERNAL_TOKEN=TEST_INTERNAL_TOKEN)
class TenantProvisionEndpointTests(APITestCase):
    """POST /api/tenants/{id}/provision/ — permissions, validations amont, réponse structurée."""

    def setUp(self):
        self.tenant = _make_tenant()
        _make_service('PERSONNEL', 'Service Personnel')

    def _provision(self, tenant_id, services, headers=None):
        self.client.credentials(**(headers or {}))
        return self.client.post(f'/api/tenants/{tenant_id}/provision/', {'services': services}, format='json')

    def test_anonymous_is_rejected(self):
        response = self._provision(self.tenant.id, ['PERSONNEL'])
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_business_admin_role_is_rejected(self):
        response = self._provision(self.tenant.id, ['PERSONNEL'], ADMIN_HEADERS)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unknown_tenant_returns_404(self):
        response = self._provision(uuid.uuid4(), ['PERSONNEL'], PLATFORM_ADMIN_HEADERS)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_inactive_tenant_returns_409(self):
        self.tenant.status = TenantStatus.INACTIVE
        self.tenant.save(update_fields=['status'])
        response = self._provision(self.tenant.id, ['PERSONNEL'], PLATFORM_ADMIN_HEADERS)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_unknown_service_returns_400(self):
        response = self._provision(self.tenant.id, ['NOT_A_SERVICE'], PLATFORM_ADMIN_HEADERS)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_empty_services_list_returns_400(self):
        response = self._provision(self.tenant.id, [], PLATFORM_ADMIN_HEADERS)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_valid_request_returns_per_service_results(self):
        with patch(
            'tenants.provisioning._call_physical_provisioning',
            return_value={'database_name': 'tenant_x_personnel', 'host': 'fultang-personnel', 'port': 5432},
        ):
            response = self._provision(self.tenant.id, ['PERSONNEL'], PLATFORM_ADMIN_HEADERS)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results'][0]['service'], 'PERSONNEL')
        self.assertEqual(response.data['results'][0]['status'], TenantDatabaseStatus.ACTIVE)


# =============================================================================
# Platform Admin — Login (frontend Platform Admin, étape de démonstration)
# =============================================================================

from django.contrib.auth.hashers import make_password

from .models import PlatformAdmin


class PlatformAdminAuthVerifyTests(APITestCase):
    """
    POST /api/platform-admin/login/ — seul endroit du backend qui peut
    faire naître le rôle PLATFORM_ADMIN dans un JWT (voir Gateway
    /auth/platform-admin/login, qui appelle cet endpoint).
    """

    def setUp(self):
        self.email = 'platform-admin-test@fultang.local'
        self.password = 'CorrectHorseBatteryStaple1!'
        self.admin = PlatformAdmin.objects.create(
            email=self.email, password=make_password(self.password), nom='Test', prenom='Admin',
        )

    def _login(self, email, password):
        return self.client.post('/api/platform-admin/login/', {'email': email, 'password': password}, format='json')

    def test_valid_credentials_return_platform_admin_role(self):
        response = self._login(self.email, self.password)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['roles'], ['PLATFORM_ADMIN'])
        self.assertEqual(response.data['email'], self.email)
        self.assertNotIn('password', response.data)

    def test_wrong_password_is_rejected(self):
        response = self._login(self.email, 'wrong-password')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unknown_email_is_rejected(self):
        response = self._login('nobody@fultang.local', self.password)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_inactive_account_is_rejected(self):
        self.admin.is_active = False
        self.admin.save(update_fields=['is_active'])
        response = self._login(self.email, self.password)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_fields_return_400(self):
        response = self.client.post('/api/platform-admin/login/', {'email': self.email}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_authentication_required_to_attempt_login(self):
        """Symétrique de AuthVerifyView (service-personnel) : précède toute authentification DRF."""
        self.client.credentials()  # aucun header d'identité
        response = self._login(self.email, self.password)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
