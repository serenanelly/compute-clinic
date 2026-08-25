/**
 * API Service for Accountant Financial Module
 * Handles all API calls related to financial accounting
 */
import axiosInstanceCompta from '../Utils/axiosInstanceCompta';

// ==================== QUITTANCES ====================

/**
 * Get statistics for quittances
 * @returns {Promise} Statistics data
 */
export const getQuittancesStatistiques = async () => {
    const response = await axiosInstanceCompta.get('/quittances/statistiques/');
    return response.data;
};

/**
 * Get advanced statistics for financial reports
 * @param {string} periode - 'jour', 'semaine', 'mois', 'annee'
 * @returns {Promise} Advanced statistics with period comparison
 */
export const getStatistiquesAvancees = async (periode = 'mois') => {
    const response = await axiosInstanceCompta.get(`/quittances/statistiques_avancees/?periode=${periode}`);
    return response.data;
};

/**
 * Get quittances pending validation
 * @returns {Promise} List of quittances to validate
 */
export const getQuittancesAValider = async () => {
    const response = await axiosInstanceCompta.get('/quittances/a_valider/');
    return response.data;
};

/**
 * Get validated quittances
 * @param {Object} filters - Optional filters (date_debut, date_fin, mode_paiement)
 * @returns {Promise} List of validated quittances
 */
export const getQuittancesValidees = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.date_debut) params.append('date_debut', filters.date_debut);
    if (filters.date_fin) params.append('date_fin', filters.date_fin);
    if (filters.mode_paiement) params.append('mode_paiement', filters.mode_paiement);

    const response = await axiosInstanceCompta.get(`/quittances/validees/?${params.toString()}`);
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data?.quittances) return data.quittances;
    if (data?.results) return data.results;
    return [];
};

/**
 * Validate a quittance and optionally assign to an account
 * @param {number} id - Quittance ID
 * @param {number|null} compteComptableId - Optional account ID
 * @returns {Promise} Validation result
 */
export const validerQuittance = async (id, compteComptableId = null) => {
    const data = compteComptableId ? { compte_comptable_id: compteComptableId } : {};
    const response = await axiosInstanceCompta.post(`/quittances/${id}/valider/`, data);
    return response.data;
};

/**
 * Get journal de ventilation (distribution journal)
 * @param {Object} filters - Optional filters (date_debut, date_fin, compte_comptable_id)
 * @returns {Promise} Ventilation data
 */
export const getJournalVentilation = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.date_debut) params.append('date_debut', filters.date_debut);
    if (filters.date_fin) params.append('date_fin', filters.date_fin);
    if (filters.compte_comptable_id) params.append('compte_comptable_id', filters.compte_comptable_id);

    const response = await axiosInstanceCompta.get(`/quittances/journal_ventilation/?${params.toString()}`);
    return response.data;
};

/**
 * Get quittances for today
 * @returns {Promise} Today's quittances
 */
export const getQuittancesDuJour = async () => {
    const response = await axiosInstanceCompta.get('/quittances/du_jour/');
    return response.data;
};

/**
 * Get quittances for this month
 * @returns {Promise} This month's quittances
 */
export const getQuittancesDuMois = async () => {
    const response = await axiosInstanceCompta.get('/quittances/du_mois/');
    return response.data;
};

// ==================== COMPTES COMPTABLES ====================

/**
 * Get all accounting accounts
 * @returns {Promise} List of accounts
 */
export const getComptesComptables = async () => {
    const response = await axiosInstanceCompta.get('/comptes-comptables/');
    return response.data;
};

/**
 * Get product accounts (Class 7) for receipt allocation
 * @returns {Promise} List of product accounts
 */
export const getComptesProduits = async () => {
    const response = await axiosInstanceCompta.get('/comptes-comptables/produits/');
    const data = response.data;
    if (Array.isArray(data)) {
        return data;
    }
    if (Array.isArray(data.comptes)) {
        return data.comptes;
    }
    if (Array.isArray(data.results)) {
        return data.results;
    }

    return [];
};

