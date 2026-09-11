/** Plages de référence constantes vitales (CORR-A2-011) — miroir backend. */
const TA_PATTERN = /^(\d{2,3})\s*\/\s*(\d{2,3})$/;

export const validateVitalField = (name, rawValue) => {
    if (rawValue == null || String(rawValue).trim() === '') {
        return { ok: true };
    }
    const value = String(rawValue).trim();
    if (name === 'tension_arterielle') {
        const m = value.match(TA_PATTERN);
        if (!m) return { ok: false, message: 'Format tension : NNN/NNN (ex. 120/80).' };
        const sys = parseInt(m[1], 10);
        const dia = parseInt(m[2], 10);
        if (sys < 60 || sys > 250 || dia < 40 || dia > 150) {
            return { ok: false, message: 'Tension hors plage réaliste (60–250 / 40–150 mmHg).' };
        }
        if (sys <= dia) {
            return { ok: false, message: 'La systolique doit être supérieure à la diastolique.' };
        }
        return { ok: true };
    }
    const ranges = {
        temperature: [34, 42],
        taux_oxygene: [50, 100],
        pouls: [30, 220],
        poids: [0.5, 300],
        taille: [30, 250],
        frequence_respiratoire: [12, 60],
        glycemie: [0.3, 5.0],
    };
    if (!ranges[name]) return { ok: true };
    const num = parseFloat(value.replace(',', '.'));
    if (Number.isNaN(num)) return { ok: false, message: 'Valeur numérique attendue.' };
    const [lo, hi] = ranges[name];
    if (num < lo || num > hi) {
        return { ok: false, message: `Valeur hors plage (${lo}–${hi}).` };
    }
    return { ok: true };
};

export const validateClinicalForm = (fields) => {
    const errors = {};
    ['temperature', 'taux_oxygene', 'pouls', 'poids', 'taille', 'tension_arterielle', 'frequence_respiratoire', 'glycemie'].forEach((f) => {
        const r = validateVitalField(f, fields[f]);
        if (!r.ok) errors[f] = r.message;
    });
    return errors;
};
