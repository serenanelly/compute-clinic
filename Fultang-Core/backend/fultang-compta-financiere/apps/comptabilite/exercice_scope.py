"""Filtrage par exercice comptable ouvert (vues opérationnelles)."""
from apps.comptabilite.models import ExerciceComptable


def get_exercice_ouvert():
    """Retourne l'exercice ouvert unique, ou None."""
    return ExerciceComptable.objects.filter(statut='ouvert').order_by('-annee').first()


def resolve_exercice_id(request, allow_historique=False):
    """
    - Param ?exercice= : consultation historique (si allow_historique).
    - Sinon : exercice ouvert.
    """
    ex_param = request.query_params.get('exercice') if request else None
    if ex_param and allow_historique:
        return int(ex_param)
    ex = get_exercice_ouvert()
    return ex.id if ex else None


def filter_queryset_par_exercice_courant(qs, request, field='exercice_id', allow_historique=False):
    ex_id = resolve_exercice_id(request, allow_historique=allow_historique)
    if ex_id:
        return qs.filter(**{field: ex_id})
    return qs.none()
