"""
repositories.py — Accès aux données du Tenant Registry.

Le TenantRepository est le seul point du code autorisé à parler
directement à l'ORM pour le modèle Tenant. Il est responsable de la
traduction entre le TenantService et Django : requêtes, filtres,
persistance.

Ce qu'il ne doit PAS faire :
  - appliquer des règles métier (ex: décider si un identifier est
    "valide" au sens métier, déclencher des effets de bord comme la
    création d'une base tenant) → cela appartient à TenantService et,
    plus tard, aux services de Provisioning (Phase 7) ;
  - exposer des détails HTTP (status codes, erreurs DRF) → cela
    appartient à la couche API (views.py).

Utilisé par : TenantService (Phase 1).
Sera réutilisé tel quel par les phases futures qui ont besoin d'un accès
bas niveau aux tenants sans passer par l'API HTTP (ex: Dynamic Database
Routing en Phase 6, Tenant Provisioning en Phase 7).
"""
from typing import Optional
from uuid import UUID

from django.db.models import QuerySet

from .models import PlatformService, Tenant, TenantDatabase, TenantDatabaseStatus, TenantStatus


class TenantRepository:
    """Encapsule les opérations de lecture/écriture sur le modèle Tenant."""

    def create(self, *, name: str, identifier: str) -> Tenant:
        """Persiste un nouveau tenant avec le statut par défaut (ACTIVE)."""
        return Tenant.objects.create(name=name, identifier=identifier)

    def get_by_id(self, tenant_id: UUID) -> Tenant:
        """Retourne le tenant correspondant à `tenant_id`.

        Lève Tenant.DoesNotExist si aucun tenant ne correspond.
        """
        return Tenant.objects.get(id=tenant_id)

    def get_by_identifier(self, identifier: str) -> Optional[Tenant]:
        """Retourne le tenant correspondant à `identifier`, ou None."""
        return Tenant.objects.filter(identifier=identifier).first()

    def list(self, *, status: Optional[str] = None) -> QuerySet[Tenant]:
        """Retourne les tenants du registre, filtrés par statut si fourni."""
        queryset = Tenant.objects.all()
        if status is not None:
            queryset = queryset.filter(status=status)
        return queryset

    def update_status(self, tenant_id: UUID, status: TenantStatus) -> Tenant:
        """Met à jour le statut d'un tenant et retourne l'instance à jour."""
        tenant = self.get_by_id(tenant_id)
        tenant.status = status
        tenant.save(update_fields=['status'])
        return tenant


class PlatformServiceRepository:
    """Encapsule les opérations de lecture/écriture sur le catalogue PlatformService."""

    def create(self, *, code: str, name: str) -> PlatformService:
        """Enregistre un nouveau service dans le catalogue plateforme."""
        return PlatformService.objects.create(code=code, name=name)

    def get_by_code(self, code: str) -> PlatformService:
        """Retourne le service correspondant à `code`.

        Lève PlatformService.DoesNotExist si aucun service ne correspond.
        """
        return PlatformService.objects.get(code=code)

    def list(self, *, status: Optional[str] = None) -> QuerySet[PlatformService]:
        """Retourne les services du catalogue, filtrés par statut si fourni."""
        queryset = PlatformService.objects.all()
        if status is not None:
            queryset = queryset.filter(status=status)
        return queryset


class TenantDatabaseRepository:
    """
    Encapsule les opérations de lecture/écriture sur les associations
    Tenant + Service → Database (TenantDatabase).

    Sera réutilisé tel quel par le futur Dynamic Database Routing
    (Phase 6), qui a besoin d'un accès bas niveau — via
    `get_for_tenant_and_service` — sans passer par l'API HTTP.
    """

    def create(
        self, *, tenant_id: UUID, service_code: str, database_name: str,
        host: str, port: int, secret_reference: str,
    ) -> TenantDatabase:
        """Persiste une nouvelle configuration (statut par défaut : PENDING)."""
        return TenantDatabase.objects.create(
            tenant_id=tenant_id,
            service_id=service_code,
            database_name=database_name,
            host=host,
            port=port,
            secret_reference=secret_reference,
        )

    def get_by_id(self, tenant_database_id: UUID) -> TenantDatabase:
        """Retourne la configuration correspondant à `tenant_database_id`.

        Lève TenantDatabase.DoesNotExist si aucune configuration ne correspond.
        """
        return TenantDatabase.objects.select_related('tenant', 'service').get(id=tenant_database_id)

    def get_for_tenant_and_service(self, tenant_id: UUID, service_code: str) -> Optional[TenantDatabase]:
        """Retourne la configuration d'un tenant pour un service donné, ou None."""
        return TenantDatabase.objects.filter(tenant_id=tenant_id, service_id=service_code).first()

    def list(
        self, *, tenant_id: Optional[UUID] = None,
        service_code: Optional[str] = None, status: Optional[str] = None,
    ) -> QuerySet[TenantDatabase]:
        """Liste les configurations, filtrées par tenant/service/statut si fournis."""
        queryset = TenantDatabase.objects.select_related('tenant', 'service').all()
        if tenant_id is not None:
            queryset = queryset.filter(tenant_id=tenant_id)
        if service_code is not None:
            queryset = queryset.filter(service_id=service_code)
        if status is not None:
            queryset = queryset.filter(status=status)
        return queryset

    def update_fields(self, tenant_database_id: UUID, **fields) -> TenantDatabase:
        """Met à jour un sous-ensemble de champs et retourne l'instance à jour."""
        instance = self.get_by_id(tenant_database_id)
        for field, value in fields.items():
            setattr(instance, field, value)
        instance.save(update_fields=[*fields.keys(), 'updated_at'])
        return instance

    def update_status(self, tenant_database_id: UUID, status: TenantDatabaseStatus) -> TenantDatabase:
        """Met à jour uniquement le statut logique d'une configuration."""
        return self.update_fields(tenant_database_id, status=status)
