"""
ViewSets pour les modèles ArchiveInventaire et LigneArchiveInventaire.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from apps.comptabilite_matiere.models import (
    ArchiveInventaire,
    LigneArchiveInventaire,
    Materiel,
)
from apps.comptabilite_matiere.serializers import (
    ArchiveInventaireSerializer,
    ArchiveInventaireCreateSerializer,
    LigneArchiveInventaireSerializer,
    LigneArchiveInventaireUpdateSerializer,
)


class ArchiveInventaireViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour les opérations CRUD sur ArchiveInventaire.
    """
    queryset = ArchiveInventaire.objects.all()
    serializer_class = ArchiveInventaireSerializer
    pagination_class = None  # Désactiver la pagination
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ArchiveInventaireCreateSerializer
        return ArchiveInventaireSerializer
    
    def get_queryset(self):
        """Filtre les archives par statut si spécifié."""
        queryset = ArchiveInventaire.objects.select_related(
            'rapport_associe'
        ).prefetch_related('lignes')
        
        statut = self.request.query_params.get('statut', None)
        if statut:
            queryset = queryset.filter(statut=statut)
        return queryset
    
    @action(detail=True, methods=['post'])
    def terminer(self, request, pk=None):
        """Termine l'inventaire."""
        archive = self.get_object()
        if archive.statut != ArchiveInventaire.StatutChoices.OUVERT:
            return Response(
                {'error': 'L\'inventaire n\'est pas ouvert.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        archive.terminer()
        return Response(ArchiveInventaireSerializer(archive).data)
    
    @action(detail=True, methods=['get'])
    def ancien_stock(self, request, pk=None):
        """Retourne l'ancien stock de l'archive."""
        archive = self.get_object()
        lignes = archive.lignes.all()
        data = [
            {
                'code_materiel': l.code_materiel,
                'nom_materiel': l.nom_materiel,
                'quantite': l.quantite_ancien_stock,
            }
            for l in lignes
        ]
        return Response(data)
    
    @action(detail=True, methods=['get'])
    def nouveau_stock(self, request, pk=None):
        """Retourne le nouveau stock de l'archive."""
        archive = self.get_object()
        lignes = archive.lignes.filter(quantite_nouveau_stock__isnull=False)
        data = [
            {
                'code_materiel': l.code_materiel,
                'nom_materiel': l.nom_materiel,
                'quantite': l.quantite_nouveau_stock,
            }
            for l in lignes
        ]
        return Response(data)
    
    @action(detail=True, methods=['get'])
    def differences(self, request, pk=None):
        """Retourne les différences de l'archive."""
        archive = self.get_object()
        lignes = archive.lignes.filter(difference__isnull=False)
        data = [
            {
                'code_materiel': l.code_materiel,
                'nom_materiel': l.nom_materiel,
                'ancien_stock': l.quantite_ancien_stock,
                'nouveau_stock': l.quantite_nouveau_stock,
                'difference': l.difference,
                'statut': l.get_statut_difference_display(),
            }
            for l in lignes
        ]
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Retourne les archives récentes."""
        archives = ArchiveInventaire.objects.order_by('-date_creation')[:10]
        return Response(ArchiveInventaireSerializer(archives, many=True).data)


class LigneArchiveInventaireViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour les opérations CRUD sur LigneArchiveInventaire.
    """
    queryset = LigneArchiveInventaire.objects.all()
    serializer_class = LigneArchiveInventaireSerializer
    pagination_class = None  # Désactiver la pagination
    
    def get_queryset(self):
        """Filtre les lignes par archive si spécifié."""
        queryset = LigneArchiveInventaire.objects.select_related(
            'id_archive', 'id_materiel'
        )
        archive_id = self.request.query_params.get('archive', None)
        if archive_id:
            queryset = queryset.filter(id_archive=archive_id)
        return queryset
    
    @action(detail=False, methods=['put'])
    def batch_update(self, request):
        """Mise à jour en lot des nouveaux stocks."""
        updates = request.data.get('updates', [])
        updated_lines = []
        
        for update in updates:
            try:
                ligne = LigneArchiveInventaire.objects.get(
                    id_ligne_archive=update.get('id_ligne_archive')
                )
                ligne.quantite_nouveau_stock = update.get('quantite_nouveau_stock')
                ligne.save()
                updated_lines.append(ligne.id_ligne_archive)
            except LigneArchiveInventaire.DoesNotExist:
                continue
        
        return Response({
            'message': f'{len(updated_lines)} lignes mises à jour.',
            'updated_ids': updated_lines,
        })
