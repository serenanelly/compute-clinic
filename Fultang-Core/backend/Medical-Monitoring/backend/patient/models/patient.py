import uuid
from datetime import datetime
from django.db import models
from django.utils.translation import gettext_lazy as _
from .choices import Sexe, StatutMatrimonial
from .satellite import Adresse, Nationalite
from .emergency import PersonneAPrevenir, LienParente

class Patient(models.Model):
    """
    Modèle représentant un Patient avec son dossier complet.
    """

    # Identifiants (PK UUID)
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name=_("ID Unique")
    )
    matricule = models.CharField(
        max_length=7,
        unique=True,
        blank=True,
        verbose_name=_("Matricule")
    )

    # État civil
    nom = models.CharField(max_length=100, verbose_name=_("Nom"))
    prenom = models.CharField(max_length=100, blank=True, null=True, verbose_name=_("Prénom"))
    sexe = models.CharField(max_length=1, choices=Sexe.choices, verbose_name=_("Sexe"))
    date_naissance = models.DateField(verbose_name=_("Date de naissance"))
    lieu_naissance = models.CharField(
        max_length=100, blank=True, default='', verbose_name=_("Lieu de naissance")
    )
    profession = models.CharField(
        max_length=100, blank=True, default='', verbose_name=_("Profession")
    )
    code_identifiant = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        null=True,
        verbose_name=_("Code identifiant (accueil rapide)"),
    )
    est_anonyme = models.BooleanField(
        default=False,
        verbose_name=_("Dossier anonyme / identité minimale"),
    )
    dossier_incomplet = models.BooleanField(
        default=False,
        verbose_name=_("Dossier à compléter par le personnel soignant"),
    )
    statut_matrimonial = models.CharField(
        max_length=20, 
        choices=StatutMatrimonial.choices, 
        verbose_name=_("Statut matrimonial")
    )
    
    # --- Nouvelles Relations ---
    
    # Chaque patient a son adresse
    adresse = models.OneToOneField(
        Adresse, on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='resident_patient'
    )
    
    # Un patient peut avoir plusieurs nationalités
    nationalites = models.ManyToManyField(
        Nationalite, blank=True, related_name='patients'
    )
    
    # Un patient peut désigner plusieurs personnes à prévenir
    personnes_a_prevenir = models.ManyToManyField(
        PersonneAPrevenir, 
        through=LienParente, 
        related_name='patients_secours'
    )

    # Coordonnées (Le champ original numéro_securite_sociale est conservé)
    courriel = models.EmailField(blank=True, null=True, verbose_name=_("Courriel"))
    numero_securite_sociale = models.CharField(
        max_length=50, 
        unique=True, 
        verbose_name=_("Numéro de sécurité sociale")
    )

    # Médias
    photo = models.ImageField(upload_to='patients/photos/', blank=True, null=True, verbose_name=_("Photo"))
    nombre_enfants = models.PositiveIntegerField(default=0, verbose_name=_("Nombre d'enfants"))

    # Audit
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Créé le"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Modifié le"))

    class Meta:
        verbose_name = _("Patient")
        verbose_name_plural = _("Patients")
        ordering = ['nom', 'prenom']

    @classmethod
    def generate_next_matricule(cls):
        """
        Génère le prochain matricule au format YYFNNNN.
        YY = 2 derniers chiffres de l'année.
        F = Fultang constant.
        NNNN = Index sur 4 chiffres (0000 à 9999).
        """
        prefix = f"{datetime.now().year % 100}F"
        last_patient = cls.objects.filter(matricule__startswith=prefix).order_by('matricule').last()
        
        if not last_patient:
            return f"{prefix}0000"
        
        try:
            # Extraction de la partie numérique (les 4 derniers caractères)
            last_number = int(last_patient.matricule[3:])
            next_number = last_number + 1
            return f"{prefix}{next_number:04d}"
        except (ValueError, IndexError):
            # En cas de format de matricule altéré, on repart à 0000 pour ce préfixe
            return f"{prefix}0000"

    def save(self, *args, **kwargs):
        if not self.matricule:
            self.matricule = self.generate_next_matricule()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.nom} {self.prenom or ''} ({self.matricule})"
