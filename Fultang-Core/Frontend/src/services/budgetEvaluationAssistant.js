/**
 * Assistant d'évaluation budgétaire pour les demandes d'achat.
 *
 * Deux contrôles orthogonaux (comptabilité financière) :
 * 1. Autorisation budgétaire — enveloppe prévisionnelle (contrôle de gestion, hors bilan)
 * 2. Liquidité trésorerie — solde réel classe 5 SYSCOHADA (caisse, banque…)
 *
 * Approuver ≠ payer : une demande peut être autorisée budgétairement mais mise
 * en attente de décaissement faute de liquidités.
 */
import { getTableauDeBordData, getCaissesJournalieres } from './accountantApi';
import {
    materielMedicalApi,
    materielDurableApi,
    ligneSortieApi,
    sortieApi,
    besoinApi,
    ligneBesoinApi,
} from './comptabiliteMatiereApi';

const CONSUMPTION_DAYS = 90;
const STOCK_CRITICAL_DAYS = 7;
const STOCK_WARNING_DAYS = 21;
const STOCK_LOW_THRESHOLD = 20;
const TRESORERIE_RESERVE_RATIO = 0.35;

const fmt = (n) =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

function normalizeList(data) {
    if (Array.isArray(data)) return data;
    return data?.results || [];
}

function parseBesoinCode(description = '') {
    const match = description.match(/\[([^\]]+)\]/);
    return match ? match[1] : null;
}

function tokenize(text) {
    return (text || '')
        .toLowerCase()
        .replace(/[^\w\sàâäéèêëïîôùûüç]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2);
}

function mergeMaterialCatalog(medicaux, durables) {
    const seen = new Set();
    const catalog = [];
    [...medicaux, ...durables].forEach((m) => {
        const key = (m.code_materiel || m.nom_Materiel || m.nom_materiel || '').toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        catalog.push({
            ...m,
            sourceStock: m.categorie ? 'pharmacie' : 'compta_matiere',
        });
    });
    return catalog;
}

function findMaterialStock(catalog, name) {
    const q = (name || '').toLowerCase().trim();
    if (!q) return null;

    let match = catalog.find((m) => {
        const n = (m.nom_Materiel || m.nom_materiel || '').toLowerCase();
        return n.includes(q) || q.includes(n);
    });
    if (match) return match;

    const qTokens = tokenize(name);
    if (qTokens.length === 0) return null;

    let best = null;
    let bestScore = 0;
    catalog.forEach((m) => {
        const nTokens = tokenize(m.nom_Materiel || m.nom_materiel);
        const score = qTokens.filter((t) =>
            nTokens.some((nt) => nt.includes(t) || t.includes(nt))
        ).length;
        if (score > bestScore) {
            bestScore = score;
            best = m;
        }
    });
    return bestScore >= 1 ? best : null;
}

function buildSortieDateIndex(sorties) {
    const index = {};
    sorties.forEach(s => {
        const id = s.idSortie ?? s.id;
        index[id] = new Date(s.date_sortie || s.date_creation).getTime();
    });
    return index;
}

function analyzeMaterialConsumption(nomMateriel, lignesSortie, sortieDates) {
    const q = (nomMateriel || '').toLowerCase().trim();
    const cutoff = Date.now() - CONSUMPTION_DAYS * 86400000;

    const lines = lignesSortie.filter(l => {
        const n = (l.nom_materiel || '').toLowerCase();
        return n.includes(q) || q.includes(n);
    });

    let qtyPeriod = 0;
    let lastSortie = 0;
    lines.forEach(l => {
        const sortieId = l.id_sortie ?? l.idSortie;
        const ts = sortieDates[sortieId];
        if (ts && ts >= cutoff) {
            qtyPeriod += Number(l.quantite) || 0;
            if (ts > lastSortie) lastSortie = ts;
        }
    });

    const perDay = qtyPeriod / CONSUMPTION_DAYS;
    const perWeek = perDay * 7;

    return {
        qtyPeriod,
        perDay: Math.round(perDay * 100) / 100,
        perWeek: Math.round(perWeek * 10) / 10,
        perMonth: Math.round(perDay * 30),
        sortiesCount: lines.length,
        lastSortie: lastSortie ? new Date(lastSortie).toISOString().split('T')[0] : null,
        vitesse: perWeek >= 10 ? 'elevee' : perWeek >= 3 ? 'moyenne' : perWeek > 0 ? 'faible' : 'inconnue',
    };
}

