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
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Date de création de l'enregistrement du tenant.",
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.identifier})"


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
