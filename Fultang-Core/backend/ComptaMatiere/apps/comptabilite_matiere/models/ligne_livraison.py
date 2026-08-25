from django.db import models
from .livraison import Livraison
from .materiel import Materiel

class LigneLivraison(models.Model):
    """Une ligne détaillant le contenu d'une livraison.
    Elle lie un matériel (médical ou durable) à une livraison.
    """
    TYPE_CHOICES = [
        ("MEDICAL", "Medical"),
        ("DURABLE", "Durable"),
    ]
    id_livraison = models.ForeignKey(
        Livraison,
        on_delete=models.CASCADE,
        related_name="lignes",
        verbose_name="Livraison",
    )
    type_materiel = models.CharField(
        max_length=7,
        choices=TYPE_CHOICES,
        verbose_name="Type de matériel",
    )
    materiel = models.ForeignKey(
        Materiel,
        on_delete=models.PROTECT,
        verbose_name="Matériel",
    )
    code_materiel = models.CharField(
        max_length=50,
        verbose_name="Code du matériel",
        help_text="Code d'identification du matériel",
        blank=True,
        default=""
    )
    nom_materiel = models.CharField(
        max_length=150,
        verbose_name="Nom du matériel",
        help_text="Nom du matériel livré",
        blank=True,
        default=""
    )
    quantite_conforme = models.PositiveIntegerField(default=0)
    quantite_non_conforme = models.PositiveIntegerField(default=0)
    prix_unitaire_achat = models.DecimalField(max_digits=10, decimal_places=2)
    date_peremption = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Ligne de livraison"
        verbose_name_plural = "Lignes de livraison"
        db_table = "comptabilite_matiere_ligne_livraison"

    def __str__(self):
        return f"{self.materiel} - {self.quantite_conforme}+{self.quantite_non_conforme}"

    def save(self, *args, **kwargs):
        # Seule la quantité CONFORME entre en stock. Le matériel non conforme
        # est comptabilisé sur la ligne (quantite_non_conforme) pour la traçabilité
        # mais n'intègre jamais le stock utilisable.
        if not self.pk:
            materiel = self.materiel
            materiel.quantite_stock += self.quantite_conforme
            materiel.save()
        else:
            # Modification : ajuster le stock selon la différence de quantité conforme.
            old_instance = LigneLivraison.objects.get(pk=self.pk)
            diff = self.quantite_conforme - old_instance.quantite_conforme
            if diff != 0:
                materiel = self.materiel
                materiel.quantite_stock += diff
                materiel.save()
                
        super().save(*args, **kwargs)
        
        # Mettre à jour le montant_total de la Livraison parente
        livraison = self.id_livraison
        total = sum(l.prix_unitaire_achat * l.quantite_conforme for l in livraison.lignes.all())
        livraison.montant_total = total
        livraison.save(update_fields=['montant_total'])
