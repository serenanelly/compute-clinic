"""
services.py — Opérations métier du Tenant Registry.

TenantService est la porte d'entrée applicative pour gérer les tenants.
C'est la "source de vérité" citée dans la roadmap : toute création,
lecture ou modification de tenant, qu'elle vienne de l'API HTTP
(views.py) ou d'un futur appel interne (Phase 6, 7...), doit passer par
ce service plutôt que par le TenantRepository directement.

Ce dont ce composant est responsable :
  - gérer le cycle de vie des métadonnées d'un tenant (création,
    consultation, activation/désactivation).

Ce qu'il ne doit PAS faire (couvert par des phases ultérieures) :
  - résoudre le tenant courant à partir d'une requête HTTP (Phase 2) ;
  - émettre ou valider un JWT contenant un tenant_id (Phase 3) ;
  - propager un contexte tenant à travers l'application (Phase 4) ;
  - créer/gérer la base de données dédiée du tenant (Phase 5, 7) ;
  - router une requête vers la bonne base tenant (Phase 6) ;
  - migrer des données existantes vers un tenant (Phase 8) ;
  - gérer l'activation des services fonctionnels par tenant (Tenant
    Configuration — voir `TenantFunctionalServiceService` ci-dessous,
    volontairement séparé de `TenantService` : l'identité d'un tenant et
    sa configuration métier restent deux responsabilités distinctes).
"""
from typing import Iterable, Optional, Tuple
from uuid import UUID

from django.db.models import QuerySet

from .models import (
    AdminActionLog,
    FunctionalService,
    PlatformService,
    Tenant,
    TenantDatabase,
    TenantDatabaseStatus,
    TenantFunctionalService,
    TenantStatus,
)
from .repositories import (
    AdminActionLogRepository,
    FunctionalServiceRepository,
    PlatformServiceRepository,
    TenantDatabaseRepository,
    TenantFunctionalServiceRepository,
    TenantRepository,
)


class TenantService:
    """Fournit les opérations métier de gestion des tenants."""

    def __init__(self, repository: Optional[TenantRepository] = None):
        self._repository = repository or TenantRepository()

    def create_tenant(
        self, *, name: str, identifier: str, allow_clinical_agent_export: Optional[bool] = None,
        **profile_fields,
    ) -> Tenant:
        """Enregistre un nouvel établissement dans le Tenant Registry."""
        return self._repository.create(
            name=name, identifier=identifier,
            allow_clinical_agent_export=allow_clinical_agent_export,
            **profile_fields,
        )

    def get_tenant(self, tenant_id: UUID) -> Tenant:
        """Retourne un tenant par son identifiant technique (UUID)."""
        return self._repository.get_by_id(tenant_id)

    def set_clinical_agent_export_authorization(self, tenant_id: UUID, value: bool) -> Tenant:
        """Active/désactive l'autorisation d'export clinical-agent pour ce tenant."""
        return self._repository.update_allow_clinical_agent_export(tenant_id, value)

    def update_profile(self, tenant_id: UUID, **profile_fields) -> Tenant:
        """Met à jour les champs de profil descriptifs (address/phone/email/logo_url)."""
        return self._repository.update_profile(tenant_id, **profile_fields)

    def get_tenant_by_identifier(self, identifier: str) -> Optional[Tenant]:
        """Retourne un tenant par son identifiant métier stable, ou None."""
        return self._repository.get_by_identifier(identifier)

    def list_tenants(self, *, status: Optional[str] = None) -> QuerySet[Tenant]:
        """Liste les tenants du registre, éventuellement filtrés par statut."""
        return self._repository.list(status=status)

    def activate_tenant(self, tenant_id: UUID) -> Tenant:
        """Passe un tenant au statut ACTIVE."""
        return self._repository.update_status(tenant_id, TenantStatus.ACTIVE)

    def deactivate_tenant(self, tenant_id: UUID) -> Tenant:
        """Passe un tenant au statut INACTIVE."""
        return self._repository.update_status(tenant_id, TenantStatus.INACTIVE)

    def set_logo(self, tenant_id: UUID, uploaded_file) -> Tenant:
        """Remplace le logo uploadé d'un tenant (Cycle de vie du tenant, Phase 2)."""
        return self._repository.set_logo(tenant_id, uploaded_file)

    def remove_logo(self, tenant_id: UUID) -> Tenant:
        """Supprime le logo uploadé d'un tenant."""
        return self._repository.remove_logo(tenant_id)


