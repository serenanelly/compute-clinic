import uuid
from unittest.mock import MagicMock, patch

from django.contrib.auth.hashers import make_password
from django.test import RequestFactory, TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .authentication import GatewayHeaderAuthentication
from .models import Medecin
from .tenant_routing.context import set_tenant_context

TENANT_A = uuid.uuid4()
TENANT_B = uuid.uuid4()


def _create_medecin(email, password, tenant_id):
    """
    Utilisé par les tests Phase 3/4/5 (scoping par colonne tenant_id,
    pas encore le routing physique de base introduit en Phase 6).
    `.using('default')` contourne délibérément le Database Router : ces
    tests emploient des tenant_id aléatoires (uuid4()) non enregistrés
    dans le Tenant Registry, donc non routables réellement. Le VRAI
    routing, avec de vrais tenants enregistrés, est couvert séparément
    par TenantDatabaseRoutingTests plus bas dans ce fichier.
    """
    return Medecin.objects.using('default').create(
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

    Phase 6 : AuthVerifyView interroge désormais la base via le Database
    Router (comme toute vue tenant-scopée). Ces tests utilisent des
    tenant_id aléatoires non enregistrés dans le Tenant Registry — on
    neutralise donc la résolution physique de base (`ensure_connection_alias`
    → toujours 'default', comme avant Phase 6) pour rester focalisés sur
    ce qu'ils testent réellement : le filtrage (email, tenant_id). Le
    VRAI routing multi-bases est testé séparément (TenantDatabaseRoutingTests).
    """

    def setUp(self):
        patcher = patch('api.tenant_routing.router.ensure_connection_alias', return_value='default')
        patcher.start()
        self.addCleanup(patcher.stop)

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
        # authenticate() établit désormais le Tenant Context (Phase 6) —
        # neutralisé après chaque test pour ne jamais fuiter vers le test
        # suivant (hors du cycle middleware normal ici, RequestFactory pur).
        self.addCleanup(lambda: set_tenant_context(None))

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


# =============================================================================
# Phase 6 — Dynamic Database Routing
# =============================================================================

import threading
import time

from .tenant_routing import cache as cache_module
from .tenant_routing import pool_registry as pool_registry_module
from .tenant_routing.context import (
    TenantContextMissingError,
    get_current_tenant_context,
    reset_tenant_context,
    require_tenant_context,
)
from .tenant_routing.pool_registry import TenantDatabaseInactiveError, ensure_connection_alias
from .tenant_routing.registry_client import (
    TenantDatabaseInfo,
    TenantDatabaseNotFoundError,
    TenantRegistryUnavailableError,
)
from .tenant_routing.router import TenantDatabaseRouter

ROUTE_TENANT_A = str(uuid.uuid4())
ROUTE_TENANT_B = str(uuid.uuid4())


class TenantContextTests(TestCase):
    """
    §4 : le Tenant Context est isolé, précis, et refuse l'absence totale de décision.

    Note d'implémentation des tests : `contextvars.ContextVar` ne revient
    JAMAIS à son état "jamais initialisé" une fois `.set()` appelé sur un
    thread donné — seul un `.reset(token)` avec le token d'origine (ou un
    tout nouveau thread, qui démarre avec un Context vierge, vérifié
    empiriquement) le permet. Chaque test ci-dessous restaure donc
    explicitement l'état qu'il a lui-même modifié (setUp/tearDown
    symétriques), et la vérification "jamais établi" s'exécute dans un
    thread neuf plutôt que de supposer un état vierge sur le thread de
    test partagé par toute la suite.
    """

    def setUp(self):
        self._token = set_tenant_context(None)

    def tearDown(self):
        reset_tenant_context(self._token)

    def test_require_tenant_context_raises_when_never_established(self):
        """Un thread neuf n'a jamais vu set_tenant_context() — Context vierge, vérifié empiriquement."""
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
        """tenant_id=None (pool non assigné) est un contexte VALIDE, pas une absence de contexte."""
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
        """Simule deux requêtes successives sur le même thread : la seconde ne doit jamais hériter du tenant de la première."""
        from .tenant_routing.middleware import TenantContextCleanupMiddleware

        captured = []
        middleware = TenantContextCleanupMiddleware(get_response=lambda request: "ok")
        state_before_both_requests = get_current_tenant_context()

        # Requête 1 : Tenant A (établi "pendant" get_response, comme le ferait authenticate())
        def view_a(request):
            set_tenant_context(ROUTE_TENANT_A)
            captured.append(require_tenant_context().tenant_id)
            return "ok"

        middleware.get_response = view_a
        middleware(request=object())
        # Nettoyé après la requête : retour exact à l'état d'avant la requête 1.
        self.assertEqual(get_current_tenant_context(), state_before_both_requests)

        # Requête 2 : le middleware repart d'un contexte neutre (tenant_id=None)
        # à chaque requête — elle ne doit voir NI Tenant A, ni l'état antérieur.
        def view_b(request):
            ctx = require_tenant_context()
            captured.append(ctx.tenant_id)
            return "ok"

        middleware.get_response = view_b
        middleware(request=object())

        self.assertEqual(captured, [ROUTE_TENANT_A, None])


