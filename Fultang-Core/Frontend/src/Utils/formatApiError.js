/** Messages d'erreur API en français (CORR-A4-013). */

const FIELD_LABELS = {
    nom: 'Nom',
    prenom: 'Prénom',
    contact: 'Téléphone',
    email: 'E-mail',
    date_naissance: 'Date de naissance',
    date_embauche: "Date d'embauche",
    profession: 'Profession',
    numero_securite_sociale: 'N° sécurité sociale',
    code_identifiant: 'Code identifiant',
    pays: 'Pays',
    ville: 'Ville',
    quartier: 'Quartier',
    poste: 'Poste',
    service: 'Service',
    patient: 'Patient',
    motif: 'Motif',
    detail: 'Détail',
    non_field_errors: 'Erreur',
};

const formatFieldErrors = (data) => {
    if (!data || typeof data !== 'object') return null;
    const parts = [];
    Object.entries(data).forEach(([key, val]) => {
        const label = FIELD_LABELS[key] || key.replace(/_/g, ' ');
        const msg = Array.isArray(val) ? val.join(', ') : String(val);
        if (key === 'detail') parts.unshift(msg);
        else parts.push(`${label} : ${msg}`);
    });
    return parts.length ? parts.join(' — ') : null;
};

export const formatApiError = (error, fallback = "Une erreur est survenue. Réessayez ou contactez l'administrateur.") => {
    if (!error) return fallback;
    if (typeof error === 'string') return error;
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) return 'Session expirée — veuillez vous reconnecter.';
    if (status === 403) return "Vous n'avez pas les droits pour cette action.";
    if (status === 404) return 'Ressource introuvable.';
    if (status === 402) return data?.error || 'Paiement requis avant cette action.';
    if (status >= 500) return 'Le serveur est indisponible — réessayez dans quelques instants.';

    const formatted = formatFieldErrors(data);
    if (formatted) return formatted;
    if (error.message && !error.message.startsWith('Request failed')) return error.message;
    return fallback;
};
