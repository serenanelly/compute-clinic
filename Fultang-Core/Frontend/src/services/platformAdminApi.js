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
