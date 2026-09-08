"""
tests_tenant_routing.py — Tests du chantier Gestion-Infrastructures
tenant-aware.

Même patron de tests que service-personnel/api/tests.py et
Medical-Monitoring/backend/core/tests_tenant_routing.py — adapté à
l'unique app tenant-scopée de ce service ('infrastructures').

Exécution : `python manage.py test infrastructures.tests_tenant_routing`.
"""
import threading
import uuid
from unittest.mock import MagicMock, patch

from django.test import RequestFactory, TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from config.authentication import GatewayHeaderAuthentication
from config.permissions import IsInternalService
from config.tenant_routing import cache as cache_module
from config.tenant_routing import pool_registry as pool_registry_module
from config.tenant_routing.context import (
    TenantContextMissingError,
    get_current_tenant_context,
    reset_tenant_context,
    require_tenant_context,
    set_tenant_context,
)
from config.tenant_routing.pool_registry import (
    DatabaseProvisioningError,
    TenantDatabaseInactiveError,
    ensure_connection_alias,
    provision_database,
)
from config.tenant_routing.registry_client import (
    TenantDatabaseInfo,
    TenantDatabaseNotFoundError,
    TenantRegistryUnavailableError,
)
from config.tenant_routing.router import TenantDatabaseRouter
from config.views import ProvisionDatabaseView

ROUTE_TENANT_A = str(uuid.uuid4())
ROUTE_TENANT_B = str(uuid.uuid4())

# Ce service (contrairement à service-personnel/Medical-Monitoring) bascule
# `DATABASES['default']` vers sqlite pendant `manage.py test` (voir
# config/settings.py, bloc `if 'test' in sys.argv`, hors périmètre de ce
# chantier). `provision_database()` lit HOST/PORT de `default` pour ouvrir
# sa connexion admin PostgreSQL (voir pool_registry._admin_connection_params)
# — sqlite n'a pas de PORT. Les tests qui exercent le vrai code de
# `provision_database` restaurent donc explicitement une forme Postgres
# pour 'default' (psycopg2.connect lui-même reste mocké : aucune vraie
# connexion réseau n'est ouverte).
POSTGRES_SHAPED_DEFAULT_DB = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'infrastructure_db',
        'USER': 'infrastructure_user',
        'PASSWORD': 'password',
        'HOST': 'infrastructure-db',
        'PORT': 5432,
    }
}


# =============================================================================
# Tenant Context
# =============================================================================

class TenantContextTests(TestCase):
    """Le Tenant Context est isolé, précis, et refuse l'absence totale de décision."""

    def setUp(self):
        self._token = set_tenant_context(None)

    def tearDown(self):
        reset_tenant_context(self._token)

    def test_require_tenant_context_raises_when_never_established(self):
        """
        contextvars ne revient jamais à son état vierge sur le thread de
        test partagé par toute la suite — vérifié dans un thread neuf
        (un threading.Thread n'hérite PAS du contextvar du parent).
        """
        result = {}

        def check():
            try:
                require_tenant_context()
                result["raised"] = False
            except TenantContextMissingError:
                result["raised"] = True

        thread = threading.Thread(target=check)
        thread.start()
        thread.join()
        self.assertTrue(result["raised"])

    def test_set_and_get_tenant_context(self):
        set_tenant_context(ROUTE_TENANT_A)
        self.assertEqual(require_tenant_context().tenant_id, ROUTE_TENANT_A)

    def test_none_tenant_id_is_a_valid_explicit_context(self):
        set_tenant_context(None)
        ctx = require_tenant_context()  # ne lève PAS
        self.assertIsNone(ctx.tenant_id)

    def test_reset_restores_prior_state(self):
        before = get_current_tenant_context()
        token = set_tenant_context(ROUTE_TENANT_A)
        self.assertEqual(get_current_tenant_context().tenant_id, ROUTE_TENANT_A)
        reset_tenant_context(token)
        self.assertEqual(get_current_tenant_context(), before)

    def test_sequential_requests_do_not_leak_context(self):
        from config.tenant_routing.middleware import TenantContextCleanupMiddleware

        captured = []
        middleware = TenantContextCleanupMiddleware(get_response=lambda request: "ok")
        state_before = get_current_tenant_context()

        def view_a(request):
            set_tenant_context(ROUTE_TENANT_A)
            captured.append(require_tenant_context().tenant_id)
            return "ok"

        middleware.get_response = view_a
        middleware(request=object())
        self.assertEqual(get_current_tenant_context(), state_before)

        def view_b(request):
            ctx = require_tenant_context()
            captured.append(ctx.tenant_id)
            return "ok"

        middleware.get_response = view_b
        middleware(request=object())

        self.assertEqual(captured, [ROUTE_TENANT_A, None])


