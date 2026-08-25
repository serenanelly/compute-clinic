"""
Vues pour l'application comptabilite_matiere.
"""
from .besoin import BesoinViewSet
from .ligne_besoin import LigneBesoinViewSet
from .materiel import MaterielViewSet, MaterielMedicalViewSet, MaterielDurableViewSet
from .livraison_sortie import LivraisonViewSet, SortieViewSet
from .ligne_sortie import LigneSortieViewSet
from .archive_inventaire import ArchiveInventaireViewSet, LigneArchiveInventaireViewSet
from .rapport import RapportViewSet
from .piece_jointe_rapport import PieceJointeRapportViewSet
from .ligne_livraison import LigneLivraisonViewSet

__all__ = [
    'BesoinViewSet',
    'LigneBesoinViewSet',
    'MaterielViewSet',
    'MaterielMedicalViewSet',
    'MaterielDurableViewSet',
    'LivraisonViewSet',
    'SortieViewSet',
    'LigneSortieViewSet',
    'ArchiveInventaireViewSet',
    'LigneArchiveInventaireViewSet',
    'RapportViewSet',
    'PieceJointeRapportViewSet',
    'LigneLivraisonViewSet',
]
