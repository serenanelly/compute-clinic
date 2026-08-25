"""
Configuration de l'admin Django pour comptabilite_matiere.
"""
from django.contrib import admin
from apps.comptabilite_matiere.models import (
    Besoin,
    LigneBesoin,
    Materiel,
    MaterielMedical,
    MaterielDurable,
    Livraison,
    LigneLivraison,
    Sortie,
    LigneSortie,
    ArchiveInventaire,
    LigneArchiveInventaire,
    Rapport,
    PieceJointeRapport,
)


# Inlines pour les lignes
class LigneBesoinInline(admin.TabularInline):
    model = LigneBesoin
    extra = 1
    fields = ['materiel_nom', 'quantite_demandee', 'priorite', 'quantite_accordee']


class LigneSortieInline(admin.TabularInline):
    model = LigneSortie
    extra = 1
    fields = ['id_materiel', 'quantite', 'prix_unitaire', 'sous_total']
    readonly_fields = ['sous_total']


class LigneArchiveInventaireInline(admin.TabularInline):
    model = LigneArchiveInventaire
    extra = 0
    fields = ['id_materiel', 'nom_materiel', 'quantite_ancien_stock', 'quantite_nouveau_stock', 'difference', 'statut_difference']
    readonly_fields = ['difference', 'statut_difference']


class PieceJointeRapportInline(admin.TabularInline):
    model = PieceJointeRapport
    extra = 1
    fields = ['type_piece', 'nom_fichier', 'chemin_fichier']


@admin.register(Besoin)
class BesoinAdmin(admin.ModelAdmin):
    """Configuration de l'interface d'administration pour le modèle Besoin."""
    
    list_display = [
        'idBesoin',
        'motif_court',
        'idPersonnel_emetteur',
        'statut',
        'date_creation_besoin',
        'date_traitement_directeur',
    ]
    
    list_filter = ['statut', 'date_creation_besoin']
    search_fields = ['motif', 'idPersonnel_emetteur__nom']
    readonly_fields = ['idBesoin', 'date_creation_besoin']
    ordering = ['-date_creation_besoin']
    inlines = [LigneBesoinInline]
    
    def motif_court(self, obj):
        return obj.motif[:50] + '...' if len(obj.motif) > 50 else obj.motif
    motif_court.short_description = 'Motif'


@admin.register(LigneBesoin)
class LigneBesoinAdmin(admin.ModelAdmin):
    """Configuration admin pour LigneBesoin."""
    list_display = ['id_ligne_besoin', 'id_besoin', 'materiel_nom', 'quantite_demandee', 'priorite', 'quantite_accordee']
    list_filter = ['priorite']
    search_fields = ['materiel_nom']


@admin.register(Materiel)
class MaterielAdmin(admin.ModelAdmin):
    """Configuration admin pour Materiel."""
    list_display = ['idMateriel', 'code_materiel', 'nom_Materiel', 'prix_achat_unitaire', 'quantite_stock']
    list_filter = ['date_derniere_modification']
    search_fields = ['nom_Materiel', 'code_materiel']
    readonly_fields = ['idMateriel', 'date_derniere_modification']


@admin.register(MaterielMedical)
class MaterielMedicalAdmin(admin.ModelAdmin):
    """Configuration admin pour MaterielMedical."""
    list_display = ['idMateriel', 'nom_Materiel', 'categorie', 'unite_mesure', 'prix_vente_unitaire', 'quantite_stock']
    list_filter = ['categorie', 'unite_mesure']
    search_fields = ['nom_Materiel']


@admin.register(MaterielDurable)
class MaterielDurableAdmin(admin.ModelAdmin):
    """Configuration admin pour MaterielDurable."""
    list_display = ['idMateriel', 'nom_Materiel', 'Etat', 'localisation', 'quantite_stock']
    list_filter = ['Etat', 'localisation']
    search_fields = ['nom_Materiel', 'localisation']


@admin.register(Livraison)
class LivraisonAdmin(admin.ModelAdmin):
    """Configuration admin pour Livraison."""
    list_display = ['idLivraison', 'bon_livraison_numero', 'nom_fournisseur', 'date_reception', 'montant_total']
    list_filter = ['date_reception', 'nom_fournisseur']
    search_fields = ['bon_livraison_numero', 'nom_fournisseur']


@admin.register(LigneLivraison)
class LigneLivraisonAdmin(admin.ModelAdmin):
    """Configuration admin pour LigneLivraison."""
    list_display = ['id', 'id_livraison', 'materiel', 'quantite_conforme', 'quantite_non_conforme']
    list_filter = ['type_materiel']
    search_fields = ['materiel__nom_Materiel']


@admin.register(Sortie)
class SortieAdmin(admin.ModelAdmin):
    """Configuration admin pour Sortie."""
    list_display = ['idSortie', 'numero_sortie', 'date_sortie', 'motif_sortie', 'idPersonnel']
    list_filter = ['motif_sortie', 'date_sortie']
    search_fields = ['numero_sortie']
    inlines = [LigneSortieInline]


@admin.register(LigneSortie)
class LigneSortieAdmin(admin.ModelAdmin):
    """Configuration admin pour LigneSortie."""
    list_display = ['id_ligne_sortie', 'id_sortie', 'nom_materiel', 'quantite', 'prix_unitaire', 'sous_total']
    list_filter = ['type_materiel']
    search_fields = ['nom_materiel', 'code_materiel']


@admin.register(ArchiveInventaire)
class ArchiveInventaireAdmin(admin.ModelAdmin):
    """Configuration admin pour ArchiveInventaire."""
    list_display = ['id_archive', 'code_archive', 'date_creation', 'id_responsable', 'statut']
    list_filter = ['statut', 'date_creation']
    search_fields = ['code_archive']
    inlines = [LigneArchiveInventaireInline]


@admin.register(LigneArchiveInventaire)
class LigneArchiveInventaireAdmin(admin.ModelAdmin):
    """Configuration admin pour LigneArchiveInventaire."""
    list_display = ['id_ligne_archive', 'id_archive', 'nom_materiel', 'quantite_ancien_stock', 'quantite_nouveau_stock', 'difference', 'statut_difference']
    list_filter = ['statut_difference']
    search_fields = ['nom_materiel', 'code_materiel']


@admin.register(Rapport)
class RapportAdmin(admin.ModelAdmin):
    """Configuration admin pour Rapport."""
    list_display = ['id', 'code_rapport', 'objet_court', 'id_expediteur', 'id_destinataire', 'type_rapport', 'est_lu', 'date_envoi']
    list_filter = ['type_rapport', 'est_lu', 'date_envoi']
    search_fields = ['code_rapport', 'objet', 'corps']
    inlines = [PieceJointeRapportInline]
    
    def objet_court(self, obj):
        return obj.objet[:30] + '...' if len(obj.objet) > 30 else obj.objet
    objet_court.short_description = 'Objet'


@admin.register(PieceJointeRapport)
class PieceJointeRapportAdmin(admin.ModelAdmin):
    """Configuration admin pour PieceJointeRapport."""
    list_display = ['id_piece_jointe', 'id_rapport', 'type_piece', 'nom_fichier', 'created_at']
    list_filter = ['type_piece', 'created_at']
    search_fields = ['nom_fichier']