class PlatformServiceCatalog:
    """
    Fournit les opérations métier sur le catalogue des services de la
    plateforme (PlatformService).

    Responsable uniquement de la gestion du catalogue lui-même (quels
    services EXISTENT). Ne décide jamais quels services sont activés
    pour un tenant (Phase 9 : Tenant Configuration).
    """

    def __init__(self, repository: Optional[PlatformServiceRepository] = None):
        self._repository = repository or PlatformServiceRepository()

    def register_service(self, *, code: str, name: str) -> PlatformService:
        """Ajoute un nouveau service au catalogue plateforme."""
        return self._repository.create(code=code, name=name)

    def get_service(self, code: str) -> PlatformService:
        """Retourne un service du catalogue par son code technique."""
        return self._repository.get_by_code(code)

    def list_services(self, *, status: Optional[str] = None) -> QuerySet[PlatformService]:
        """Liste les services du catalogue, éventuellement filtrés par statut."""
        return self._repository.list(status=status)


class TenantDatabaseService:
    """
    Fournit les opérations métier sur les associations Tenant + Service
    → Database (modèle "Database per Tenant per Service").

    Ce dont ce composant est responsable :
      - gérer le cycle de vie de la CONFIGURATION LOGIQUE (déclarer,
        consulter, modifier, désactiver quelle base un tenant utilise
        pour un service donné).

    Ce qu'il ne doit PAS faire (couvert par des phases ultérieures) :
      - créer ou supprimer une base PostgreSQL physique (Phase 7 :
        Tenant Provisioning) ;
      - router une requête vers cette base (Phase 6 : Dynamic Database
        Routing) ;
      - décider si un service est activé pour un tenant (Phase 9 :
        Tenant Configuration) ;
      - résoudre les credentials réels depuis `secret_reference` (futur
        Secret Manager, non implémenté à ce stade).
    """

    def __init__(self, repository: Optional[TenantDatabaseRepository] = None):
        self._repository = repository or TenantDatabaseRepository()

    def create_tenant_database(
        self, *, tenant_id: UUID, service_code: str, database_name: str,
        host: str, port: int, secret_reference: str,
    ) -> TenantDatabase:
        """Déclare une nouvelle configuration Tenant + Service → Database."""
        return self._repository.create(
            tenant_id=tenant_id, service_code=service_code,
            database_name=database_name, host=host, port=port,
            secret_reference=secret_reference,
        )

    def get_tenant_database(self, tenant_database_id: UUID) -> TenantDatabase:
        """Retourne une configuration par son identifiant technique."""
        return self._repository.get_by_id(tenant_database_id)

    def get_for_tenant_and_service(self, tenant_id: UUID, service_code: str) -> Optional[TenantDatabase]:
        """Retourne la configuration d'un tenant pour un service, ou None."""
        return self._repository.get_for_tenant_and_service(tenant_id, service_code)

    def list_tenant_databases(
        self, *, tenant_id: Optional[UUID] = None,
        service_code: Optional[str] = None, status: Optional[str] = None,
    ) -> QuerySet[TenantDatabase]:
        """Liste les configurations, éventuellement filtrées par tenant/service/statut."""
        return self._repository.list(tenant_id=tenant_id, service_code=service_code, status=status)

    def update_tenant_database(self, tenant_database_id: UUID, **fields) -> TenantDatabase:
        """Met à jour les champs d'infrastructure d'une configuration existante."""
        return self._repository.update_fields(tenant_database_id, **fields)

    def set_status(self, tenant_database_id: UUID, status: TenantDatabaseStatus) -> TenantDatabase:
        """Change le statut logique d'une configuration (aucune action physique)."""
        return self._repository.update_status(tenant_database_id, status)


