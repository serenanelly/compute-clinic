import axiosInstance from '../Utils/axiosInstance';
import { getGatewayBaseUrl } from '../Utils/gatewayUrls';

const BASE_URL = `${getGatewayBaseUrl()}/personnel/primes`;

export const getPrimes = async (filters = {}) => {
    const response = await axiosInstance.get(`${BASE_URL}/`, { params: filters });
    return response.data;
};

export const createPrime = async (data) => {
    const response = await axiosInstance.post(`${BASE_URL}/`, data);
    return response.data;
};

export const deletePrime = async (id) => {
    await axiosInstance.delete(`${BASE_URL}/${id}/`);
};