class TenantDatabaseCacheTests(TestCase):
    """§8 : cache TTL du mapping tenant → base, dégradation gracieuse si le Registry est indisponible."""

    def setUp(self):
        self.cache = cache_module.TenantDatabaseCache()
        self.info = TenantDatabaseInfo(database_name="db_a", host="h", port=5432, status="ACTIVE")

    def test_first_access_calls_registry_once_and_caches(self):
        with patch.object(cache_module, "resolve_tenant_database", return_value=self.info) as mock_resolve:
            result1 = self.cache.get(ROUTE_TENANT_A)
            result2 = self.cache.get(ROUTE_TENANT_A)

        self.assertEqual(result1, self.info)
        self.assertEqual(result2, self.info)
        mock_resolve.assert_called_once_with(ROUTE_TENANT_A)

    @override_settings(TENANT_DB_CACHE_TTL_SECONDS=0)
    def test_expired_entry_triggers_a_new_registry_call(self):
        with patch.object(cache_module, "resolve_tenant_database", return_value=self.info) as mock_resolve:
            self.cache.get(ROUTE_TENANT_A)
            time.sleep(0.01)
            self.cache.get(ROUTE_TENANT_A)

        self.assertEqual(mock_resolve.call_count, 2)

    @override_settings(TENANT_DB_CACHE_TTL_SECONDS=0)
    def test_stale_cache_reused_when_registry_becomes_unavailable(self):
        with patch.object(cache_module, "resolve_tenant_database", return_value=self.info):
            self.cache.get(ROUTE_TENANT_A)

        with patch.object(
            cache_module, "resolve_tenant_database", side_effect=TenantRegistryUnavailableError("down")
        ):
            result = self.cache.get(ROUTE_TENANT_A)  # ne lève pas : réutilise le cache expiré

        self.assertEqual(result, self.info)

    def test_no_cache_and_registry_unavailable_propagates_error(self):
        with patch.object(
            cache_module, "resolve_tenant_database", side_effect=TenantRegistryUnavailableError("down")
        ):
            with self.assertRaises(TenantRegistryUnavailableError):
                self.cache.get(ROUTE_TENANT_B)

    def test_not_found_is_not_cached_and_propagates(self):
        with patch.object(
            cache_module, "resolve_tenant_database", side_effect=TenantDatabaseNotFoundError("nope")
        ):
            with self.assertRaises(TenantDatabaseNotFoundError):
                self.cache.get(ROUTE_TENANT_B)

    def test_invalidate_forces_a_fresh_lookup(self):
        with patch.object(cache_module, "resolve_tenant_database", return_value=self.info) as mock_resolve:
            self.cache.get(ROUTE_TENANT_A)
            self.cache.invalidate(ROUTE_TENANT_A)
            self.cache.get(ROUTE_TENANT_A)

        self.assertEqual(mock_resolve.call_count, 2)


