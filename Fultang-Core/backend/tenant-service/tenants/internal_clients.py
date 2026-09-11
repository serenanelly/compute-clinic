"""
internal_clients.py — Appels HTTP internes tenant-service → services métier.

Regroupe le mécanisme d'appel service-to-service déjà utilisé par
`provisioning.py` (`_call_physical_provisioning`, Phase 7) pour que le
Cycle de vie du tenant (Phase 2) puisse l'appeler une seconde fois — vers
un endpoint interne différent (création du premier compte administrateur)
— sans dupliquer la logique HTTP bas niveau (urllib, jeton interne,
gestion d'erreurs).

Aucun nouveau protocole : même jeton partagé
(`TENANT_SERVICE_INTERNAL_TOKEN`), même bibliothèque (`urllib`, stdlib),
même sémantique d'erreur (HTTP/réseau → une exception unique que
l'appelant traduit en échec explicite de sa propre étape, jamais un faux
succès).
"""
import json
import logging
import urllib.error
import urllib.request
from typing import Optional

from django.conf import settings

logger = logging.getLogger("tenants.internal_clients")


class InternalServiceCallError(Exception):
    """Erreur générique d'appel à un service interne (HTTP ou réseau)."""


def call_internal_service(base_url: str, path: str, payload: dict, timeout: Optional[int] = None) -> dict:
    """
    POST `payload` (JSON) vers `{base_url}/{path}`, authentifié par le
    jeton de service interne partagé.

    Lève InternalServiceCallError sur toute erreur HTTP ou réseau —
    jamais de valeur de repli devinée.
    """
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "X-Internal-Service-Token": settings.TENANT_SERVICE_INTERNAL_TOKEN,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout or settings.PROVISIONING_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        logger.error("Appel interne %s a échoué : HTTP %s", url, exc.code)
        raise InternalServiceCallError(f"{path} a répondu {exc.code} : {body[:300]}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        logger.error("Appel interne %s injoignable : %s", url, exc)
        raise InternalServiceCallError(f"{path} injoignable : {exc}") from exc


class AdminProvisioningError(Exception):
    """La création du compte administrateur initial a échoué côté service-personnel."""


def create_first_admin(tenant_id, *, nom: str, prenom: str, email: str) -> dict:
    """
    Appelle POST /api/internal/create-first-admin/ sur service-personnel
    (Cycle de vie du tenant, Phase 2) pour créer le compte administrateur
    initial d'un tenant dont la base PERSONNEL est déjà ACTIVE.

    Retourne le JSON du service ({id, email, temporary_password}). Lève
    AdminProvisioningError sur tout échec — jamais un compte "à moitié"
    créé qu'on prétendrait fonctionnel.
    """
    base_url = f"{settings.PROVISIONING_SERVICE_PERSONNEL_URL.rstrip('/')}/api"
    try:
        return call_internal_service(
            base_url, "internal/create-first-admin/",
            {"tenant_id": str(tenant_id), "nom": nom, "prenom": prenom, "email": email},
        )
    except InternalServiceCallError as exc:
        raise AdminProvisioningError(str(exc)) from exc
