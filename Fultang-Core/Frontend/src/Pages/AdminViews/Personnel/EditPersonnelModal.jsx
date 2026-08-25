import { useState, useEffect } from 'react';
import { Modal, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';
import { updatePersonnel } from '../../../services/personnelApi';
import { getAllServices } from '../../../services/servicesApi';

/**
 * Modal pour modifier un personnel existant.
 */
export function EditPersonnelModal({ isOpen, onClose, onSuccess, personnel }) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [services, setServices] = useState([]);

    const [formData, setFormData] = useState({
        nom: '', prenom: '', date_naissance: '', email: '',
        contact: '', poste: '', statut: '', service: '', adresse: ''
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

    const STATUTS = [
        { value: 'actif', label: t('personnel.statuses.actif') },
        { value: 'licencie', label: t('personnel.statuses.licencie') },
        { value: 'retraite', label: t('personnel.statuses.retraite') }
    ];

    useEffect(() => {
        if (isOpen) fetchServices();
    }, [isOpen]);

    useEffect(() => {
        if (personnel) {
            setFormData({
                nom: personnel.nom || '',
                prenom: personnel.prenom || '',
                date_naissance: personnel.date_naissance || '',
                email: personnel.email || '',
                contact: personnel.contact || '',
                poste: personnel.poste || '',
                statut: personnel.statut || 'actif',
                service: personnel.service || '',
                adresse: personnel.adresse || ''
            });
        }
    }, [personnel]);

    const fetchServices = async () => {
        try {
            const response = await getAllServices();
            // Gerer les deux formats de reponse
            const servicesData = response.results || response.data || response || [];
            setServices(servicesData);
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.nom.trim()) newErrors.nom = t('services.required');
        if (!formData.email.trim()) newErrors.email = t('services.required');
        if (formData.contact && !/^6\d{8}$/.test(formData.contact)) {
            newErrors.contact = t('services.phoneFormat');
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            const dataToSend = {
                nom: formData.nom.trim(),
                prenom: formData.prenom.trim(),
                date_naissance: formData.date_naissance,
                email: formData.email.trim(),
                contact: formData.contact.trim(),
                poste: formData.poste,
                statut: formData.statut
            };

            // Envoyer service comme entier si selectionne
            if (formData.service && formData.service !== '') {
                dataToSend.service = parseInt(formData.service, 10);
            } else {
                dataToSend.service = null;  // Explicitement null si pas de service
            }

            if (formData.adresse && formData.adresse.trim()) {
                dataToSend.adresse = formData.adresse.trim();
            }

            console.log('Updating personnel with:', dataToSend);  // Debug

            await updatePersonnel(personnel.id, dataToSend);
            message.success(t('personnel.updateSuccess'));
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error updating personnel:', error);
            const errorMsg = error.response?.data?.detail || error.response?.data?.erreurs || 'Error';
            message.error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={<div className="flex items-center gap-2"><User className="w-5 h-5 text-primary-end" /><span>{t('personnel.editPersonnel')}</span></div>}
            open={isOpen}
            onCancel={onClose}
            onOk={handleSubmit}
            confirmLoading={loading}
            okText={t('common.save')}
            cancelText={t('common.cancel')}
            width={700}
        >
            <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('personnel.lastName')} *</label>
                        <input type="text" name="nom" value={formData.nom} onChange={handleChange}
                            className={`w-full px-3 py-2 border rounded-lg ${errors.nom ? 'border-red-500' : 'border-gray-300'}`} />
                        {errors.nom && <p className="text-red-500 text-xs mt-1">{errors.nom}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('personnel.firstName')}</label>
                        <input type="text" name="prenom" value={formData.prenom} onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('personnel.birthDate')}</label>
                        <input type="date" name="date_naissance" value={formData.date_naissance} onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('personnel.email')} *</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange}
                            className={`w-full px-3 py-2 border rounded-lg ${errors.email ? 'border-red-500' : 'border-gray-300'}`} />
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('personnel.phone')}</label>
                        <input type="text" name="contact" value={formData.contact} onChange={handleChange} maxLength={9}
                            className={`w-full px-3 py-2 border rounded-lg ${errors.contact ? 'border-red-500' : 'border-gray-300'}`} />
                        {errors.contact && <p className="text-red-500 text-xs mt-1">{errors.contact}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('personnel.position')}</label>
                        <select name="poste" value={formData.poste} onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                            {POSTES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('personnel.status')}</label>
                        <select name="statut" value={formData.statut} onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                            {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('personnel.service')}</label>
                        <select name="service" value={formData.service} onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                            <option value="">{t('personnel.selectService')}</option>
                            {services.map(s => <option key={s.id} value={s.id}>{s.nom_service}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('personnel.address')}</label>
                        <input type="text" name="adresse" value={formData.adresse} onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                    </div>
                </div>
            </div>
        </Modal>
    );
}
