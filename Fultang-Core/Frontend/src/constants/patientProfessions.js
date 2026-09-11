/** Métiers proposés à l'accueil — dernière entrée = saisie libre. */
export const PROFESSIONS_PRESET = [
    'Élève / Étudiant',
    'Enseignant / Professeur',
    'Médecin',
    'Infirmier(ère)',
    'Commerçant(e)',
    'Fonctionnaire',
    'Agriculteur / Éleveur',
    'Artisan',
    'Chauffeur',
    'Menagère / Aide ménagère',
    'Employé(e) de bureau',
    'Retraité(e)',
    'Sans emploi',
    'AUTRE',
];

export const PROFESSION_AUTRE = 'AUTRE';

/** Décompose une profession enregistrée vers select + champ libre. */
export function splitProfessionForForm(profession) {
    if (!profession?.trim()) {
        return { profession_select: '', profession_autre: '' };
    }
    const trimmed = profession.trim();
    if (PROFESSIONS_PRESET.includes(trimmed) && trimmed !== PROFESSION_AUTRE) {
        return { profession_select: trimmed, profession_autre: '' };
    }
    return { profession_select: PROFESSION_AUTRE, profession_autre: trimmed };
}

/** Valeur finale envoyée à l'API. */
export function resolveProfessionValue(formData) {
    const sel = formData.profession_select;
    if (sel === PROFESSION_AUTRE) {
        return formData.profession_autre?.trim() || '';
    }
    return sel?.trim() || formData.profession?.trim() || '';
}

/** Validation frontend — profession obligatoire (hors mode code identifiant). */
export function validateProfessionFields(formData) {
    const errors = {};
    const sel = formData.profession_select;
    if (!sel) {
        errors.profession_select = 'La profession est obligatoire.';
        return errors;
    }
    if (sel === PROFESSION_AUTRE && !formData.profession_autre?.trim()) {
        errors.profession_autre = 'Précisez la profession.';
    }
    return errors;
}