function daysUntilStockout(stock, perDay) {
    if (!stock || stock <= 0) return 0;
    if (!perDay || perDay <= 0) return null;
    return Math.floor(stock / perDay);
}

async function loadLignesBesoinFromDemande(demande) {
    const code = parseBesoinCode(demande.description);
    if (!code) return [];

    const besoins = normalizeList(await besoinApi.getAll());
    const besoin = besoins.find(b => (b.code_besoin || `BES-${b.idBesoin}`) === code);
    if (!besoin) return [];

    const lignes = normalizeList(await ligneBesoinApi.getByBesoin(besoin.idBesoin));
    return lignes.map(l => ({
        nom: l.materiel_nom || l.nom_materiel,
        quantiteDemandee: Number(l.quantite_demandee) || 0,
        priorite: l.priorite,
    }));
}

/** Contrôle 1 — Autorisation budgétaire (enveloppe prévisionnelle). */
export function evaluateBudgetAuthorization({ montant, budgetDispo, budgetPrevu, budgetConsomme, engagements = 0, tauxBudget }) {
    const margeTolerance = budgetPrevu * 0.05;
    const resteApres = budgetDispo - montant;

    if (montant <= budgetDispo) {
        return {
            status: 'ok',
            statusLabel: 'Autorisé',
            headline: `Dans l'enveloppe (${fmt(resteApres)} FCFA restants)`,
            detail:
                'La dépense respecte le plafond budgétaire de l\'exercice. ' +
                'Le budget est un outil d\'autorisation — il ne crée pas de liquidités.',
            canAuthorize: true,
            resteApres,
        };
    }

    if (montant <= budgetDispo + margeTolerance) {
        return {
            status: 'warning',
            statusLabel: 'Limite',
            headline: 'Proche du plafond budgétaire',
            detail:
                `Montant ${fmt(montant)} FCFA vs disponible ${fmt(budgetDispo)} FCFA ` +
                `(consommé ${fmt(budgetConsomme)} / alloué ${fmt(budgetPrevu)} FCFA). ` +
                'Réallocation ou dérogation budgétaire à envisager.',
            canAuthorize: true,
            resteApres,
        };
    }

    return {
        status: 'blocked',
        statusLabel: 'Dépassement',
        headline: 'Hors enveloppe budgétaire',
        detail:
            `Dépassement de ${fmt(montant - budgetDispo)} FCFA sur le budget disponible. ` +
            (engagements > 0
                ? `${fmt(engagements)} FCFA déjà engagés (demandes approuvées non payées). `
                : '') +
            'Nécessite réallocation budgétaire ou rejet.',
        canAuthorize: false,
        resteApres,
    };
}