class PoolRegistryTests(TestCase):
    """§9/§10 : enregistrement de connexion par tenant + verrouillage de création concurrente."""

    def setUp(self):
        self.tenant_id = str(uuid.uuid4())
        self.alias = pool_registry_module._alias_for(self.tenant_id)
        self.addCleanup(self._cleanup_alias)

    def _cleanup_alias(self):
        from django.db import connections
        connections.databases.pop(self.alias, None)
        pool_registry_module._creation_locks.pop(self.tenant_id, None)

    def test_ensure_connection_alias_registers_active_database(self):
        info = TenantDatabaseInfo(database_name="db_x", host="h", port=5432, status="ACTIVE")
        with patch.object(cache_module.tenant_database_cache, "get", return_value=info):
            alias = ensure_connection_alias(self.tenant_id)

        from django.db import connections
        self.assertEqual(alias, self.alias)
        self.assertIn(alias, connections.databases)
        self.assertEqual(connections.databases[alias]["NAME"], "db_x")
        self.assertEqual(connections.databases[alias]["ENGINE"], "django.db.backends.postgresql")

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
        """
        §10 : N requêtes simultanées pour un tenant dont le pool n'existe
        pas encore ne doivent déclencher qu'UNE seule résolution/
        enregistrement — pas une par thread.
        """
        info = TenantDatabaseInfo(database_name="db_x", host="h", port=5432, status="ACTIVE")
        call_count = {"n": 0}
        count_lock = threading.Lock()
        barrier = threading.Barrier(10)

        def slow_get(tenant_id):
            with count_lock:
                call_count["n"] += 1
            time.sleep(0.05)  # élargit la fenêtre de course
            return info

        results = []
        errors = []

        def worker():
            barrier.wait()  # synchronise le départ de tous les threads
            try:
                results.append(ensure_connection_alias(self.tenant_id))
            except Exception as exc:  # pragma: no cover - diagnostic
                errors.append(exc)

        with patch.object(cache_module.tenant_database_cache, "get", side_effect=slow_get):
            threads = [threading.Thread(target=worker) for _ in range(10)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        self.assertEqual(errors, [])
        self.assertEqual(len(results), 10)
        self.assertTrue(all(r == self.alias for r in results))
        self.assertEqual(call_count["n"], 1, "le pool ne doit être créé qu'une seule fois malgré 10 requêtes concurrentes")


class TenantDatabaseRouterTests(TestCase):
    """§11/§18 : décisions du Database Router — aucune logique métier, refus explicite si le contexte est invalide/absent."""

    def setUp(self):
        self.router = TenantDatabaseRouter()
        self.addCleanup(lambda: set_tenant_context(None))

    def test_system_app_model_returns_none(self):
        from django.contrib.auth.models import User
        self.assertIsNone(self.router.db_for_read(User))
        self.assertIsNone(self.router.db_for_write(User))

    def test_raises_when_no_context_established(self):
        """Le contextvar ne revient jamais à son état vierge sur le thread de test partagé
        par toute la suite (voir TenantContextTests) — on vérifie donc dans un thread neuf."""
        result = {}

        def check():
            try:
                self.router.db_for_read(Medecin)
                result["raised"] = False
            except TenantContextMissingError:
                result["raised"] = True

        thread = threading.Thread(target=check)
        thread.start()
        thread.join()
        self.assertTrue(result["raised"])

    def test_none_tenant_routes_to_default(self):
        set_tenant_context(None)
        self.assertEqual(self.router.db_for_read(Medecin), "default")
        self.assertEqual(self.router.db_for_write(Medecin), "default")

    def test_real_tenant_routes_to_resolved_alias(self):
        set_tenant_context(ROUTE_TENANT_A)
        with patch("api.tenant_routing.router.ensure_connection_alias", return_value="tenant_a_alias") as mock_ensure:
            self.assertEqual(self.router.db_for_read(Medecin), "tenant_a_alias")
        mock_ensure.assert_called_once_with(ROUTE_TENANT_A)

    def test_different_tenants_resolve_to_different_aliases(self):
        """12 : isolation absolue — Tenant A et Tenant B ne doivent jamais résoudre au même alias."""

        set_tenant_context(ROUTE_TENANT_A)
        with patch("api.tenant_routing.router.ensure_connection_alias", side_effect=lambda t: f"alias_{t}"):
            alias_a = self.router.db_for_read(Medecin)

        set_tenant_context(ROUTE_TENANT_B)
        with patch("api.tenant_routing.router.ensure_connection_alias", side_effect=lambda t: f"alias_{t}"):
            alias_b = self.router.db_for_read(Medecin)

        self.assertNotEqual(alias_a, alias_b)

    def test_inactive_tenant_database_is_refused_not_redirected(self):
        set_tenant_context(ROUTE_TENANT_A)
        with patch("api.tenant_routing.router.ensure_connection_alias", side_effect=TenantDatabaseInactiveError(ROUTE_TENANT_A, "INACTIVE")):
            with self.assertRaises(TenantDatabaseInactiveError):
                self.router.db_for_read(Medecin)

    def test_unregistered_tenant_database_is_refused_not_redirected(self):
        set_tenant_context(ROUTE_TENANT_A)
        with patch("api.tenant_routing.router.ensure_connection_alias", side_effect=TenantDatabaseNotFoundError("nope")):
            with self.assertRaises(TenantDatabaseNotFoundError):
                self.router.db_for_read(Medecin)

    def test_allow_relation_same_database(self):
        class FakeState:
            def __init__(self, db):
                self.db = db

        class FakeObj:
            def __init__(self, db):
                self._state = FakeState(db)

        self.assertTrue(self.router.allow_relation(FakeObj("tenant_a"), FakeObj("tenant_a")))
        self.assertFalse(self.router.allow_relation(FakeObj("tenant_a"), FakeObj("tenant_b")))

    def test_allow_migrate_api_app_everywhere(self):
        self.assertTrue(self.router.allow_migrate("default", "api"))
        self.assertTrue(self.router.allow_migrate("tenant_a_alias", "api"))

    def test_allow_migrate_migrations_bookkeeping_everywhere(self):
        self.assertTrue(self.router.allow_migrate("tenant_a_alias", "migrations"))

    def test_allow_migrate_system_apps_only_on_default(self):
        self.assertIsNone(self.router.allow_migrate("default", "auth"))
        self.assertFalse(self.router.allow_migrate("tenant_a_alias", "auth"))
        self.assertFalse(self.router.allow_migrate("tenant_a_alias", "admin"))


# =============================================================================
# Phase 7 — Tenant Provisioning
# =============================================================================

from .permissions import IsInternalService
from .tenant_routing.pool_registry import DatabaseProvisioningError, provision_database

PROVISION_TENANT = str(uuid.uuid4())


class IsInternalServicePermissionTests(TestCase):
    """§14 : le endpoint interne de provisioning n'est accessible qu'avec le jeton partagé."""

    def setUp(self):
        self.factory = RequestFactory()
        self.permission = IsInternalService()

    def test_correct_token_is_authorized(self):
        request = self.factory.post('/internal/provision-database/', HTTP_X_INTERNAL_SERVICE_TOKEN='test-internal-token')
        with override_settings(TENANT_SERVICE_INTERNAL_TOKEN='test-internal-token'):
            self.assertTrue(self.permission.has_permission(request, None))

    def test_wrong_token_is_refused(self):
        request = self.factory.post('/internal/provision-database/', HTTP_X_INTERNAL_SERVICE_TOKEN='wrong')
        with override_settings(TENANT_SERVICE_INTERNAL_TOKEN='test-internal-token'):
            self.assertFalse(self.permission.has_permission(request, None))

    def test_missing_token_is_refused(self):
        request = self.factory.post('/internal/provision-database/')
        with override_settings(TENANT_SERVICE_INTERNAL_TOKEN='test-internal-token'):
            self.assertFalse(self.permission.has_permission(request, None))

    def test_unconfigured_server_side_token_refuses_everything(self):
        """Un jeton serveur vide refuse TOUT accès plutôt que de l'accepter silencieusement."""
        request = self.factory.post('/internal/provision-database/', HTTP_X_INTERNAL_SERVICE_TOKEN='anything')
        with override_settings(TENANT_SERVICE_INTERNAL_TOKEN=''):
            self.assertFalse(self.permission.has_permission(request, None))


class ProvisionDatabaseEndpointTests(APITestCase):
    """
    Vue HTTP POST /api/internal/provision-database/ — permissions et
    délégation à `provision_database`. La création physique réelle
    (psycopg2 + migrate) est mockée ici : elle est vérifiée séparément,
    en conditions réelles, dans DatabaseProvisioningUnitTests et par la
    validation pilote Docker (voir rapport final Phase 7).
    """

    def setUp(self):
        self.url = '/api/internal/provision-database/'

    @override_settings(TENANT_SERVICE_INTERNAL_TOKEN='test-internal-token')
    def test_missing_token_is_rejected(self):
        response = self.client.post(self.url, {'tenant_id': PROVISION_TENANT}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(TENANT_SERVICE_INTERNAL_TOKEN='test-internal-token')
    def test_wrong_token_is_rejected(self):
        response = self.client.post(
            self.url, {'tenant_id': PROVISION_TENANT}, format='json',
            HTTP_X_INTERNAL_SERVICE_TOKEN='wrong',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(TENANT_SERVICE_INTERNAL_TOKEN='test-internal-token')
    def test_missing_tenant_id_returns_400(self):
        response = self.client.post(
            self.url, {}, format='json', HTTP_X_INTERNAL_SERVICE_TOKEN='test-internal-token',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(TENANT_SERVICE_INTERNAL_TOKEN='test-internal-token')
    def test_valid_request_delegates_to_provision_database_and_returns_its_result(self):
        with patch('api.views.provision_database', return_value={
            'database_name': 'tenant_x_personnel', 'host': 'postgres', 'port': 5432,
        }) as mock_provision:
            response = self.client.post(
                self.url, {'tenant_id': PROVISION_TENANT}, format='json',
                HTTP_X_INTERNAL_SERVICE_TOKEN='test-internal-token',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['database_name'], 'tenant_x_personnel')
        mock_provision.assert_called_once_with(PROVISION_TENANT)

    @override_settings(TENANT_SERVICE_INTERNAL_TOKEN='test-internal-token')
    def test_provisioning_failure_returns_502_not_500(self):
        """Un échec de provisioning est une erreur d'infrastructure identifiée (502), jamais un 500 générique opaque."""
        with patch('api.views.provision_database', side_effect=DatabaseProvisioningError("Migration échouée : OperationalError")):
            response = self.client.post(
                self.url, {'tenant_id': PROVISION_TENANT}, format='json',
                HTTP_X_INTERNAL_SERVICE_TOKEN='test-internal-token',
            )

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertIn('error', response.data)


class DatabaseProvisioningUnitTests(TestCase):
    """
    §5/§7/§10 : création physique déterministe/idempotente, et nettoyage
    de l'alias en cas d'échec de migration (jamais d'alias enregistré
    pointant vers un schéma non confirmé).

    N'ouvre AUCUNE vraie connexion PostgreSQL admin ici (psycopg2.connect
    est mocké) — la preuve avec un vrai serveur PostgreSQL est faite
    séparément (validation pilote Docker, voir rapport final Phase 7).
    """

    def setUp(self):
        self.tenant_id = str(uuid.uuid4())
        self.alias = pool_registry_module._alias_for(self.tenant_id)
        self.addCleanup(self._cleanup_alias)

    def _cleanup_alias(self):
        from django.db import connections
        connections.databases.pop(self.alias, None)
        pool_registry_module._creation_locks.pop(self.tenant_id, None)

    def test_database_name_is_deterministic_and_derived_only_from_uuid(self):
        """Aucune entrée utilisateur libre n'intervient jamais dans le nom physique de la base."""
        name = pool_registry_module._alias_for(self.tenant_id)
        self.assertTrue(name.startswith("tenant_"))
        self.assertTrue(name.endswith("_personnel"))
        self.assertNotIn("-", name)  # tirets de l'UUID retirés — identifiant SQL sûr

    def test_create_database_if_missing_is_idempotent(self):
        """Un appel répété ne recrée pas la base : vérifiée existante avant toute tentative de CREATE."""
        mock_conn = MagicMock()
        mock_cursor = mock_conn.cursor.return_value.__enter__.return_value
        mock_cursor.fetchone.return_value = (1,)  # la base existe déjà

        with patch('api.tenant_routing.pool_registry.psycopg2.connect', return_value=mock_conn):
            created = pool_registry_module._create_database_if_missing("tenant_x_personnel")

        self.assertFalse(created)
        mock_cursor.execute.assert_called_once()  # seulement le SELECT d'existence, jamais CREATE DATABASE
        mock_conn.close.assert_called_once()

    def test_provision_database_registers_alias_and_migrates(self):
        mock_conn = MagicMock()
        mock_cursor = mock_conn.cursor.return_value.__enter__.return_value
        mock_cursor.fetchone.return_value = None  # la base n'existe pas encore

        with patch('api.tenant_routing.pool_registry.psycopg2.connect', return_value=mock_conn), \
             patch('api.tenant_routing.pool_registry.call_command') as mock_migrate:
            result = provision_database(self.tenant_id)

        from django.db import connections
        self.assertIn(self.alias, connections.databases)
        mock_migrate.assert_called_once_with('migrate', 'api', database=self.alias, interactive=False, verbosity=0)
        self.assertEqual(result['database_name'], self.alias)

    def test_migration_failure_unregisters_the_alias(self):
        """
        §10 : un échec APRÈS création physique de la base ne doit jamais
        laisser un alias enregistré utilisable par une requête ordinaire
        sur ce même processus — le nettoyage est explicite, pas un
        DROP DATABASE automatique (voir MULTITENANT_ARCHITECTURE.md
        §Phase 7 "Échecs partiels").
        """
        mock_conn = MagicMock()
        mock_cursor = mock_conn.cursor.return_value.__enter__.return_value
        mock_cursor.fetchone.return_value = None

        with patch('api.tenant_routing.pool_registry.psycopg2.connect', return_value=mock_conn), \
             patch('api.tenant_routing.pool_registry.call_command', side_effect=Exception("boom")), \
             patch('api.tenant_routing.pool_registry.connections') as mock_connections:
            mock_connections.databases = {}
            with self.assertRaises(DatabaseProvisioningError):
                provision_database(self.tenant_id)

        # L'alias a bien été retiré après l'échec (jamais laissé en place).
        self.assertNotIn(self.alias, mock_connections.databases)
