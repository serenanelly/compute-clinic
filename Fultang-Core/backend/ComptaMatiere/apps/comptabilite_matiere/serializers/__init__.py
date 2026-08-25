"""
Sérialiseurs pour l'application comptabilite_matiere.
"""
from .besoin import (
    BesoinSerializer, 
    BesoinCreateSerializer, 
    BesoinUpdateSerializer,
    CommentaireDirecteurSerializer,
    ModifierStatutSerializer,
)
from .ligne_besoin import (
    LigneBesoinSerializer,
    LigneBesoinCreateSerializer,
)
from .materiel import (
    MaterielSerializer,
    MaterielCreateSerializer,
    MaterielUpdateSerializer,
    MaterielMedicalSerializer,
    MaterielMedicalCreateSerializer,
    MaterielMedicalUpdateSerializer,
    MaterielDurableSerializer,
    MaterielDurableCreateSerializer,
    MaterielDurableUpdateSerializer,
)
from .livraison_sortie import (
    LivraisonSerializer,
    LivraisonCreateSerializer,
    LivraisonUpdateSerializer,
    SortieSerializer,
    SortieCreateSerializer,
    SortieUpdateSerializer,
)
from .ligne_sortie import (
    LigneSortieSerializer,
    LigneSortieCreateSerializer,
)
from .archive_inventaire import (
    ArchiveInventaireSerializer,
    ArchiveInventaireCreateSerializer,
    LigneArchiveInventaireSerializer,
    LigneArchiveInventaireUpdateSerializer,
)
from .rapport import (
    RapportSerializer,
    RapportCreateSerializer,
    RapportMarkReadSerializer,
)
from .piece_jointe_rapport import (
    PieceJointeRapportSerializer,
    PieceJointeRapportCreateSerializer,
)
from .ligne_livraison import LigneLivraisonSerializer

__all__ = [
    # Besoin
    'BesoinSerializer',
    'BesoinCreateSerializer',
    'BesoinUpdateSerializer',
    'CommentaireDirecteurSerializer',
    'ModifierStatutSerializer',
    # LigneBesoin
    'LigneBesoinSerializer',
    'LigneBesoinCreateSerializer',
    # Materiel
    'MaterielSerializer',
    'MaterielCreateSerializer',
    'MaterielUpdateSerializer',
    'MaterielMedicalSerializer',
    'MaterielMedicalCreateSerializer',
    'MaterielMedicalUpdateSerializer',
    'MaterielDurableSerializer',
    'MaterielDurableCreateSerializer',
    'MaterielDurableUpdateSerializer',
    # Livraison et Sortie
    'LivraisonSerializer',
    'LivraisonCreateSerializer',
    'LivraisonUpdateSerializer',
    'SortieSerializer',
    'SortieCreateSerializer',
    'SortieUpdateSerializer',
    # LigneSortie
    'LigneSortieSerializer',
    'LigneSortieCreateSerializer',
    # ArchiveInventaire
    'ArchiveInventaireSerializer',
    'ArchiveInventaireCreateSerializer',
    'LigneArchiveInventaireSerializer',
    'LigneArchiveInventaireUpdateSerializer',
    # Rapport
    'RapportSerializer',
    'RapportCreateSerializer',
    'RapportMarkReadSerializer',
    # PieceJointeRapport
    'PieceJointeRapportSerializer',
    'PieceJointeRapportCreateSerializer',
    # LigneLivraison
    'LigneLivraisonSerializer',
]
