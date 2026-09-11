import axiosInstance from '../Utils/axiosInstance';
import { getGatewayBaseUrl } from '../Utils/gatewayUrls.js';

const infrastructureBase = () => `${getGatewayBaseUrl()}/infrastructure`;

export const getAllBatiments = async () => {
    const response = await axiosInstance.get(`${infrastructureBase()}/batiments/`);
    return response.data;
};

export const createBatiment = async (data) => {
    const response = await axiosInstance.post(`${infrastructureBase()}/batiments/`, data);
    return response.data;
};

export const getAllEtages = async (batimentId) => {
    const params = batimentId ? { batiment: batimentId } : {};
    const response = await axiosInstance.get(`${infrastructureBase()}/etages/`, { params });
    return response.data;
};

export const createEtage = async (data) => {
    const response = await axiosInstance.post(`${infrastructureBase()}/etages/`, data);
    return response.data;
};

export const getTypesBatiment = async () => {
    const response = await axiosInstance.get(`${infrastructureBase()}/types-batiment/`);
    return response.data;
};
