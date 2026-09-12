"""
models.py — Tenant Registry (Phase 1 : Tenant Management).

Un Tenant représente un établissement de santé indépendant de l'écosystème
FullTang. Ce module ne contient que les métadonnées d'identité d'un tenant
(qui il est, comment on le reconnaît, s'il est actif).

Ce que ce module NE doit PAS contenir :
  - la configuration métier d'un tenant (modules activés, formulaires,
    workflows, feature flags) → Phase 9 : Tenant Configuration ;
  - les informations de connexion à la base de données du tenant
    (Database per Tenant) → Phase 5 : Tenant Database Management ;
  - toute logique de résolution du tenant courant à partir d'une requête
    (sous-domaine, header, JWT) → Phase 2 : Tenant Identification & Resolution.
"""
import uuid

from django.core.validators import RegexValidator
from django.db import models


class TenantStatus(models.TextChoices):
    """États possibles d'un tenant dans le registre."""
    ACTIVE = 'ACTIVE', 'Actif'
    INACTIVE = 'INACTIVE', 'Inactif'


class Tenant(models.Model):
    """
    Représente un établissement de santé (le "locataire" de l'écosystème
    multitenant FullTang).

    C'est l'entité racine du Tenant Registry : toute autre donnée liée au
    tenant (dans ce service ou dans les futures phases) se rattachera à lui
    par son `id`.

    Le modèle est volontairement minimal pour cette Phase 1 — il est conçu
    pour être enrichi (relations vers une configuration, une base de
    données dédiée, un statut de provisioning plus fin, etc.) sans que ces
    champs actuels aient besoin d'être remaniés.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Identifiant technique unique du tenant (UUID).",
    )
    name = models.CharField(
        max_length=255,
        help_text="Nom de l'établissement de santé.",
    )
    identifier = models.SlugField(
        max_length=100,
        unique=True,
        help_text=(
            "Identifiant métier unique et stable du tenant (ex: utilisé plus "
            "tard pour la résolution par sous-domaine ou par header). "
            "Ne doit pas changer une fois attribué."
        ),
    )
    status = models.CharField(
        max_length=20,
        choices=TenantStatus.choices,
        default=TenantStatus.ACTIVE,
        help_text="Statut du tenant dans le registre (actif / inactif).",
    )
    allow_clinical_agent_export = models.BooleanField(
        default=True,
        help_text=(
            "Autorise ou non l'envoi des données médicales anonymisées de "
            "ce tenant vers clinical-agent / MedTutor. Par défaut True : "
            "un tenant existant avant l'introduction de ce champ conserve "
            "le comportement actuel après migration (aucune régression "
            "silencieuse de fonctionnalité). Source de vérité unique — "
            "clinical-agent interroge ce champ (via le Tenant Registry) "
            "avant toute lecture de données destinées à l'export, jamais "
            "après ; la logique de décision reste dans clinical-agent, ce "
            "champ n'est qu'une configuration."
        ),
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Date de création de l'enregistrement du tenant.",
    )

    # Champs d'identité descriptifs (Tenant Management — Phase "Configuration
    # des établissements"). Volontairement minimal et tous facultatifs :
    # seuls `name`/`identifier` sont obligatoires à la création. `logo_url`
    # est une référence (URL), pas un champ d'upload de fichier — ce service
    # n'a aucune infrastructure de stockage de médias à ce stade ; brancher
    # un vrai upload est une extension future, pas construite ici.
    address = models.TextField(
        blank=True, default='',
        help_text="Adresse postale de l'établissement (facultatif).",
    )
    phone = models.CharField(
        max_length=30, blank=True, default='',
        help_text="Numéro de téléphone principal de l'établissement (facultatif).",
    )
    email = models.EmailField(
        blank=True, default='',
        help_text="Email de contact principal de l'établissement (facultatif).",
    )
    logo_url = models.URLField(
        blank=True, default='',
        help_text=(
            "URL externe de secours pour le logo (facultatif). Si `logo` "
            "(fichier uploadé, voir ci-dessous) est renseigné, il prime "
            "toujours sur ce champ pour l'affichage — voir "
            "TenantSerializer.get_logo_display_url."
        ),
    )
    logo = models.ImageField(
        upload_to='tenants/logos/',
        blank=True, null=True,
        help_text=(
            "Logo de l'établissement, uploadé par le PlatformAdmin (Cycle "
            "de vie du tenant — Phase 2). Stockage disque local classique "
            "(FileSystemStorage, MEDIA_ROOT/MEDIA_URL), aucun object "
            "storage (S3/MinIO) n'existe encore dans FullTang — voir "
            "MULTITENANT_ARCHITECTURE.md pour la limite documentée "
            "(non partagé entre plusieurs instances du service)."
        ),
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.identifier})"


class AdminAction(models.TextChoices):
    """Types d'actions journalisées par AdminActionLog (Logs d'administration)."""
    TENANT_CREATED = 'TENANT_CREATED', 'Établissement créé'
    TENANT_PROFILE_UPDATED = 'TENANT_PROFILE_UPDATED', 'Profil de l\'établissement modifié'
    TENANT_TECHNICAL_CONFIG_UPDATED = 'TENANT_TECHNICAL_CONFIG_UPDATED', 'Configuration technique modifiée'
    TENANT_STATUS_CHANGED = 'TENANT_STATUS_CHANGED', 'Statut de l\'établissement modifié'
    # Suppression définitive (extension de l'AdminActionLog existant,
    # jamais un second système d'audit) — voir TenantDeletionRecord et
    # TenantDeletionService (services.py).
    TENANT_DELETION_STARTED = 'TENANT_DELETION_STARTED', 'Suppression définitive démarrée'
    TENANT_DELETION_ARCHIVED = 'TENANT_DELETION_ARCHIVED', 'Archive de suppression validée'
    TENANT_DELETION_CLEANED = 'TENANT_DELETION_CLEANED', 'Ressources physiques du tenant supprimées'
    TENANT_DELETION_COMPLETED = 'TENANT_DELETION_COMPLETED', 'Suppression définitive terminée'
    TENANT_DELETION_FAILED = 'TENANT_DELETION_FAILED', 'Suppression définitive échouée'
    TENANT_PROVISIONED = 'TENANT_PROVISIONED', 'Provisioning déclenché'
    TENANT_ADMIN_PROVISIONED = 'TENANT_ADMIN_PROVISIONED', 'Compte administrateur provisionné'
    TENANT_LOGO_UPDATED = 'TENANT_LOGO_UPDATED', 'Logo mis à jour'
    TENANT_LOGO_REMOVED = 'TENANT_LOGO_REMOVED', 'Logo supprimé'
    FUNCTIONAL_SERVICES_BULK_SET = 'FUNCTIONAL_SERVICES_BULK_SET', 'Services configurés en masse'
    FUNCTIONAL_SERVICE_TOGGLED = 'FUNCTIONAL_SERVICE_TOGGLED', 'Service activé/désactivé'


class AdminActionLog(models.Model):
    """
    Journal d'administration (Logs — Tenant Management, cycle de vie
    complet du tenant).

    Une ligne = une action mutante effectuée par un PLATFORM_ADMIN sur le
    Tenant Registry. Vit dans tenant-service comme le reste des données
    non-tenant-scopées de la plateforme (Tenant, FunctionalService,
    PlatformAdmin) — pas un nouveau service.

    `target_tenant_id`/`target_tenant_identifier` sont dupliqués à plat
    (pas de ForeignKey) : un log d'audit doit rester lisible même si le
    tenant visé disparaissait un jour (aucune suppression de Tenant
    n'existe dans cette phase, mais un log ne doit structurellement
    jamais dépendre du cycle de vie de sa cible). `identifier` est un
    instantané au moment de l'action — stable par construction (voir
    Tenant.identifier : "ne doit pas changer une fois attribué").

    Ne contient jamais de secret : `metadata` ne doit recevoir que des
    valeurs déjà sûres à afficher (codes de service, booléens, noms) —
    jamais un mot de passe, même temporaire (voir emails.py).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor_id = models.CharField(max_length=100, blank=True, default='')
    actor_email = models.CharField(max_length=255, blank=True, default='')
    action = models.CharField(max_length=50, choices=AdminAction.choices)
    target_tenant_id = models.UUIDField(null=True, blank=True)
    target_tenant_identifier = models.CharField(max_length=100, blank=True, default='')
    description = models.CharField(max_length=500)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} — {self.actor_email or self.actor_id} — {self.action}"


