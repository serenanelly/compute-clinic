import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from patient.models import Patient
from .choices import GroupeSanguin, FacteurRhesus, StatutAddiction, StatutRDV, AntecedentType

# --- Classes de Santé ---

class Antecedent(models.Model):
    """Antécédents médicaux ou familiaux du patient."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='antecedents')
    
    type = models.CharField(
        max_length=20, 
        choices=AntecedentType.choices, 
        verbose_name=_("Type d'antécédent")
    )
    nom = models.CharField(max_length=255, verbose_name=_("Nom de l'antécédent"))
    date = models.DateField(verbose_name=_("Date de l'antécédent"))
    description = models.TextField(blank=True, null=True, verbose_name=_("Description"))

    class Meta:
        verbose_name = _("Antécédent")
        verbose_name_plural = _("Antécédents")
        ordering = ['-date']

    def __str__(self):
        return f"{self.type} - {self.nom} ({self.patient})"

class DonneesCliniques(models.Model):
    """Constantes vitales et données biologiques de base."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.OneToOneField(Patient, on_delete=models.CASCADE, related_name='donnees_cliniques')
    
    groupe_sanguin = models.CharField(max_length=2, choices=GroupeSanguin.choices, verbose_name=_("Groupe sanguin"))
    facteur_rhesus = models.CharField(max_length=10, choices=FacteurRhesus.choices, verbose_name=_("Facteur rhésus"))
    electrophorese_hb = models.CharField(max_length=50, blank=True, null=True, verbose_name=_("Electrophorèse d'Hb"))
    
    poids = models.CharField(max_length=50, verbose_name=_("Poids"))
    taille = models.CharField(max_length=50, verbose_name=_("Taille"))
    pouls = models.CharField(max_length=50, verbose_name=_("Pouls"))
    taux_oxygene = models.CharField(max_length=50, verbose_name=_("Taux d'oxygène"))
    temperature = models.CharField(max_length=50, blank=True, null=True, verbose_name=_("Température"))
    tension_arterielle = models.CharField(max_length=50, blank=True, null=True, verbose_name=_("Tension artérielle"))

    class Meta:
        verbose_name = _("Données Cliniques")
        verbose_name_plural = _("Données Cliniques")

class Allergie(models.Model):
    """Allergies dont souffre le patient."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='allergies')
    manifestation = models.CharField(max_length=255, verbose_name=_("Manifestation"))
    declencheur = models.CharField(max_length=255, verbose_name=_("Déclencheur"))

    class Meta:
        verbose_name = _("Allergie")
        verbose_name_plural = _("Allergies")

class Maladie(models.Model):
    """Maladies contractées par le patient."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='maladies')
    nom = models.CharField(max_length=100, verbose_name=_("Nom de la maladie"))
    debut = models.DateField(verbose_name=_("Date de début"))
    fin = models.DateField(blank=True, null=True, verbose_name=_("Date de fin"))
    description = models.TextField(blank=True, null=True, verbose_name=_("Description"))

    class Meta:
        verbose_name = _("Maladie")
        verbose_name_plural = _("Maladies")

class Traitement(models.Model):
    """Traitements liés à une maladie spécifique."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    maladie = models.ForeignKey(Maladie, on_delete=models.CASCADE, related_name='traitements')
    nom_medicament = models.CharField(max_length=255, verbose_name=_("Nom du médicament"))
    type = models.CharField(max_length=100, verbose_name=_("Type"))
    duree = models.CharField(max_length=100, verbose_name=_("Durée"))
    posologie = models.TextField(verbose_name=_("Posologie"))
    observation = models.TextField(blank=True, null=True, verbose_name=_("Observation"))

    class Meta:
        verbose_name = _("Traitement")
        verbose_name_plural = _("Traitements")

# --- Classes de Mode de Vie ---

class ModeDeVie(models.Model):
    """Habitudes de vie du patient."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.OneToOneField(Patient, on_delete=models.CASCADE, related_name='mode_de_vie')
    moustiquaire = models.BooleanField(default=False, verbose_name=_("Dort sous moustiquaire"))
    animal_de_compagnie = models.BooleanField(default=False, verbose_name=_("A un animal de compagnie"))

    class Meta:
        verbose_name = _("Mode de Vie")
        verbose_name_plural = _("Modes de Vie")

class Voyage(models.Model):
    """Historique des voyages."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='voyages')
    lieu = models.CharField(max_length=255, verbose_name=_("Lieu"))
    frequence = models.CharField(max_length=100, verbose_name=_("Fréquence"))
    duree = models.CharField(max_length=100, verbose_name=_("Durée"))

    class Meta:
        verbose_name = _("Voyage")
        verbose_name_plural = _("Voyages")

class ActivitePhysique(models.Model):
    """Activités physiques pratiquées."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='activites_physiques')
    nom = models.CharField(max_length=100, verbose_name=_("Nom de l'activité"))
    frequence = models.CharField(max_length=100, verbose_name=_("Fréquence"))

    class Meta:
        verbose_name = _("Activité Physique")
        verbose_name_plural = _("Activités Physiques")

class Addiction(models.Model):
    """Addictions présentées par le patient."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='addictions')
    nom = models.CharField(max_length=100, verbose_name=_("Nom de l'addiction"))
    debut = models.DateField(verbose_name=_("Date de début"))
    statut = models.CharField(max_length=20, choices=StatutAddiction.choices, verbose_name=_("Statut"))

    class Meta:
        verbose_name = _("Addiction")
        verbose_name_plural = _("Addictions")

# --- Suivi ---

class RendezVous(models.Model):
    """Suivi des rendez-vous."""

    class CreeParRole(models.TextChoices):
        RECEPTIONNISTE = 'RECEPTIONNISTE', _('Réceptionniste')
        INFIRMIER = 'INFIRMIER', _('Infirmier')
        MEDECIN = 'MEDECIN', _('Médecin')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='rendez_vous')
    motif = models.TextField(verbose_name=_("Motif"))
    personnel_concerne = models.CharField(max_length=255, verbose_name=_("Personnel concerné"))
    date_heure = models.DateTimeField(verbose_name=_("Date et heure"))
    statut = models.CharField(max_length=20, choices=StatutRDV.choices, default=StatutRDV.PROGRAMME, verbose_name=_("Statut"))
    # Rôle de l'auteur du RDV : détermine le routage vers les salles d'attente
    # (réceptionniste → infirmier + médecin ; infirmier → médecin).
    cree_par_role = models.CharField(
        max_length=20,
        choices=CreeParRole.choices,
        default=CreeParRole.RECEPTIONNISTE,
        verbose_name=_("Créé par (rôle)"),
    )

    class Meta:
        verbose_name = _("Rendez-vous")
        verbose_name_plural = _("Rendez-vous")