/**
 * Get accounts statistics
 * @returns {Promise} Account statistics
 */
export const getComptesStatistiques = async () => {
    const response = await axiosInstanceCompta.get('/comptes-comptables/statistiques/');
    return response.data;
};

/**
 * Get accounts by class
 * @param {string} classe - Class number (1-7)
 * @returns {Promise} Accounts in that class
 */
export const getComptesParClasse = async (classe) => {
    const response = await axiosInstanceCompta.get(`/comptes-comptables/par-classe/${classe}/`);
    return response.data;
};

/**
 * Get accounts in tree structure
 * @returns {Promise} Account tree
 */
export const getComptesArborescence = async () => {
    const response = await axiosInstanceCompta.get('/comptes-comptables/arborescence/');
    return response.data;
};

/**
 * Create a new accounting account
 * @param {Object} data - Account data
 * @returns {Promise} Created account
 */
export const createCompteComptable = async (data) => {
    const response = await axiosInstanceCompta.post('/comptes-comptables/', data);
    return response.data;
};

/**
 * Update an accounting account
 * @param {number} id - Account ID
 * @param {Object} data - Updated data
 * @returns {Promise} Updated account
 */
export const updateCompteComptable = async (id, data) => {
    const response = await axiosInstanceCompta.patch(`/comptes-comptables/${id}/`, data);
    return response.data;
};

/**
 * Delete an accounting account
 * @param {number} id - Account ID
 * @returns {Promise} Deletion result
 */
export const deleteCompteComptable = async (id) => {
    const response = await axiosInstanceCompta.delete(`/comptes-comptables/${id}/`);
    return response.data;
};

// ==================== ÉCRITURES COMPTABLES ====================

/**
 * Get all accounting entries
 * @returns {Promise} List of entries
 */
export const getEcritures = async () => {
    const response = await axiosInstanceCompta.get('/ecritures/');
    return response.data;
};

/**
 * Create a manual accounting entry
 * @param {Object} data - Entry data with lines
 * @returns {Promise} Created entry
 */
export const createEcriture = async (data) => {
    const response = await axiosInstanceCompta.post('/ecritures/', data);
    return response.data;
};

/**
 * Validate a draft accounting entry
 * @param {number} id - Entry ID
 * @returns {Promise} Validated entry
 */
export const validerEcriture = async (id) => {
    const response = await axiosInstanceCompta.patch(`/ecritures/${id}/valider/`);
    return response.data;
};


/**
 * Get écritures statistics
 * @returns {Promise} Statistics
 */
export const getEcrituresStatistiques = async () => {
    const response = await axiosInstanceCompta.get('/ecritures/statistiques/');
    return response.data;
};

/**
 * Get balance of accounts
 * @param {Object} filters - Optional filters (date_debut, date_fin, classe)
 * @returns {Promise} Balance data
 */
export const getBalance = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.date_debut) params.append('date_debut', filters.date_debut);
    if (filters.date_fin) params.append('date_fin', filters.date_fin);
    if (filters.classe) params.append('classe', filters.classe);
    if (filters.exercice) params.append('exercice', filters.exercice);

    const response = await axiosInstanceCompta.get(`/ecritures/balance/?${params.toString()}`);
    return response.data;
};

/**
 * Get Grand Livre (movements for a specific account)
 * @param {number} compteId - Account ID
 * @param {Object} filters - Optional date filters
 * @returns {Promise} Grand Livre data
 */
export const getGrandLivre = async (compteId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.date_debut) params.append('date_debut', filters.date_debut);
    if (filters.date_fin) params.append('date_fin', filters.date_fin);
    if (filters.exercice) params.append('exercice', filters.exercice);

    const response = await axiosInstanceCompta.get(`/ecritures/grand-livre/${compteId}/?${params.toString()}`);
    return response.data;
};

/**
 * Get Grand Livre for ALL accounts that have movements
 * @param {Object} filters - Optional date filters
 * @returns {Promise} All movements grouped by account
 */
