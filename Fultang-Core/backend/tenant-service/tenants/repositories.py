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

from .models import Tenant, TenantStatus


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
