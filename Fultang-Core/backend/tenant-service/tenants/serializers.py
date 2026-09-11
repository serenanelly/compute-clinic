from django.conf import settings
from rest_framework import serializers

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

# Champs d'identité descriptifs, tous facultatifs — voir Tenant.Meta et le
# commentaire du modèle. Centralisé ici pour que TenantSerializer et
# TenantUpdateSerializer restent synchronisés sans dupliquer la liste.
TENANT_PROFILE_FIELDS = ['address', 'phone', 'email', 'logo_url']


class TenantSerializer(serializers.ModelSerializer):
    """Représentation d'un tenant pour la lecture et la création.

    `id`, `status` et `created_at` sont en lecture seule à la création :
    le statut initial d'un tenant est toujours ACTIVE et son id est généré
    par le registre. `allow_clinical_agent_export` et les champs de profil
    (`address`/`phone`/`email`/`logo_url`, tous facultatifs) sont acceptés
    en écriture à la création, mais leur modification ultérieure passe par
    `TenantUpdateSerializer` (PATCH /tenants/{id}/), pas par ce
    serializer — cohérent avec `status`, qui a lui aussi son action
    dédiée plutôt qu'une mise à jour générale libre.
    """

    logo_display_url = serializers.SerializerMethodField()
    establishment_url = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = [
            'id', 'name', 'identifier', 'status', 'allow_clinical_agent_export',
            *TENANT_PROFILE_FIELDS, 'logo_display_url', 'establishment_url', 'created_at',
        ]
        read_only_fields = ['id', 'status', 'created_at', 'logo_display_url', 'establishment_url']

    def get_logo_display_url(self, obj) -> str:
        """
        URL à afficher pour le logo — RELATIVE au préfixe Gateway
        `/tenants/**` (jamais un chemin interne `/api/media/**`, jamais
        une URL absolue construite depuis le Host interne du conteneur,
        qui ne serait pas joignable par le navigateur). Le fichier
        uploadé (`logo`) prime toujours sur l'URL externe manuelle
        (`logo_url`) — voir Tenant.logo.
        """
        if obj.logo:
            return f"/tenants/media/{obj.logo.name}"
        return obj.logo_url or ''

    def get_establishment_url(self, obj) -> str:
        """
        URL réelle de l'établissement (Cycle de vie du tenant, Phase 2) —
        voir TENANT_ESTABLISHMENT_URL_TEMPLATE. Convention de
        développement local documentée (sous-domaine `*.localhost`), pas
        un mécanisme DNS de production.
        """
        return settings.TENANT_ESTABLISHMENT_URL_TEMPLATE.format(identifier=obj.identifier)


class TenantUpdateSerializer(serializers.ModelSerializer):
    """
    Payload attendu par PATCH/PUT /tenants/{id}/.

    Expose `allow_clinical_agent_export` (Phase Medical-Monitoring
    tenant-aware) et les champs de profil descriptifs (Tenant Management —
    Configuration des établissements). `name`/`identifier` restent
    volontairement absents (un identifier ne doit pas changer une fois
    attribué, voir docstring du modèle) et `status` reste réservé à
    l'action dédiée `PATCH /tenants/{id}/status/`.
    """

    class Meta:
        model = Tenant
        fields = ['allow_clinical_agent_export', *TENANT_PROFILE_FIELDS]


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


class FunctionalServiceSerializer(serializers.ModelSerializer):
    """
    Représentation d'un service fonctionnel du catalogue produit (voir
    `FunctionalService` — à ne pas confondre avec `PlatformServiceSerializer`,
    qui représente les microservices techniques).

    Catalogue seedé par migration (voir `0009_seed_functional_services.py`) :
    aucune création via l'API dans cette phase, seule la consultation est
    exposée (`FunctionalServiceViewSet`, lecture seule).
    """

    class Meta:
        model = FunctionalService
        fields = ['code', 'name', 'status', 'display_order', 'created_at']
        read_only_fields = fields


class TenantFunctionalServiceSerializer(serializers.Serializer):
    """
    Représentation de la configuration d'UN service fonctionnel pour UN
    tenant — utilisée par `GET /tenants/{id}/functional-services/`.

    Sérialiseur simple (pas un ModelSerializer) car la réponse fusionne le
    catalogue complet (`FunctionalService`) avec la configuration du
    tenant (`TenantFunctionalService`, absente = activé par défaut) — voir
    `services.py::TenantFunctionalServiceService.list_for_tenant`, qui
    produit déjà des objets prêts à sérialiser plutôt qu'une jointure ORM
    exposée directement.
    """

    code = serializers.CharField()
    name = serializers.CharField()
    display_order = serializers.IntegerField()
    enabled = serializers.BooleanField()


class TenantFunctionalServiceToggleSerializer(serializers.Serializer):
    """Payload attendu par PATCH /tenants/{id}/functional-services/{code}/."""

    enabled = serializers.BooleanField()


class TenantFunctionalServiceItemSerializer(serializers.Serializer):
    """Un élément de la liste `services` attendue par le bulk ci-dessous."""

    code = serializers.CharField(max_length=50)
    enabled = serializers.BooleanField()


class TenantFunctionalServiceBulkSerializer(serializers.Serializer):
    """
    Payload attendu par POST /tenants/{id}/functional-services/bulk/.

    Utilisé par l'Étape 3 du wizard de création de tenant : enregistre en
    un seul appel l'état (coché/décoché) de chaque service fonctionnel du
    catalogue au moment de la création. Un code absent du catalogue est
    rejeté par la couche service (jamais silencieusement ignoré) — voir
    `TenantFunctionalServiceService.bulk_set`.
    """

    services = serializers.ListField(
        child=TenantFunctionalServiceItemSerializer(),
        allow_empty=False,
    )


class TenantProvisionAdminRequestSerializer(serializers.Serializer):
    """
    Payload attendu par POST /tenants/{id}/provision-admin/ — Cycle de
    vie du tenant, Phase 2. Champs volontairement minimaux (§4 de la
    mission : "en restant simple") : le compte administrateur complet
    (adresse, contact...) reste à la charge de l'administrateur
    lui-même une fois connecté, pas du PlatformAdmin à la création.
    """

    nom = serializers.CharField(max_length=100)
    prenom = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    email = serializers.EmailField()


class AdminActionLogSerializer(serializers.ModelSerializer):
    """Représentation d'une entrée du journal d'administration (Logs)."""

    class Meta:
        model = AdminActionLog
        fields = [
            'id', 'actor_id', 'actor_email', 'action',
            'target_tenant_id', 'target_tenant_identifier',
            'description', 'metadata', 'created_at',
        ]
        read_only_fields = fields
