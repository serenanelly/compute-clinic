import axios from "axios";
import { getGatewayBaseUrl } from "./gatewayUrls";

// getGatewayBaseUrl() cible le hostname courant (résolution de tenant par
// sous-domaine) — sans cela, tous les appels médicaux (Doctor/Nurse/
// Patient/Pharmacist/Laboratory...) partiraient vers un hostname fixe
// (VITE_BACKEND_FULTANG_API_BASE_MEDICALSTAFF_URL) au lieu du tenant
// réellement ouvert dans le navigateur. Voir Utils/gatewayUrls.js.
const axiosInstance = axios.create({
    baseURL: `${getGatewayBaseUrl()}/medical`,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor to add auth token dynamically on each request
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token_key_fultang");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle auth errors
axiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            console.warn('Session expired or unauthorized. Please login again.');
            // Optionally redirect to login page
            // window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;