class UnknownFunctionalServiceError(Exception):
    """Un code de service fonctionnel demandé n'existe pas dans le catalogue."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(f"Service fonctionnel inconnu du catalogue : {code}.")


# Services fonctionnels qui ne sont PAS désactivables : de l'administration
# du tenant, pas des fonctionnalités optionnelles (finalisation de la
# désactivation effective, exigence explicite). Un tenant sans aucun
# service désactivable ne peut plus jamais perdre l'accès à la gestion de
# son propre personnel — jamais un simple filtre frontend, la règle vit
# ici, au même endroit que la validation du catalogue, pour s'appliquer
# à TOUT appelant (`set_service` et `bulk_set`, donc PATCH comme wizard
# de création).
NON_DISABLEABLE_FUNCTIONAL_SERVICES = frozenset({"GESTION_PERSONNEL"})


class ImmutableFunctionalServiceError(Exception):
    """Tentative de désactiver un service fonctionnel qui ne doit jamais l'être."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(f"Le service fonctionnel {code} ne peut pas être désactivé.")


class TenantFunctionalServiceService:
    """
    Fournit les opérations métier de la Tenant Configuration — catégorie
    "Services" : quels services fonctionnels du catalogue FullTang
    (`FunctionalService`) sont activés pour un tenant donné.

    Première catégorie de configuration d'établissement implémentée ;
    conçue pour que d'autres catégories (workflows, formulaires, etc.)
    s'ajoutent plus tard comme des services frères de celui-ci, sans
    modifier `TenantService` ni ce module au-delà d'un nouvel ajout.

    Ne gère JAMAIS la création de nouveaux services fonctionnels (c'est le
    rôle du catalogue, seedé par migration dans cette phase) — uniquement
    l'activation/désactivation PAR TENANT d'un service déjà existant.
    """

    def __init__(
        self,
        catalog_repository: Optional[FunctionalServiceRepository] = None,
        config_repository: Optional[TenantFunctionalServiceRepository] = None,
    ):
        self._catalog = catalog_repository or FunctionalServiceRepository()
        self._configs = config_repository or TenantFunctionalServiceRepository()

    def list_catalog(self, *, status: Optional[str] = None) -> QuerySet[FunctionalService]:
        """Liste le catalogue des services fonctionnels (voir `FunctionalServiceRepository.list`)."""
        return self._catalog.list(status=status)

    def list_for_tenant(self, tenant_id: UUID) -> list:
        """
        Retourne l'état (activé/désactivé) de CHAQUE service du catalogue
        pour ce tenant — fusionne le catalogue complet avec la
        configuration existante du tenant, un service sans ligne explicite
        étant considéré ACTIVÉ PAR DÉFAUT (voir `TenantFunctionalService.__doc__`).

        Retourne une liste de dicts prêts à sérialiser (pas un QuerySet
        ORM) car il s'agit déjà d'une fusion en mémoire, pas d'une
        requête unique.
        """
        configured = {
            config.service_id: config.enabled
            for config in self._configs.list_for_tenant(tenant_id)
        }
        return [
            {
                'code': service.code,
                'name': service.name,
                'display_order': service.display_order,
                'enabled': configured.get(service.code, True),
            }
            for service in self._catalog.list(status='ACTIVE')
        ]

    def set_service(self, tenant_id: UUID, service_code: str, enabled: bool) -> TenantFunctionalService:
        """Active/désactive UN service fonctionnel pour un tenant.

        Lève UnknownFunctionalServiceError si `service_code` n'existe pas
        dans le catalogue — jamais de création silencieuse d'une
        configuration pour un service qui n'existe pas.

        Lève ImmutableFunctionalServiceError si l'appelant tente de
        DÉSACTIVER un service listé dans NON_DISABLEABLE_FUNCTIONAL_SERVICES
        (ex: GESTION_PERSONNEL) — l'activer explicitement (déjà son état
        par défaut) reste un no-op accepté, seule la désactivation est
        refusée.
        """
        if not enabled and service_code in NON_DISABLEABLE_FUNCTIONAL_SERVICES:
            raise ImmutableFunctionalServiceError(service_code)
        try:
            self._catalog.get_by_code(service_code)
        except FunctionalService.DoesNotExist as exc:
            raise UnknownFunctionalServiceError(service_code) from exc
        return self._configs.upsert(tenant_id, service_code, enabled)

    def bulk_set(self, tenant_id: UUID, service_enabled_pairs: Iterable[Tuple[str, bool]]) -> None:
        """
        Active/désactive PLUSIEURS services fonctionnels pour un tenant en
        un seul appel — utilisé par l'Étape 3 du wizard de création.

        Valide TOUS les codes contre le catalogue AVANT d'écrire quoi que
        ce soit (même principe que `ProvisioningOrchestrator.provision` :
        une demande partiellement invalide ne doit jamais laisser un état
        partiellement appliqué) : lève UnknownFunctionalServiceError sur
        le premier code inconnu rencontré, sans avoir touché la base.
        """
        pairs = list(service_enabled_pairs)
        known_codes = set(self._catalog.list().values_list('code', flat=True))
        for code, enabled in pairs:
            if code not in known_codes:
                raise UnknownFunctionalServiceError(code)
            if not enabled and code in NON_DISABLEABLE_FUNCTIONAL_SERVICES:
                raise ImmutableFunctionalServiceError(code)
        self._configs.bulk_upsert(tenant_id, pairs)


