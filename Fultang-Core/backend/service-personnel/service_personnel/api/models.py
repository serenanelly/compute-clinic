import uuid
from django.db import models

class GradeInfirmier(models.TextChoices):
    IDE = 'IDE', 'IDE'
    ISP = 'ISP', 'ISP'
    INFIRMIER_ASSISTANT_PRINCIPAL = 'INFIRMIER_ASSISTANT_PRINCIPAL', 'Infirmier Assistant Principal'
    INFIRMIER_ANESTHESISTE = 'INFIRMIER_ANESTHESISTE', 'Infirmier Anesthésiste'
    INFIRMIER_BREVETE = 'INFIRMIER_BREVETE', 'Infirmier Breveté'
    AUTRE = 'AUTRE', 'Autre'

class Langue(models.TextChoices):
    ANGLAIS = 'ANGLAIS', 'Anglais'
    FRANCAIS = 'FRANCAIS', 'Français'
    AUTRES = 'AUTRES', 'Autres'

class NiveauAccreditation(models.TextChoices):
    TECHNICIEN_ASSISTANT = 'TECHNICIEN_ASSISTANT', 'Technicien Assistant'
    CADRE_COMPTABLE = 'CADRE_COMPTABLE', 'Cadre Comptable'
    EXPERT_COMPTABLE = 'EXPERT_COMPTABLE', 'Expert Comptable'
    CERTIFICATIONS_PROFESSIONNELLES = 'CERTIFICATIONS_PROFESSIONNELLES', 'Certifications Professionnelles'
    AUTRE = 'AUTRE', 'Autre'

class SpecialiteLabo(models.TextChoices):
    PARASITOLOGIE_MYCOLOGIE = 'PARASITOLOGIE_MYCOLOGIE', 'Parasitologie Mycologie'
    HEMATOLOGIE = 'HEMATOLOGIE', 'Hématologie'
    BIOCHIMIE_CLINIQUE = 'BIOCHIMIE_CLINIQUE', 'Biochimie Clinique'
    BACTERIOLOGIE_VIROLOGIE = 'BACTERIOLOGIE_VIROLOGIE', 'Bactériologie Virologie'
    IMMUNOLOGIE_SERO_IMMUNOLOGIE = 'IMMUNOLOGIE_SERO_IMMUNOLOGIE', 'Immunologie Séro-Immunologie'
    AUTRE = 'AUTRE', 'Autre'

class Statut(models.TextChoices):
    ACTIF = 'Actif', 'Actif'
    CONGE = 'Congé', 'Congé'
    SUSPENDU = 'Suspendu', 'Suspendu'
    AUTRE = 'Autre', 'Autre'

class Service(models.Model):
    id_service = models.AutoField(primary_key=True)
    nom_service = models.CharField(max_length=100)
    code_analytique = models.CharField(max_length=100)
    desc_service = models.TextField(blank=True, default='')
    chef_service_id = models.UUIDField(null=True, blank=True)

    def __str__(self):
        return self.nom_service

class Personnel(models.Model):
    id_personnel = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    date_naissance = models.DateField()
    adresse = models.TextField()
    email = models.EmailField(unique=True)
    contact = models.CharField(max_length=50)
    matricule = models.CharField(max_length=50, unique=True)
    date_embauche = models.DateField()
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.ACTIF)
    mot_de_passe = models.CharField(max_length=255)
    
    # Le personnel n'est plus obligé d'appartenir à un service
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True, related_name='%(class)s_personnels')

    class Meta:
        abstract = True

    def modifierProfil(self):
        pass

    def seConnecter(self):
        return True


class Medecin(Personnel):
    specialite = models.CharField(max_length=100)
    numero_ordre = models.CharField(max_length=50)

class MedecinGeneraliste(Personnel):
    """
    Médecin généraliste : praticien de premier recours sans spécialité restreinte.
    Son rôle dans le système est 'MedecinGeneraliste'.
    """
    numero_ordre = models.CharField(
        max_length=50,
        verbose_name="Numéro d'ordre",
        help_text="Numéro d'inscription à l'Ordre National des Médecins du Cameroun"
    )
    zone_couverte = models.CharField(
        max_length=200,
        blank=True,
        default='',
        verbose_name="Zone couverte",
        help_text="Secteur ou quartier de rattachement du médecin généraliste"
    )

    class Meta:
        verbose_name = "Médecin Généraliste"
        verbose_name_plural = "Médecins Généralistes"

class Infirmiere(Personnel):
    grade = models.CharField(max_length=50, choices=GradeInfirmier.choices)

class Receptionniste(Personnel):
    langues_parlees = models.JSONField(default=list)

class ComptableFinancier(Personnel):
    niveau_accreditation = models.CharField(max_length=100, choices=NiveauAccreditation.choices)

class ComptableMatiere(Personnel):
    pass

class Laborantin(Personnel):
    specialite_labo = models.CharField(max_length=100, choices=SpecialiteLabo.choices)

class Pharmacien(Personnel):
    numero_licence = models.CharField(max_length=100)

class Directeur(Personnel):
    pass

class Admin(Personnel):
    def creerCompteUtilisateur(self):
        pass

    def reinitialiserMotDePasse(self):
        pass