class PlatformServiceStatus(models.TextChoices):
    """États possibles d'un service dans le catalogue de la plateforme."""
    ACTIVE = 'ACTIVE', 'Actif'
    INACTIVE = 'INACTIVE', 'Inactif'


class PlatformService(models.Model):
    """
    Catalogue des microservices connus de la plateforme FullTang (Phase 5
    — Tenant Database Management).

    Ce n'est PAS la configuration d'un tenant : c'est la liste contrôlée
    des services qui EXISTENT sur la plateforme, indépendamment de qui
    les utilise. Sert de référence pour `TenantDatabase.service` — un
    `TenantDatabase` ne peut jamais pointer vers un service absent d'ici
    (contrainte de clé étrangère, `on_delete=PROTECT`).

    Nommé `PlatformService` (et non `Service`) pour éviter toute
    confusion avec les classes de couche métier de ce même module
    (`TenantService`, `TenantDatabaseService` dans services.py).

    Extensibilité : ajouter un nouveau service à FullTang (ex:
    Pharmacie, Laboratoire, Imagerie) se fait en ajoutant une ligne ici
    — jamais en modifiant `Tenant` ou `TenantDatabase`.

    Ce que ce modèle NE représente PAS :
      - quels services sont ACTIVÉS pour un tenant donné (Phase 9 :
        Tenant Configuration — activation/désactivation fonctionnelle) ;
      - l'URL réseau réelle du microservice pour le routing HTTP (reste
        dans api-gateway/app/config.py pour cette phase).
    """

    code = models.CharField(
        max_length=50,
        primary_key=True,
        validators=[RegexValidator(
            regex=r'^[A-Z][A-Z0-9_]*$',
            message="Le code doit être en MAJUSCULES_SNAKE_CASE (ex: PERSONNEL, COMPTA_MATIERE).",
        )],
        help_text=(
            "Identifiant technique stable du service (ex: PERSONNEL). "
            "Utilisé par les futurs mécanismes de routing (Phase 6) — "
            "ne doit jamais changer une fois créé."
        ),
    )
    name = models.CharField(
        max_length=100,
        help_text="Nom lisible du service (ex: Service Personnel).",
    )
    status = models.CharField(
        max_length=20,
        choices=PlatformServiceStatus.choices,
        default=PlatformServiceStatus.ACTIVE,
        help_text="Statut du service dans le catalogue plateforme.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f"{self.code} ({self.name})"


class TenantDatabaseStatus(models.TextChoices):
    """
    États possibles d'une association Tenant + Service → Database.

    Cycle de vie du provisioning (Phase 7) — réutilise ce même champ
    plutôt que d'introduire un second système d'état sur `Tenant` :

        PENDING → PROVISIONING → ACTIVE
                       ↓
                    FAILED  (peut être re-tenté : redevient PROVISIONING)

    PENDING et FAILED sont tous deux des points de départ valides pour
    une tentative de provisioning (`ProvisioningOrchestrator`, voir
    provisioning.py) — FAILED n'est pas un état terminal, un nouvel
    appel de provisioning pour le même (tenant, service) reprend depuis
    FAILED.
    """
    PENDING = 'PENDING', 'En attente de provisioning'
    PROVISIONING = 'PROVISIONING', 'Provisioning en cours'
    ACTIVE = 'ACTIVE', 'Actif'
    INACTIVE = 'INACTIVE', 'Inactif'
    FAILED = 'FAILED', 'Échec du provisioning'


class TenantDatabase(models.Model):
    """
    Association logique Tenant + Service → Base de données (Phase 5 :
    Tenant Database Management, modèle "Database per Tenant per Service").

    Décrit QUELLE base un service donné doit utiliser pour un tenant
    donné. Ce modèle est purement déclaratif :
      - l'enregistrer ici NE crée AUCUNE base PostgreSQL physique
        (Phase 7 : Tenant Provisioning) ;
      - il ne fait router AUCUNE requête (Phase 6 : Dynamic Database
        Routing).

    `status` par défaut à PENDING (pas ACTIVE) précisément parce
    qu'aucune création physique n'a lieu à l'enregistrement : une entrée
    fraîchement créée décrit une intention de configuration, pas une
    base confirmée utilisable.

    Sécurité :
      - `secret_reference` est une RÉFÉRENCE opaque (ex: un chemin dans
        un futur secret manager) — JAMAIS un mot de passe. Aucun champ
        de ce modèle ne contient, ni ne doit jamais contenir, un
        credential en clair. FullTang n'a pas encore de Secret Manager :
        ce champ réserve uniquement la structure nécessaire pour le
        brancher plus tard (non construit ici, volontairement) ;
      - toute l'API de ce modèle est réservée à PLATFORM_ADMIN (voir
        views.py) — un administrateur d'établissement (rôle ADMIN,
        tenant-scope) n'a accès à aucune opération sur ce modèle.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='databases',
        help_text="Tenant auquel appartient cette configuration de base.",
    )
    service = models.ForeignKey(
        PlatformService,
        on_delete=models.PROTECT,
        related_name='tenant_databases',
        help_text="Service de la plateforme concerné (doit exister dans le catalogue PlatformService).",
    )
    database_name = models.CharField(
        max_length=100,
        help_text="Nom logique de la base dédiée à ce tenant pour ce service.",
    )
    host = models.CharField(
        max_length=255,
        help_text="Hôte du serveur de base de données.",
    )
    port = models.PositiveIntegerField(
        default=5432,
        help_text="Port du serveur de base de données.",
    )
    status = models.CharField(
        max_length=20,
        choices=TenantDatabaseStatus.choices,
        default=TenantDatabaseStatus.PENDING,
        help_text="Statut logique de la configuration (voir docstring de classe).",
    )
    secret_reference = models.CharField(
        max_length=255,
        help_text=(
            "Référence opaque vers les credentials de connexion (ex: "
            "chemin dans un secret manager). Ne contient jamais le mot "
            "de passe lui-même."
        ),
    )
    last_error = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text=(
            "Phase 7 : résumé lisible de la dernière erreur de provisioning "
            "(status=FAILED). Jamais un secret/credential — un message "
            "d'erreur technique court. Vide dès que le statut redevient "
            "ACTIVE ou PROVISIONING."
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['tenant_id', 'service_id']
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'service'],
                name='tenant_database_unique_tenant_service',
            ),
        ]

    def __str__(self):
        return f"{self.tenant.identifier} / {self.service.code} → {self.database_name}"


class PlatformAdmin(models.Model):
    """
    Identité PLATFORM_ADMIN — démonstration frontend (Phase "Platform Admin UI").

    Volontairement séparé du modèle `Personnel` de `service-personnel` :
    un PLATFORM_ADMIN n'appartient à AUCUN tenant (il n'a pas de
    `tenant_id`, contrairement à tout compte métier), et sa gestion
    complète (CRUD, plusieurs comptes, rotation de mot de passe...) est
    hors périmètre de cette étape — un seul compte de démonstration est
    seedé (voir la migration de seed associée).

    Ce modèle ne fait que stocker un identifiant + un mot de passe
    hashé (`django.contrib.auth.hashers`, même mécanisme que
    `Personnel.mot_de_passe` dans service-personnel — pas un nouveau
    système de hachage). La vérification de rôle PLATFORM_ADMIN reste
    entièrement côté backend : `PlatformAdminAuthVerifyView` (views.py)
    est le SEUL endroit qui peut faire naître ce rôle dans un JWT.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255, help_text="Hashé via django.contrib.auth.hashers.make_password.")
    nom = models.CharField(max_length=100, blank=True, default='')
    prenom = models.CharField(max_length=100, blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.email


class FunctionalServiceStatus(models.TextChoices):
    """États possibles d'un service fonctionnel dans le catalogue produit."""
    ACTIVE = 'ACTIVE', 'Actif'
    INACTIVE = 'INACTIVE', 'Inactif'


class FunctionalService(models.Model):
    """
    Catalogue des SERVICES FONCTIONNELS de FullTang (Tenant Configuration
    — couche établissement).

    À NE JAMAIS CONFONDRE avec `PlatformService` : `PlatformService` est
    la liste des MICROSERVICES TECHNIQUES de la plateforme (PERSONNEL,
    MEDICAL, COMPTA...), utilisée pour le provisioning et le routage de
    bases de données. `FunctionalService` est la liste des CAPACITÉS
    PRODUIT qu'un établissement peut proposer (Pharmacie, Laboratoire,
    Médecine générale...) — une notion strictement métier/fonctionnelle,
    sans rapport avec le découpage en microservices : par exemple
    "Pharmacie" et "Laboratoire" sont deux entrées distinctes de ce
    catalogue alors qu'elles vivent techniquement toutes les deux dans le
    microservice Medical-Monitoring (`PlatformService` MEDICAL).

    Ce catalogue représente les fonctionnalités RÉELLEMENT développées et
    maintenues dans le code de FullTang (rôles Medecin/Infirmiere/
    Pharmacien/Laborantin/Caissier/Comptable dans service-personnel, apps
    métier de Medical-Monitoring/fultang-compta-financiere/ComptaMatiere/
    Gestion-Infrastructures) — pas une liste inventée. Il ne représente
    PAS quels services sont activés pour un tenant donné (voir
    `TenantFunctionalService` ci-dessous), et n'est PAS géré depuis
    service-personnel (qui gère aujourd'hui des `Service` organisationnels
    — services hospitaliers/services analytiques d'un établissement,
    ex: "Cardiologie" — une notion complètement différente, propre à
    chaque base tenant ; voir la documentation de Tenant Management).

    `display_order` contrôle l'ordre d'affichage dans l'IHM — les
    fonctionnalités les plus importantes doivent porter la valeur la plus
    basse, pas un ordre alphabétique ou d'insertion.
    """

    code = models.CharField(
        max_length=50,
        primary_key=True,
        validators=[RegexValidator(
            regex=r'^[A-Z][A-Z0-9_]*$',
            message="Le code doit être en MAJUSCULES_SNAKE_CASE (ex: PHARMACIE, COMPTA_FINANCIERE).",
        )],
        help_text="Identifiant technique stable du service fonctionnel (ex: PHARMACIE).",
    )
    name = models.CharField(
        max_length=100,
        help_text="Nom lisible du service fonctionnel (ex: Pharmacie).",
    )
    status = models.CharField(
        max_length=20,
        choices=FunctionalServiceStatus.choices,
        default=FunctionalServiceStatus.ACTIVE,
        help_text="Statut du service dans le catalogue produit (ACTIVE = proposable aux tenants).",
    )
    display_order = models.PositiveIntegerField(
        default=0,
        help_text="Ordre d'affichage dans l'IHM (valeur la plus basse = affiché en premier).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['display_order', 'name']

    def __str__(self):
        return self.name


class TenantFunctionalService(models.Model):
    """
    Configuration PAR TENANT de l'activation d'un service fonctionnel
    (Tenant Configuration — couche établissement, catégorie "Services").

    Une ligne = un tenant a explicitement configuré un service fonctionnel
    du catalogue (`FunctionalService`) comme activé ou désactivé.
    L'ABSENCE de ligne pour un (tenant, service) donné est traitée par la
    couche service (voir `services.py`) comme "activé par défaut" — un
    nouvel établissement n'a pas besoin qu'on lui crée explicitement 9
    lignes pour hériter d'un comportement raisonnable ; le wizard de
    création en crée cependant une complète dès la création (voir
    `views.py::bulk_set_functional_services`), pour que la configuration
    initiale soit explicite et traçable plutôt qu'implicite.

    Strictement scopée par tenant : `UniqueConstraint(tenant, service)`
    empêche toute ambiguïté, et aucune ligne n'est jamais partagée entre
    deux tenants (chaque ligne pointe vers un seul `Tenant` par `CASCADE`).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE, related_name='functional_services',
    )
    service = models.ForeignKey(
        FunctionalService, on_delete=models.PROTECT, related_name='tenant_configs',
    )
    enabled = models.BooleanField(
        default=True,
        help_text="True si ce service fonctionnel est disponible pour ce tenant.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['tenant_id', 'service_id']
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'service'],
                name='tenant_functional_service_unique_tenant_service',
            ),
        ]

    def __str__(self):
        return f"{self.tenant.identifier} / {self.service.code} = {self.enabled}"


class TenantDeletionStatus(models.TextChoices):
    """
    États du cycle de vie d'une suppression définitive de tenant (une
    opération distincte de `TenantStatus` — voir `TenantDeletionRecord`).
    """
    PENDING = 'PENDING', 'En attente'
    ARCHIVING = 'ARCHIVING', 'Archivage en cours'
    ARCHIVED = 'ARCHIVED', 'Archive validée'
    CLEANING = 'CLEANING', 'Nettoyage des ressources en cours'
    COMPLETED = 'COMPLETED', 'Terminée'
    FAILED = 'FAILED', 'Échouée'


class TenantDeletionRecord(models.Model):
    """
    Trace du cycle de vie d'une suppression définitive de tenant
    (Suppression définitive — distincte de la suspension, `Tenant.status`).

    DÉLIBÉRÉMENT AUCUNE ForeignKey vers `Tenant` : le tenant ciblé sera
    supprimé du registre à la fin d'une suppression réussie (voir
    `TenantDeletionService`) — un enregistrement dont l'existence même
    dépendrait, via CASCADE, du tenant qu'il décrit disparaîtrait avec
    lui, rendant impossible toute preuve a posteriori qu'une suppression
    a eu lieu. Même principe déjà appliqué à `AdminActionLog`
    (`target_tenant_id`/`target_tenant_identifier` dupliqués à plat) —
    ce modèle en est un complément plus détaillé, spécifique au
    déroulement (étape par étape) d'UNE opération de suppression
    précise, là où `AdminActionLog` n'enregistre que des évènements
    ponctuels.

    Un seul enregistrement actif (statut PENDING/ARCHIVING/ARCHIVED/
    CLEANING) par tenant_id à la fois — voir
    `TenantDeletionService.delete_tenant` pour la vérification
    d'exclusion mutuelle (§11 de la tâche : "empêcher deux suppressions
    simultanées du même tenant").

    Champs de rétention volontairement neutres (§Rétention de la tâche) :
    aucune durée n'est fixée ici, ni ailleurs dans le code —
    `retention_policy` est une simple étiquette libre (ex. "standard"),
    `retention_until`/`deletion_eligible_at` restent NULL tant qu'une
    politique réelle n'est pas décidée hors du périmètre technique.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Identité du tenant, dupliquée à plat (voir docstring) — snapshot au
    # moment du déclenchement, stable même après suppression du Tenant.
    tenant_id = models.UUIDField(db_index=True)
    tenant_identifier = models.CharField(max_length=100)
    tenant_name = models.CharField(max_length=255)

    # Qui a déclenché l'opération (même convention que AdminActionLog :
    # extrait de request.user, jamais l'objet complet).
    initiated_by_id = models.CharField(max_length=100, blank=True, default='')
    initiated_by_email = models.CharField(max_length=255, blank=True, default='')

    status = models.CharField(
        max_length=20,
        choices=TenantDeletionStatus.choices,
        default=TenantDeletionStatus.PENDING,
    )

    # Référence vers l'archive constituée avant toute suppression
    # destructive (voir archiving.py) — un chemin relatif sous
    # settings.ARCHIVE_ROOT, jamais un chemin absolu (portable entre
    # environnements).
    archive_reference = models.CharField(max_length=255, blank=True, default='')
    archive_version = models.CharField(max_length=20, blank=True, default='')

    # Rétention — volontairement non peuplés par une durée codée en dur
    # (voir docstring). `retention_policy` : étiquette libre documentant
    # QUELLE politique s'applique (à définir hors du périmètre technique) ;
    # `retention_until`/`deletion_eligible_at` restent NULL tant qu'aucune
    # politique réelle n'a fixé de date.
    retention_policy = models.CharField(max_length=100, blank=True, default='')
    retention_until = models.DateTimeField(null=True, blank=True)
    deletion_eligible_at = models.DateTimeField(null=True, blank=True)

    error_message = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant_id', 'status']),
        ]

    def __str__(self):
        return f"Suppression {self.tenant_identifier} — {self.status}"
