"""
tests/test_login_tenant_context.py — Authentification tenant-aware.

Vérifie le flux complet Login → JWT (tenant_id) → Gateway (comparaison
tenant demandé vs tenant du token) en simulant le Tenant Service et le
Service Personnel au niveau du client httpx partagé par la Gateway.
"""
import base64
import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app, client, limiter

TENANT_A_ID = "11111111-1111-1111-1111-111111111111"
TENANT_B_ID = "22222222-2222-2222-2222-222222222222"
TENANT_INACTIVE_ID = "33333333-3333-3333-3333-333333333333"

TENANTS = {
    "hopital-central": {"id": TENANT_A_ID, "identifier": "hopital-central", "status": "ACTIVE"},
    "clinique-paix": {"id": TENANT_B_ID, "identifier": "clinique-paix", "status": "ACTIVE"},
    "clinique-fermee": {"id": TENANT_INACTIVE_ID, "identifier": "clinique-fermee", "status": "INACTIVE"},
}

USER = {
    "id": "99999999-9999-9999-9999-999999999999",
    "email": "user@fultang.local",
    "roles": ["Medecin"],
    "nom": "Dupont",
    "prenom": "Jean",
}

test_client = TestClient(app)


@pytest.fixture(autouse=True)
def _reset_login_rate_limit():
    """POST /auth/login est limité à 5/minute — évite les faux 429 entre tests."""
    limiter.reset()
    yield


def _decode(token: str) -> dict:
    payload_b64 = token.split(".")[1]
    payload_b64 += "=" * (-len(payload_b64) % 4)
    return json.loads(base64.urlsafe_b64decode(payload_b64))


async def _fake_tenant_resolve_get(url, params=None, headers=None, **kwargs):
    identifier = (params or {}).get("identifier")
    tenant = TENANTS.get(identifier)
    if tenant is None:
        return httpx.Response(404)
    return httpx.Response(200, json=tenant)


async def _fake_verify_post_success(url, json=None, **kwargs):
    assert "tenant_id" in json  # la Gateway doit toujours transmettre tenant_id (même None)
    return httpx.Response(200, json={**USER, "tenant_id": json.get("tenant_id")})


async def _fake_verify_post_invalid_credentials(url, json=None, **kwargs):
    return httpx.Response(401, json={"detail": "Identifiants invalides"})


async def _fake_downstream_request(method, target_url, **kwargs):
    """Simule la réponse du microservice cible (jamais vraiment appelé si 403 avant)."""
    return httpx.Response(200, json={"ok": True})


def test_login_success_includes_tenant_context_in_access_token():
    """1 & 2 : login réussi pour un utilisateur du Tenant A ; le token porte le bon tenant_id."""
    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "post", new=AsyncMock(side_effect=_fake_verify_post_success)):
        response = test_client.post(
            "/auth/login",
            json={"email": "user@fultang.local", "password": "secret"},
            headers={"Host": "hopital-central.fulltang.com"},
        )

    assert response.status_code == 200
    payload = _decode(response.json()["access_token"])
    assert payload["tenant_id"] == TENANT_A_ID
    assert payload["sub"] == USER["id"]


def test_login_on_unknown_subdomain_is_refused_without_calling_personnel_service():
    """Tenant inexistant → erreur appropriée, sans appel au Service Personnel."""
    verify_mock = AsyncMock(side_effect=_fake_verify_post_success)
    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "post", new=verify_mock):
        response = test_client.post(
            "/auth/login",
            json={"email": "user@fultang.local", "password": "secret"},
            headers={"Host": "unknown.fulltang.com"},
        )

    assert response.status_code == 404
    verify_mock.assert_not_awaited()


def test_login_on_inactive_tenant_is_refused():
    """Tenant INACTIVE → accès refusé."""
    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "post", new=AsyncMock(side_effect=_fake_verify_post_success)):
        response = test_client.post(
            "/auth/login",
            json={"email": "user@fultang.local", "password": "secret"},
            headers={"Host": "clinique-fermee.fulltang.com"},
        )

    assert response.status_code == 403