class AdminActionLogService:
    """
    Fournit les opérations métier du journal d'administration (Logs —
    cycle de vie complet du tenant, Phase 2).

    `record(...)` est volontairement appelé explicitement depuis chaque
    vue mutante de `TenantViewSet` plutôt que via un signal Django ou un
    middleware générique : chaque action porte un contexte métier propre
    (quel service a été activé, quel champ a changé...) qu'un mécanisme
    implicite ne pourrait reconstituer proprement — un seul point d'appel
    par action mutante, jamais dupliqué, reste plus simple à lire et à
    étendre qu'une abstraction générique prématurée.
    """

    def __init__(self, repository: Optional[AdminActionLogRepository] = None):
        self._repository = repository or AdminActionLogRepository()

    def record(
        self, *, actor, action: str, tenant: Optional[Tenant] = None,
        description: str = '', metadata: Optional[dict] = None,
    ) -> AdminActionLog:
        """
        Journalise une action administrative.

        `actor` est l'utilisateur Gateway courant (`request.user`,
        `GatewayUser` — voir config/authentication.py) : seuls `.id` et
        `.email` (si présents) sont extraits, jamais l'objet complet.
        """
        return self._repository.create(
            action=action,
            actor_id=str(getattr(actor, 'id', '') or ''),
            actor_email=getattr(actor, 'email', '') or '',
            target_tenant_id=tenant.id if tenant is not None else None,
            target_tenant_identifier=tenant.identifier if tenant is not None else '',
            description=description,
            metadata=metadata or {},
        )

    def list_logs(
        self, *, tenant_id: Optional[UUID] = None, actor: Optional[str] = None,
        action: Optional[str] = None, date_from=None, date_to=None,
    ) -> QuerySet[AdminActionLog]:
        return self._repository.list(
            tenant_id=tenant_id, actor=actor, action=action, date_from=date_from, date_to=date_to,
        )
