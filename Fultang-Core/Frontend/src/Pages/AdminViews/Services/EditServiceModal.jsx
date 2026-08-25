import { useState, useEffect } from 'react';
import { Modal, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { updateService } from '../../../services/servicesApi';

/**
 * Modal pour modifier un service existant.
 * Permet de modifier le nom, la description et le chef (par email).
 */
export function EditServiceModal({ isOpen, onClose, onSuccess, service }) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        nom_service: '',
        desc_service: '',
        chef_email: ''
    });

    useEffect(() => {
        if (service) {
            setFormData({
                nom_service: service.nom_service || '',
                desc_service: service.desc_service || '',
                chef_email: service.chef_service_details?.email || ''
            });
        }
    }, [service]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.nom_service.trim()) {
            newErrors.nom_service = t('services.required');
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            await updateService(service.id, formData);
            message.success(t('services.updateSuccess'));
            onSuccess();
            onClose();
        } catch (error) {
            const errorMsg = error.response?.data?.detail || error.response?.data?.erreurs || 'Error';
            message.error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary-end" />
                    <span>{t('services.edit')} - {service?.nom_service}</span>
                </div>
            }
            open={isOpen}
            onCancel={onClose}
            onOk={handleSubmit}
            confirmLoading={loading}
            okText={t('common.save')}
            cancelText={t('common.cancel')}
            width={500}
        >
            <div className="space-y-4 py-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('services.serviceName')} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="nom_service"
                        value={formData.nom_service}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-end ${errors.nom_service ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {errors.nom_service && <p className="text-red-500 text-xs mt-1">{errors.nom_service}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('services.serviceDescription')}
                    </label>
                    <textarea
                        name="desc_service"
                        value={formData.desc_service}
                        onChange={handleChange}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('services.chefService')} ({t('services.email')})
                    </label>
                    <input
                        type="email"
                        name="chef_email"
                        value={formData.chef_email}
                        onChange={handleChange}
                        placeholder="chef@hospital.cm"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        {t('services.optional')} - Entrez l'email d'un personnel existant
                    </p>
                </div>
            </div>
        </Modal>
    );
}
