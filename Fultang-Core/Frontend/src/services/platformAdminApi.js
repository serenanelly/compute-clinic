import axiosInstance from '../Utils/axiosInstance';
import { getGatewayBaseUrl } from '../Utils/gatewayUrls';

/**
 * Service API pour le back-office Platform Admin.
 * Centralise les appels vers le Tenant Registry (tenant-service), via la
 * Gateway (préfixe /tenants/**), réservés au rôle PLATFORM_ADMIN côté
 * backend (voir tenant-service/tenants/permissions.py::IsPlatformAdmin).
 */

const BASE_URL = () => `${getGatewayBaseUrl()}/tenants`;

/**
 * Liste tous les tenants du registre.
 * @returns {Promise<Array>} Liste des tenants {id, name, identifier, status, created_at}
 */
export const getAllTenants = async () => {
    const response = await axiosInstance.get(`${BASE_URL()}/tenants/`);
    return response.data;
};

/**
 * Liste tous les services du catalogue plateforme.
 * @returns {Promise<Array>} Liste des services {code, name, status, created_at}
 */
export const getAllPlatformServices = async () => {
    const response = await axiosInstance.get(`${BASE_URL()}/platform-services/`);
    return response.data;
};

/**
 * Crée un nouveau tenant.
 * @param {Object} payload {name, identifier, address?, phone?, email?, logo_url?, allow_clinical_agent_export?}
 * @returns {Promise<Object>} Le tenant créé
 */
export const createTenant = async (payload) => {
    const response = await axiosInstance.post(`${BASE_URL()}/tenants/`, payload);
    return response.data;
};

/**
 * Récupère un tenant par son id.
 * @param {string} id
 * @returns {Promise<Object>} Le tenant
 */
export const getTenant = async (id) => {
    const response = await axiosInstance.get(`${BASE_URL()}/tenants/${id}/`);
    return response.data;
};

/**
 * Met à jour partiellement un tenant (profil et/ou configuration technique).
 * @param {string} id
 * @param {Object} payload champs à modifier
 * @returns {Promise<Object>} Le tenant mis à jour
 */
export const updateTenant = async (id, payload) => {
    const response = await axiosInstance.patch(`${BASE_URL()}/tenants/${id}/`, payload);
    return response.data;
};

/**
 * Suspend ou réactive un établissement (Cycle de vie du tenant, Phase 3).
 * @param {string} id
 * @param {"ACTIVE"|"INACTIVE"} newStatus
 * @returns {Promise<Object>} Le tenant mis à jour
 */
export const updateTenantStatus = async (id, newStatus) => {
    const response = await axiosInstance.patch(`${BASE_URL()}/tenants/${id}/status/`, { status: newStatus });
    return response.data;
};

/**
 * Provisionne les bases de données d'un tenant pour les services plateforme donnés.
 * @param {string} id
 * @param {string[]} serviceCodes ex. ["PERSONNEL","MEDICAL","COMPTA","COMPTA_MATIERE","INFRASTRUCTURE"]
 * @returns {Promise<Object>} {tenant, results: [{service, status, database_name, detail}, ...]}
 */
export const provisionTenant = async (id, serviceCodes) => {
    const response = await axiosInstance.post(`${BASE_URL()}/tenants/${id}/provision/`, { services: serviceCodes });
    return response.data;
};

/**
 * Liste le catalogue complet des services fonctionnels (ordonné par display_order).
 * @returns {Promise<Array>} [{code, name, status, display_order, created_at}, ...]
 */
export const getFunctionalServiceCatalog = async () => {
    const response = await axiosInstance.get(`${BASE_URL()}/functional-services/`);
    return response.data;
};

/**
 * Liste la configuration des services fonctionnels d'un tenant donné (fusionnée
 * avec le catalogue : chaque entrée du catalogue apparaît toujours).
 * @param {string} id
 * @returns {Promise<Array>} [{code, name, display_order, enabled}, ...]
 */
export const getTenantFunctionalServices = async (id) => {
    const response = await axiosInstance.get(`${BASE_URL()}/tenants/${id}/functional-services/`);
    return response.data;
};

/**
 * Définit en une fois l'état (activé/désactivé) de plusieurs services
 * fonctionnels pour un tenant. Tout ou rien côté backend.
 * @param {string} id
 * @param {Array<{code:string, enabled:boolean}>} services
 * @returns {Promise<Array>} Liste complète mise à jour (même forme que getTenantFunctionalServices)
 */
export const bulkSetTenantFunctionalServices = async (id, services) => {
    const response = await axiosInstance.post(`${BASE_URL()}/tenants/${id}/functional-services/bulk/`, { services });
    return response.data;
};

/**
 * Active/désactive un unique service fonctionnel pour un tenant.
 * @param {string} id
 * @param {string} code
 * @param {boolean} enabled
 * @returns {Promise<Array>} Liste complète mise à jour (même forme que getTenantFunctionalServices)
 */
export const toggleTenantFunctionalService = async (id, code, enabled) => {
    const response = await axiosInstance.patch(`${BASE_URL()}/tenants/${id}/functional-services/${code}/`, { enabled });
    return response.data;
};

/**
 * Crée le compte administrateur initial d'un tenant (service-personnel) et
 * lui envoie un email de bienvenue avec des identifiants temporaires.
 * @param {string} id
 * @param {Object} payload {nom, prenom?, email}
 * @returns {Promise<Object>} {tenant, admin_created, admin_detail, email_sent, email_detail}
 */
export const provisionTenantAdmin = async (id, payload) => {
    const response = await axiosInstance.post(`${BASE_URL()}/tenants/${id}/provision-admin/`, payload);
    return response.data;
};

/**
 * Envoie (remplace) le logo d'un tenant.
 * @param {string} id
 * @param {File} file image, 2 Mo max
 * @returns {Promise<Object>} Le tenant mis à jour (avec logo_display_url)
 */
export const uploadTenantLogo = async (id, file) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await axiosInstance.post(`${BASE_URL()}/tenants/${id}/logo/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
};

/**
 * Supprime le logo (téléversé) d'un tenant.
 * @param {string} id
 * @returns {Promise<Object>} Le tenant mis à jour
 */
export const deleteTenantLogo = async (id) => {
    const response = await axiosInstance.delete(`${BASE_URL()}/tenants/${id}/logo/`);
    return response.data;
};

/**
 * Liste les bases de données (par service plateforme) d'un tenant.
 * @param {string} id
 * @returns {Promise<Array>} [{id, tenant, service, database_name, host, port, status, secret_reference, created_at, updated_at}, ...]
 */
export const getTenantDatabases = async (id) => {
    const response = await axiosInstance.get(`${BASE_URL()}/tenant-databases/`, { params: { tenant: id } });
    return response.data;
};

/**
 * Liste le journal des actions d'administration (audit trail).
 * @param {Object} [params] {tenant?, actor?, action?, date_from?, date_to?}
 * @returns {Promise<Array>} [{id, actor_id, actor_email, action, target_tenant_id, target_tenant_identifier, description, metadata, created_at}, ...]
 */
export const getAdminLogs = async (params = {}) => {
    const response = await axiosInstance.get(`${BASE_URL()}/admin-logs/`, { params });
    return response.data;
};
