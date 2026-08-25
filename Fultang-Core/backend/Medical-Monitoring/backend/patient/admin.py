from django.contrib import admin
from .models import (
    Patient, Adresse, Nationalite, Contact, 
    PersonneAPrevenir, LienParente
)

# --- Inlines (Saisie groupée) ---

class ContactInline(admin.TabularInline):
    model = Contact
    extra = 1
    fields = ['type', 'numero']

class LienParenteInline(admin.TabularInline):
    model = LienParente
    extra = 1

# --- Configurations Admin ---

@admin.register(Adresse)
class AdresseAdmin(admin.ModelAdmin):
    list_display = ('ville', 'quartier', 'pays')
    list_filter = ('pays', 'ville')

@admin.register(Nationalite)
class NationaliteAdmin(admin.ModelAdmin):
    list_display = ('libelle',)

@admin.register(PersonneAPrevenir)
class PersonneAPrevenirAdmin(admin.ModelAdmin):
    list_display = ('nom', 'prenom')
    inlines = [ContactInline]

@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    # Colonnes affichées dans la liste
    list_display = ('matricule', 'nom', 'prenom', 'sexe', 'created_at')
    
    # Filtres latéraux
    list_filter = ('sexe', 'statut_matrimonial', 'created_at')
    
    # Champs de recherche
    search_fields = ('matricule', 'nom', 'prenom', 'numero_securite_sociale')
    
    # Inlines pour les données liées
    inlines = [ContactInline, LienParenteInline]
    
    # Organisation du formulaire d'édition
    fieldsets = (
        ('Identité', {
            'fields': (
                'matricule', 'nom', 'prenom', 'sexe', 
                'date_naissance', 'lieu_naissance', 'photo'
            )
        }),
        ('Localisation & Nation', {
            'fields': ('adresse', 'nationalites')
        }),
        ('Informations Sociales', {
            'fields': (
                'profession', 'statut_matrimonial', 
                'nombre_enfants', 'numero_securite_sociale', 'courriel'
            )
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    
    # Dates en lecture seule
    readonly_fields = ('created_at', 'updated_at')