export const getGrandLivreGlobal = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.date_debut) params.append('date_debut', filters.date_debut);
    if (filters.date_fin) params.append('date_fin', filters.date_fin);

    const response = await axiosInstanceCompta.get(`/ecritures/grand-livre-global/?${params.toString()}`);
    return response.data;
};

/**
 * Get only accounts that have been used in at least one validated entry
 * @param {Object} filters - Optional date filters
 * @returns {Promise} List of accounts with movements
 */
export const getComptesUtilises = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.date_debut) params.append('date_debut', filters.date_debut);
    if (filters.date_fin) params.append('date_fin', filters.date_fin);

    const response = await axiosInstanceCompta.get(`/ecritures/comptes-utilises/?${params.toString()}`);
    return response.data;
};

/**
 * Get all journals
 * @returns {Promise} List of journals
 */
export const getJournaux = async () => {
    const response = await axiosInstanceCompta.get('/journaux/');
    return response.data;
};

/**
 * Get entries for a specific journal
 * @param {string} code - Journal code (JC, JB, JMM, JOD)
 * @param {Object} filters - Optional date filters
 * @returns {Promise} Journal entries
 */
export const getJournalEcritures = async (code, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.date_debut) params.append('date_debut', filters.date_debut);
    if (filters.date_fin) params.append('date_fin', filters.date_fin);

    const response = await axiosInstanceCompta.get(`/journaux/${code}/ecritures/?${params.toString()}`);
    return response.data;
};

// ==================== DASHBOARD DATA ====================

/**
 * Get financial KPIs and budget summary
 * @returns {Promise} Dashboard KPIs
 */
export const getTableauDeBordData = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.date_debut) params.append('date_debut', filters.date_debut);
    if (filters.date_fin) params.append('date_fin', filters.date_fin);
    const query = params.toString();
    const url = query ? `/tableau-de-bord/dashboard/?${query}` : '/tableau-de-bord/dashboard/';
    const response = await axiosInstanceCompta.get(url);
    return response.data;
};

/**
 * Get monthly evolution of revenue and expenses
 * @param {number} [annee] - Year to fetch data for
 * @returns {Promise} Monthly evolution list
 */
export const getEvolutionMensuelle = async (annee, exerciceId = null) => {
    const params = {};
    if (annee) params.annee = annee;
    if (exerciceId) params.exercice_id = exerciceId;
    const query = Object.keys(params).length
        ? `?${new URLSearchParams(params).toString()}`
        : '';
    const response = await axiosInstanceCompta.get(`/tableau-de-bord/evolution-mensuelle/${query}`);
    return response.data;
};


// ==================== EXPORT FUNCTIONS ====================

/**
 * Get quittance data for PDF generation
 * @param {number} id - Quittance ID
 * @returns {Promise} Quittance data for PDF
 */
export const getQuittanceExportPdf = async (id) => {
    const response = await axiosInstanceCompta.get(`/quittances/${id}/export_pdf/`);
    return response.data;
};

/**
 * Download validated quittances as CSV
 * @param {Object} filters - Optional filters (date_debut, date_fin)
 * @returns {Promise} CSV file blob
 */
export const downloadQuittancesCsv = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.date_debut) params.append('date_debut', filters.date_debut);
    if (filters.date_fin) params.append('date_fin', filters.date_fin);

    const response = await axiosInstanceCompta.get(`/quittances/export_csv/?${params.toString()}`, {
        responseType: 'blob'
    });

    return response.data;
};

/**
 * Generate and download PDF for a single quittance
 * Uses browser print functionality as a simple PDF solution
 * @param {number} id - Quittance ID
 */
