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
