from django.db import models

class TypeBatiment(models.Model):
    nom = models.CharField(max_length=100, unique=True)
    description = models.TextField(null=True, blank=True)

    def __str__(self):
        return self.nom

class TypeSalle(models.Model):
    nom = models.CharField(max_length=100, unique=True)
    description = models.TextField(null=True, blank=True)

    def __str__(self):
        return self.nom

class StatutSalle(models.TextChoices):
    DISPONIBLE = 'DISPONIBLE', 'Disponible'
    OCCUPEE = 'OCCUPEE', 'Occupée'
    EN_MAINTENANCE = 'EN_MAINTENANCE', 'En maintenance'
    HORS_SERVICE = 'HORS_SERVICE', 'Hors service'
    RESERVEE = 'RESERVEE', 'Réservée'

class Batiment(models.Model):
    nom = models.CharField(max_length=255)
    type = models.ForeignKey(TypeBatiment, on_delete=models.RESTRICT, related_name='batiments')
    nb_etages = models.IntegerField()
    date_construction = models.DateField()
    responsable_id = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return self.nom

class Etage(models.Model):
    numero = models.IntegerField()
    batiment = models.ForeignKey(Batiment, on_delete=models.CASCADE, related_name='etages')

    def __str__(self):
        return f"Étage {self.numero} - {self.batiment.nom}"

class Salle(models.Model):
    nom = models.CharField(max_length=255)
    type = models.ForeignKey(TypeSalle, on_delete=models.RESTRICT, related_name='salles')
    capacite = models.IntegerField()
    nb_lits = models.IntegerField(null=True, blank=True, help_text="Nombre de lits (≤ capacité totale)")
    numero = models.CharField(max_length=50)
    statut = models.CharField(max_length=50, choices=StatutSalle.choices, default=StatutSalle.DISPONIBLE)
    etage = models.ForeignKey(Etage, on_delete=models.CASCADE, related_name='salles')
    service_id = models.IntegerField(null=True, blank=True)
    tarif_journalier = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    nb_places_disponibles = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"Salle {self.numero} ({self.nom})"