/** Contrôle 2 — Liquidité trésorerie (classe 5, décaissement réel). */
export function evaluateTreasuryLiquidity({ montant, tresorerie, caisseSolde = 0, tresorerieDetail = null }) {
    const tresorerieApres = tresorerie - montant;
    const reserveMin = tresorerie * TRESORERIE_RESERVE_RATIO;
    const tresorerieUtilisable = Math.max(0, tresorerie - reserveMin);

    const reportDetail = tresorerieDetail?.report_manquant
        ? ` Attention : le report à nouveau depuis l'exercice ${tresorerieDetail.exercice_report_source} ` +
          "n'a pas encore été généré (journal JRN) — la trésorerie affichée peut être sous-estimée."
        : tresorerieDetail?.solde_report_a_nouveau > 0
            ? ` Dont ${fmt(tresorerieDetail.solde_report_a_nouveau)} FCFA reportés (JRN) ` +
              `et ${fmt(tresorerieDetail.solde_mouvements_exercice)} FCFA de mouvements courants.`
            : '';

    if (montant > tresorerie) {
        return {
            status: 'pending',
            statusLabel: 'Paiement différé',
            headline: 'Liquidités insuffisantes pour décaisser maintenant',
            detail:
                `Trésorerie réelle ${fmt(tresorerie)} FCFA (cl. 5) — montant demandé ${fmt(montant)} FCFA.` +
                (reportDetail ? ` ${reportDetail}` : '') +
                " Ne pas autoriser le paiement maintenant ; la demande peut être conservée pour un cycle ultérieur.",
            canPayNow: false,
            paymentMode: 'attente_liquidites',
            tresorerieApres,
            reserveMin,
            tresorerieUtilisable,
        };
    }

    if (tresorerieApres < reserveMin) {
        return {
            status: 'warning',
            statusLabel: 'Réserve basse',
            headline: 'Paiement possible mais sous le seuil de sécurité',
            detail:
                `Après décaissement : ${fmt(tresorerieApres)} FCFA restants ` +
                `(seuil réserve ${Math.round(TRESORERIE_RESERVE_RATIO * 100)} % = ${fmt(reserveMin)} FCFA). ` +
                (caisseSolde > 0 && montant > caisseSolde
                    ? `Paiement probablement par banque (caisse jour : ${fmt(caisseSolde)} FCFA). `
                    : ''),
            canPayNow: true,
            paymentMode: 'paiement_avec_reserve_bassee',
            tresorerieApres,
            reserveMin,
            tresorerieUtilisable,
        };
    }

    return {
        status: 'ok',
        statusLabel: 'Payable',
        headline: 'Liquidités suffisantes pour décaisser',
        detail:
            `Trésorerie ${fmt(tresorerie)} FCFA → ${fmt(tresorerieApres)} FCFA après paiement. ` +
            (caisseSolde > 0 && montant > caisseSolde
                ? `Montant > caisse du jour (${fmt(caisseSolde)} FCFA) — virement/chèque probable. `
                : 'Le décaissement impactera directement les comptes classe 5.'),
        canPayNow: true,
        paymentMode: 'paiement_immediat',
        tresorerieApres,
        reserveMin,
        tresorerieUtilisable,
    };
}

function buildPartialFulfillmentPlan(lignes, materialInsights, montant) {
    const lines = lignes.map((ligne, idx) => {
        const insight =
            materialInsights[idx] ||
            materialInsights.find(
                (m) => (m.nom || '').toLowerCase() === (ligne.nom || '').toLowerCase()
            ) ||
            {};
        const stock = insight.stockActuel ?? 0;
        const demande = Number(ligne.quantiteDemandee) || 1;
        const quantiteAServirDuStock = Math.min(Math.max(0, stock), demande);
        const quantiteACommander = Math.max(0, demande - quantiteAServirDuStock);

        return {
            nom: ligne.nom,
            quantiteDemandee: demande,
            stockDisponible: stock,
            quantiteAServirDuStock,
            quantiteACommander,
            urgence: insight.urgence || 'normale',
            sourceStock: insight.sourceStock || 'compta_matiere',
            unite: insight.unite || null,
        };
    });

    const totalDemande = lines.reduce((s, l) => s + l.quantiteDemandee, 0);
    const totalServir = lines.reduce((s, l) => s + l.quantiteAServirDuStock, 0);
    const ratio = totalDemande > 0 ? totalServir / totalDemande : 0;
    const montantCouvertStock = Math.round(montant * ratio);
    const montantDiffere = Math.max(0, montant - montantCouvertStock);

    return {
        lines,
        peutServirDuStock: lines.some((l) => l.quantiteAServirDuStock > 0),
        couvreEntierement: lines.every((l) => l.quantiteACommander === 0),
        montantCouvertStock,
        montantDiffere,
        totalServir,
    };
}

