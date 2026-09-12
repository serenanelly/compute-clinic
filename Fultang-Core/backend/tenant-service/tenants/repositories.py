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
from typing import Iterable, Optional, Tuple
from uuid import UUID

from django.db import IntegrityError, transaction
from django.db.models import Q, QuerySet

from .models import (
    AdminActionLog,
    FunctionalService,
    PlatformService,
    Tenant,
    TenantDatabase,
    TenantDatabaseStatus,
    TenantDeletionRecord,
    TenantDeletionStatus,
    TenantFunctionalService,
    TenantStatus,
)

# Champs de profil facultatifs — voir Tenant.Meta et serializers.py::TENANT_PROFILE_FIELDS.
_TENANT_PROFILE_FIELDS = ('address', 'phone', 'email', 'logo_url')


class TenantRepository:
    """Encapsule les opérations de lecture/écriture sur le modèle Tenant."""

    def create(
        self, *, name: str, identifier: str,
        allow_clinical_agent_export: Optional[bool] = None,
        **profile_fields,
    ) -> Tenant:
        """
        Persiste un nouveau tenant avec le statut par défaut (ACTIVE).

        `allow_clinical_agent_export` est optionnel : si non fourni, le
        défaut du modèle (`True`) s'applique — un appelant qui ne connaît
        pas encore ce champ (scripts existants, tests plus anciens)
        continue de fonctionner sans modification. `profile_fields` ne
        retient que les clés reconnues (`address`/`phone`/`email`/
        `logo_url`) — toute autre clé est silencieusement ignorée plutôt
        que de lever une erreur, pour rester tolérant à un appelant qui
        passerait un dict plus large (ex: `serializer.validated_data`).
        """
        kwargs = {'name': name, 'identifier': identifier}
        if allow_clinical_agent_export is not None:
            kwargs['allow_clinical_agent_export'] = allow_clinical_agent_export
        for field in _TENANT_PROFILE_FIELDS:
            if field in profile_fields and profile_fields[field] is not None:
                kwargs[field] = profile_fields[field]
        return Tenant.objects.create(**kwargs)

    def update_allow_clinical_agent_export(self, tenant_id: UUID, value: bool) -> Tenant:
        """Met à jour uniquement l'autorisation d'export clinical-agent."""
        tenant = self.get_by_id(tenant_id)
        tenant.allow_clinical_agent_export = value
        tenant.save(update_fields=['allow_clinical_agent_export'])
        return tenant

    def update_profile(self, tenant_id: UUID, **profile_fields) -> Tenant:
        """Met à jour un sous-ensemble des champs de profil descriptifs."""
        tenant = self.get_by_id(tenant_id)
        updated = []
        for field in _TENANT_PROFILE_FIELDS:
            if field in profile_fields:
                setattr(tenant, field, profile_fields[field])
                updated.append(field)
        if updated:
            tenant.save(update_fields=updated)
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

    def set_logo(self, tenant_id: UUID, uploaded_file) -> Tenant:
        """Remplace le logo uploadé d'un tenant (écrase l'ancien fichier s'il existe)."""
        tenant = self.get_by_id(tenant_id)
        if tenant.logo:
            tenant.logo.delete(save=False)
        tenant.logo = uploaded_file
        tenant.save(update_fields=['logo'])
        return tenant

    def remove_logo(self, tenant_id: UUID) -> Tenant:
        """Supprime le logo uploadé d'un tenant (le fichier disque est effacé)."""
        tenant = self.get_by_id(tenant_id)
        if tenant.logo:
            tenant.logo.delete(save=False)
        tenant.logo = None
        tenant.save(update_fields=['logo'])
        return tenant

    def delete(self, tenant_id: UUID) -> None:
        """
        Supprime DÉFINITIVEMENT la ligne Tenant du registre opérationnel
        (Suppression définitive — jamais un changement de `status`, voir
        `TenantDeletionService`). CASCADE déjà configuré au niveau modèle
        supprime `TenantDatabase`/`TenantFunctionalService` associés.

        N'APPELER QU'APRÈS que `TenantDeletionService` a terminé
        l'archivage validé ET la suppression physique des ressources —
        jamais avant (voir son docstring pour l'ordre exact et pourquoi).

        Le fichier logo, s'il existe, est effacé du disque (même geste
        que `remove_logo` — Django ne supprime jamais un fichier
        FileField automatiquement à la suppression de la ligne).
        """
        tenant = self.get_by_id(tenant_id)
        if tenant.logo:
            tenant.logo.delete(save=False)
        tenant.delete()


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


