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
    params = params or {}
    if "id" in params:
        # Résolution PAR ID (Cycle de vie du tenant, Phase 3 — vérification
        # de suspension hors convention hostname) : voir get_tenant_status().
        tenant = next((t for t in TENANTS.values() if t["id"] == params["id"]), None)
    else:
        tenant = TENANTS.get(params.get("identifier"))
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
    """
    localhost (CAS D) : aucun tenant demandé par hostname → pas de comparaison
    de mismatch possible. La requête reste néanmoins autorisée ici car le
    tenant porté par le token (Tenant A) est bien vérifié ACTIVE par la
    résolution PAR ID (Cycle de vie du tenant, Phase 3) — voir la classe
    de tests dédiée ci-dessous pour le cas symétrique (tenant suspendu).
    """
    token = _login("hopital-central.fulltang.com")

    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "request", new=AsyncMock(side_effect=_fake_downstream_request)):
        response = test_client.get(
            "/personnel/medecins/",
            headers={"Host": "localhost:8080", "Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200


# --- Suspension effective (Cycle de vie du tenant, Phase 3) -----------------
#
# AVANT ce correctif : un JWT émis avant la suspension d'un tenant restait
# valide indéfiniment dès lors que l'appelant utilisait un hostname hors
# convention (localhost en développement) — la résolution par hostname ne
# se déclenchait jamais, donc `TenantInactiveError` n'était jamais levée.
# Ces tests couvrent le correctif : le statut du tenant PORTÉ PAR LE TOKEN
# est désormais revérifié, même quand le hostname ne permet aucune
# résolution.

def test_already_issued_token_is_blocked_after_tenant_suspended_via_offconvention_hostname():
    """Le scénario central de cette phase : suspension après coup, JWT déjà émis, hostname localhost."""
    token = _login("hopital-central.fulltang.com")

    # Le tenant est suspendu ENTRE l'émission du token et cette requête.
    TENANTS["hopital-central"]["status"] = "INACTIVE"
    try:
        with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
             patch.object(client, "request", new=AsyncMock(side_effect=_fake_downstream_request)) as downstream_mock:
            response = test_client.get(
                "/personnel/medecins/",
                headers={"Host": "localhost:8080", "Authorization": f"Bearer {token}"},
            )
    finally:
        TENANTS["hopital-central"]["status"] = "ACTIVE"  # jamais laisser fuiter cet état vers un autre test

    assert response.status_code == 403
    assert response.json()["detail"]["error_type"] == "TENANT_SUSPENDED"
    downstream_mock.assert_not_awaited()  # jamais transmis au microservice métier


def test_suspending_tenant_a_never_affects_tenant_b_via_offconvention_hostname():
    """Isolation stricte : la suspension du Tenant A ne doit jamais affecter le Tenant B."""
    token_b = _login("clinique-paix.fulltang.com")

    TENANTS["hopital-central"]["status"] = "INACTIVE"
    try:
        with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
             patch.object(client, "request", new=AsyncMock(side_effect=_fake_downstream_request)):
            response = test_client.get(
                "/personnel/medecins/",
                headers={"Host": "localhost:8080", "Authorization": f"Bearer {token_b}"},
            )
    finally:
        TENANTS["hopital-central"]["status"] = "ACTIVE"

    assert response.status_code == 200


def test_request_without_any_token_is_unaffected_by_suspension_check():
    """Requête anonyme (pas de Bearer token) : aucun tenant_id à vérifier, comportement inchangé."""
    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "request", new=AsyncMock(side_effect=_fake_downstream_request)):
        response = test_client.get(
            "/personnel/medecins/",
            headers={"Host": "localhost:8080"},
        )

    assert response.status_code == 200


def test_platform_admin_token_is_unaffected_by_suspension_check():
    """
    Un PLATFORM_ADMIN n'a jamais de tenant_id dans son JWT (voir
    app.main::PlatformAdminAuthVerifyView docstring — "n'a et n'aura
    jamais de tenant_id") — le nouveau contrôle de suspension ne doit
    jamais se déclencher pour lui, quel que soit le hostname utilisé.
    """
    from app.auth.jwt_handler import create_access_token

    platform_admin_token = create_access_token(data={
        "sub": "platform-admin-id", "tenant_id": None, "roles": ["PLATFORM_ADMIN"], "email": "admin@platform.example",
    })

    get_mock = AsyncMock(side_effect=_fake_tenant_resolve_get)
    with patch.object(client, "get", new=get_mock), \
         patch.object(client, "request", new=AsyncMock(side_effect=_fake_downstream_request)):
        response = test_client.get(
            "/tenants/tenants/",
            headers={"Host": "localhost:8080", "Authorization": f"Bearer {platform_admin_token}"},
        )

    assert response.status_code == 200
    # Aucun appel de résolution PAR ID n'a dû être tenté (tenant_id absent) —
    # seul un appel `params={"identifier": ...}` serait légitime ici, et le
    # hostname "localhost:8080" ne le déclenche même pas.
    for call in get_mock.await_args_list:
        assert "id" not in (call.kwargs.get("params") or {})


def test_tenant_service_unreachable_for_status_check_returns_503_not_silent_allow():
    """Fail-closed : jamais un accès silencieusement autorisé si le Tenant Service est injoignable."""
    token = _login("hopital-central.fulltang.com")

    async def _unreachable(url, params=None, headers=None, **kwargs):
        if "id" in (params or {}):
            raise httpx.ConnectError("boom")
        return await _fake_tenant_resolve_get(url, params=params, headers=headers, **kwargs)

    with patch.object(client, "get", new=AsyncMock(side_effect=_unreachable)), \
         patch.object(client, "request", new=AsyncMock(side_effect=_fake_downstream_request)) as downstream_mock:
        response = test_client.get(
            "/personnel/medecins/",
            headers={"Host": "localhost:8080", "Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 503
    downstream_mock.assert_not_awaited()


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
