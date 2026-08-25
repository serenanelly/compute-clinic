"""Agrégation des flux opérationnels (alignés vue caissier ↔ comptabilité)."""
from __future__ import annotations

from django.db.models import Sum
from django.utils import timezone

from apps.comptabilite.models import LigneEcriture


def _date_filters(annee=None, exercice=None, date_debut=None, date_fin=None):
    if exercice is not None:
        annee = exercice.annee
    return annee, date_debut, date_fin


def get_sorties_operationnelles(annee=None, exercice=None, date_debut=None, date_fin=None):
    """
    Sorties caisse = dépenses menues + ordres de paiement exécutés.
    Même périmètre que l'historique caissier (historique-flux).
    """
    from apps.caisse.models import DepenseMenue
    from apps.sorties.models import OrdrePaiement

    annee, date_debut, date_fin = _date_filters(annee, exercice, date_debut, date_fin)

    dep_qs = DepenseMenue.objects.all()
    # Un ordre de paiement n'est réellement décaissé que s'il porte une date
    # d'exécution. Le flux d'exécution réel renseigne toujours date_execution
    # ET crée l'écriture comptable correspondante. On exclut donc les OP marqués
    # « exécutés » sans date d'exécution (données incomplètes) pour rester cohérent
    # avec l'évolution mensuelle et le grand-livre.
    op_qs = OrdrePaiement.objects.filter(
        statut__in=['execute', 'comptabilise'],
        date_execution__isnull=False,
    )

    if annee:
        dep_qs = dep_qs.filter(date_creation__year=annee)
        op_qs = op_qs.filter(date_execution__year=annee)
    if date_debut:
        dep_qs = dep_qs.filter(date_creation__date__gte=date_debut)
        op_qs = op_qs.filter(date_execution__date__gte=date_debut)
    if date_fin:
        dep_qs = dep_qs.filter(date_creation__date__lte=date_fin)
        op_qs = op_qs.filter(date_execution__date__lte=date_fin)

    depenses_menues = float(dep_qs.aggregate(t=Sum('montant'))['t'] or 0)
    ordres_paiement = float(op_qs.aggregate(t=Sum('montant'))['t'] or 0)

    return {
        'depenses_menues': depenses_menues,
        'ordres_paiement': ordres_paiement,
        'total_sorties': depenses_menues + ordres_paiement,
        'nb_depenses_menues': dep_qs.count(),
        'nb_ordres_paiement': op_qs.count(),
    }


def get_recettes_operationnelles(annee=None, exercice=None, date_debut=None, date_fin=None):
    """Quittances validées (encaissées côté caisse)."""
    from apps.caisse.models import Quittance

    annee, date_debut, date_fin = _date_filters(annee, exercice, date_debut, date_fin)
    qs = Quittance.objects.filter(est_validee=True)
    if exercice is not None:
        qs = qs.filter(exercice=exercice)
    elif annee:
        qs = qs.filter(date_creation__year=annee)
    if date_debut:
        qs = qs.filter(date_creation__date__gte=date_debut)
    if date_fin:
        qs = qs.filter(date_creation__date__lte=date_fin)

    total = float(qs.aggregate(t=Sum('montant'))['t'] or 0)
    comptabilisees = float(
        qs.filter(est_comptabilisee=True).aggregate(t=Sum('montant'))['t'] or 0
    )
    en_attente = float(
        qs.filter(est_comptabilisee=False).aggregate(t=Sum('montant'))['t'] or 0
    )
    return {
        'total_recettes_validees': total,
        'recettes_comptabilisees': comptabilisees,
        'recettes_en_attente': en_attente,
        'nb_quittances': qs.count(),
    }


def get_charges_comptables(exercice=None):
    """Charges P&L (classe 6) depuis les écritures validées."""
    lignes = LigneEcriture.objects.filter(ecriture__statut='validee')
    if exercice is not None:
        lignes = lignes.filter(ecriture__exercice=exercice)
    charges = lignes.filter(compte__classe='6').aggregate(
        debit=Sum('montant_debit'), credit=Sum('montant_credit')
    )
    produits = lignes.filter(compte__classe='7').aggregate(
        debit=Sum('montant_debit'), credit=Sum('montant_credit')
    )
    total_depenses = float((charges['debit'] or 0) - (charges['credit'] or 0))
    total_recettes = float((produits['credit'] or 0) - (produits['debit'] or 0))
    return {
        'total_recettes': total_recettes,
        'total_depenses': total_depenses,
        'resultat_net': total_recettes - total_depenses,
    }