function buildWorkflow({ budgetCheck, treasuryCheck, canAuthorize, canPayNow, authorizationType }) {
    if (!canAuthorize) {
        return {
            workflowType: 'reject',
            title: 'Décision : refus budgétaire recommandé',
            message:
                "Le plafond d'enveloppe est dépassé. Le budget autorise ou non la dépense ; " +
                'il ne se confond pas avec la trésorerie.',
            bg: '#fef2f2',
            border: '#fecaca',
            steps: [
                '1. Engagement — refus ou demande de réallocation budgétaire',
                "2. Pas de bon de commande tant que l'enveloppe n'est pas ouverte",
            ],
        };
    }

    if (canPayNow) {
        return {
            workflowType: 'pay',
            title: 'Décision : autoriser et payer',
            message:
                'Les deux feux sont au vert : droit de dépenser (budget) et liquidités disponibles (trésorerie).',
            bg: '#ecfdf5',
            border: '#a7f3d0',
            steps: [
                '1. Avis favorable → approbation directeur (engagement)',
                '2. Bon de commande → facture → ordre de paiement',
                '3. Exécution OP → débit classe 6 / crédit classe 5 + consommation budget',
            ],
        };
    }

    if (authorizationType === 'partial_stock') {
        return {
            workflowType: 'partial_stock',
            title: 'Décision : servir du stock existant — achat différé',
            message:
                "Urgence avérée (stock bas) mais trésorerie insuffisante. Servir d'abord depuis l'inventaire " +
                'pharmacie / compta matière, puis commander le reliquat quand les liquidités le permettront.',
            bg: '#fff7ed',
            border: '#fed7aa',
            steps: [
                '1. Avis favorable — distribution immédiate depuis le stock (sortie matière)',
                '2. Demande conservée pour la quantité restante à commander',
                "3. BC / OP différés jusqu'à encaissement des recettes",
            ],
        };
    }

    return {
        workflowType: 'defer',
        title: 'Décision : différer — ne pas autoriser maintenant',
        message:
            'Le budget le permet mais la trésorerie ne permet pas le décaissement. ' +
            'Ne pas autoriser le paiement maintenant ; la demande peut être conservée pour réévaluation ultérieure.',
        bg: '#fefce8',
        border: '#fde047',
        steps: [
            '1. Avis défavorable ou différé — demande conservée en file d\'attente',
            '2. Pas de bon de commande ni d\'OP tant que la trésorerie ne le permet pas',
            '3. Réévaluer au prochain cycle (encaissements, arbitrage budgétaire)',
        ],
    };
}

function synthesizeDecision({
    budgetCheck,
    treasuryCheck,
    hasCriticalStock,
    allStockComfortable,
    demande,
    partialPlan,
}) {
    const canAuthorize = budgetCheck.canAuthorize;
    const canPayNow = treasuryCheck.canPayNow;

    let avis = 'defavorable';
    let priorite = demande.priorite || 'normale';
    let confidence = 'moyenne';
    let label = 'Refuser ou réallouer le budget';
    let authorizationType = 'reject';

    if (!canAuthorize) {
        avis = 'defavorable';
        confidence = 'forte';
        label = 'Refuser — dépassement budgétaire';
        authorizationType = 'reject';
    } else if (hasCriticalStock && canPayNow) {
        avis = 'favorable';
        priorite = 'critique';
        confidence = 'forte';
        label = 'Approuver en urgence (budget + trésorerie OK)';
        authorizationType = 'pay';
    } else if (hasCriticalStock && !canPayNow && partialPlan?.peutServirDuStock) {
        avis = 'favorable';
        priorite = 'critique';
        confidence = 'moyenne';
        label =
            `Servir ${partialPlan.totalServir} unité(s) depuis le stock — ` +
            `commander le reliquat plus tard (${fmt(partialPlan.montantDiffere)} FCFA différés)`;
        authorizationType = 'partial_stock';
    } else if (hasCriticalStock && !canPayNow) {
        avis = 'defavorable';
        priorite = 'critique';
        confidence = 'moyenne';
        label = 'Différer — urgence stock mais inventaire insuffisant (demande conservée)';
        authorizationType = 'defer_conserve';
    } else if (canAuthorize && canPayNow) {
        avis = 'favorable';
        confidence = treasuryCheck.status === 'warning' ? 'moyenne' : 'forte';
        label =
            treasuryCheck.status === 'warning'
                ? 'Approuver — surveiller la réserve de trésorerie'
                : allStockComfortable
                    ? 'Approuver — budget et trésorerie OK (stock confortable)'
                    : 'Approuver — budget et trésorerie OK';
        authorizationType = 'pay';
    } else if (canAuthorize && !canPayNow) {
        avis = 'defavorable';
        confidence = 'forte';
        label = allStockComfortable
            ? 'Différer — trésorerie insuffisante, stocks confortables (demande conservée)'
            : 'Différer — trésorerie insuffisante (demande conservée pour plus tard)';
        authorizationType = 'defer_conserve';
    }

    if (
        (demande.priorite === 'haute' || demande.priorite === 'critique') &&
        avis === 'favorable' &&
        priorite === 'normale'
    ) {
        priorite = 'haute';
    }

    return {
        avis,
        priorite,
        confidence,
        label,
        canAuthorize,
        canPayNow,
        authorizationType,
    };
}

