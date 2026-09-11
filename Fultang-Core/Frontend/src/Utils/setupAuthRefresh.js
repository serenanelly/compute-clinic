/**
 * Intercepteur refresh JWT partagé (CORR-A4-014).
 * Pattern identique à axiosInstanceCompta.js.
 */
import axios from 'axios';
import { getToken, getRefreshToken } from './authToken';
import { getGatewayBaseUrl } from './gatewayUrls';
import { dispatchFultangErrorEvent } from './fultangErrorEvents';

let isRefreshing = false;
let refreshQueue = [];

const drainRefreshQueue = (error, token = null) => {
    refreshQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve(token);
    });
    refreshQueue = [];
};

export const handleSessionExpired = () => {
    localStorage.removeItem('token_key_fultang');
    localStorage.removeItem('refresh_token_fultang');
    localStorage.removeItem('user_data_fultang');
    localStorage.removeItem('user_role_fultang');
    if (!window.location.pathname.includes('/login')) {
        window.alert('Votre session a expiré (30 min d\'inactivité). Veuillez vous reconnecter.');
        window.location.href = '/login';
    }
};

export const isTokenExpired = (token) => {
    if (!token || token.startsWith('fake-')) return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.exp) return false;
        return Date.now() >= payload.exp * 1000;
    } catch {
        return false;
    }
};

export const setupAuthRefresh = (axiosInstance) => {
    axiosInstance.interceptors.response.use(
        (response) => response,
        async (error) => {
            // Cycle de vie du tenant, Phase 3 — placé AVANT toute la logique
            // 401/403 ci-dessous : sans cela, un tenant suspendu (403
            // TENANT_SUSPENDED) serait traité comme une session expirée
            // ordinaire par le bloc status===403 juste en dessous (tentative
            // de refresh puis handleSessionExpired), au lieu d'afficher
            // TenantSuspendedScreen. Ne se déclenche QUE sur les deux corps
            // de réponse structurés précis (voir fultangErrorEvents.js).
            if (dispatchFultangErrorEvent(error)) {
                return Promise.reject(error);
            }

            const originalRequest = error.config;
            const status = error.response?.status;

            if ((status === 401 || status === 403) && originalRequest && !originalRequest._retry) {
                const refreshToken = getRefreshToken();
                if (!refreshToken) {
                    handleSessionExpired();
                    return Promise.reject(error);
                }

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
                    const { data } = await axios.post(`${getGatewayBaseUrl()}/auth/refresh`, {
                        refresh_token: refreshToken,
                    });
                    const newToken = data.access_token;
                    localStorage.setItem('token_key_fultang', newToken);
                    drainRefreshQueue(null, newToken);
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return axiosInstance(originalRequest);
                } catch (refreshError) {
                    drainRefreshQueue(refreshError, null);
                    handleSessionExpired();
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            }

            return Promise.reject(error);
        },
    );
};

export const getValidToken = () => {
    const token = getToken();
    if (token && isTokenExpired(token)) {
        handleSessionExpired();
        return null;
    }
    return token;
};
