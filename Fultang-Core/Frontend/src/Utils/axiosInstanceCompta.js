/**
 * Axios instance dédiée au microservice Comptabilité Financière.
 *
 * Contrairement à axiosInstanceAccountant.js (buggé, token capturé au load),
 * cette instance utilise un interceptor qui lit le token dynamiquement
 * à chaque requête — identique au pattern de axiosInstance.js.
 *
 * Base URL : VITE_BACKEND_FULTANG_API_BASE_ACCOUNTANT_URL (défaut http://127.0.0.1:8001/api)
 */
import axios from "axios";
import { getToken, getRefreshToken } from './authToken';
import { getGatewayBaseUrl } from './gatewayUrls';
import { dispatchFultangErrorEvent } from './fultangErrorEvents';

// getGatewayBaseUrl() cible le hostname courant (résolution de tenant par
// sous-domaine) — voir axiosInstance.js / Utils/gatewayUrls.js pour le détail.
const GATEWAY_URL = getGatewayBaseUrl();

const axiosInstanceCompta = axios.create({
    baseURL: `${GATEWAY_URL}/compta-financiere`,
    headers: {
        'Content-Type': 'application/json'
    }
});

let isRefreshing = false;
let refreshQueue = [];

const drainRefreshQueue = (error, token = null) => {
    refreshQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve(token);
    });
    refreshQueue = [];
};

// Request interceptor — injection dynamique du token JWT
axiosInstanceCompta.interceptors.request.use(
    (config) => {
        const token = getToken();
        const isMockToken = token && token.startsWith('fake-');
        if (token && !isMockToken) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor — dépagination + rafraîchissement automatique du token
axiosInstanceCompta.interceptors.response.use(
    (response) => {
        if (response.data && typeof response.data === 'object' && Array.isArray(response.data.results)) {
            const arr = response.data.results;
            arr.count = response.data.count;
            arr.next = response.data.next;
            arr.previous = response.data.previous;
            response.data = arr;
        }
        return response;
    },
    async (error) => {
        // Cycle de vie du tenant, Phase 3 — voir axiosInstance.js pour la
        // justification (placé avant toute logique 401/403 existante).
        if (dispatchFultangErrorEvent(error)) {
            return Promise.reject(error);
        }

        const originalRequest = error.config;
        const status = error.response?.status;

        if ((status === 401 || status === 403) && originalRequest && !originalRequest._retry) {
            const refreshToken = getRefreshToken();
            if (refreshToken) {
                if (isRefreshing) {
                    return new Promise((resolve, reject) => {
                        refreshQueue.push({ resolve, reject });
                    }).then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return axiosInstanceCompta(originalRequest);
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
                    return axiosInstanceCompta(originalRequest);
                } catch (refreshError) {
                    drainRefreshQueue(refreshError, null);
                    console.warn('[ComptaFinancière] Session expirée — reconnectez-vous.');
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            }
        }

        return Promise.reject(error);
    }
);

export default axiosInstanceCompta;
