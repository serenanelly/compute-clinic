// Domaine racine utilisé par la Gateway pour la résolution de tenant par
// sous-domaine (voir api-gateway/app/config.py::TENANT_ROOT_DOMAIN, même
// valeur par défaut). Ne sert ici qu'à reconnaître un hostname de tenant
// côté frontend — la résolution elle-même reste entièrement backend.
const TENANT_ROOT_DOMAIN = import.meta.env.VITE_TENANT_ROOT_DOMAIN || 'fulltang.com';

/**
 * URL de base de l'API Gateway (sans suffixe /medical, /personnel, etc.)
 *
 * Multi-tenant (test) : si la page est servie depuis un sous-domaine de
 * tenant (ex: hopital-central.fulltang.com), les appels API doivent
 * cibler CE MÊME hostname pour que la Gateway reçoive le bon header
 * `Host` et résolve le bon tenant (Phase 2.1, backend — mécanisme
 * existant, non dupliqué ici). Le tenant n'est donc jamais une
 * préférence choisie dans le frontend : il découle uniquement de
 * l'hostname réel utilisé pour joindre la Gateway, exactement comme
 * pour une visite directe au backend.
 *
 * En dehors de ce cas (dev classique sur localhost), comportement
 * inchangé : variable d'environnement, avec repli sur l'ancienne
 * déduction depuis VITE_BACKEND_FULTANG_API_BASE_MEDICALSTAFF_URL.
 */
export function getGatewayBaseUrl() {
    const { hostname, protocol } = window.location;
    if (hostname.endsWith(`.${TENANT_ROOT_DOMAIN}`)) {
        return `${protocol}//${hostname}:8080`;
    }

    const fromEnv = import.meta.env.VITE_API_GATEWAY_URL;
    if (fromEnv) {
        return fromEnv.replace(/\/$/, '');
    }
    const medical = import.meta.env.VITE_BACKEND_FULTANG_API_BASE_MEDICALSTAFF_URL || '';
    return medical.replace(/\/medical\/?$/, '').replace(/\/$/, '') || 'http://localhost:8080';
}

/**
 * Identifiant du tenant courant tel que déduit du hostname (affichage
 * uniquement — jamais utilisé pour une décision d'accès, qui reste
 * entièrement backend). Retourne null hors convention de tenant
 * (localhost, IP, etc.).
 */
export function getCurrentTenantIdentifier() {
    const { hostname } = window.location;
    const suffix = `.${TENANT_ROOT_DOMAIN}`;
    if (!hostname.endsWith(suffix)) {
        return null;
    }
    const identifier = hostname.slice(0, -suffix.length);
    return identifier && !identifier.includes('.') ? identifier : null;
}

export const PERSONNEL_MEDECINS_URL = () => `${getGatewayBaseUrl()}/personnel/medecins/`;
