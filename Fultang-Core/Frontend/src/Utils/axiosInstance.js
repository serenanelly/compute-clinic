import axios from "axios";
import { getGatewayBaseUrl } from "./gatewayUrls";
import { getToken } from "./authToken";
import { setupAuthRefresh } from "./setupAuthRefresh.js";

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

axiosInstance.interceptors.request.use(
    (config) => {
        const token = getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

// Rafraîchissement automatique du token expiré — module partagé
// (Utils/setupAuthRefresh.js, aussi utilisé par Utils/Provider.jsx). Le
// détecteur de suspension tenant / service désactivé (Cycle de vie du
// tenant, Phase 3) est appelé EN PREMIER à l'intérieur de ce module, avant
// toute logique 401/403 — voir setupAuthRefresh.js. Note :
// axiosInstanceCompta.js garde encore sa propre logique de refresh
// dupliquée (avec le même détecteur) plutôt que ce module partagé.
setupAuthRefresh(axiosInstance);

export default axiosInstance;
