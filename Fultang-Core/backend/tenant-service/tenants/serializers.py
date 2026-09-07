from rest_framework import serializers

from .models import PlatformService, Tenant, TenantDatabase, TenantDatabaseStatus, TenantStatus


class TenantSerializer(serializers.ModelSerializer):
    """Représentation d'un tenant pour la lecture et la création.

    `id`, `status` et `created_at` sont en lecture seule à la création :
    le statut initial d'un tenant est toujours ACTIVE et son id est généré
    par le registre. `allow_clinical_agent_export` est acceptée en
    écriture à la création (optionnelle, défaut `True` porté par le
    modèle) mais sa modification ultérieure passe par
    `TenantUpdateSerializer` (PATCH /tenants/{id}/), pas par ce
    serializer — cohérent avec `status`, qui a lui aussi son action
    dédiée plutôt qu'une mise à jour générale libre.
    """

    class Meta:
        model = Tenant
        fields = ['id', 'name', 'identifier', 'status', 'allow_clinical_agent_export', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']


class TenantUpdateSerializer(serializers.ModelSerializer):
    """
    Payload attendu par PATCH/PUT /tenants/{id}/.

    N'expose QUE `allow_clinical_agent_export` — même principe que
    `TenantDatabaseUpdateSerializer` (Phase 5) : `name`/`identifier`
    restent volontairement absents (un identifier ne doit pas changer une
    fois attribué, voir docstring du modèle) et `status` reste réservé à
    l'action dédiée `PATCH /tenants/{id}/status/`.
    """

    class Meta:
        model = Tenant
        fields = ['allow_clinical_agent_export']


class TenantStatusUpdateSerializer(serializers.Serializer):
    """Payload attendu par PATCH /tenants/{tenant_id}/status."""

    status = serializers.ChoiceField(choices=TenantStatus.choices)


class TenantProvisionRequestSerializer(serializers.Serializer):
    """
    Payload attendu par POST /tenants/{id}/provision/ (Phase 7).

    `services` est une liste de codes (ex: ["PERSONNEL", "INFRASTRUCTURE"])
    — pas obligatoirement tout le catalogue plateforme : un tenant peut
    n'activer qu'un sous-ensemble de services (voir §4 de la tâche).
    Chaque code est vérifié contre le catalogue PlatformService par
    `ProvisioningOrchestrator`, pas ici (ce serializer ne fait que la
    validation de forme : une liste non vide de chaînes).
    """

    services = serializers.ListField(
        child=serializers.CharField(max_length=50),
        allow_empty=False,
    )


class TenantResolutionSerializer(serializers.ModelSerializer):
    """
    Réponse de GET /tenants/resolve/ — utilisée par la Tenant Resolution
    (Phase 2.1, appelante : la Gateway) et par toute résolution interne
    par UUID (Phase Medical-Monitoring tenant-aware, appelante :
    clinical-agent — voir `?id=`).

    Expose le minimum nécessaire à un appelant interne de confiance
    (protégé par IsInternalService) pour construire un Tenant Context et
    appliquer les règles qui en dépendent : jamais `name`, jamais un champ
    de configuration métier complexe (Phase 9). `allow_clinical_agent_export`
    reste un champ de PLATEFORME (au même titre que `status`), pas une
    configuration métier — c'est pour cela qu'il est exposé ici, exactement
    comme `status` l'était déjà.
    """

    class Meta:
        model = Tenant
        fields = ['id', 'identifier', 'status', 'allow_clinical_agent_export']


class PlatformServiceSerializer(serializers.ModelSerializer):
    """Représentation d'un service du catalogue plateforme.

    `code` est la clé technique (PK) : fourni à la création, jamais
    modifiable ensuite (pas de mise à jour supportée sur ce catalogue —
    seuls la création et la consultation sont exposées pour l'instant).
    """

    class Meta:
        model = PlatformService
        fields = ['code', 'name', 'status', 'created_at']
        read_only_fields = ['status', 'created_at']


class TenantDatabaseSerializer(serializers.ModelSerializer):
    """
    Représentation d'une association Tenant + Service → Database.

    `secret_reference` est une référence opaque (jamais un credential) —
    elle peut donc être exposée en lecture sans risque : aucun champ de
    ce modèle ne porte de mot de passe. `status` est en lecture seule
    ici : les changements de statut passent par l'action dédiée
    PATCH .../status/ (cohérent avec TenantSerializer). `tenant` et
    `service` acceptent respectivement l'UUID du tenant et le code du
    service (PrimaryKeyRelatedField) — un code de service inexistant
    dans le catalogue est automatiquement rejeté (400).
    """

    class Meta:
        model = TenantDatabase
        fields = [
            'id', 'tenant', 'service', 'database_name', 'host', 'port',
            'status', 'secret_reference', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']
        validators = [
            serializers.UniqueTogetherValidator(
                queryset=TenantDatabase.objects.all(),
                fields=['tenant', 'service'],
                message="Une configuration existe déjà pour ce tenant et ce service.",
            ),
        ]


class TenantDatabaseUpdateSerializer(serializers.ModelSerializer):
    """
    Payload attendu par PATCH/PUT /tenant-databases/{id}/.

    N'expose QUE les champs d'infrastructure modifiables. `tenant` et
    `service` sont volontairement absents : réassigner un tenant ou un
    service reviendrait à créer une toute nouvelle association logique,
    pas à corriger une configuration existante — ce n'est pas une
    "modification" au sens de cette API. Un client qui inclut ces clés
    dans le payload voit sa tentative sans aucun effet (champs inconnus
    du serializer, ignorés par DRF), jamais appliquée.
    """

    class Meta:
        model = TenantDatabase
        fields = ['database_name', 'host', 'port', 'secret_reference']


class TenantDatabaseStatusUpdateSerializer(serializers.Serializer):
    """Payload attendu par PATCH /tenant-databases/{id}/status/."""

    status = serializers.ChoiceField(choices=TenantDatabaseStatus.choices)


class TenantDatabaseResolutionSerializer(serializers.ModelSerializer):
    """
    Réponse de GET /tenant-databases/resolve/ — utilisée par le Dynamic
    Database Router de chaque microservice (Phase 6), réservé à la
    communication interne (IsInternalService).

    Expose volontairement le strict minimum nécessaire pour ouvrir une
    connexion (database_name, host, port, status) — jamais
    `secret_reference` (les credentials réels ne transitent pas par ce
    canal dans cette phase, voir MULTITENANT_ARCHITECTURE.md) ni `id`/
    `tenant`/`service`, non nécessaires à l'appelant.
    """

    class Meta:
        model = TenantDatabase
        fields = ['database_name', 'host', 'port', 'status']