class FunctionalServiceRepository:
    """
    Encapsule les opérations de lecture sur le catalogue FunctionalService
    (Tenant Configuration — voir modèle pour la distinction avec
    `PlatformService`).

    Aucune écriture exposée dans cette phase : le catalogue est seedé par
    migration (`0009_seed_functional_services.py`), pas géré via l'API —
    l'ajouter viendrait avec la future gestion complète du catalogue,
    hors périmètre ici.
    """

    def list(self, *, status: Optional[str] = None) -> QuerySet[FunctionalService]:
        """Retourne le catalogue, ordonné par `display_order`, filtré par statut si fourni."""
        queryset = FunctionalService.objects.all()
        if status is not None:
            queryset = queryset.filter(status=status)
        return queryset

    def get_by_code(self, code: str) -> FunctionalService:
        """Retourne le service correspondant à `code`.

        Lève FunctionalService.DoesNotExist si aucun service ne correspond.
        """
        return FunctionalService.objects.get(code=code)


class TenantFunctionalServiceRepository:
    """
    Encapsule les opérations de lecture/écriture sur la configuration par
    tenant des services fonctionnels (`TenantFunctionalService`).

    Ne réimplémente aucune logique de catalogue : `FunctionalServiceRepository`
    reste l'unique source de vérité sur les services qui EXISTENT ; celui-ci
    ne gère que l'activation/désactivation PAR TENANT.
    """

    def list_for_tenant(self, tenant_id: UUID) -> QuerySet[TenantFunctionalService]:
        """
        Retourne les lignes de configuration EXISTANTES pour ce tenant
        (peut être un sous-ensemble du catalogue complet — voir
        `TenantFunctionalService.__doc__` pour la sémantique de l'absence
        de ligne : "activé par défaut", gérée par la couche service, pas
        ici).
        """
        return TenantFunctionalService.objects.filter(tenant_id=tenant_id).select_related('service')

    def upsert(self, tenant_id: UUID, service_code: str, enabled: bool) -> TenantFunctionalService:
        """Crée ou met à jour la configuration d'UN service pour UN tenant."""
        instance, created = TenantFunctionalService.objects.update_or_create(
            tenant_id=tenant_id, service_id=service_code,
            defaults={'enabled': enabled},
        )
        return instance

    def bulk_upsert(self, tenant_id: UUID, service_enabled_pairs: Iterable[Tuple[str, bool]]) -> None:
        """
        Crée ou met à jour la configuration de PLUSIEURS services pour UN
        tenant en une seule opération logique.

        Utilisé par le wizard de création de tenant (Étape 3 — Services) :
        chaque paire est traitée par `upsert`, qui gère déjà l'idempotence
        (`update_or_create`) — pas de transaction explicite ici, un échec
        partiel laisserait certaines lignes déjà à jour et d'autres non,
        ce qui reste un état cohérent et re-jouable (rappeler ce même
        endpoint corrige les lignes manquantes, jamais un état incohérent
        au sens métier).
        """
        for service_code, enabled in service_enabled_pairs:
            self.upsert(tenant_id, service_code, enabled)


