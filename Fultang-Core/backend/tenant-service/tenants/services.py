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
  - gérer une configuration métier par tenant (Phase 9).
"""
from typing import Optional
from uuid import UUID

from django.db.models import QuerySet

from .models import PlatformService, Tenant, TenantDatabase, TenantDatabaseStatus, TenantStatus
from .repositories import PlatformServiceRepository, TenantDatabaseRepository, TenantRepository


class TenantService:
    """Fournit les opérations métier de gestion des tenants."""

    def __init__(self, repository: Optional[TenantRepository] = None):
        self._repository = repository or TenantRepository()

    def create_tenant(self, *, name: str, identifier: str) -> Tenant:
        """Enregistre un nouvel établissement dans le Tenant Registry."""
        return self._repository.create(name=name, identifier=identifier)

    def get_tenant(self, tenant_id: UUID) -> Tenant:
        """Retourne un tenant par son identifiant technique (UUID)."""
        return self._repository.get_by_id(tenant_id)

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
