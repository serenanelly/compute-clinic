"""
tests/test_tenant_resolver.py — Tests unitaires du Tenant Resolver (Phase 2.1).

Ces tests ciblent uniquement `app.tenant.resolver` : aucune dépendance à
FastAPI/TestClient n'est nécessaire, le Tenant Service est simulé au
niveau du client httpx.
"""
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.tenant.resolver import (
    INTERNAL_SERVICE_TOKEN_HEADER,
    TenantContext,
    TenantInactiveError,
    TenantNotFoundError,
    TenantResolutionError,
    TenantResolver,
)

ROOT_DOMAIN = "fulltang.com"
TENANT_SERVICE_URL = "http://fultang-tenant-web:8000"
INTERNAL_TOKEN = "test-internal-service-token"


def make_resolver(internal_service_token: str = INTERNAL_TOKEN) -> TenantResolver:
    return TenantResolver(httpx.AsyncClient(), TENANT_SERVICE_URL, ROOT_DOMAIN, internal_service_token)


# --- extract_identifier -----------------------------------------------------

def test_extracts_identifier_from_valid_subdomain():
    resolver = make_resolver()
    assert resolver.extract_identifier("hopital-central.fulltang.com") == "hopital-central"


def test_extract_identifier_ignores_port():
    resolver = make_resolver()
    assert resolver.extract_identifier("hopital-central.fulltang.com:8080") == "hopital-central"


def test_extract_identifier_returns_none_for_localhost():
    """CAS 5 : environnement de développement (localhost:8080, localhost:8005)."""
    resolver = make_resolver()
    assert resolver.extract_identifier("localhost") is None
    assert resolver.extract_identifier("localhost:8080") is None
    assert resolver.extract_identifier("localhost:8005") is None


def test_extract_identifier_returns_none_for_root_domain_alone():
    resolver = make_resolver()
    assert resolver.extract_identifier("fulltang.com") is None


def test_extract_identifier_returns_none_for_unrelated_domain():
    """CAS 4 : hostname hors convention."""
    resolver = make_resolver()
    assert resolver.extract_identifier("example.com") is None


def test_extract_identifier_returns_none_for_nested_subdomain():
    resolver = make_resolver()
    assert resolver.extract_identifier("api.hopital-central.fulltang.com") is None


# --- resolve -----------------------------------------------------------------

async def test_resolve_returns_none_for_non_tenant_hostname():
    """CAS 4/5 : pas d'appel réseau, pas d'erreur — la requête continue sans contexte."""
    resolver = make_resolver()
    with patch.object(resolver._client, "get", new=AsyncMock()) as mocked_get:
        context = await resolver.resolve("localhost:8080")

    assert context is None
    mocked_get.assert_not_awaited()


async def test_resolve_active_tenant():
    """
    CAS A (spec Phase 2.2) : hopital-central.fulltang.com, tenant existant,
    ACTIVE → résolution réussie et TenantContext complet (id, identifier, status).
    """
    resolver = make_resolver()
    mock_response = httpx.Response(
        200,
        json={"id": "57d9d34f-0000-0000-0000-000000000001", "identifier": "hopital-central", "status": "ACTIVE"},
    )
    with patch.object(resolver._client, "get", new=AsyncMock(return_value=mock_response)) as mocked_get:
        context = await resolver.resolve("hopital-central.fulltang.com")

    assert context == TenantContext(
        tenant_id="57d9d34f-0000-0000-0000-000000000001",
        tenant_identifier="hopital-central",
        status="ACTIVE",
    )
    mocked_get.assert_awaited_once()
    assert mocked_get.call_args.kwargs["params"] == {"identifier": "hopital-central"}


def test_tenant_context_exposes_id_identifier_and_status():
    """Le TenantContext doit représenter clairement id / identifier / status (Phase 2.2)."""
    context = TenantContext(tenant_id="uuid-1", tenant_identifier="hopital-central", status="ACTIVE")
    assert context.tenant_id == "uuid-1"
    assert context.tenant_identifier == "hopital-central"
    assert context.status == "ACTIVE"


# --- Authentification interne Gateway → Tenant Service -----------------------

async def test_resolve_sends_internal_service_token_header():
    """La Gateway doit toujours prouver son identité via le jeton interne (credentials valides → OK)."""
    resolver = make_resolver(internal_service_token=INTERNAL_TOKEN)
    mock_response = httpx.Response(
        200, json={"id": "x", "identifier": "hopital-central", "status": "ACTIVE"}
    )
    with patch.object(resolver._client, "get", new=AsyncMock(return_value=mock_response)) as mocked_get:
        await resolver.resolve("hopital-central.fulltang.com")

    sent_headers = mocked_get.call_args.kwargs["headers"]
    assert sent_headers[INTERNAL_SERVICE_TOKEN_HEADER] == INTERNAL_TOKEN


