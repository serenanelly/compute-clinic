"""
provisioning.py — Tenant Provisioning (Phase 7).

Rôle de ce module : automatiser ce qui, jusqu'à la Phase 6, se faisait à
la main (voir MULTITENANT_ARCHITECTURE.md §9.2.9 — script de pilotage
manuel : `CREATE DATABASE`, enregistrement `TenantDatabase`, migration).
Ce module NE remplace RIEN de l'existant :
  - le Tenant Registry (`Tenant`, `TenantService`) reste l'unique source
    de vérité sur les tenants — ce module le CONSULTE, ne le duplique pas ;
  - `TenantDatabase` (Phase 5) reste l'unique association tenant+service
    → base — ce module en gère le CYCLE DE VIE (PENDING → PROVISIONING →
    ACTIVE/FAILED), il n'introduit aucun second modèle d'état ;
  - le Dynamic Database Router (Phase 6, service-personnel) reste
    l'unique lecteur de `TenantDatabase` au moment de router une requête
    — ce module ne route rien, il ne fait que PRODUIRE une configuration
    que le Router de la Phase 6 sait déjà consommer sans modification.

Constat d'inspection (avant d'écrire ce module) : seul `service-personnel`
dispose aujourd'hui d'une infrastructure PostgreSQL "Database per Tenant"
opérationnelle (Phase 6 — `api/tenant_routing/`). Les 3 autres services
adaptés en Phase 4 (Gestion-Infrastructures, ComptaMatiere,
fultang-compta-financiere) possèdent chacun UN SEUL serveur PostgreSQL
dédié à eux-mêmes (voir leurs docker-compose.yml respectifs :
`infrastructure-db`, etc.) — aucun mécanisme de routage dynamique, aucune
capacité à héberger plusieurs bases par tenant. Créer physiquement une
base "par tenant" pour ces services nécessiterait d'abord de leur
donner l'équivalent de la Phase 6, ce qui est explicitement hors
périmètre de cette phase (règle §22 de la tâche : ne pas élargir le
périmètre).

Décision (documentée aussi dans MULTITENANT_ARCHITECTURE.md §Phase 7) :
  - le provisioning AUTOMATISÉ (création physique de base + migration)
    n'est câblé, dans cette phase, que pour les services listés dans
    `PROVISIONING_CAPABLE_SERVICES` (actuellement : PERSONNEL uniquement) ;
  - pour tout autre service demandé, ce module NE CRÉE PAS de ligne
    `TenantDatabase` (il serait malhonnête d'enregistrer une
    configuration PENDING qui ne progressera jamais automatiquement) —
    il renvoie un résultat `SKIPPED` explicite, expliquant pourquoi et
    renvoyant vers l'API Phase 5 existante (`POST /tenant-databases/`)
    si un PLATFORM_ADMIN veut déclarer une configuration manuellement.
"""
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import List, Optional, Union
from uuid import UUID

from django.conf import settings

from .models import PlatformServiceStatus, TenantDatabaseStatus, TenantStatus
from .repositories import PlatformServiceRepository, TenantDatabaseRepository, TenantRepository

logger = logging.getLogger("tenants.provisioning")

# Services pour lesquels ce module sait déclencher un provisioning
# physique réel (création de base + migration). Ajouter un service ici
# suppose qu'il dispose d'un mécanisme équivalent à
# service-personnel/api/tenant_routing (Phase 6) ET d'un endpoint
# interne de provisioning symétrique à
# POST /api/internal/provision-database/ (voir service-personnel/api/views.py).
PROVISIONING_CAPABLE_SERVICES = {
    "PERSONNEL": settings.PROVISIONING_SERVICE_PERSONNEL_URL,
}


class ProvisioningError(Exception):
    """Erreur générique de provisioning — jamais levée directement, voir sous-classes."""


class TenantNotFoundForProvisioningError(ProvisioningError):
    def __init__(self, tenant_id):
        self.tenant_id = tenant_id
        super().__init__(f"Tenant introuvable : {tenant_id}.")


class TenantNotActiveForProvisioningError(ProvisioningError):
    """
    Le tenant existe mais n'est pas ACTIVE.

    Décision (§15 de la tâche) : le provisioning est refusé pour un
    tenant INACTIVE plutôt que silencieusement accepté ou silencieusement
    ignoré — un tenant désactivé ne doit voir aucune nouvelle ressource
    d'infrastructure créée pour lui tant qu'il n'est pas réactivé.
    """
    def __init__(self, tenant_id, current_status):
        self.tenant_id = tenant_id
        self.current_status = current_status
        super().__init__(f"Le tenant {tenant_id} n'est pas ACTIVE (statut={current_status}).")


class UnknownServiceError(ProvisioningError):
    def __init__(self, service_code):
        self.service_code = service_code
        super().__init__(f"Service inconnu du catalogue plateforme : {service_code}.")