export async function loadBudgetEvaluationContext(demande) {
    const [dashboard, caissesRaw, medicaux, durables, sorties, lignesSortie, lignesBesoin] = await Promise.all([
        getTableauDeBordData().catch(() => null),
        getCaissesJournalieres().catch(() => []),
        materielMedicalApi.getAll().catch(() => []),
        materielDurableApi.getAll().catch(() => []),
        sortieApi.getAll().catch(() => []),
        ligneSortieApi.getAll().catch(() => []),
        loadLignesBesoinFromDemande(demande).catch(() => []),
    ]);

    const caisses = normalizeList(caissesRaw);
    const caisseOuverte = caisses.find(c => c.statut === 'ouverte') || null;
    const catalog = mergeMaterialCatalog(
        normalizeList(medicaux),
        normalizeList(durables)
    );

    return {
        dashboard,
        caisseOuverte,
        medicaux: catalog,
        sorties: normalizeList(sorties),
        lignesSortie: normalizeList(lignesSortie),
        lignesBesoin,
    };
}

export function computeBudgetRecommendation(context, demande) {
    const montant = Number(demande.montant_estime) || 0;
    const kpis = context.dashboard?.kpis || {};
    const budget = context.dashboard?.budget || {};
    const coherence = context.dashboard?.coherence || {};
    const tresorerieInfo = context.dashboard?.tresorerie || {};

    const tresorerie = Number(tresorerieInfo.solde ?? kpis.solde_tresorerie) || 0;
    const tresorerieDetail = {
        solde_report_a_nouveau: Number(tresorerieInfo.solde_report_a_nouveau) || 0,
        solde_mouvements_exercice: Number(tresorerieInfo.solde_mouvements_exercice) || 0,
        report_manquant: Boolean(tresorerieInfo.report_manquant),
        exercice_report_source: tresorerieInfo.exercice_report_source ?? null,
        report_a_nouveau_present: Boolean(tresorerieInfo.report_a_nouveau_present),
    };
    const budgetDispo = Number(budget.disponible) || 0;
    const budgetPrevu = Number(budget.prevu) || 0;
    const budgetConsomme = Number(budget.consomme) || 0;
    const engagements = Number(budget.engagements) || 0;
    const tauxBudget = Number(budget.taux_consommation) || 0;
    const caisseSolde = Number(context.caisseOuverte?.solde_theorique) || 0;

    const sortieDates = buildSortieDateIndex(context.sorties);
    const alerts = [];
    const materialInsights = [];

    const lignes = context.lignesBesoin.length > 0
        ? context.lignesBesoin
        : [{ nom: demande.description?.split('—').pop()?.trim() || 'Matériel demandé', quantiteDemandee: 1 }];

    let urgentCount = 0;
    let stockOkCount = 0;

    lignes.forEach(ligne => {
        const stockRow = findMaterialStock(context.medicaux, ligne.nom);
        const stock = stockRow != null ? Number(stockRow.quantite_stock) : null;
        const conso = analyzeMaterialConsumption(ligne.nom, context.lignesSortie, sortieDates);
        const joursRestants = stock != null ? daysUntilStockout(stock, conso.perDay) : null;
        const seuilAlerte = STOCK_LOW_THRESHOLD;

        let urgence = 'normale';
        if (stock != null && stock <= 0) {
            urgence = 'critique';
            urgentCount++;
        } else if (joursRestants != null && joursRestants <= STOCK_CRITICAL_DAYS) {
            urgence = 'critique';
            urgentCount++;
        } else if (joursRestants != null && joursRestants <= STOCK_WARNING_DAYS) {
            urgence = 'haute';
            urgentCount++;
        } else if (stock != null && stock <= seuilAlerte) {
            urgence = 'haute';
            urgentCount++;
        } else if (stock != null && joursRestants != null && joursRestants > STOCK_WARNING_DAYS) {
            stockOkCount++;
        }

        materialInsights.push({
            nom: ligne.nom,
            quantiteDemandee: ligne.quantiteDemandee,
            stockActuel: stock,
            codeMateriel: stockRow?.code_materiel || null,
            sourceStock: stockRow?.sourceStock || null,
            unite: stockRow?.unite_mesure_display || stockRow?.unite_mesure || null,
            ...conso,
            joursRestants,
            urgence,
            seuilAlerte,
        });
    });

    // --- Deux contrôles distincts ---
    const budgetCheck = evaluateBudgetAuthorization({
        montant, budgetDispo, budgetPrevu, budgetConsomme, engagements, tauxBudget,
    });
    const treasuryCheck = evaluateTreasuryLiquidity({
        montant, tresorerie, caisseSolde, tresorerieDetail,
    });
    const tresorerieApres = treasuryCheck.tresorerieApres;

    const partialPlan = buildPartialFulfillmentPlan(lignes, materialInsights, montant);

    if (tresorerieDetail.report_manquant) {
        alerts.push({
            level: 'warning',
            category: 'tresorerie',
            text:
                `Report à nouveau manquant depuis l'exercice ${tresorerieDetail.exercice_report_source}. ` +
                'Générez le journal JRN pour reporter la trésorerie (classe 5) sur l\'exercice courant.',
        });
    }

    // Alerte découplage budget / trésorerie
    if (coherence.alerte_decouplage || (budgetDispo > tresorerie * 3 && budgetDispo > 1_000_000)) {
        alerts.push({
            level: 'info',
            category: 'coherence',
            text:
                `Le budget disponible (${fmt(budgetDispo)} FCFA) est largement supérieur à la trésorerie réelle ` +
                `(${fmt(tresorerie)} FCFA). C'est normal : le budget est une enveloppe d'autorisation, ` +
                'pas un compte bancaire. Seule la trésorerie finance les paiements.',
        });
    }

    if (tauxBudget >= 90) {
        alerts.push({
            level: 'warning',
            category: 'budget',
            text: `Budget exercice consommé à ${tauxBudget.toFixed(0)} % (${fmt(budgetConsomme)} / ${fmt(budgetPrevu)} FCFA).`,
        });
    }

    if (engagements > 0) {
        alerts.push({
            level: 'info',
            category: 'budget',
            text: `${fmt(engagements)} FCFA déjà engagés (demandes approuvées, non encore décaissées).`,
        });
    }

    materialInsights.forEach(m => {
        if (m.urgence === 'critique') {
            alerts.push({
                level: 'error',
                category: 'stock',
                text: `${m.nom} : stock critique (${m.stockActuel ?? '?'} unités${m.joursRestants != null ? `, ~${m.joursRestants} j restants` : ''}).`,
            });
        } else if (m.urgence === 'haute') {
            alerts.push({
                level: 'warning',
                category: 'stock',
                text: `${m.nom} : stock bas (~${m.joursRestants} jours à consommation actuelle).`,
            });
        }
    });

    const hasCriticalStock = urgentCount > 0;
    const allStockComfortable = stockOkCount === materialInsights.length && materialInsights.length > 0;

    // Banque de sang — priorité absolue
    if (demande.est_banque_de_sang) {
        alerts.push({
            level: montant > tresorerie ? 'error' : 'warning',
            category: 'urgence',
            text: montant > tresorerie
                ? 'Banque de sang PRIORITAIRE — trésorerie insuffisante, financement d\'urgence à débloquer.'
                : 'Banque de sang — priorité absolue : à servir en premier, avant toute autre demande.',
        });
        return {
            metrics: {
                montant, tresorerie, budgetDispo, budgetPrevu, budgetConsomme,
                engagements, tauxBudget, caisseSolde, tresorerieApres,
            },
            checks: { budget: budgetCheck, treasury: treasuryCheck },
            workflow: buildWorkflow({
                budgetCheck,
                treasuryCheck,
                canAuthorize: true,
                canPayNow: treasuryCheck.canPayNow,
            }),
            materialInsights,
            alerts,
            suggestion: {
                avis_comptable: 'favorable',
                priorite: 'critique',
                canAuthorize: true,
                canPayNow: treasuryCheck.canPayNow,
                paymentMode: treasuryCheck.paymentMode,
                commentaire_budgetaire:
                    `Banque de sang — priorité absolue. ` +
                    `Contrôle budget : ${budgetCheck.statusLabel}. ` +
                    `Contrôle trésorerie : ${treasuryCheck.statusLabel} (${fmt(tresorerie)} FCFA). ` +
                    `Montant demandé ${fmt(montant)} FCFA. ` +
                    (treasuryCheck.canPayNow
                        ? 'Décaissement possible immédiatement.'
                        : 'Autoriser l\'engagement — paiement différé jusqu\'à mobilisation de liquidités.'),
                confidence: 'forte',
                label: 'Approuver en priorité absolue (banque de sang)',
            },
        };
    }

    const decision = synthesizeDecision({
        budgetCheck, treasuryCheck, hasCriticalStock, allStockComfortable, demande, partialPlan,
    });

    if (allStockComfortable && decision.canAuthorize && decision.canPayNow) {
        alerts.push({
            level: 'info',
            category: 'stock',
            text: 'Stocks confortables — achat peut être différé sans risque immédiat.',
        });
    }

    if (partialPlan.peutServirDuStock && decision.authorizationType === 'partial_stock') {
        alerts.push({
            level: 'warning',
            category: 'stock',
            text:
                'Urgence stock : servir immédiatement depuis l\'inventaire pharmacie / compta matière, ' +
                `puis différer l'achat du reliquat (~${fmt(partialPlan.montantDiffere)} FCFA).`,
        });
    }

    const commentaireParts = [];
    commentaireParts.push(
        `Contrôle budgétaire : ${budgetCheck.statusLabel} — ${budgetCheck.headline}.`
    );
    commentaireParts.push(
        `Contrôle trésorerie : ${treasuryCheck.statusLabel} — ${treasuryCheck.headline}.`
    );
    commentaireParts.push(`Montant demandé : ${fmt(montant)} FCFA.`);
    if (caisseSolde > 0) {
        commentaireParts.push(`Caisse ouverte (sous-ensemble cl. 57) : ${fmt(caisseSolde)} FCFA.`);
    }
    const topMateriel = materialInsights.find(m => m.urgence === 'critique') || materialInsights[0];
    if (topMateriel?.perWeek > 0) {
        commentaireParts.push(
            `${topMateriel.nom} : ~${topMateriel.perWeek}/sem. sur ${CONSUMPTION_DAYS} j (stock ${topMateriel.stockActuel ?? 'N/A'}).`
        );
    }

    if (partialPlan.peutServirDuStock) {
        const detailStock = partialPlan.lines
            .filter((l) => l.quantiteAServirDuStock > 0)
            .map((l) => `${l.nom}: ${l.quantiteAServirDuStock}/${l.quantiteDemandee} depuis stock`)
            .join(' ; ');
        if (detailStock) {
            commentaireParts.push(`Plan partiel : ${detailStock}.`);
        }
    }

    return {
        metrics: {
            montant, tresorerie, budgetDispo, budgetPrevu, budgetConsomme,
            engagements, tauxBudget, caisseSolde, tresorerieApres,
            tresorerieReport: tresorerieDetail.solde_report_a_nouveau,
            tresorerieMouvements: tresorerieDetail.solde_mouvements_exercice,
            reportManquant: tresorerieDetail.report_manquant,
        },
        checks: { budget: budgetCheck, treasury: treasuryCheck },
        workflow: buildWorkflow({
            budgetCheck,
            treasuryCheck,
            canAuthorize: decision.canAuthorize,
            canPayNow: decision.canPayNow,
            authorizationType: decision.authorizationType,
        }),
        materialInsights,
        partialPlan,
        alerts,
        suggestion: {
            avis_comptable: decision.avis,
            priorite: decision.priorite,
            canAuthorize: decision.canAuthorize,
            canPayNow: decision.canPayNow,
            authorizationType: decision.authorizationType,
            paymentMode: treasuryCheck.paymentMode,
            commentaire_budgetaire: commentaireParts.join(' '),
            confidence: decision.confidence,
            label: decision.label,
            partialPlan,
        },
    };
}

export async function getBudgetEvaluationAssistant(demande) {
    const context = await loadBudgetEvaluationContext(demande);
    const recommendation = computeBudgetRecommendation(context, demande);
    return { context, recommendation };
}