async def test_resolve_raises_resolution_error_when_tenant_service_rejects_missing_credentials():
    """Appel direct sans credentials côté Tenant Service → 401/403, propagé comme erreur de résolution."""
    resolver = make_resolver()
    mock_response = httpx.Response(401, json={"detail": "Jeton de service interne manquant ou invalide."})
    with patch.object(resolver._client, "get", new=AsyncMock(return_value=mock_response)):
        with pytest.raises(TenantResolutionError):
            await resolver.resolve("hopital-central.fulltang.com")


async def test_resolve_raises_resolution_error_when_tenant_service_rejects_wrong_credentials():
    """Mauvais jeton côté Tenant Service → 403, propagé comme erreur de résolution (pas un cas métier)."""
    resolver = make_resolver(internal_service_token="wrong-token")
    mock_response = httpx.Response(403, json={"detail": "Jeton de service interne manquant ou invalide."})
    with patch.object(resolver._client, "get", new=AsyncMock(return_value=mock_response)):
        with pytest.raises(TenantResolutionError):
            await resolver.resolve("hopital-central.fulltang.com")


async def test_resolve_second_tenant_resolves_independently():
    """Deux hostnames différents résolvent vers deux tenants différents (pas de cache/liste en dur)."""
    resolver = make_resolver()
    mock_response = httpx.Response(
        200,
        json={"id": "57d9d34f-0000-0000-0000-000000000002", "identifier": "clinique-paix", "status": "ACTIVE"},
    )
    with patch.object(resolver._client, "get", new=AsyncMock(return_value=mock_response)):
        context = await resolver.resolve("clinique-paix.fulltang.com")

    assert context.tenant_identifier == "clinique-paix"


async def test_resolve_unknown_tenant_raises_not_found():
    """CAS 2 : hostname valide mais tenant inexistant."""
    resolver = make_resolver()
    mock_response = httpx.Response(404)
    with patch.object(resolver._client, "get", new=AsyncMock(return_value=mock_response)):
        with pytest.raises(TenantNotFoundError):
            await resolver.resolve("clinique-inconnue.fulltang.com")


async def test_resolve_unknown_subdomain_raises_not_found():
    """CAS B (spec Phase 2.2) : unknown.fulltang.com → tenant inexistant, sans appel métier."""
    resolver = make_resolver()
    mock_response = httpx.Response(404)
    with patch.object(resolver._client, "get", new=AsyncMock(return_value=mock_response)):
        with pytest.raises(TenantNotFoundError) as exc_info:
            await resolver.resolve("unknown.fulltang.com")

    assert exc_info.value.tenant_identifier == "unknown"


async def test_resolve_inactive_tenant_raises_inactive_error():
    """CAS 3 / CAS C (spec Phase 2.2) : tenant existant mais status = INACTIVE → accès refusé."""
    resolver = make_resolver()
    mock_response = httpx.Response(
        200,
        json={"id": "57d9d34f-0000-0000-0000-000000000003", "identifier": "clinique-fermee", "status": "INACTIVE"},
    )
    with patch.object(resolver._client, "get", new=AsyncMock(return_value=mock_response)):
        with pytest.raises(TenantInactiveError):
            await resolver.resolve("clinique-fermee.fulltang.com")


async def test_resolve_invalid_host_is_refused_without_calling_tenant_service():
    """CAS D (spec Phase 2.2) : hostname ne correspondant pas au domaine configuré → refusé, aucun appel réseau."""
    resolver = make_resolver()
    with patch.object(resolver._client, "get", new=AsyncMock()) as mocked_get:
        context = await resolver.resolve("not-a-fulltang-domain.example.org")

    assert context is None
    mocked_get.assert_not_awaited()


async def test_resolve_raises_resolution_error_when_tenant_service_unreachable():
    resolver = make_resolver()
    with patch.object(resolver._client, "get", new=AsyncMock(side_effect=httpx.ConnectError("boom"))):
        with pytest.raises(TenantResolutionError):
            await resolver.resolve("hopital-central.fulltang.com")


async def test_resolve_uses_tenant_service_as_source_of_truth():
    """La résolution passe TOUJOURS par un appel réseau au Tenant Service — jamais de liste en dur."""
    resolver = make_resolver()
    mock_get = AsyncMock(
        return_value=httpx.Response(
            200, json={"id": "x", "identifier": "hopital-central", "status": "ACTIVE"}
        )
    )
    with patch.object(resolver._client, "get", new=mock_get):
        await resolver.resolve("hopital-central.fulltang.com")

    mock_get.assert_awaited_once()
    called_url = mock_get.call_args.args[0]
    assert called_url == f"{TENANT_SERVICE_URL}/api/tenants/resolve/"