def get_kpis_exercice_unifies(exercice):
    """KPIs exercice : comptables + opérationnels (cohérence caissier)."""
    compta = get_charges_comptables(exercice)
    sorties = get_sorties_operationnelles(exercice=exercice)
    recettes = get_recettes_operationnelles(exercice=exercice)

    resultat_operationnel = recettes['recettes_comptabilisees'] - sorties['total_sorties']

    return {
        **compta,
        'recettes_validees_caisse': recettes['total_recettes_validees'],
        'recettes_en_attente': recettes['recettes_en_attente'],
        'depenses_menues': sorties['depenses_menues'],
        'ordres_paiement_executes': sorties['ordres_paiement'],
        'total_sorties': sorties['total_sorties'],
        'depenses_operationnelles': sorties['total_sorties'],
        'resultat_net_operationnel': resultat_operationnel,
    }


TYPE_SORTIE_TO_CAT = {
    'fournisseur': 'ACH-MED',
    'charge': 'SRV-EXT',
    'salaire': 'SAL',
    'remboursement': 'FONC',
}


def maj_budget_consomme(exercice, montant, categorie_sortie=None, type_sortie=None):
    """Incrémente le budget prévisionnel correspondant à une sortie."""
    from decimal import Decimal
    from apps.comptabilite.models import BudgetPrevisionnel
    from apps.sorties.models import CategorieSortie

    if not exercice or not montant:
        return

    cat = categorie_sortie
    if not cat and type_sortie:
        code = TYPE_SORTIE_TO_CAT.get(type_sortie)
        if code:
            cat = CategorieSortie.objects.filter(code=code).first()
    if not cat:
        return

    budget = BudgetPrevisionnel.objects.filter(
        exercice=exercice, categorie=cat
    ).order_by('id').first()
    if budget:
        budget.montant_consomme = (budget.montant_consomme or Decimal('0')) + Decimal(str(montant))
        budget.save(update_fields=['montant_consomme'])


def synchroniser_budgets_exercice(exercice):
    """Recalcule montant_consomme depuis les sorties réelles (cohérence rétroactive)."""
    from decimal import Decimal
    from apps.caisse.models import DepenseMenue
    from apps.comptabilite.models import BudgetPrevisionnel
    from apps.sorties.models import OrdrePaiement, CategorieSortie

    if not exercice:
        return

    annee = exercice.annee
    BudgetPrevisionnel.objects.filter(exercice=exercice).update(montant_consomme=Decimal('0'))

    for dep in DepenseMenue.objects.filter(
        date_creation__year=annee
    ).select_related('categorie_sortie'):
        if dep.categorie_sortie_id:
            maj_budget_consomme(exercice, dep.montant, categorie_sortie=dep.categorie_sortie)

    for op in OrdrePaiement.objects.filter(
        statut__in=['execute', 'comptabilise'],
        date_execution__year=annee,
    ):
        maj_budget_consomme(exercice, op.montant, type_sortie=op.type_sortie)


def get_sorties_mensuelles(annee, exercice=None):
    """Sorties par mois (dépenses menues + OP) pour graphiques."""
    from apps.caisse.models import DepenseMenue
    from apps.sorties.models import OrdrePaiement

    mois_data = []
    for mois in range(1, 13):
        dep = float(
            DepenseMenue.objects.filter(
                date_creation__year=annee, date_creation__month=mois
            ).aggregate(t=Sum('montant'))['t'] or 0
        )
        op = float(
            OrdrePaiement.objects.filter(
                statut__in=['execute', 'comptabilise'],
                date_execution__year=annee,
                date_execution__month=mois,
            ).aggregate(t=Sum('montant'))['t'] or 0
        )
        mois_data.append({
            'mois': mois,
            'depenses_menues': dep,
            'ordres_paiement': op,
            'total_sorties': dep + op,
        })
    return mois_data