class AdminActionLogRepository:
    """
    Encapsule les opérations de lecture/écriture du journal
    d'administration (Logs — cycle de vie complet du tenant, Phase 2).
    """

    def create(
        self, *, action: str, actor_id: str = '', actor_email: str = '',
        target_tenant_id: Optional[UUID] = None, target_tenant_identifier: str = '',
        description: str = '', metadata: Optional[dict] = None,
    ) -> AdminActionLog:
        return AdminActionLog.objects.create(
            action=action,
            actor_id=actor_id or '',
            actor_email=actor_email or '',
            target_tenant_id=target_tenant_id,
            target_tenant_identifier=target_tenant_identifier or '',
            description=description,
            metadata=metadata or {},
        )

    def list(
        self, *, tenant_id: Optional[UUID] = None, actor: Optional[str] = None,
        action: Optional[str] = None, date_from=None, date_to=None,
    ) -> QuerySet[AdminActionLog]:
        """Liste le journal, filtré par tenant/acteur/type d'action/période si fournis.

        `actor` filtre par correspondance partielle sur l'id OU l'email de
        l'acteur (un PLATFORM_ADMIN se souvient rarement d'un UUID exact).
        """
        queryset = AdminActionLog.objects.all()
        if tenant_id is not None:
            queryset = queryset.filter(target_tenant_id=tenant_id)
        if actor:
            queryset = queryset.filter(
                Q(actor_email__icontains=actor) | Q(actor_id__icontains=actor)
            )
        if action:
            queryset = queryset.filter(action=action)
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            # `__date__lte` compare la PARTIE DATE de created_at (convertie
            # dans le fuseau courant par Django) à date_to — inclut donc
            # naturellement toute la journée de date_to, sans avoir besoin
            # de calculer une borne "lendemain minuit" à la main. Avant ce
            # correctif, `created_at__lte=date_to` comparait un datetime à
            # une simple chaîne de date (minuit UTC) : tout événement du
            # jour choisi lui-même — pas seulement les jours suivants —
            # était exclu, ce qui pouvait facilement ressembler à "le
            # filtre ne renvoie rien" pour l'utilisateur.
            queryset = queryset.filter(created_at__date__lte=date_to)
        return queryset


class TenantDeletionRecordRepository:
    """
    Encapsule les opérations de lecture/écriture de
    `TenantDeletionRecord` (Suppression définitive — voir son docstring
    de modèle pour le choix de ne jamais lier ce modèle à `Tenant` par
    ForeignKey).
    """

    def create(
        self, *, tenant_id: UUID, tenant_identifier: str, tenant_name: str,
        initiated_by_id: str = '', initiated_by_email: str = '',
        retention_policy: str = '',
    ) -> TenantDeletionRecord:
        return TenantDeletionRecord.objects.create(
            tenant_id=tenant_id,
            tenant_identifier=tenant_identifier,
            tenant_name=tenant_name,
            initiated_by_id=initiated_by_id or '',
            initiated_by_email=initiated_by_email or '',
            retention_policy=retention_policy or '',
        )

    def get(self, record_id: UUID) -> TenantDeletionRecord:
        return TenantDeletionRecord.objects.get(id=record_id)

    def has_active_deletion(self, tenant_id: UUID) -> bool:
        """
        True si une suppression est déjà en cours pour ce tenant (statut
        PENDING/ARCHIVING/ARCHIVED/CLEANING) — exclusion mutuelle : deux
        suppressions concurrentes du même tenant ne doivent jamais
        s'entrelacer (§11 de la tâche).
        """
        active_statuses = [
            TenantDeletionStatus.PENDING, TenantDeletionStatus.ARCHIVING,
            TenantDeletionStatus.ARCHIVED, TenantDeletionStatus.CLEANING,
        ]
        return TenantDeletionRecord.objects.filter(tenant_id=tenant_id, status__in=active_statuses).exists()

    def update_status(
        self, record_id: UUID, status: str, *, error_message: Optional[str] = None,
        archive_reference: Optional[str] = None, archive_version: Optional[str] = None,
        completed: bool = False,
    ) -> TenantDeletionRecord:
        record = self.get(record_id)
        record.status = status
        if error_message is not None:
            record.error_message = error_message
        if archive_reference is not None:
            record.archive_reference = archive_reference
        if archive_version is not None:
            record.archive_version = archive_version
        if completed:
            from django.utils import timezone
            record.completed_at = timezone.now()
        record.save()
        return record

    def list(self, *, tenant_id: Optional[UUID] = None) -> QuerySet[TenantDeletionRecord]:
        queryset = TenantDeletionRecord.objects.all()
        if tenant_id is not None:
            queryset = queryset.filter(tenant_id=tenant_id)
        return queryset
