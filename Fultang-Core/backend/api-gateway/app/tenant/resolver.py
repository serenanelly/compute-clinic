"""
tenant/resolver.py — Résolution Hostname → Tenant (Phase 2.1).

Le hostname d'une requête (ex: `hopital-central.fulltang.com`) encode
l'identifiant technique du tenant demandé. Ce module traduit ce hostname
en un TenantContext en interrogeant le Tenant Service — la Gateway ne
maintient JAMAIS de liste de tenants en dur : elle n'est qu'un point
d'entrée pour la résolution, le Tenant Service reste la source de vérité.

Pourquoi `identifier` != `name` : `identifier` est l'identifiant technique
stable qui compose l'URL (sous-domaine) et sert de clé de résolution ;
`name` est un libellé métier affiché, qui peut changer librement sans
jamais casser une URL ni une intégration existante.

IMPORTANT — ce que ce module NE fait PAS :
Le hostname indique uniquement "quel tenant est visé", jamais "qui a le
droit d'y accéder". Le TenantContext produit ici n'est donc en aucun cas
une preuve d'autorisation utilisateur — la vérification User → Tenant est
une phase ultérieure (2.2), tout comme la propagation de ce contexte aux
microservices métier.

Authentification service-to-service : le Tenant Service ne fait plus
confiance à quiconque appelle GET /tenants/resolve/. Le TenantResolver
prouve son identité de Gateway via un jeton partagé transmis dans le
header X-Internal-Service-Token (voir TENANT_SERVICE_INTERNAL_TOKEN dans
app.config) — vérifié côté Tenant Service par IsInternalService.
"""
from dataclasses import dataclass
from typing import Optional

import httpx

INTERNAL_SERVICE_TOKEN_HEADER = "X-Internal-Service-Token"


@dataclass(frozen=True)
class TenantContext:
    """
    Résultat d'une résolution hostname → tenant réussie.

    Ne représente que l'identification du tenant demandé (id, identifier,
    status) — jamais une preuve d'autorisation utilisateur. `status` est
    toujours "ACTIVE" ici (un tenant INACTIVE lève TenantInactiveError
    avant la construction du contexte) ; il est inclus explicitement pour
    que ce contexte reste une représentation complète et autoportante du
    tenant résolu, exploitable par les phases suivantes sans qu'elles
    aient à relire cette hypothèse dans le code du resolver.
    """
    tenant_id: str
    tenant_identifier: str
    status: str


class TenantResolutionError(Exception):
    """Base des erreurs de résolution tenant (ex: Tenant Service injoignable)."""


class TenantNotFoundError(TenantResolutionError):
    """Aucun tenant ne correspond à l'identifier extrait du hostname (CAS 2)."""

    def __init__(self, tenant_identifier: str):
        self.tenant_identifier = tenant_identifier
        super().__init__(f"Aucun tenant ne correspond à l'identifier '{tenant_identifier}'.")


class TenantInactiveError(TenantResolutionError):
    """Le tenant existe mais n'est pas ACTIVE (CAS 3)."""

    def __init__(self, tenant_identifier: str):
        self.tenant_identifier = tenant_identifier
        super().__init__(f"Le tenant '{tenant_identifier}' est inactif.")


class TenantResolver:
    """Résout un hostname de requête vers un TenantContext via le Tenant Service."""

    def __init__(
        self,
        http_client: httpx.AsyncClient,
        tenant_service_url: str,
        root_domain: str,
        internal_service_token: str,
    ):
        self._client = http_client
        self._tenant_service_url = tenant_service_url.rstrip("/")
        self._root_domain = root_domain.lower()
        self._internal_service_token = internal_service_token

    def extract_identifier(self, hostname: str) -> Optional[str]:
        """
        `<identifier>.<root_domain>` → `identifier`.

        Retourne None si le hostname ne suit pas la convention de
        sous-domaine tenant (CAS 4/5 : localhost, IP de dev, domaine tiers,
        sous-domaine imbriqué, ou root_domain seul) — dans ce cas l'appelant
        doit traiter la requête comme "hors contexte tenant", pas comme une
        erreur.
        """
        host = hostname.split(":")[0].lower()  # on ignore un éventuel port
        suffix = f".{self._root_domain}"

        if not host.endswith(suffix):
            return None

        identifier = host[: -len(suffix)]
        if not identifier or "." in identifier:
            return None  # sous-domaine vide ou multi-niveaux : hors convention

        return identifier

    async def resolve(self, hostname: str) -> Optional[TenantContext]:
        """
        Résout un hostname vers son TenantContext.

        Retourne None si le hostname est hors convention de tenant (CAS 4/5)
        — la requête doit alors continuer sans contexte tenant, comme avant
        la Phase 2.1 (ex: localhost en développement).

        Lève TenantNotFoundError (CAS 2), TenantInactiveError (CAS 3) ou
        TenantResolutionError sinon (Tenant Service injoignable, ou jeton
        interne rejeté par IsInternalService — 401/403 imprévus ici :
        c'est un problème de configuration, pas un cas métier).
        """
        identifier = self.extract_identifier(hostname)
        if identifier is None:
            return None

        try:
            response = await self._client.get(
                f"{self._tenant_service_url}/api/tenants/resolve/",
                params={"identifier": identifier},
                headers={INTERNAL_SERVICE_TOKEN_HEADER: self._internal_service_token},
            )
        except httpx.RequestError as exc:
            raise TenantResolutionError(f"Tenant Service injoignable : {exc}") from exc

        if response.status_code == 404:
            raise TenantNotFoundError(identifier)
        if response.status_code != 200:
            raise TenantResolutionError(
                f"Réponse inattendue du Tenant Service ({response.status_code})."
            )

        data = response.json()
        if data.get("status") != "ACTIVE":
            raise TenantInactiveError(identifier)

        return TenantContext(tenant_id=data["id"], tenant_identifier=data["identifier"], status=data["status"])
