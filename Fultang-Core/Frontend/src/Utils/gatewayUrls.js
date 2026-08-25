/**
 * URL de base de l'API Gateway (sans suffixe /medical, /personnel, etc.)
 */
export function getGatewayBaseUrl() {
    const fromEnv = import.meta.env.VITE_API_GATEWAY_URL;
    if (fromEnv) {
        return fromEnv.replace(/\/$/, '');
    }
    const medical = import.meta.env.VITE_BACKEND_FULTANG_API_BASE_MEDICALSTAFF_URL || '';
    return medical.replace(/\/medical\/?$/, '').replace(/\/$/, '') || 'http://localhost:8080';
}

export const PERSONNEL_MEDECINS_URL = () => `${getGatewayBaseUrl()}/personnel/medecins/`;
