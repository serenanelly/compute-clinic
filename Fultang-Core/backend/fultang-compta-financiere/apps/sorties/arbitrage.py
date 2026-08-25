"""
Moteur d'arbitrage budgétaire des demandes d'achat.

Objectif : quand plusieurs demandes d'achat sont en concurrence et que les fonds
ne suffisent pas pour toutes les servir, décider objectivement lesquelles servir
maintenant, lesquelles différer, dans le respect des règles suivantes :

1. Comptabilité d'engagement (référence : « disponible = crédits ouverts −
   engagements − réalisations ») : l'enveloppe allouable déduit les engagements
   en cours (demandes déjà approuvées non encore payées) du budget disponible.
2. Réserve de trésorerie de sécurité : on ne descend pas sous un matelas de
   sécurité (paramétrable) pour les achats non vitaux.
3. Banque de sang = priorité absolue : toujours servie en premier, quitte à
   entamer la réserve de sécurité, tant que la trésorerie ne devient pas négative.
4. Équité / ancienneté : à priorité égale, les demandes les plus anciennes
   (typiquement celles reportées faute de fonds au cycle précédent) passent
   devant, pour éviter qu'une demande reste indéfiniment non servie.
"""
from apps.comptabilite.models import BudgetPrevisionnel
from apps.comptabilite.exercice_scope import get_exercice_ouvert
from apps.comptabilite.tresorerie_helper import get_tresorerie_detail
from apps.sorties.models import DemandeAchat
from django.db.models import Sum

# Part de la trésorerie conservée en réserve de sécurité (matelas anti-choc).
# Référence gestion de trésorerie : viser 2 à 3 mois de charges fixes ; à défaut
# d'un suivi des charges fixes, on applique un pourcentage prudent de la trésorerie.
DEFAULT_RESERVE_RATIO = 0.35

PRIORITE_RANK = {'critique': 3, 'haute': 2, 'normale': 1}

# Demandes encore « en concurrence » pour l'enveloppe (ni approuvées ni rejetées).
STATUTS_EN_CONCURRENCE = ['soumise', 'evaluee']


def _tresorerie(exercice):
    return get_tresorerie_detail(exercice)['solde']


def _budget(exercice):
    if not exercice:
        return 0.0, 0.0
    agg = BudgetPrevisionnel.objects.filter(exercice=exercice).aggregate(
        prevu=Sum('montant_prevu'), consomme=Sum('montant_consomme'),
    )
    return float(agg['prevu'] or 0), float(agg['consomme'] or 0)


def _engagements():
    """Montant déjà engagé : demandes approuvées non encore payées."""
    agg = DemandeAchat.objects.filter(statut='approuvee').aggregate(
        t=Sum('montant_estime'),
    )
    return float(agg['t'] or 0)


def _demande_payload(d, decision, motif, cumul):
    return {
        'id': d.id,
        'numero': d.numero,
        'description': d.description,
        'montant_estime': float(d.montant_estime or 0),
        'priorite': d.priorite,
        'est_banque_de_sang': d.est_banque_de_sang,
        'avis_comptable': d.avis_comptable,
        'statut': d.statut,
        'date_creation': d.date_creation.isoformat() if d.date_creation else None,
        'decision': decision,          # 'servir' | 'differer' | 'alerte'
        'motif': motif,
        'cumul_servi': round(cumul, 2),
    }


def compute_arbitrage(reserve_ratio=DEFAULT_RESERVE_RATIO):
    """Calcule le plan d'arbitrage global sur les demandes en concurrence."""
    try:
        reserve_ratio = float(reserve_ratio)
    except (TypeError, ValueError):
        reserve_ratio = DEFAULT_RESERVE_RATIO
    reserve_ratio = min(max(reserve_ratio, 0.0), 0.9)

    exercice = get_exercice_ouvert()
    tresorerie = _tresorerie(exercice)
    budget_prevu, budget_consomme = _budget(exercice)
    engagements = _engagements()

    reserve = round(tresorerie * reserve_ratio, 2)
    # Disponible pour engagement (comptabilité d'engagement).
    budget_disponible = budget_prevu - budget_consomme - engagements

    demandes = list(
        DemandeAchat.objects.filter(statut__in=STATUTS_EN_CONCURRENCE)
    )

    banque_sang = [d for d in demandes if d.est_banque_de_sang]
    autres = [d for d in demandes if not d.est_banque_de_sang]

    # Équité : les plus anciennes d'abord (reportées faute de fonds au cycle précédent).
    banque_sang.sort(key=lambda d: d.date_creation or 0)
    # Autres : priorité déclarée décroissante, puis ancienneté croissante.
    autres.sort(key=lambda d: (
        -PRIORITE_RANK.get(d.priorite, 1),
        d.date_creation,
    ))

    resultats = []
    cumul = 0.0
    tresorerie_restante = tresorerie
    budget_restant = budget_disponible

    # --- Passe 1 : banque de sang (priorité absolue, peut entamer la réserve) ---
    for d in banque_sang:
        montant = float(d.montant_estime or 0)
        if montant <= tresorerie_restante:
            tresorerie_restante -= montant
            budget_restant -= montant
            cumul += montant
            resultats.append(_demande_payload(
                d, 'servir',
                'Banque de sang — priorité absolue, servie en premier.', cumul,
            ))
        else:
            resultats.append(_demande_payload(
                d, 'alerte',
                'Banque de sang PRIORITAIRE mais trésorerie insuffisante — '
                'financement d\'urgence à débloquer (découvert, virement, etc.).',
                cumul,
            ))

    # --- Passe 2 : autres demandes, dans la limite de l'enveloppe restante ---
    # Enveloppe = min(trésorerie restante − réserve, budget disponible restant).
    enveloppe = max(0.0, min(tresorerie_restante - reserve, budget_restant))
    enveloppe_restante = enveloppe

    for d in autres:
        montant = float(d.montant_estime or 0)
        if montant <= enveloppe_restante:
            enveloppe_restante -= montant
            cumul += montant
            resultats.append(_demande_payload(
                d, 'servir',
                'Fonds disponibles dans l\'enveloppe — à servir ce cycle.', cumul,
            ))
        else:
            resultats.append(_demande_payload(
                d, 'differer',
                'Fonds insuffisants ce cycle — à reprioriser au prochain '
                '(l\'ancienneté la fera remonter).', cumul,
            ))

    nb_servir = sum(1 for r in resultats if r['decision'] == 'servir')
    nb_differer = sum(1 for r in resultats if r['decision'] == 'differer')
    nb_alerte = sum(1 for r in resultats if r['decision'] == 'alerte')
    total_demande = sum(float(d.montant_estime or 0) for d in demandes)

    return {
        'fonds': {
            'tresorerie': round(tresorerie, 2),
            'reserve_ratio': reserve_ratio,
            'reserve_securite': reserve,
            'budget_prevu': round(budget_prevu, 2),
            'budget_consomme': round(budget_consomme, 2),
            'engagements_en_cours': round(engagements, 2),
            'budget_disponible': round(budget_disponible, 2),
            'enveloppe_allouable': round(enveloppe, 2),
        },
        'synthese': {
            'nb_demandes': len(demandes),
            'total_montant_demande': round(total_demande, 2),
            'total_a_servir': round(cumul, 2),
            'reste_enveloppe': round(enveloppe_restante, 2),
            'nb_servir': nb_servir,
            'nb_differer': nb_differer,
            'nb_alerte': nb_alerte,
        },
        'demandes': resultats,
    }
