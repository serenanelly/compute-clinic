/**
 * Postes personnel — catégories médical / admin (CORR-A5-007, A5-010).
 */
export const POSTE_CATEGORIES = {
    medical: {
        label: 'Personnel médical',
        postes: ['medecin', 'infirmier', 'laborantin', 'pharmacien'],
    },
    admin: {
        label: 'Personnel administratif',
        postes: ['receptioniste', 'caissier', 'comptable', 'comptable_matiere', 'directeur', 'admin'],
    },
};

/**
 * Correspondance poste → service fonctionnel (Tenant Configuration) —
 * copie frontend de POSTE_TO_FUNCTIONAL_SERVICE (service-personnel/api/views.py,
 * seule source de vérité pour le blocage réel côté backend). Sert
 * uniquement à ne PAS PROPOSER un poste dont le service est désactivé
 * pour cet établissement (AddPersonnelModal.jsx) et à afficher le
 * personnel existant comme Inactif quand son service est désactivé
 * (AdminPersonnelPage.jsx) — jamais la seule protection.
 *
 * Correctif du mapping des rôles comptables : 'caissier' pointait, côté
 * backend, vers le modèle ComptableFinancier (donc vers COMPTA_FINANCIERE)
 * et 'comptable' vers ComptableMatiere (donc vers COMPTA_MATIERE) — aucun
 * poste ne pointait vers CAISSE. Un modèle Caissier dédié a été créé ;
 * 'comptable' désigne désormais la Comptabilité Financière sans
 * ambiguïté ; 'comptable_matiere' est un nouveau poste distinct pour la
 * Comptabilité Matière.
 */
export const POSTE_TO_FUNCTIONAL_SERVICE = {
    pharmacien: 'PHARMACIE',
    laborantin: 'LABORATOIRE',
    infirmier: 'SOINS_INFIRMIERS',
    caissier: 'CAISSE',
    comptable: 'COMPTA_FINANCIERE',
    comptable_matiere: 'COMPTA_MATIERE',
};

export const MEDICAL_SPECIALITES = [
    'Médecine Générale',
    'Cardiologie',
    'Dermatologie',
    'Gynécologie',
    'Neurologie',
    'Ophtalmologie',
    'Pédiatrie',
    'Psychiatrie',
    'Radiologie',
    'Chirurgie',
    'ORL',
    'Autre',
];

export const BACKEND_STATUTS = [
    { value: 'Actif', labelKey: 'personnel.statuses.actif' },
    { value: 'Congé', labelKey: 'personnel.statuses.conge' },
    { value: 'Suspendu', labelKey: 'personnel.statuses.suspendu' },
    { value: 'Autre', labelKey: 'personnel.statuses.autre' },
];

/** ID service depuis une entrée API (id ou id_service). */
export function getServiceId(service) {
    return service?.id ?? service?.id_service;
}

export function buildPostesOptions(t) {
    return [
        { value: 'receptioniste', label: t('personnel.positions.receptioniste'), category: 'admin' },
        { value: 'caissier', label: t('personnel.positions.caissier'), category: 'admin' },
        { value: 'infirmier', label: t('personnel.positions.infirmier'), category: 'medical' },
        { value: 'medecin', label: t('personnel.positions.medecin'), category: 'medical' },
        { value: 'laborantin', label: t('personnel.positions.laborantin'), category: 'medical' },
        { value: 'pharmacien', label: t('personnel.positions.pharmacien'), category: 'medical' },
        { value: 'comptable', label: t('personnel.positions.comptable'), category: 'admin' },
        { value: 'comptable_matiere', label: t('personnel.positions.comptable_matiere', { defaultValue: 'Comptable Matière' }), category: 'admin' },
        { value: 'directeur', label: t('personnel.positions.directeur'), category: 'admin' },
        { value: 'admin', label: t('personnel.positions.admin', { defaultValue: 'Administrateur système' }), category: 'admin' },
    ];
}