# =============================================================================
# Cache TTL
# =============================================================================

class TenantDatabaseCacheTests(TestCase):
    def setUp(self):
        self.cache = cache_module.TenantDatabaseCache()

    def test_first_access_calls_registry_once_and_caches(self):
        info = TenantDatabaseInfo(database_name="db_x", host="h", port=5432, status="ACTIVE")
        with patch.object(cache_module, "resolve_tenant_database", return_value=info) as mock_resolve:
            self.cache.get(ROUTE_TENANT_A)
            self.cache.get(ROUTE_TENANT_A)
        mock_resolve.assert_called_once()

    def test_expired_entry_triggers_a_new_registry_call(self):
        info = TenantDatabaseInfo(database_name="db_x", host="h", port=5432, status="ACTIVE")
        with patch.object(cache_module, "resolve_tenant_database", return_value=info) as mock_resolve, \
             override_settings(TENANT_DB_CACHE_TTL_SECONDS=0):
            self.cache.get(ROUTE_TENANT_A)
            self.cache.get(ROUTE_TENANT_A)
        self.assertEqual(mock_resolve.call_count, 2)

    def test_invalidate_forces_a_fresh_lookup(self):
        info = TenantDatabaseInfo(database_name="db_x", host="h", port=5432, status="ACTIVE")
        with patch.object(cache_module, "resolve_tenant_database", return_value=info) as mock_resolve:
            self.cache.get(ROUTE_TENANT_A)
            self.cache.invalidate(ROUTE_TENANT_A)
            self.cache.get(ROUTE_TENANT_A)
        self.assertEqual(mock_resolve.call_count, 2)

    def test_not_found_is_not_cached_and_propagates(self):
        with patch.object(cache_module, "resolve_tenant_database", side_effect=TenantDatabaseNotFoundError("x")):
            with self.assertRaises(TenantDatabaseNotFoundError):
                self.cache.get(ROUTE_TENANT_A)

    def test_no_cache_and_registry_unavailable_propagates_error(self):
        with patch.object(cache_module, "resolve_tenant_database", side_effect=TenantRegistryUnavailableError("x")):
            with self.assertRaises(TenantRegistryUnavailableError):
                self.cache.get(ROUTE_TENANT_A)

    def test_stale_cache_reused_when_registry_becomes_unavailable(self):
        info = TenantDatabaseInfo(database_name="db_x", host="h", port=5432, status="ACTIVE")
        with patch.object(cache_module, "resolve_tenant_database", return_value=info):
            self.cache.get(ROUTE_TENANT_A)
        with patch.object(cache_module, "resolve_tenant_database", side_effect=TenantRegistryUnavailableError("down")):
            result = self.cache.get(ROUTE_TENANT_A)
        self.assertEqual(result, info)


# =============================================================================
# Pool Registry — alias de connexion, verrouillage, provisioning physique
# =============================================================================

