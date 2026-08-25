"""
URLs de l'application comptabilite_matiere.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.comptabilite_matiere.views import (
    BesoinViewSet,
    LigneBesoinViewSet,
    MaterielViewSet,
    MaterielMedicalViewSet,
    MaterielDurableViewSet,
    LivraisonViewSet,
    SortieViewSet,
    LigneSortieViewSet,
    ArchiveInventaireViewSet,
    LigneArchiveInventaireViewSet,
    RapportViewSet,
    PieceJointeRapportViewSet,
    LigneLivraisonViewSet,
)

app_name = 'comptabilite_matiere'

router = DefaultRouter()

# Enregistrer les ViewSets
router.register(r'besoins', BesoinViewSet, basename='besoin')
router.register(r'lignes-besoin', LigneBesoinViewSet, basename='lignebesoin')
router.register(r'materiels', MaterielViewSet, basename='materiel')
router.register(r'materiels-medicaux', MaterielMedicalViewSet, basename='materiel-medical')
router.register(r'materiels-durables', MaterielDurableViewSet, basename='materiel-durable')
router.register(r'livraisons', LivraisonViewSet, basename='livraison')
router.register(r'sorties', SortieViewSet, basename='sortie')
router.register(r'lignes-sortie', LigneSortieViewSet, basename='lignesortie')
router.register(r'archives-inventaire', ArchiveInventaireViewSet, basename='archiveinventaire')
router.register(r'lignes-archive', LigneArchiveInventaireViewSet, basename='lignearchive')
router.register(r'rapports', RapportViewSet, basename='rapport')
router.register(r'pieces-jointes', PieceJointeRapportViewSet, basename='piecejointe')
router.register(r'lignes-livraison', LigneLivraisonViewSet, basename='lignelivraison')

urlpatterns = [
    path('', include(router.urls)),
]