export const downloadQuittancePdf = async (id) => {
    const data = await getQuittanceExportPdf(id);

    if (!data.success) {
        throw new Error('Failed to fetch quittance data');
    }

    // Create printable HTML
    const quittance = data.quittance;
    const patient = data.patient;
    const hopital = data.hopital;

    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Quittance ${quittance.numero}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
                .header h1 { margin: 0; color: #333; }
                .header p { margin: 5px 0; color: #666; }
                .content { margin: 20px 0; }
                .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                .label { font-weight: bold; color: #555; }
                .value { color: #333; }
                .amount { font-size: 24px; font-weight: bold; color: #2e7d32; text-align: center; margin: 20px 0; }
                .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #999; }
                .validated { background: #e8f5e9; padding: 10px; border-radius: 5px; text-align: center; }
                @media print { 
                    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${hopital.nom}</h1>
                <p>${hopital.adresse}</p>
                <p>Tél: ${hopital.telephone}</p>
            </div>
            
            <h2 style="text-align: center; margin-top: 30px;">QUITTANCE DE PAIEMENT</h2>
            <p style="text-align: center; font-size: 14px; color: #666;">N° ${quittance.numero}</p>
            
            <div class="content">
                <div class="row">
                    <span class="label">Date de paiement:</span>
                    <span class="value">${new Date(quittance.date_paiement).toLocaleString('fr-FR')}</span>
                </div>
                ${patient ? `
                <div class="row">
                    <span class="label">Patient:</span>
                    <span class="value">${patient.full_name} (${patient.matricule})</span>
                </div>
                ` : ''}
                <div class="row">
                    <span class="label">Motif:</span>
                    <span class="value">${quittance.motif}</span>
                </div>
                <div class="row">
                    <span class="label">Type de recette:</span>
                    <span class="value">${quittance.type_recette}</span>
                </div>
                <div class="row">
                    <span class="label">Mode de paiement:</span>
                    <span class="value">${quittance.mode_paiement}</span>
                </div>
            </div>
            
            <div class="amount">
                ${new Intl.NumberFormat('fr-FR').format(quittance.montant)} FCFA
            </div>
            <p style="text-align: center; font-style: italic; color: #666;">
                ${quittance.montant_lettres}
            </p>
            
            ${quittance.validee ? `
            <div class="validated">
                ✓ Quittance validée le ${quittance.date_validation ? new Date(quittance.date_validation).toLocaleDateString('fr-FR') : 'N/A'}
            </div>
            ` : ''}
            
            <div class="footer">
                <p>Document généré le ${new Date().toLocaleString('fr-FR')}</p>
                <p>${hopital.nom} - Système de Gestion Hospitalière</p>
            </div>
        </body>
        </html>
    `;

    // Open print dialog
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 500);

    return { success: true };
};

// ==================== ÉTATS FINANCIERS ====================

/**
 * Get Bilan Comptable
 * @param {Object} filters - Optional date filters
 * @returns {Promise} Bilan data
 */
export const getBilan = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.date) params.append('date', filters.date);
    if (filters.exercice) params.append('exercice', filters.exercice);

    const response = await axiosInstanceCompta.get(`/etats-financiers/bilan/?${params.toString()}`);
    return response.data;
};

/**
 * Get Compte de Résultat
 * @param {Object} filters - Optional date filters
 * @returns {Promise} Compte de résultat data
 */
export const getCompteResultat = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.date_debut) params.append('date_debut', filters.date_debut);
    if (filters.date_fin) params.append('date_fin', filters.date_fin);
    if (filters.exercice) params.append('exercice', filters.exercice);

    const response = await axiosInstanceCompta.get(`/etats-financiers/compte-resultat/?${params.toString()}`);
    return response.data;
};

/**
 * Get Tableau des Flux de Trésorerie
 * @param {Object} filters - Optional date filters
 * @returns {Promise} Flux de trésorerie data
 */
export const getFluxTresorerie = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.date_debut) params.append('date_debut', filters.date_debut);
    if (filters.date_fin) params.append('date_fin', filters.date_fin);
    if (filters.exercice) params.append('exercice', filters.exercice);

    const response = await axiosInstanceCompta.get(`/etats-financiers/flux-tresorerie/?${params.toString()}`);
    return response.data;
};

// ==================== EXERCICES COMPTABLES ====================

export const getExercices = async () => {
    const response = await axiosInstanceCompta.get('/exercices/');
    return response.data;
};

export const getExerciceCourant = async () => {
    const response = await axiosInstanceCompta.get('/exercices/courant/');
    return response.data;
};

export const getExerciceComparatif = async () => {
    const response = await axiosInstanceCompta.get('/exercices/comparatif/');
    return response.data;
};

export const getExerciceSyntheseHistorique = async (exerciceId) => {
    const response = await axiosInstanceCompta.get(`/exercices/${exerciceId}/synthese-historique/`);
    return response.data;
};

export const createExercice = async (data) => {
    const response = await axiosInstanceCompta.post('/exercices/', data);
    return response.data;
};

export const cloturerExercice = async (id) => {
    const response = await axiosInstanceCompta.post(`/exercices/${id}/cloturer/`);
    return response.data;
};

export const genererReportNouveau = async (id) => {
    const response = await axiosInstanceCompta.post(`/exercices/${id}/report-nouveau/`);
    return response.data;
};

// ==================== BUDGETS PRÉVISIONNELS ====================

export const getBudgets = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.exercice) params.append('exercice', filters.exercice);
    if (filters.service_hospitalier) params.append('service_hospitalier', filters.service_hospitalier);
    const response = await axiosInstanceCompta.get(`/budgets/?${params.toString()}`);
    return response.data;
};

export const createBudget = async (data) => {
    const response = await axiosInstanceCompta.post('/budgets/', data);
    return response.data;
};

export const getEvaluationBudget = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.exercice) params.append('exercice', filters.exercice);
    const response = await axiosInstanceCompta.get(`/budgets/evaluation/?${params.toString()}`);
    return response.data;
};

// ==================== COMPTABILISATION DE LA CAISSE ====================

export const getQuittancesAComptabiliser = async () => {
    const response = await axiosInstanceCompta.get('/quittances/a_comptabiliser/');
    return response.data;
};

export const comptabiliserQuittance = async (id, compteProduitId) => {
    const response = await axiosInstanceCompta.post(`/quittances/${id}/generer_ecriture/`, {
        compte_produit_id: compteProduitId
    });
    return response.data;
};

// ==================== CHEQUES ====================

export const getCheques = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.est_encaisse !== undefined) params.append('est_encaisse', filters.est_encaisse);
    const response = await axiosInstanceCompta.get(`/cheques/?${params.toString()}`);
    return response.data;
};

export const encaisserCheque = async (id) => {
    const response = await axiosInstanceCompta.post(`/cheques/${id}/encaisser/`);
    return response.data;
};

// ==================== CAISSE JOURNALIERE ====================

export const getCaissesJournalieres = async () => {
    const response = await axiosInstanceCompta.get('/caisse-journaliere/');
    return response.data;
};

/**
 * Solde de report autoritaire pour la prochaine ouverture (source de vérité backend).
 * Renvoie { solde_ouverture, source, has_report, ... }.
 */
export const getDernierSoldeCaisse = async () => {
    const response = await axiosInstanceCompta.get('/caisse-journaliere/dernier-solde/');
    return response.data;
};

export const ouvrirCaisse = async (data) => {
    const response = await axiosInstanceCompta.post('/caisse-journaliere/ouvrir/', data);
    return response.data;
};

export const fermerCaisse = async (id, data) => {
    const response = await axiosInstanceCompta.patch(`/caisse-journaliere/${id}/fermer/`, data);
    return response.data;
};

// ==================== DEPENSES MENUES ====================

export const getDepensesMenues = async () => {
    const response = await axiosInstanceCompta.get('/depenses-menues/');
    return response.data;
};

export const createDepenseMenue = async (data) => {
    const response = await axiosInstanceCompta.post('/depenses-menues/', data);
    return response.data;
};

// ==================== INVENTAIRE CAISSE ====================

export const getInventairesCaisse = async () => {
    const response = await axiosInstanceCompta.get('/inventaires-caisse/');
    return response.data;
};

export const createInventaireCaisse = async (data) => {
    const response = await axiosInstanceCompta.post('/inventaires-caisse/', data);
    return response.data;
};

export const cloreInventaire = async (id, data) => {
    const response = await axiosInstanceCompta.patch(`/inventaires-caisse/${id}/clore/`, data);
    return response.data;
};

// ==================== SORTIES / ACHATS ====================

export const getDemandesAchat = async () => {
    const response = await axiosInstanceCompta.get('/demandes-achat/');
    return response.data;
};

export const evaluerDemandeAchat = async (id, data) => {
    const response = await axiosInstanceCompta.patch(`/demandes-achat/${id}/evaluer/`, data);
    return response.data;
};

export const getArbitrageDemandes = async (reserveRatio) => {
    const params = reserveRatio != null ? `?reserve_ratio=${reserveRatio}` : '';
    const response = await axiosInstanceCompta.get(`/demandes-achat/arbitrage/${params}`);
    return response.data;
};

export const getBonsCommande = async () => {
    const response = await axiosInstanceCompta.get('/bons-commande/');
    return response.data;
};

export const createBonCommande = async (data) => {
    const response = await axiosInstanceCompta.post('/bons-commande/', data);
    return response.data;
};

export const validerBonCommande = async (id) => {
    const response = await axiosInstanceCompta.patch(`/bons-commande/${id}/valider/`);
    return response.data;
};

export const approuverBonCommande = async (id) => {
    const response = await axiosInstanceCompta.patch(`/bons-commande/${id}/approuver/`);
    return response.data;
};

export const getFactures = async () => {
    const response = await axiosInstanceCompta.get('/factures-fournisseur/');
    return response.data;
};

export const getFacturesImpayees = async () => {
    const response = await axiosInstanceCompta.get('/factures-fournisseur/impayees/');
    return response.data;
};

export const createFacture = async (data) => {
    const response = await axiosInstanceCompta.post('/factures-fournisseur/', data);
    return response.data;
};

export const comptabiliserFacture = async (id, compteChargeId) => {
    const body = compteChargeId ? { compte_charge_id: compteChargeId } : {};
    const response = await axiosInstanceCompta.patch(`/factures-fournisseur/${id}/comptabiliser/`, body);
    return response.data;
};

export const getOrdresPaiement = async () => {
    const response = await axiosInstanceCompta.get('/ordres-paiement/');
    return response.data;
};

export const createOrdrePaiement = async (data) => {
    const response = await axiosInstanceCompta.post('/ordres-paiement/', data);
    return response.data;
};

export const validerOrdrePaiement = async (id) => {
    const response = await axiosInstanceCompta.patch(`/ordres-paiement/${id}/valider/`);
    return response.data;
};

export const approuverOrdrePaiement = async (id) => {
    const response = await axiosInstanceCompta.patch(`/ordres-paiement/${id}/approuver/`);
    return response.data;
};

export const executerOrdrePaiement = async (id) => {
    const response = await axiosInstanceCompta.patch(`/ordres-paiement/${id}/executer/`);
    return response.data;
};

export const comptabiliserOrdrePaiement = async (id) => {
    const response = await axiosInstanceCompta.patch(`/ordres-paiement/${id}/comptabiliser/`);
    return response.data;
};

// ==================== PISTE D'AUDIT ====================

export const getAuditLogs = async () => {
    const response = await axiosInstanceCompta.get('/audit-log/');
    const data = response.data;
    return Array.isArray(data) ? data : (data.results || []);
};

// ==================== ENDPOINTS SPÉCIFIQUES SUPPLÉMENTAIRES ====================

/**
 * Obtenir les statistiques par journal comptable
 */
export const getJournalStatistiques = async () => {
    const response = await axiosInstanceCompta.get('/journaux/statistiques/');
    return response.data;
};

/**
 * Obtenir toutes les prestations de service enregistrées
 */
export const getPrestationsDeService = async () => {
    const response = await axiosInstanceCompta.get('/prestations-de-service/');
    return response.data;
};

/**
 * Obtenir les prestations de service spécifiques à un service hospitalier
 */
export const getPrestationsDeServiceByService = async (serviceId) => {
    const response = await axiosInstanceCompta.get(`/prestations-de-service/by-service/${serviceId}/`);
    return response.data;
};

/**
 * Obtenir les catégories de sorties (dépenses)
 */
export const getCategoriesSortie = async () => {
    const response = await axiosInstanceCompta.get('/categories-sortie/');
    return response.data;
};

/**
 * Obtenir le résultat financier ventilé par service hospitalier
 */
export const getResultatParService = async () => {
    const response = await axiosInstanceCompta.get('/etats-financiers/resultat-par-service/');
    return response.data;
};

// ==================== FOURNISSEURS ====================

/**
 * Obtenir la liste de tous les fournisseurs
 */
export const getFournisseurs = async () => {
    const response = await axiosInstanceCompta.get('/fournisseurs/');
    return response.data;
};

/**
 * Créer un nouveau fournisseur
 * @param {Object} data - { raison_sociale, niu, adresse, telephone, email, actif }
 */
export const createFournisseur = async (data) => {
    const response = await axiosInstanceCompta.post('/fournisseurs/', data);
    return response.data;
};

/**
 * Mettre à jour un fournisseur
 */
export const updateFournisseur = async (id, data) => {
    const response = await axiosInstanceCompta.patch(`/fournisseurs/${id}/`, data);
    return response.data;
};

/**
 * Supprimer un fournisseur
 */
export const deleteFournisseur = async (id) => {
    const response = await axiosInstanceCompta.delete(`/fournisseurs/${id}/`);
    return response.data;
};

/**
 * Obtenir l'historique des commandes d'un fournisseur
 */
export const getFournisseurHistorique = async (id) => {
    const response = await axiosInstanceCompta.get(`/fournisseurs/${id}/historique/`);
    return response.data;
};

// ==================== DEMANDES D'ACHAT ====================

/**
 * Créer une nouvelle demande d'achat
 */
export const createDemandeAchat = async (data) => {
    const response = await axiosInstanceCompta.post('/demandes-achat/', data);
    return response.data;
};

/**
 * Approuver une demande d'achat (Directeur)
 */
export const approuverDemandeAchat = async (id) => {
    const response = await axiosInstanceCompta.patch(`/demandes-achat/${id}/approuver/`);
    return response.data;
};

export const rejeterDemandeAchat = async (id, data = {}) => {
    const response = await axiosInstanceCompta.patch(`/demandes-achat/${id}/rejeter/`, data);
    return response.data;
};

// ==================== CHÈQUES (COMPLÉMENTS) ====================

/**
 * Obtenir les chèques non encaissés
 */
export const getChequesNonEncaisses = async () => {
    const response = await axiosInstanceCompta.get('/cheques/non-encaisses/');
    return response.data;
};

/**
 * Obtenir les chèques encaissés
 */
export const getChequesEncaisses = async () => {
    const response = await axiosInstanceCompta.get('/cheques/encaisses/');
    return response.data;
};

/**
 * Créer un chèque (lié à une quittance)
 */
export const createCheque = async (data) => {
    const response = await axiosInstanceCompta.post('/cheques/', data);
    return response.data;
};

// ==================== COMPLÉMENTS DIVERS ====================

/**
 * Obtenir les logs d'audit d'un utilisateur spécifique
 */
export const getAuditLogParUtilisateur = async (userId) => {
    const response = await axiosInstanceCompta.get(`/audit-log/par-utilisateur/${userId}/`);
    return response.data;
};

/**
 * Obtenir les budgets d'un service hospitalier spécifique
 */
export const getBudgetParService = async (serviceId) => {
    const response = await axiosInstanceCompta.get(`/budgets/par-service/${serviceId}/`);
    return response.data;
};

/**
 * Obtenir les quittances de la semaine
 */
export const getQuittancesDeLaSemaine = async () => {
    const response = await axiosInstanceCompta.get('/quittances/de_la_semaine/');
    return response.data;
};

/**
 * Créer une catégorie de sortie
 */
export const createCategorieSortie = async (data) => {
    const response = await axiosInstanceCompta.post('/categories-sortie/', data);
    return response.data;
};
