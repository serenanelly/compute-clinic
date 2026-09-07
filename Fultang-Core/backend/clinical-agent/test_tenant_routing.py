# ============================================================
# Fultang — Clinical Agent
# Tests unitaires : registry_client.py, engine_registry.py
# ============================================================
"""
clinical-agent n'a aucun harnais de test préexistant (pas de pytest en
dépendance) — ces tests utilisent `unittest` (bibliothèque standard),
sans nouvelle dépendance. Le comportement bout-en-bout (signal →
Medical-Monitoring → clinical-agent → buffer, autorisation d'export,
isolation entre tenants) a été vérifié séparément en conditions réelles
(Docker + PostgreSQL, 2 tenants pilotes) — voir le rapport final. Ces
tests couvrent la logique la plus facilement isolable : résolution du
Tenant Registry et gestion du cache d'engines par tenant.

Exécution : `python -m unittest test_tenant_routing -v`
"""
import json
import unittest
import urllib.error
from unittest.mock import MagicMock, patch

import registry_client
import engine_registry


def _http_error(code, body=b"{}"):
    return urllib.error.HTTPError(url="http://x", code=code, msg="err", hdrs=None, fp=MagicMock(read=lambda: body))


class ResolveTenantDatabaseTests(unittest.TestCase):
    def test_success_returns_info(self):
        payload = json.dumps({"database_name": "db_a", "host": "h", "port": 5432, "status": "ACTIVE"}).encode()
        fake_response = MagicMock()
        fake_response.read.return_value = payload
        fake_response.__enter__.return_value = fake_response

        with patch("registry_client.urllib.request.urlopen", return_value=fake_response):
            info = registry_client.resolve_tenant_database("tenant-a")

        self.assertEqual(info.database_name, "db_a")
        self.assertEqual(info.status, "ACTIVE")

    def test_404_raises_not_found(self):
        with patch("registry_client.urllib.request.urlopen", side_effect=_http_error(404)):
            with self.assertRaises(registry_client.TenantDatabaseNotFoundError):
                registry_client.resolve_tenant_database("tenant-a")

    def test_500_raises_unavailable(self):
        with patch("registry_client.urllib.request.urlopen", side_effect=_http_error(500)):
            with self.assertRaises(registry_client.TenantRegistryUnavailableError):
                registry_client.resolve_tenant_database("tenant-a")

    def test_network_error_raises_unavailable(self):
        with patch("registry_client.urllib.request.urlopen", side_effect=urllib.error.URLError("down")):
            with self.assertRaises(registry_client.TenantRegistryUnavailableError):
                registry_client.resolve_tenant_database("tenant-a")


class GetTenantConfigTests(unittest.TestCase):
    def test_success_returns_config_with_export_flag(self):
        payload = json.dumps({
            "id": "tenant-a", "identifier": "hopital-central", "status": "ACTIVE",
            "allow_clinical_agent_export": False,
        }).encode()
        fake_response = MagicMock()
        fake_response.read.return_value = payload
        fake_response.__enter__.return_value = fake_response

        with patch("registry_client.urllib.request.urlopen", return_value=fake_response):
            config = registry_client.get_tenant_config("tenant-a")

        self.assertEqual(config.identifier, "hopital-central")
        self.assertFalse(config.allow_clinical_agent_export)

    def test_404_raises_tenant_not_found(self):
        with patch("registry_client.urllib.request.urlopen", side_effect=_http_error(404)):
            with self.assertRaises(registry_client.TenantNotFoundError):
                registry_client.get_tenant_config("tenant-a")


class ListActiveTenantDatabasesTests(unittest.TestCase):
    def test_returns_tenant_id_info_pairs(self):
        payload = json.dumps([
            {"tenant_id": "t1", "database_name": "db1", "host": "h", "port": 5432, "status": "ACTIVE"},
            {"tenant_id": "t2", "database_name": "db2", "host": "h", "port": 5432, "status": "ACTIVE"},
        ]).encode()
        fake_response = MagicMock()
        fake_response.read.return_value = payload
        fake_response.__enter__.return_value = fake_response

        with patch("registry_client.urllib.request.urlopen", return_value=fake_response):
            results = registry_client.list_active_tenant_databases()

        self.assertEqual([tid for tid, _ in results], ["t1", "t2"])

    def test_unavailable_registry_raises(self):
        with patch("registry_client.urllib.request.urlopen", side_effect=urllib.error.URLError("down")):
            with self.assertRaises(registry_client.TenantRegistryUnavailableError):
                registry_client.list_active_tenant_databases()


class EngineRegistryTests(unittest.TestCase):
    def setUp(self):
        engine_registry._engines.clear()
        engine_registry._creation_locks.clear()

    def test_creates_and_caches_engine_per_tenant(self):
        info = registry_client.TenantDatabaseInfo(database_name="db_a", host="h", port=5432, status="ACTIVE")
        fake_engine = MagicMock()

        with patch("engine_registry.resolve_tenant_database", return_value=info) as mock_resolve, \
             patch("engine_registry.create_engine", return_value=fake_engine) as mock_create:
            engine1 = engine_registry.get_engine_for_tenant("tenant-a")
            engine2 = engine_registry.get_engine_for_tenant("tenant-a")

        self.assertIs(engine1, engine2)
        mock_resolve.assert_called_once()
        mock_create.assert_called_once()

    def test_inactive_database_raises_and_is_not_cached(self):
        info = registry_client.TenantDatabaseInfo(database_name="db_a", host="h", port=5432, status="PENDING")

        with patch("engine_registry.resolve_tenant_database", return_value=info):
            with self.assertRaises(engine_registry.TenantDatabaseInactiveError):
                engine_registry.get_engine_for_tenant("tenant-a")

        self.assertNotIn("tenant-a", engine_registry._engines)

    def test_different_tenants_get_different_engines(self):
        info_a = registry_client.TenantDatabaseInfo(database_name="db_a", host="h", port=5432, status="ACTIVE")
        info_b = registry_client.TenantDatabaseInfo(database_name="db_b", host="h", port=5432, status="ACTIVE")

        with patch("engine_registry.resolve_tenant_database", side_effect=[info_a, info_b]), \
             patch("engine_registry.create_engine", side_effect=lambda *a, **k: MagicMock()):
            engine_a = engine_registry.get_engine_for_tenant("tenant-a")
            engine_b = engine_registry.get_engine_for_tenant("tenant-b")

        self.assertIsNot(engine_a, engine_b)

    def test_registry_error_propagates_without_creating_engine(self):
        with patch("engine_registry.resolve_tenant_database", side_effect=registry_client.TenantRegistryUnavailableError("down")):
            with self.assertRaises(registry_client.TenantRegistryUnavailableError):
                engine_registry.get_engine_for_tenant("tenant-a")
        self.assertNotIn("tenant-a", engine_registry._engines)


if __name__ == "__main__":
    unittest.main()
