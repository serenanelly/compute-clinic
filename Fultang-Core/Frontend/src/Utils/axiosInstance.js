import axios from "axios";
import { getGatewayBaseUrl } from "./gatewayUrls";
import { getToken, getRefreshToken } from "./authToken";
import { dispatchFultangErrorEvent } from "./fultangErrorEvents";

// getGatewayBaseUrl() cible le hostname courant (résolution de tenant par
// sous-domaine) — sans cela, tous les appels médicaux (Doctor/Nurse/
// Patient/Pharmacist/Laboratory...) partiraient vers un hostname fixe
// (VITE_BACKEND_FULTANG_API_BASE_MEDICALSTAFF_URL) au lieu du tenant
// réellement ouvert dans le navigateur. Voir Utils/gatewayUrls.js.
const GATEWAY_URL = getGatewayBaseUrl();

const axiosInstance = axios.create({
    baseURL: `${GATEWAY_URL}/medical`,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor to add auth token dynamically on each request
axiosInstance.interceptors.request.use(
    (config) => {
        const token = getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor — rafraîchissement automatique du token expiré,
// même pattern déjà éprouvé dans axiosInstanceCompta.js (extrait ici pour
// que TOUS les appels passant par cette instance — dont platformAdminApi.js,
// utilisée par le Tenant Management — en bénéficient aussi. Avant ce
// correctif, un access token expiré (30 min de durée de vie) faisait
// échouer silencieusement en 401 tout appel via cette instance sans jamais
// retenter, y compris en plein milieu de l'assistant de création de tenant.
let isRefreshing = false;
let refreshQueue = [];

const drainRefreshQueue = (error, token = null) => {
    refreshQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve(token);
    });
    refreshQueue = [];
};

axiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        // Cycle de vie du tenant, Phase 3 — placé AVANT toute la logique
        // 401/403 existante ci-dessous : ne se déclenche QUE sur les deux
        // corps de réponse structurés précis (voir fultangErrorEvents.js),
        // donc sans jamais modifier le comportement actuel pour un 401/403
        // "ordinaire" (rafraîchissement de token, permission insuffisante).
        if (dispatchFultangErrorEvent(error)) {
            return Promise.reject(error);
        }

        const originalRequest = error.config;
        const status = error.response?.status;

        if (status === 401 && originalRequest && !originalRequest._retry) {
            const refreshToken = getRefreshToken();
            if (refreshToken) {
                if (isRefreshing) {
                    return new Promise((resolve, reject) => {
                        refreshQueue.push({ resolve, reject });
                    }).then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return axiosInstance(originalRequest);
                    });
                }

                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    const { data } = await axios.post(`${GATEWAY_URL}/auth/refresh`, {
                        refresh_token: refreshToken,
                    });
                    const newToken = data.access_token;
                    localStorage.setItem('token_key_fultang', newToken);
                    drainRefreshQueue(null, newToken);
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return axiosInstance(originalRequest);
                } catch (refreshError) {
                    drainRefreshQueue(refreshError, null);
                    console.warn('Session expirée — reconnectez-vous.');
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            }
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;