class PoolRegistryTests(TestCase):
    """Enregistrement de connexion par tenant + verrouillage de création concurrente."""

    def setUp(self):
        self.tenant_id = str(uuid.uuid4())
        self.alias = pool_registry_module._alias_for(self.tenant_id)
        self.addCleanup(self._cleanup_alias)

    def _cleanup_alias(self):
        from django.db import connections
        connections.databases.pop(self.alias, None)
        pool_registry_module._creation_locks.pop(self.tenant_id, None)

    def test_alias_suffix_is_infrastructure_not_personnel_or_medical(self):
        """
        Régression : Gestion-Infrastructures, service-personnel et
        Medical-Monitoring ne doivent jamais produire le même alias pour
        un même tenant_id.
        """
        self.assertTrue(self.alias.endswith("_infrastructure"))
        self.assertNotIn("personnel", self.alias)
        self.assertNotIn("medical", self.alias)

    def test_ensure_connection_alias_registers_active_database(self):
        info = TenantDatabaseInfo(database_name="db_x", host="h", port=5432, status="ACTIVE")
        with patch.object(cache_module.tenant_database_cache, "get", return_value=info):
            alias = ensure_connection_alias(self.tenant_id)

        from django.db import connections
        self.assertEqual(alias, self.alias)
        self.assertIn(alias, connections.databases)
        self.assertEqual(connections.databases[alias]["NAME"], "db_x")

    def test_inactive_database_is_refused_and_not_registered(self):
        info = TenantDatabaseInfo(database_name="db_x", host="h", port=5432, status="PENDING")
        with patch.object(cache_module.tenant_database_cache, "get", return_value=info):
            with self.assertRaises(TenantDatabaseInactiveError):
                ensure_connection_alias(self.tenant_id)

        from django.db import connections
        self.assertNotIn(self.alias, connections.databases)

    def test_already_registered_alias_skips_cache_lookup(self):
        info = TenantDatabaseInfo(database_name="db_x", host="h", port=5432, status="ACTIVE")
        with patch.object(cache_module.tenant_database_cache, "get", return_value=info) as mock_get:
            ensure_connection_alias(self.tenant_id)
            ensure_connection_alias(self.tenant_id)
        mock_get.assert_called_once()

    def test_concurrent_first_access_creates_pool_only_once(self):
        info = TenantDatabaseInfo(database_name="db_x", host="h", port=5432, status="ACTIVE")
        barrier = threading.Barrier(10)
        results = []

        def worker():
            barrier.wait()
            with patch.object(cache_module.tenant_database_cache, "get", return_value=info) as mock_get:
                alias = ensure_connection_alias(self.tenant_id)
                results.append((alias, mock_get.call_count))

        with patch.object(cache_module.tenant_database_cache, "get", return_value=info):
            threads = [threading.Thread(target=worker) for _ in range(10)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        self.assertEqual(len({alias for alias, _ in results}), 1)

    def test_create_database_if_missing_is_idempotent(self):
        mock_conn = MagicMock()
        mock_cursor = mock_conn.cursor.return_value.__enter__.return_value
        mock_cursor.fetchone.return_value = (1,)

        with patch('config.tenant_routing.pool_registry.psycopg2.connect', return_value=mock_conn):
            created = pool_registry_module._create_database_if_missing("tenant_x_infrastructure")

        self.assertFalse(created)
        mock_cursor.execute.assert_called_once()
        mock_conn.close.assert_called_once()

    @override_settings(DATABASES=POSTGRES_SHAPED_DEFAULT_DB)
    def test_provision_database_registers_alias_and_migrates_without_app_label(self):
        """
        Le provisioning ne doit JAMAIS restreindre `migrate` à un seul
        app_label en dur — c'est `TenantDatabaseRouter.allow_migrate` qui
        décide seul de ce qui s'applique sur l'alias (voir docstring de
        pool_registry.provision_database).
        """
        mock_conn = MagicMock()
        mock_cursor = mock_conn.cursor.return_value.__enter__.return_value
        mock_cursor.fetchone.return_value = None

        with patch('config.tenant_routing.pool_registry.psycopg2.connect', return_value=mock_conn), \
             patch('config.tenant_routing.pool_registry.call_command') as mock_migrate:
            result = provision_database(self.tenant_id)

        from django.db import connections
        self.assertIn(self.alias, connections.databases)
        mock_migrate.assert_called_once_with('migrate', database=self.alias, interactive=False, verbosity=0)
        self.assertNotIn('infrastructures', mock_migrate.call_args.args)  # aucun app_label positionnel
        self.assertEqual(result['database_name'], self.alias)

    @override_settings(DATABASES=POSTGRES_SHAPED_DEFAULT_DB)
    def test_migration_failure_unregisters_the_alias(self):
        mock_conn = MagicMock()
        mock_cursor = mock_conn.cursor.return_value.__enter__.return_value
        mock_cursor.fetchone.return_value = None

        with patch('config.tenant_routing.pool_registry.psycopg2.connect', return_value=mock_conn), \
             patch('config.tenant_routing.pool_registry.call_command', side_effect=Exception("boom")), \
             patch('config.tenant_routing.pool_registry.connections') as mock_connections:
            mock_connections.databases = {}
            with self.assertRaises(DatabaseProvisioningError):
                provision_database(self.tenant_id)

        self.assertNotIn(self.alias, mock_connections.databases)


# =============================================================================
# Database Router
# =============================================================================

class TenantDatabaseRouterTests(TestCase):
    """Aucune logique métier, refus explicite si le contexte est invalide/absent."""

    def setUp(self):
        self.router = TenantDatabaseRouter()
        self.addCleanup(lambda: set_tenant_context(None))

    def test_system_app_model_returns_none(self):
        from django.contrib.auth.models import User
        self.assertIsNone(self.router.db_for_read(User))
        self.assertIsNone(self.router.db_for_write(User))

    def test_raises_when_no_context_established(self):
        result = {}

        def check():
            try:
                self.router.db_for_read(_FakeModel("infrastructures"))
                result["raised"] = False
            except TenantContextMissingError:
                result["raised"] = True

        thread = threading.Thread(target=check)
        thread.start()
        thread.join()
        self.assertTrue(result["raised"])

    def test_none_tenant_routes_to_default(self):
        set_tenant_context(None)
        self.assertEqual(self.router.db_for_read(_FakeModel("infrastructures")), "default")

    def test_real_tenant_routes_to_resolved_alias(self):
        set_tenant_context(ROUTE_TENANT_A)
        with patch("config.tenant_routing.router.ensure_connection_alias", return_value="tenant_a_alias") as mock_ensure:
            self.assertEqual(self.router.db_for_read(_FakeModel("infrastructures")), "tenant_a_alias")
        mock_ensure.assert_called_once_with(ROUTE_TENANT_A)

    def test_non_tenant_scoped_app_is_never_routed_to_tenant_alias(self):
        """
        'auth' n'est pas dans TENANT_SCOPED_APPS : même avec un tenant
        réel dans le contexte, ce modèle doit continuer d'utiliser
        'default' (via None, laissé à Django).
        """
        set_tenant_context(ROUTE_TENANT_A)
        with patch("config.tenant_routing.router.ensure_connection_alias") as mock_ensure:
            self.assertIsNone(self.router.db_for_read(_FakeModel("auth")))
            self.assertIsNone(self.router.db_for_write(_FakeModel("auth")))
        mock_ensure.assert_not_called()

    def test_different_tenants_resolve_to_different_aliases(self):
        set_tenant_context(ROUTE_TENANT_A)
        with patch("config.tenant_routing.router.ensure_connection_alias", side_effect=lambda t: f"alias_{t}"):
            alias_a = self.router.db_for_read(_FakeModel("infrastructures"))

        set_tenant_context(ROUTE_TENANT_B)
        with patch("config.tenant_routing.router.ensure_connection_alias", side_effect=lambda t: f"alias_{t}"):
            alias_b = self.router.db_for_read(_FakeModel("infrastructures"))

        self.assertNotEqual(alias_a, alias_b)

    def test_inactive_tenant_database_is_refused_not_redirected(self):
        set_tenant_context(ROUTE_TENANT_A)
        with patch(
            "config.tenant_routing.router.ensure_connection_alias",
            side_effect=TenantDatabaseInactiveError(ROUTE_TENANT_A, "PENDING"),
        ):
            with self.assertRaises(TenantDatabaseInactiveError):
                self.router.db_for_read(_FakeModel("infrastructures"))

    def test_unregistered_tenant_database_is_refused_not_redirected(self):
        set_tenant_context(ROUTE_TENANT_A)
        with patch(
            "config.tenant_routing.router.ensure_connection_alias",
            side_effect=TenantDatabaseNotFoundError("no config"),
        ):
            with self.assertRaises(TenantDatabaseNotFoundError):
                self.router.db_for_read(_FakeModel("infrastructures"))

    def test_allow_relation_same_database(self):
        obj1, obj2 = MagicMock(), MagicMock()
        obj1._state.db = "alias_a"
        obj2._state.db = "alias_a"
        self.assertTrue(self.router.allow_relation(obj1, obj2))

        obj2._state.db = "alias_b"
        self.assertFalse(self.router.allow_relation(obj1, obj2))

    def test_allow_migrate_tenant_scoped_app_everywhere(self):
        self.assertTrue(self.router.allow_migrate("default", "infrastructures"))
        self.assertTrue(self.router.allow_migrate("tenant_a_alias", "infrastructures"))

    def test_allow_migrate_migrations_bookkeeping_everywhere(self):
        self.assertTrue(self.router.allow_migrate("tenant_a_alias", "migrations"))

    def test_allow_migrate_system_apps_only_on_default(self):
        self.assertIsNone(self.router.allow_migrate("default", "auth"))
        self.assertFalse(self.router.allow_migrate("tenant_a_alias", "auth"))
        self.assertFalse(self.router.allow_migrate("tenant_a_alias", "admin"))


class _FakeModel:
    """Simule un modèle Django juste assez pour le router (app_label uniquement)."""
    def __init__(self, app_label):
        self._meta = MagicMock()
        self._meta.app_label = app_label


# =============================================================================
# Authentication — extraction X-Tenant-ID
# =============================================================================

class GatewayHeaderAuthenticationTenantTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.auth = GatewayHeaderAuthentication()
        self.addCleanup(lambda: set_tenant_context(None))

    def test_authenticate_extracts_user_id_roles_and_tenant_id(self):
        request = self.factory.get(
            '/', HTTP_X_USER_ID='u1', HTTP_X_USER_ROLES='Admin,Directeur', HTTP_X_TENANT_ID=ROUTE_TENANT_A,
        )
        user, _ = self.auth.authenticate(request)
        self.assertEqual(user.id, 'u1')
        self.assertEqual(user.roles, ['Admin', 'Directeur'])
        self.assertEqual(user.tenant_id, ROUTE_TENANT_A)
        self.assertEqual(require_tenant_context().tenant_id, ROUTE_TENANT_A)

    def test_authenticate_without_tenant_header_leaves_tenant_id_none(self):
        request = self.factory.get('/', HTTP_X_USER_ID='u1', HTTP_X_USER_ROLES='Admin')
        user, _ = self.auth.authenticate(request)
        self.assertIsNone(user.tenant_id)
        self.assertIsNone(require_tenant_context().tenant_id)

    def test_authenticate_without_user_id_header_returns_none(self):
        request = self.factory.get('/')
        self.assertIsNone(self.auth.authenticate(request))


# =============================================================================
# Provisioning interne
# =============================================================================

class IsInternalServicePermissionTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.permission = IsInternalService()

    def test_correct_token_is_authorized(self):
        request = self.factory.post('/', HTTP_X_INTERNAL_SERVICE_TOKEN='test-token')
        with override_settings(TENANT_SERVICE_INTERNAL_TOKEN='test-token'):
            self.assertTrue(self.permission.has_permission(request, None))

    def test_wrong_token_is_refused(self):
        request = self.factory.post('/', HTTP_X_INTERNAL_SERVICE_TOKEN='wrong')
        with override_settings(TENANT_SERVICE_INTERNAL_TOKEN='test-token'):
            self.assertFalse(self.permission.has_permission(request, None))

    def test_missing_token_is_refused(self):
        request = self.factory.post('/')
        with override_settings(TENANT_SERVICE_INTERNAL_TOKEN='test-token'):
            self.assertFalse(self.permission.has_permission(request, None))

    def test_unconfigured_server_side_token_refuses_everything(self):
        request = self.factory.post('/', HTTP_X_INTERNAL_SERVICE_TOKEN='anything')
        with override_settings(TENANT_SERVICE_INTERNAL_TOKEN=''):
            self.assertFalse(self.permission.has_permission(request, None))


PROVISION_TENANT = str(uuid.uuid4())


class ProvisionDatabaseEndpointTests(APITestCase):
    def setUp(self):
        self.url = '/api/internal/provision-database/'

    @override_settings(TENANT_SERVICE_INTERNAL_TOKEN='test-token')
    def test_missing_token_is_rejected(self):
        response = self.client.post(self.url, {'tenant_id': PROVISION_TENANT}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(TENANT_SERVICE_INTERNAL_TOKEN='test-token')
    def test_missing_tenant_id_returns_400(self):
        response = self.client.post(self.url, {}, format='json', HTTP_X_INTERNAL_SERVICE_TOKEN='test-token')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(TENANT_SERVICE_INTERNAL_TOKEN='test-token')
    def test_valid_request_delegates_to_provision_database(self):
        with patch('config.views.provision_database', return_value={
            'database_name': 'tenant_x_infrastructure', 'host': 'infrastructure-db', 'port': 5432,
        }) as mock_provision:
            response = self.client.post(
                self.url, {'tenant_id': PROVISION_TENANT}, format='json', HTTP_X_INTERNAL_SERVICE_TOKEN='test-token',
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['database_name'], 'tenant_x_infrastructure')
        mock_provision.assert_called_once_with(PROVISION_TENANT)

    @override_settings(TENANT_SERVICE_INTERNAL_TOKEN='test-token')
    def test_provisioning_failure_returns_502(self):
        with patch('config.views.provision_database', side_effect=DatabaseProvisioningError("boom")):
            response = self.client.post(
                self.url, {'tenant_id': PROVISION_TENANT}, format='json', HTTP_X_INTERNAL_SERVICE_TOKEN='test-token',
            )
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
