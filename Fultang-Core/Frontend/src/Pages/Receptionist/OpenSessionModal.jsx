import { useState, useEffect } from 'react';
import { Modal, Select } from 'antd';
import { FolderOpen, User, Building2 } from 'lucide-react';
import { createSession, putSessionEnAttente, rediriggerPatient } from '../../services/sessionsApi';
import { getAllServices } from '../../services/servicesApi';
import { useAuthentication } from '../../Utils/Provider';
import { useFeedback } from '../../contexts/FeedbackContext.jsx';

/**
 * Modal pour ouvrir une session pour un patient.
 * Le réceptionniste sélectionne le service vers lequel diriger le patient.
 * 
 * @param {boolean} isOpen - État d'ouverture du modal
 * @param {function} onClose - Callback de fermeture  
 * @param {Object} patient - Patient sélectionné
 * @param {function} onSuccess - Callback après création réussie
 */
export function OpenSessionModal({ isOpen, onClose, patient, onSuccess, mode = 'standard', isUpdate = false, sessionId = null }) {
    const [services, setServices] = useState([]);
    const [selectedService, setSelectedService] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingServices, setLoadingServices] = useState(false);
    const { userData } = useAuthentication();
    const { showSuccess, showError, showWarning } = useFeedback();

    useEffect(() => {
        if (isOpen) {
            fetchServices();
        }
    }, [isOpen]);

    const fetchServices = async () => {
        setLoadingServices(true);
        try {
            const response = await getAllServices();
            const data = response.data || response.results || response || [];
            setServices(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching services:', error);
            showError('Erreur lors du chargement des services.', 'Échec du chargement');
        } finally {
            setLoadingServices(false);
        }
    };

    const handleSubmit = async () => {
        if (!selectedService) {
            showWarning('Veuillez sélectionner un service.', 'Champ requis');
            return;
        }

        setLoading(true);
        try {
            if (isUpdate && sessionId) {
                // Mode redirection (Nurse)
                // 1. Trouver le nom du service
                const serviceObj = services.find(s => s.id === selectedService);
                if (!serviceObj) throw new Error("Service not found");

                // 2. Rediriger
                await rediriggerPatient(sessionId, {
                    type: 'service',
                    valeur: serviceObj.nom_service
                });

                // 3. Si mode cashier, mettre en attente
                if (mode === 'cashier') {
                    await putSessionEnAttente(sessionId);
                    showSuccess('Le patient a été redirigé vers la caisse avec succès!', 'Patient redirigé');
                } else {
                    showSuccess('Le patient a été redirigé avec succès!', 'Redirection réussie');
                }
            } else {
                // Mode création (Receptionist)
                const requestData = {
                    id_patient: patient.id,
                    id_service: selectedService,
                    id_personnel: userData?.id
                };

                const response = await createSession(requestData);

                if (mode === 'cashier') {
                    const newSessionId = response.data.id || response.data.data.id;
                    await putSessionEnAttente(newSessionId);
                    showSuccess('Le patient a été envoyé à la caisse avec succès!', 'Patient envoyé');
                } else {
                    showSuccess('La session a été ouverte avec succès!', 'Session ouverte');
                }
            }

            setSelectedService(null);
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error creating session:', error);
            const errorMessage = error.response?.data?.detail || error.response?.data?.error || 'Erreur lors de l\'ouverture de la session.';
            showError(errorMessage, 'Échec');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedService(null);
        onClose();
    };

    return (
        <Modal
            open={isOpen}
            onCancel={handleClose}
            footer={null}
            width={500}
            centered
        >
            <div className="p-2">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-r from-primary-start to-primary-end rounded-full flex items-center justify-center mb-4">
                        <FolderOpen className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">
                        {mode === 'cashier' ? 'Envoyer à la caisse' : 'Ouvrir une session'}
                    </h2>
                    <p className="text-gray-600 mt-2">
                        {mode === 'cashier'
                            ? 'Sélectionner le service de destination pour le paiement'
                            : 'Envoyer le patient vers un service'}
                    </p>
                </div>

                {/* Info patient */}
                {patient && (
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-800">
                                    {patient.nom} {patient.prenom}
                                </p>
                                <p className="text-sm text-gray-600">
                                    Matricule: {patient.matricule}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sélection du service */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Select service
                        </div>
                    </label>
                    <Select
                        className="w-full"
                        size="large"
                        placeholder="Choisir un service..."
                        loading={loadingServices}
                        value={selectedService}
                        onChange={(value) => setSelectedService(value)}
                        options={services.map(service => ({
                            value: service.id,
                            label: service.nom_service
                        }))}
                        showSearch
                        optionFilterProp="label"
                        filterOption={(input, option) =>
                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                    />
                    {services.length === 0 && !loadingServices && (
                        <p className="text-sm text-orange-600 mt-2">
                            Aucun service available. Please en créer un d'abord.
                        </p>
                    )}
                </div>

                {/* Boutons */}
                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading || !selectedService}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {loading ? 'Traitement...' : (mode === 'cashier' ? 'Envoyer à la caisse' : (isUpdate ? 'Rediriger' : 'Ouvrir la session'))}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export default OpenSessionModal;
