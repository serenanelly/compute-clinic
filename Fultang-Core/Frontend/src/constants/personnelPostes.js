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
        postes: ['receptioniste', 'caissier', 'comptable', 'directeur', 'admin'],
    },
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
        { value: 'directeur', label: t('personnel.positions.directeur'), category: 'admin' },
        { value: 'admin', label: t('personnel.positions.admin', { defaultValue: 'Administrateur système' }), category: 'admin' },
    ];
}
