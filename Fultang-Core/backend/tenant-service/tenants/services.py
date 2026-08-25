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

from .models import Tenant, TenantStatus
from .repositories import TenantRepository


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
