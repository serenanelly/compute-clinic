/** Affichage sexe API (M/F) vs formulaire (MASCULIN/FEMININ). */

export const isSexeMasculin = (sexe) => sexe === 'M' || sexe === 'MASCULIN';

export const formatSexeLabel = (sexe) => {
    if (sexe === 'F' || sexe === 'FEMININ') return 'Féminin';
    if (sexe === 'M' || sexe === 'MASCULIN') return 'Masculin';
    return sexe || '—';
};

export const getSexeTagColor = (sexe) => (isSexeMasculin(sexe) ? 'blue' : 'magenta');

export const getPatientContact = (p) =>
    p.contact_principal || p.contact || p.contacts?.[0]?.numero || null;

export const getPatientVille = (p) =>
    p.ville || p.adresse?.ville || null;
