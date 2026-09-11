import axiosInstanceCompta from '../Utils/axiosInstanceCompta';

/** Catalogue prestations examens (CORR-A3-016) */
export const getExamPrestations = async () => {
    const response = await axiosInstanceCompta.get('/prestations-de-service/');
    const raw = response.data?.results || response.data || [];
    return raw.filter(
        (p) => p.actif !== false && ['laboratoire', 'imagerie'].includes(p.type_prestation),
    );
};
