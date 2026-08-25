import { useState, useEffect } from 'react';
import { Modal, message, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';
import { createPersonnel } from '../../../services/personnelApi';
import { createMedecin } from '../../../services/medecinsApi';
import { getAllServices } from '../../../services/servicesApi';

/**
 * Modal pour ajouter un nouveau personnel.
 * Le mot de passe est auto-genere et envoye par email.
 * Si le poste est 'medecin', utilise l'endpoint /api/medecins/ avec le champ specialite.
 */
export function AddPersonnelModal({ isOpen, onClose, onSuccess }) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [services, setServices] = useState([]);
    const [apiError, setApiError] = useState(null);

    const [formData, setFormData] = useState({
        nom: '',
        prenom: '',
        date_naissance: '',
        email: '',
        contact: '',
        poste: '',
        service: '',
        adresse: ''
    });

    const POSTES = [
        { value: 'receptioniste', label: t('personnel.positions.receptioniste') },
        { value: 'caissier', label: t('personnel.positions.caissier') },
        { value: 'infirmier', label: t('personnel.positions.infirmier') },
        { value: 'medecin', label: t('personnel.positions.medecin') },
        { value: 'laborantin', label: t('personnel.positions.laborantin') },
        { value: 'pharmacien', label: t('personnel.positions.pharmacien') },
        { value: 'comptable', label: t('personnel.positions.comptable') },
        { value: 'directeur', label: t('personnel.positions.directeur') }
    ];

    // Specialites medicales courantes
    const SPECIALITES = [
        'Médecine Générale',
        'Cardiologie',
        'Dermatologie',
        'Gynécologie',
        'Neurologie',
        'Ophtalmologie',
        'Pédiatrie',
        'Psychiatrie',
        'Radiologie',
        'Chirurgie',
        'ORL',
        'Autre'
    ];

    useEffect(() => {
        if (isOpen) {
            fetchServices();
            setApiError(null);
        }
    }, [isOpen]);

    const fetchServices = async () => {
        try {
            const response = await getAllServices();
            const servicesData = response.results || response.data || response || [];
            setServices(servicesData);
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
        setApiError(null);
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.nom.trim()) newErrors.nom = t('services.required');
        if (!formData.date_naissance) newErrors.date_naissance = t('services.required');
        if (!formData.email.trim()) newErrors.email = t('services.required');
        if (!formData.contact.trim()) {
            newErrors.contact = t('services.required');
        } else if (!/^6\d{8}$/.test(formData.contact)) {
            newErrors.contact = t('services.phoneFormat');
        }
        if (!formData.poste) newErrors.poste = t('services.required');



        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const formatErrorMessage = (errorData) => {
        if (typeof errorData === 'string') return errorData;

        if (errorData.erreurs) {
            const erreurs = errorData.erreurs;
            const messages = [];
            for (const [field, fieldErrors] of Object.entries(erreurs)) {
                const errorList = Array.isArray(fieldErrors) ? fieldErrors : [fieldErrors];
                messages.push(`${field}: ${errorList.join(', ')}`);
            }
            return messages.join('\n');
        }

        if (errorData.detail) return errorData.detail;
        if (errorData.error) return `${errorData.error}: ${errorData.detail || ''}`;

        return JSON.stringify(errorData);
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setLoading(true);
        setApiError(null);

        try {
            // Preparer les donnees de base
            const dataToSend = {
                nom: formData.nom.trim(),
                prenom: formData.prenom.trim() || '',
                date_naissance: formData.date_naissance,
                email: formData.email.trim().toLowerCase(),
                contact: formData.contact.trim(),
                poste: formData.poste
            };

            // Ajouter les champs optionnels
            if (formData.service) {
                dataToSend.service = parseInt(formData.service, 10);
            }
            if (formData.adresse && formData.adresse.trim()) {
                dataToSend.adresse = formData.adresse.trim();
            }

            console.log('Sending data:', dataToSend);

            // Si le poste est medecin, utiliser l'endpoint /api/medecins/
            if (formData.poste === 'medecin') {
                await createMedecin(dataToSend);
                message.success('Médecin créé avec succès. Un email a été envoyé avec le mot de passe.');
            } else {
                await createPersonnel(dataToSend);
                message.success(t('personnel.createSuccess'));
            }

            resetForm();
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error creating personnel:', error);
            const errorData = error.response?.data;
            const errorMsg = formatErrorMessage(errorData);
            setApiError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            nom: '', prenom: '', date_naissance: '', email: '',
            contact: '', poste: '', service: '', adresse: ''
        });
        setErrors({});
        setApiError(null);
    };

    // Verifier si le poste selectionne est medecin
    const isMedecin = formData.poste === 'medecin';

    return (
        <Modal
            title={<div className="flex items-center gap-2"><User className="w-5 h-5 text-primary-end" /><span>{t('personnel.addPersonnel')}</span></div>}
            open={isOpen}
            onCancel={() => { resetForm(); onClose(); }}
            onOk={handleSubmit}
            confirmLoading={loading}
            okText={t('common.save')}
            cancelText={t('common.cancel')}
            width={700}
        >
            <div className="space-y-4 py-4">
                {/* Affichage des erreurs API */}
                {apiError && (
                    <Alert
                        type="error"
                        message={t('common.error')}
                        description={<pre className="whitespace-pre-wrap text-sm">{apiError}</pre>}
                        showIcon
                        closable
                        onClose={() => setApiError(null)}
                    />
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('personnel.lastName')} <span className="text-red-500">*</span>
                        </label>
                        <input type="text" name="nom" value={formData.nom} onChange={handleChange}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-end ${errors.nom ? 'border-red-500' : 'border-gray-300'}`} />
                        {errors.nom && <p className="text-red-500 text-xs mt-1">{errors.nom}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('personnel.firstName')}
                        </label>
                        <input type="text" name="prenom" value={formData.prenom} onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('personnel.birthDate')} <span className="text-red-500">*</span>
                        </label>
                        <input type="date" name="date_naissance" value={formData.date_naissance} onChange={handleChange}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-end ${errors.date_naissance ? 'border-red-500' : 'border-gray-300'}`} />
                        {errors.date_naissance && <p className="text-red-500 text-xs mt-1">{errors.date_naissance}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('personnel.email')} <span className="text-red-500">*</span>
                        </label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange}
                            placeholder="exemple@hospital.cm"
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-end ${errors.email ? 'border-red-500' : 'border-gray-300'}`} />
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('personnel.phone')} <span className="text-red-500">*</span>
                        </label>
                        <input type="text" name="contact" value={formData.contact} onChange={handleChange}
                            placeholder="677123456" maxLength={9}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-end ${errors.contact ? 'border-red-500' : 'border-gray-300'}`} />
                        <p className="text-xs text-gray-500 mt-1">{t('services.phoneFormat')}</p>
                        {errors.contact && <p className="text-red-500 text-xs mt-1">{errors.contact}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('personnel.position')} <span className="text-red-500">*</span>
                        </label>
                        <select name="poste" value={formData.poste} onChange={handleChange}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-end ${errors.poste ? 'border-red-500' : 'border-gray-300'}`}>
                            <option value="">{t('services.selectPosition')}</option>
                            {POSTES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                        {errors.poste && <p className="text-red-500 text-xs mt-1">{errors.poste}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('personnel.service')}</label>
                        <select name="service" value={formData.service} onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end">
                            <option value="">{t('personnel.selectService')}</option>
                            {services.map(s => <option key={s.id} value={s.id}>{s.nom_service}</option>)}
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('personnel.address')}</label>
                        <input type="text" name="adresse" value={formData.adresse} onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end" />
                    </div>
                </div>
            </div>
        </Modal>
    );
}