class ServiceNotActiveError(ProvisioningError):
    def __init__(self, service_code, current_status):
        self.service_code = service_code
        self.current_status = current_status
        super().__init__(f"Le service {service_code} n'est pas ACTIVE (statut={current_status}).")


class PhysicalProvisioningError(ProvisioningError):
    """La création physique (appel au service propriétaire) a échoué."""


@dataclass(frozen=True)
class ProvisioningResult:
    """Résultat du provisioning pour UN (tenant, service) demandé."""
    service_code: str
    status: str  # une valeur de TenantDatabaseStatus, ou "SKIPPED"
    database_name: Optional[str] = None
    detail: Optional[str] = None


def _deterministic_database_name(tenant_id: UUID, service_code: str) -> str:
    """
    Nom de base déterministe, sûr, sans collision, dérivé UNIQUEMENT d'un
    UUID (typé, jamais un texte libre saisi par un utilisateur) et d'un
    code de service déjà validé contre le catalogue PlatformService.

    Volontairement identique au format déjà utilisé par
    `service-personnel/api/tenant_routing/pool_registry._alias_for()`
    (Phase 6) : `tenant_<uuid_hex_32>_<service_code_minuscule>`. Les deux
    formules sont indépendantes (deux services déployés séparément, pas
    de bibliothèque partagée) mais DOIVENT rester synchronisées — c'est
    un doublon assumé et documenté (voir MULTITENANT_ARCHITECTURE.md
    §Phase 7), pas un oubli. Le service propriétaire (ici
    service-personnel) reste néanmoins la source de vérité finale : il
    recalcule ce nom lui-même côté serveur au lieu de faire confiance à
    une chaîne reçue par le réseau (voir provision-database endpoint).
    """
    return f"tenant_{tenant_id.hex}_{service_code.lower()}"


