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
from typing import Optional, Tuple
from uuid import UUID

from django.db import IntegrityError, transaction
from django.db.models import QuerySet

from .models import PlatformService, Tenant, TenantDatabase, TenantDatabaseStatus, TenantStatus


class TenantRepository:
    """Encapsule les opérations de lecture/écriture sur le modèle Tenant."""

    def create(self, *, name: str, identifier: str, allow_clinical_agent_export: Optional[bool] = None) -> Tenant:
        """
        Persiste un nouveau tenant avec le statut par défaut (ACTIVE).

        `allow_clinical_agent_export` est optionnel : si non fourni, le
        défaut du modèle (`True`) s'applique — un appelant qui ne connaît
        pas encore ce champ (scripts existants, tests plus anciens)
        continue de fonctionner sans modification.
        """
        kwargs = {'name': name, 'identifier': identifier}
        if allow_clinical_agent_export is not None:
            kwargs['allow_clinical_agent_export'] = allow_clinical_agent_export
        return Tenant.objects.create(**kwargs)

    def update_allow_clinical_agent_export(self, tenant_id: UUID, value: bool) -> Tenant:
        """Met à jour uniquement l'autorisation d'export clinical-agent."""
        tenant = self.get_by_id(tenant_id)
        tenant.allow_clinical_agent_export = value
        tenant.save(update_fields=['allow_clinical_agent_export'])
        return tenant

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

    # --- Phase 7 : Tenant Provisioning ---------------------------------
    #
    # Les méthodes ci-dessous existent uniquement pour le provisioning
    # automatisé (voir provisioning.py). Elles s'appuient sur deux
    # mécanismes PostgreSQL natifs plutôt que sur un verrou applicatif :
    #   1. La contrainte d'unicité (tenant, service) déjà présente sur ce
    #      modèle (Meta.constraints) — deux créations concurrentes pour
    #      le même couple : une seule réussit, l'autre lève IntegrityError.
    #   2. Une mise à jour conditionnelle atomique (`UPDATE ... WHERE
    #      status IN (...)`, via QuerySet.update()) pour "réclamer" le
    #      droit de lancer le provisioning physique — équivalent à un
    #      verrou "compare-and-swap" porté par PostgreSQL lui-même, donc
    #      valide même avec plusieurs instances de tenant-service (à la
    #      différence du threading.Lock() local-process de la Phase 6).

    def get_or_create_declarative(
        self, *, tenant_id: UUID, service_code: str, database_name: str,
        host: str, port: int, secret_reference: str,
    ) -> Tuple[TenantDatabase, bool]:
        """
        Retourne la configuration existante pour (tenant, service), ou en
        crée une nouvelle en PENDING si elle n'existe pas encore.

        Idempotent par construction : si deux appels concurrents tentent
        tous deux la création, la contrainte d'unicité fait échouer l'un
        des deux avec IntegrityError — on rattrape ce cas précis et on
        relit la ligne créée par l'autre appel, plutôt que de laisser
        l'erreur remonter (un appel de provisioning répété ne doit
        jamais être une erreur, voir §7 de la tâche).
        """
        try:
            with transaction.atomic():
                instance = TenantDatabase.objects.create(
                    tenant_id=tenant_id,
                    service_id=service_code,
                    database_name=database_name,
                    host=host,
                    port=port,
                    secret_reference=secret_reference,
                )
            return instance, True
        except IntegrityError:
            existing = self.get_for_tenant_and_service(tenant_id, service_code)
            if existing is None:
                # Ne peut arriver que dans une fenêtre de course extrêmement
                # étroite (suppression concomitante) — ne jamais deviner,
                # on relaisse l'appelant réessayer explicitement.
                raise
            return existing, False

    def claim_for_provisioning(self, tenant_database_id: UUID) -> bool:
        """
        Tente de faire passer la configuration de PENDING/FAILED à
        PROVISIONING de façon atomique.

        Retourne True si CET appel a "gagné" le droit de lancer le
        provisioning physique, False si un autre appel (concurrent, ou
        un état déjà ACTIVE) a la main — l'appelant ne doit alors
        déclencher AUCUNE action physique, seulement rapporter l'état
        courant (voir provisioning.py).
        """
        updated_count = TenantDatabase.objects.filter(
            id=tenant_database_id,
            status__in=[TenantDatabaseStatus.PENDING, TenantDatabaseStatus.FAILED],
        ).update(status=TenantDatabaseStatus.PROVISIONING, last_error='')
        return updated_count == 1

    def mark_active(self, tenant_database_id: UUID) -> TenantDatabase:
        """Provisioning physique réussi : PROVISIONING → ACTIVE, erreur effacée."""
        return self.update_fields(
            tenant_database_id, status=TenantDatabaseStatus.ACTIVE, last_error='',
        )

    def mark_failed(self, tenant_database_id: UUID, error: str) -> TenantDatabase:
        """Provisioning physique en échec : PROVISIONING → FAILED, avec un résumé de la cause."""
        return self.update_fields(
            tenant_database_id, status=TenantDatabaseStatus.FAILED, last_error=error[:500],
        )
