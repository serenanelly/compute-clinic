import axios from "axios";
import { getToken } from './authToken';

const axiosInstanceAccountant = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_FULTANG_API_BASE_ACCOUNTANT_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor to add auth token dynamically on each request
// En mode mock, le token est factice — on ne l'envoie pas pour éviter le rejet 401.
axiosInstanceAccountant.interceptors.request.use(
    (config) => {
        const token = getToken();
        const isMockToken = token && token.startsWith('fake-');
        if (token && !isMockToken) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle auth errors and depagination
axiosInstanceAccountant.interceptors.response.use(
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
    (error) => {
        if (error.response && error.response.status === 401) {
            console.warn('Session expired or unauthorized. Please login again.');
            // Optionally redirect to login page
            // window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default axiosInstanceAccountant;