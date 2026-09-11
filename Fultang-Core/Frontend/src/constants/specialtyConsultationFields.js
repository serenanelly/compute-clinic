/** Champs consultation adaptés par spécialité (CORR-A4-003). */

export const SPECIALTY_EXTRA_FIELDS = {
    Cardiologie: [
        { name: 'auscultation_cardiaque', label: 'Auscultation cardiaque', placeholder: 'Bruits, rythme, souffles…' },
        { name: 'oedemes_mi', label: 'Œdèmes membres inférieurs', placeholder: 'Présence, localisation…' },
    ],
    Gynécologie: [
        { name: 'examen_gynecologique', label: 'Examen gynécologique', placeholder: 'Speculum, toucher vaginal…' },
        { name: 'ddr', label: 'DDR / cycle', placeholder: 'Date dernières règles, cycle…' },
    ],
    Pédiatrie: [
        { name: 'courbe_croissance', label: 'Courbe de croissance', placeholder: 'Percentiles, évolution…' },
        { name: 'vaccination', label: 'Statut vaccinal', placeholder: 'À jour / rappels…' },
    ],
    Neurologie: [
        { name: 'examen_neurologique', label: 'Examen neurologique', placeholder: 'Réflexes, force, sensibilité…' },
    ],
    Dermatologie: [
        { name: 'lesions_cutanees', label: 'Lésions cutanées', placeholder: 'Type, localisation, extension…' },
    ],
};

export const getSpecialtyFields = (specialite) => {
    if (!specialite) return [];
    const key = Object.keys(SPECIALTY_EXTRA_FIELDS).find(
        (k) => specialite.toLowerCase().includes(k.toLowerCase()),
    );
    return key ? SPECIALTY_EXTRA_FIELDS[key] : [];
};