def test_login_fails_for_nonexistent_user_in_tenant():
    """Utilisateur inexistant dans le tenant demandé → authentification refusée."""
    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "post", new=AsyncMock(side_effect=_fake_verify_post_invalid_credentials)):
        response = test_client.post(
            "/auth/login",
            json={"email": "nobody@fultang.local", "password": "secret"},
            headers={"Host": "hopital-central.fulltang.com"},
        )

    assert response.status_code == 401


def test_login_without_resolved_tenant_still_works_with_null_tenant_id():
    """CAS D / dev local : hostname hors convention → tenant_id=None transmis, login inchangé."""
    verify_mock = AsyncMock(side_effect=_fake_verify_post_success)
    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "post", new=verify_mock):
        response = test_client.post(
            "/auth/login",
            json={"email": "user@fultang.local", "password": "secret"},
            headers={"Host": "localhost:8080"},
        )

    assert response.status_code == 200
    payload = _decode(response.json()["access_token"])
    assert payload["tenant_id"] is None
    sent_json = verify_mock.call_args.kwargs["json"]
    assert sent_json["tenant_id"] is None


def _login(hostname: str) -> str:
    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "post", new=AsyncMock(side_effect=_fake_verify_post_success)):
        response = test_client.post(
            "/auth/login",
            json={"email": "user@fultang.local", "password": "secret"},
            headers={"Host": hostname},
        )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_request_with_matching_tenant_token_is_authorized():
    """3 : requête vers Tenant A avec le token Tenant A → autorisée (pas de 403)."""
    token = _login("hopital-central.fulltang.com")

    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "request", new=AsyncMock(side_effect=_fake_downstream_request)):
        response = test_client.get(
            "/personnel/medecins/",
            headers={"Host": "hopital-central.fulltang.com", "Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200


def test_request_with_mismatched_tenant_token_is_forbidden():
    """4 : requête vers Tenant B avec le token Tenant A → 403."""
    token = _login("hopital-central.fulltang.com")

    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "request", new=AsyncMock(side_effect=_fake_downstream_request)) as downstream_mock:
        response = test_client.get(
            "/personnel/medecins/",
            headers={"Host": "clinique-paix.fulltang.com", "Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 403
    downstream_mock.assert_not_awaited()  # jamais transmis au microservice métier


def test_invalid_token_is_not_treated_as_tenant_mismatch():
    """7 : token invalide/expiré → comportement actuel conservé (pas de 403 lié au tenant)."""
    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "request", new=AsyncMock(side_effect=_fake_downstream_request)):
        response = test_client.get(
            "/personnel/medecins/",
            headers={"Host": "hopital-central.fulltang.com", "Authorization": "Bearer not-a-real-token"},
        )

    # Pas de 403 "tenant mismatch" ici : la requête continue (le 401 éventuel
    # vient de l'authentification du microservice en aval, hors du périmètre
    # de ce test qui simule une réponse 200).
    assert response.status_code != 403


def test_request_without_resolved_tenant_skips_mismatch_check():
    """localhost (CAS D) : aucun tenant demandé → pas de comparaison possible, comportement inchangé."""
    token = _login("hopital-central.fulltang.com")

    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "request", new=AsyncMock(side_effect=_fake_downstream_request)):
        response = test_client.get(
            "/personnel/medecins/",
            headers={"Host": "localhost:8080", "Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200


def test_refresh_token_preserves_tenant_context():
    """8 : refresh token → nouveau access token conservant le bon contexte tenant."""
    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "post", new=AsyncMock(side_effect=_fake_verify_post_success)):
        login_response = test_client.post(
            "/auth/login",
            json={"email": "user@fultang.local", "password": "secret"},
            headers={"Host": "hopital-central.fulltang.com"},
        )
    refresh_token = login_response.json()["refresh_token"]

    refresh_response = test_client.post("/auth/refresh", json={"refresh_token": refresh_token})

    assert refresh_response.status_code == 200
    new_payload = _decode(refresh_response.json()["access_token"])
    assert new_payload["tenant_id"] == TENANT_A_ID
