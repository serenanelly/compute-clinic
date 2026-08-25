/**
 * Service API pour la Comptabilité Matière
 * Se connecte au backend Fultang pour les opérations de gestion de stock
 */
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_BACKEND_COMPTABILITE_MATIERE_URL || "http://127.0.0.1:8080/compta-matiere";
const GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || "http://127.0.0.1:8080";

// Instance Axios pour la comptabilité matière
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Intercepteur pour ajouter le token si disponible
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token_key_fultang");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Helper pour charger toutes les pages d'une API paginée
async function fetchAllPages(endpoint) {
    let allResults = [];
    let url = endpoint;

    while (url) {
        const response = await apiClient.get(url);
        const data = response.data;

        // Si c'est une réponse paginée
        if (data.results) {
            allResults = [...allResults, ...data.results];
            // Extraire le chemin relatif du next URL
            if (data.next) {
                const nextUrl = new URL(data.next);
                url = nextUrl.pathname + nextUrl.search;
            } else {
                url = null;
            }
        } else {
            // Si ce n'est pas paginé, retourner directement
            return data;
        }
    }

    return allResults;
}

// ============================================
// MATÉRIELS MÉDICAUX
// URL Backend: GET /api/materiels-medicaux/
// Opération: Récupération de la liste des consommables médicaux
// ============================================
export const materielMedicalApi = {
    getAll: async () => {
        // Charger toutes les pages
        return await fetchAllPages("/materiels-medicaux/");
    },
    getById: async (id) => {
        const response = await apiClient.get(`/materiels-medicaux/${id}/`);
        return response.data;
    },
    create: async (data) => {
        const response = await apiClient.post("/materiels-medicaux/", data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await apiClient.put(`/materiels-medicaux/${id}/`, data);
        return response.data;
    },
    patch: async (id, data) => {
        const response = await apiClient.patch(`/materiels-medicaux/${id}/`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await apiClient.delete(`/materiels-medicaux/${id}/`);
        return response.data;
    }
};

// ============================================
// MATÉRIELS DURABLES
// URL Backend: GET /api/materiels-durables/
// Opération: Récupération de la liste des équipements (lits, machines...)
// ============================================
export const materielDurableApi = {
    getAll: async () => {
        const response = await apiClient.get("/materiels-durables/");
        return response.data;
    },
    getById: async (id) => {
        const response = await apiClient.get(`/materiels-durables/${id}/`);
        return response.data;
    },
    create: async (data) => {
        const response = await apiClient.post("/materiels-durables/", data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await apiClient.put(`/materiels-durables/${id}/`, data);
        return response.data;
    },
    patch: async (id, data) => {
        const response = await apiClient.patch(`/materiels-durables/${id}/`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await apiClient.delete(`/materiels-durables/${id}/`);
        return response.data;
    }
};

// ============================================
// ARCHIVES D'INVENTAIRE
// URL Backend: GET /api/archives-inventaire/
// Opération: Historique des inventaires réalisés
// ============================================
export const archiveInventaireApi = {
    getAll: async () => {
        return await fetchAllPages("/archives-inventaire/");
    },
    getById: async (id) => {
        const response = await apiClient.get(`/archives-inventaire/${id}/`);
        return response.data;
    },
    create: async (data) => {
        const response = await apiClient.post("/archives-inventaire/", data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await apiClient.put(`/archives-inventaire/${id}/`, data);
        return response.data;
    },
    patch: async (id, data) => {
        const response = await apiClient.patch(`/archives-inventaire/${id}/`, data);
        return response.data;
    },
    terminer: async (id) => {
        const response = await apiClient.post(`/archives-inventaire/${id}/terminer/`);
        return response.data;
    },
    delete: async (id) => {
        const response = await apiClient.delete(`/archives-inventaire/${id}/`);
        return response.data;
    }
};

// ============================================
// LIGNES D'ARCHIVE D'INVENTAIRE
// URL Backend: GET /api/lignes-archive/
// Opération: Détails des produits pour un inventaire donné
// ============================================
export const ligneArchiveApi = {
    getAll: async () => {
        return await fetchAllPages("/lignes-archive/");
    },
    getByArchive: async (archiveId) => {
        const response = await apiClient.get(`/lignes-archive/?archive=${archiveId}`);
        return response.data;
    },
    getById: async (id) => {
        const response = await apiClient.get(`/lignes-archive/${id}/`);
        return response.data;
    },
    create: async (data) => {
        const response = await apiClient.post("/lignes-archive/", data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await apiClient.put(`/lignes-archive/${id}/`, data);
        return response.data;
    },
    patch: async (id, data) => {
        const response = await apiClient.patch(`/lignes-archive/${id}/`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await apiClient.delete(`/lignes-archive/${id}/`);
        return response.data;
    }
};

// ============================================
// SORTIES
// URL Backend: GET /api/sorties/
// Opération: Gestion des sorties de stock vers les services
// ============================================
export const sortieApi = {
    getAll: async () => {
        return await fetchAllPages("/sorties/");
    },
    getById: async (id) => {
        const response = await apiClient.get(`/sorties/${id}/`);
        return response.data;
    },
    create: async (data) => {
        const response = await apiClient.post("/sorties/", data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await apiClient.put(`/sorties/${id}/`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await apiClient.delete(`/sorties/${id}/`);
        return response.data;
    }
};

// ============================================
// LIGNES DE SORTIE
// URL Backend: GET /api/lignes-sortie/
// Opération: Détail des produits contenus dans une sortie
// ============================================
export const ligneSortieApi = {
    getAll: async () => {
        return await fetchAllPages("/lignes-sortie/");
    },
    getBySortie: async (sortieId) => {
        const response = await apiClient.get(`/lignes-sortie/?sortie=${sortieId}`);
        return response.data;
    },
    create: async (data) => {
        const response = await apiClient.post("/lignes-sortie/", data);
        return response.data;
    },
    delete: async (id) => {
        const response = await apiClient.delete(`/lignes-sortie/${id}/`);
        return response.data;
    }
};

// ============================================
// RAPPORTS
// URL Backend: GET /api/rapports/
// Opération: Rapports générés par le système ou les utilisateurs
// ============================================
export const rapportApi = {
    getAll: async () => {
        return await fetchAllPages("/rapports/");
    },
    // Récupérer les rapports envoyés par un utilisateur
    getSentBy: async (userId) => {
        const response = await apiClient.get(`/rapports/sent/`, { params: { user_id: userId } });
        return response.data;
    },
    // Récupérer les rapports reçus par un utilisateur
    getReceivedBy: async (userId) => {
        const response = await apiClient.get(`/rapports/received/`, { params: { user_id: userId } });
        return response.data;
    },
    // Récupérer tous les rapports d'un utilisateur (envoyés + reçus)
    getByUser: async (userId) => {
        const [sentRes, receivedRes] = await Promise.all([
            apiClient.get(`/rapports/sent/`, { params: { user_id: userId } }),
            apiClient.get(`/rapports/received/`, { params: { user_id: userId } }),
        ]);
        const sent = sentRes.data;
        const received = receivedRes.data;
        return {
            sent: Array.isArray(sent) ? sent : (sent?.results || []),
            received: Array.isArray(received) ? received : (received?.results || []),
        };
    },
    getById: async (id) => {
        const response = await apiClient.get(`/rapports/${id}/`);
        return response.data;
    },
    create: async (data) => {
        const response = await apiClient.post("/rapports/", data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await apiClient.put(`/rapports/${id}/`, data);
        return response.data;
    },
    patch: async (id, data) => {
        const response = await apiClient.patch(`/rapports/${id}/`, data);
        return response.data;
    },
    marquerLu: async (id) => {
        const response = await apiClient.post(`/rapports/${id}/mark-read/`);
        return response.data;
    },
    delete: async (id) => {
        const response = await apiClient.delete(`/rapports/${id}/`);
        return response.data;
    }
};

export function getPersonnelId() {
    return localStorage.getItem("personnel_id") || "";
}

export const besoinApi = {
    getAll: async () => {
        return await fetchAllPages("/besoins/");
    },
    getById: async (id) => {
        const response = await apiClient.get(`/besoins/${id}/`);
        return response.data;
    },
    create: async (data) => {
        const response = await apiClient.post("/besoins/", data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await apiClient.put(`/besoins/${id}/`, data);
        return response.data;
    },
    patch: async (id, data) => {
        const response = await apiClient.patch(`/besoins/${id}/`, data);
        return response.data;
    },
    valider: async (id, data = {}) => {
        const response = await apiClient.patch(`/besoins/${id}/`, { ...data, statut: "EN_COURS" });
        return response.data;
    },
    rejeter: async (id, commentaire) => {
        const response = await apiClient.patch(`/besoins/${id}/`, {
            statut: "REJETE",
            commentaire_directeur: commentaire
        });
        return response.data;
    },
    traiter: async (id, data = {}) => {
        const response = await apiClient.patch(`/besoins/${id}/`, { ...data, statut: "TRAITE" });
        return response.data;
    },
    delete: async (id) => {
        const response = await apiClient.delete(`/besoins/${id}/`);
        return response.data;
    }
};

// ============================================
// LIGNES DE BESOIN
// ============================================
export const ligneBesoinApi = {
    getAll: async () => {
        const response = await apiClient.get("/lignes-besoin/");
        return response.data;
    },
    getByBesoin: async (besoinId) => {
        const response = await apiClient.get(`/lignes-besoin/?besoin=${besoinId}`);
        return response.data;
    },
    create: async (data) => {
        const response = await apiClient.post("/lignes-besoin/", data);
        return response.data;
    },
    delete: async (id) => {
        const response = await apiClient.delete(`/lignes-besoin/${id}/`);
        return response.data;
    }
};

// ============================================
// LIVRAISONS
// ============================================
export const livraisonApi = {
    getAll: async () => {
        return await fetchAllPages("/livraisons/");
    },
    getById: async (id) => {
        const response = await apiClient.get(`/livraisons/${id}/`);
        return response.data;
    },
    create: async (data) => {
        const response = await apiClient.post("/livraisons/", data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await apiClient.put(`/livraisons/${id}/`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await apiClient.delete(`/livraisons/${id}/`);
        return response.data;
    }
};

// ============================================
// LIGNES DE LIVRAISON
// ============================================
export const ligneLivraisonApi = {
    getAll: async () => {
        return await fetchAllPages("/lignes-livraison/");
    },
    getByLivraison: async (livraisonId) => {
        const response = await apiClient.get(`/lignes-livraison/?livraison=${livraisonId}`);
        return response.data;
    },
    create: async (data) => {
        const response = await apiClient.post("/lignes-livraison/", data);
        return response.data;
    },
    delete: async (id) => {
        const response = await apiClient.delete(`/lignes-livraison/${id}/`);
        return response.data;
    }
};

// ============================================
// FONCTIONS HELPERS POUR DASHBOARD
// ============================================

/**
 * Récupère les statistiques du dashboard pharmacien
 */
export async function getPharmacistDashboardStats() {
    try {
        // Récupérer les matériels médicaux
        const medications = await materielMedicalApi.getAll();
        const medsArray = Array.isArray(medications) ? medications : (medications.results || []);

        // Récupérer les sorties du jour (ventes)
        const sorties = await sortieApi.getAll();
        const sortiesArray = Array.isArray(sorties) ? sorties : (sorties.results || []);

        const today = new Date().toISOString().split('T')[0];
        const todaySales = sortiesArray.filter(s =>
            s.date_sortie?.startsWith(today) && s.motif_sortie === 'VENTE'
        );

        // Calculer les statistiques
        const lowStock = medsArray.filter(m => (m.quantite_stock || 0) <= (m.seuil_alerte || 20));

        return {
            medications: medsArray,
            todaySales: todaySales,
            totalMedications: medsArray.length,
            lowStock: lowStock.length,
            salesCount: todaySales.length
        };
    } catch (error) {
        console.error("Erreur lors de la récupération des stats pharmacien:", error);
        throw error;
    }
}

// Client personnel (service Personnel via gateway, pas compta matière)
const personnelClient = axios.create({
    baseURL: `${GATEWAY_URL}/personnel/personnel`,
    headers: { 'Content-Type': 'application/json' },
});

personnelClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token_key_fultang");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ============================================
// PERSONNEL (service Personnel /personnel/personnel/)
// ============================================
export const personnelApi = {
    getAll: async () => {
        const response = await personnelClient.get("/", { params: { page_size: 1000 } });
        return response.data.results || response.data;
    },
    getById: async (id) => {
        const response = await personnelClient.get(`/${id}/`);
        return response.data;
    }
};

// Alias utilisés par PharmacyNeeds.jsx et pages legacy
export const getAllBesoins = (...args) => besoinApi.getAll(...args);
export const createBesoin = (...args) => besoinApi.create(...args);
export const createLigneBesoin = (...args) => ligneBesoinApi.create(...args);
export const getAllMateriels = (...args) => materielMedicalApi.getAll(...args);
export const getLignesBesoin = (besoinId) => ligneBesoinApi.getByBesoin(besoinId);

export default apiClient;