def _call_physical_provisioning(service_code: str, callback_url: str, tenant_id: UUID) -> dict:
    """
    Appelle l'endpoint interne de provisioning du service propriétaire.

    Même mécanisme que `registry_client.py` côté service-personnel :
    jeton de service interne partagé, `urllib` (stdlib), aucun nouveau
    protocole. Direction symétrique à la Phase 6 (qui appelait
    tenant-service → service métier) : ici, tenant-service appelle LE
    SERVICE MÉTIER, qui est seul à connaître ses propres credentials
    PostgreSQL (TENANT_DB_USER/PASSWORD) — tenant-service ne les
    connaît jamais, cohérent avec `secret_reference` étant une
    référence opaque (Phase 5).
    """
    url = f"{callback_url.rstrip('/')}/api/internal/provision-database/"
    payload = json.dumps({"tenant_id": str(tenant_id)}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={
            "X-Internal-Service-Token": settings.TENANT_SERVICE_INTERNAL_TOKEN,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=settings.PROVISIONING_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        logger.error(
            "Provisioning physique refusé par %s pour tenant_id=%s : HTTP %s",
            service_code, tenant_id, exc.code,
        )
        raise PhysicalProvisioningError(f"{service_code} a répondu {exc.code} : {body[:300]}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        logger.error("Service %s injoignable pour provisioning tenant_id=%s : %s", service_code, tenant_id, exc)
        raise PhysicalProvisioningError(f"{service_code} injoignable : {exc}") from exc


class ProvisioningOrchestrator:
    """
    Point d'entrée unique du provisioning (Phase 7).

    Ne réimplémente aucune logique de résolution de base : il PRODUIT
    des `TenantDatabase`, il ne les LIT jamais pour router quoi que ce
    soit (c'est le rôle du Router, Phase 6, dans chaque service métier).
    """

    def __init__(
        self,
        tenant_repository: Optional[TenantRepository] = None,
        service_repository: Optional[PlatformServiceRepository] = None,
        tenant_database_repository: Optional[TenantDatabaseRepository] = None,
    ):
        self._tenants = tenant_repository or TenantRepository()
        self._services = service_repository or PlatformServiceRepository()
        self._tenant_databases = tenant_database_repository or TenantDatabaseRepository()

    def provision(self, tenant_id: Union[UUID, str], service_codes: List[str]) -> List[ProvisioningResult]:
        """
        Provisionne `service_codes` pour `tenant_id`.

        `tenant_id` accepte un `UUID` ou sa forme chaîne (ex: appel
        programmatique depuis un shell/script, ou un futur appelant hors
        HTTP) — normalisé en `UUID` dès l'entrée : le reste du module
        (notamment `_deterministic_database_name`, qui a besoin de
        `.hex`) peut alors compter sur un type unique, sans le
        revalider à chaque usage interne.

        Deux passes bien distinctes (§10 vs §15 de la tâche) :

        1. VALIDATION AMONT — tenant introuvable/inactif, ou N'IMPORTE
           LEQUEL des services demandés inconnu/inactif dans le
           catalogue plateforme → REFUS de la demande ENTIÈRE (exception
           levée, AUCUNE ligne TenantDatabase touchée). Ce sont des
           erreurs de saisie du PLATFORM_ADMIN, pas des échecs
           d'infrastructure — elles ne doivent jamais laisser un état
           partiel derrière elles.
        2. EXÉCUTION — une fois tous les services validés, chacun est
           provisionné INDÉPENDAMMENT : l'échec physique de l'un
           (ex: base 2 injoignable) n'empêche jamais la tentative des
           autres, et ne lève jamais d'exception — toujours rapporté
           dans la liste de résultats (voir §10 : "échec partiel doit
           rester compréhensible").
        """
        if not isinstance(tenant_id, UUID):
            try:
                tenant_id = UUID(str(tenant_id))
            except ValueError as exc:
                raise TenantNotFoundForProvisioningError(tenant_id) from exc

        try:
            tenant = self._tenants.get_by_id(tenant_id)
        except Exception as exc:  # Tenant.DoesNotExist, non importé ici pour rester découplé de l'ORM
            raise TenantNotFoundForProvisioningError(tenant_id) from exc

        if tenant.status != TenantStatus.ACTIVE:
            raise TenantNotActiveForProvisioningError(tenant_id, tenant.status)

        platform_services = {}
        for service_code in service_codes:
            try:
                platform_service = self._services.get_by_code(service_code)
            except Exception as exc:
                raise UnknownServiceError(service_code) from exc
            if platform_service.status != PlatformServiceStatus.ACTIVE:
                raise ServiceNotActiveError(service_code, platform_service.status)
            platform_services[service_code] = platform_service

        return [self._provision_one(tenant_id, code) for code in service_codes]

    def _provision_one(self, tenant_id: UUID, service_code: str) -> ProvisioningResult:
        # Le service a déjà été validé (existe + ACTIVE) dans provision()
        # ci-dessus — cette méthode ne gère que ce qui peut légitimement
        # varier entre deux services par ailleurs valides : la capacité
        # (ou non) à les provisionner physiquement, et les échecs
        # d'infrastructure lors de la tentative.
        if service_code not in PROVISIONING_CAPABLE_SERVICES:
            return ProvisioningResult(
                service_code=service_code, status="SKIPPED",
                detail=(
                    f"Provisioning physique non automatisé pour {service_code} dans cette phase "
                    "(pas de Dynamic Database Routing équivalent Phase 6 pour ce service). "
                    "Une configuration peut être déclarée manuellement via POST /api/tenant-databases/."
                ),
            )

        database_name = _deterministic_database_name(tenant_id, service_code)
        callback_url = PROVISIONING_CAPABLE_SERVICES[service_code]

        tenant_database, _created = self._tenant_databases.get_or_create_declarative(
            tenant_id=tenant_id,
            service_code=service_code,
            database_name=database_name,
            host="",  # renseigné après le retour du provisioning physique
            port=5432,
            secret_reference=f"shared:{service_code}_DB_USER/{service_code}_DB_PASSWORD",
        )

        if tenant_database.status == TenantDatabaseStatus.ACTIVE:
            # Idempotence (§7) : déjà provisionné, aucune action physique
            # répétée — on rapporte simplement l'état actuel.
            return ProvisioningResult(
                service_code=service_code, status=TenantDatabaseStatus.ACTIVE,
                database_name=tenant_database.database_name, detail="Déjà provisionné (aucune action refaite).",
            )

        won_claim = self._tenant_databases.claim_for_provisioning(tenant_database.id)
        if not won_claim:
            # Soit un autre appel concurrent est déjà en train de
            # provisionner ce (tenant, service), soit il vient tout juste
            # de devenir ACTIVE entre notre lecture et notre tentative de
            # réclamation — dans les deux cas, ne JAMAIS déclencher une
            # deuxième action physique en parallèle (§8 de la tâche).
            current = self._tenant_databases.get_by_id(tenant_database.id)
            return ProvisioningResult(
                service_code=service_code, status=current.status,
                database_name=current.database_name,
                detail="Provisioning déjà en cours ou terminé (aucune action physique déclenchée par cet appel).",
            )

        try:
            physical_result = _call_physical_provisioning(service_code, callback_url, tenant_id)
        except PhysicalProvisioningError as exc:
            self._tenant_databases.mark_failed(tenant_database.id, str(exc))
            return ProvisioningResult(
                service_code=service_code, status=TenantDatabaseStatus.FAILED,
                database_name=tenant_database.database_name, detail=str(exc),
            )

        # Le service propriétaire recalcule et confirme le nom + host/port
        # réellement utilisés — on les persiste tels quels (source de
        # vérité = le service qui a physiquement créé la base).
        self._tenant_databases.update_fields(
            tenant_database.id,
            database_name=physical_result["database_name"],
            host=physical_result["host"],
            port=physical_result["port"],
        )
        self._tenant_databases.mark_active(tenant_database.id)

        return ProvisioningResult(
            service_code=service_code, status=TenantDatabaseStatus.ACTIVE,
            database_name=physical_result["database_name"], detail="Provisionné avec succès.",
        )
