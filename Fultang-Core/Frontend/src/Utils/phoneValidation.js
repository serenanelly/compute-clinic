/** Validation téléphone — Cameroun ou international E.164 (CORR-A4-012). */

const CAMEROON_LOCAL = /^6\d{8}$/;

export const normalizePhoneDigits = (value) => String(value || '').replace(/[\s\-().]/g, '');

export const isValidPhone = (value, { required = true } = {}) => {
    const raw = String(value || '').trim();
    if (!raw) return !required;
    if (raw.startsWith('+')) {
        const digits = raw.slice(1).replace(/\D/g, '');
        return digits.length >= 8 && digits.length <= 15;
    }
    const digits = normalizePhoneDigits(raw);
    if (CAMEROON_LOCAL.test(digits)) return true;
    if (/^\d{8,15}$/.test(digits)) return true;
    return false;
};

export const phoneErrorMessage = (label = 'Le numéro') =>
    `${label} doit être un numéro camerounais (6XXXXXXXX) ou international (+indicatif, 8–15 chiffres).`;

export const formatPhoneForApi = (value) => {
    const raw = String(value || '').trim();
    if (raw.startsWith('+')) return raw.replace(/[\s\-().]/g, '');
    const digits = normalizePhoneDigits(raw);
    if (CAMEROON_LOCAL.test(digits)) return digits;
    return digits;
};
