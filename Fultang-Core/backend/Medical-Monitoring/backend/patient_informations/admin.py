from django.contrib import admin
from .models import (
    DonneesCliniques, Allergie, Maladie, Traitement,
    ModeDeVie, Voyage, ActivitePhysique, Addiction, RendezVous
)

# --- Inlines ---

class TraitementInline(admin.TabularInline):
    model = Traitement
    extra = 1

class AllergieInline(admin.TabularInline):
    model = Allergie
    extra = 1

class VoyageInline(admin.TabularInline):
    model = Voyage
    extra = 1

class ActivitePhysiqueInline(admin.TabularInline):
    model = ActivitePhysique
    extra = 1

class AddictionInline(admin.TabularInline):
    model = Addiction
    extra = 1

# --- Admins ---

@admin.register(DonneesCliniques)
class DonneesCliniquesAdmin(admin.ModelAdmin):
    list_display = ('patient', 'groupe_sanguin', 'facteur_rhesus', 'poids', 'taux_oxygene')
    search_fields = ('patient__nom', 'patient__matricule')

@admin.register(Maladie)
class MaladieAdmin(admin.ModelAdmin):
    list_display = ('patient', 'nom', 'debut', 'fin')
    inlines = [TraitementInline]
    search_fields = ('patient__nom', 'nom')

@admin.register(RendezVous)
class RendezVousAdmin(admin.ModelAdmin):
    list_display = ('patient', 'motif', 'date_heure', 'statut')
    list_filter = ('statut', 'date_heure')
    search_fields = ('patient__nom', 'motif')

@admin.register(ModeDeVie)
class ModeDeVieAdmin(admin.ModelAdmin):
    list_display = ('patient', 'moustiquaire', 'animal_de_compagnie')

admin.site.register(Allergie)
admin.site.register(Voyage)
admin.site.register(ActivitePhysique)
admin.site.register(Addiction)
