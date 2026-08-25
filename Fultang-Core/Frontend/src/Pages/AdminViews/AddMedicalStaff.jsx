import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { User, ShieldAlert, Award, Calendar, Mail, Phone, MapPin, DollarSign, Building } from 'lucide-react';
import { message, Select, Input, Button, Card } from 'antd';
import { CustomDashboard } from '../../GlobalComponents/CustomDashboard.jsx';
import { AdminNavBar } from './AdminNavBar.jsx';
import { newAdminNavLink } from './newAdminNavLink.js';
import { createPersonnel } from '../../services/personnelApi';
import { createMedecin } from '../../services/medecinsApi';
import { getAllServices } from '../../services/servicesApi';

export function AddMedicalStaff() {
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

    const MEDICAL_ROLES = [
        { value: 'medecin', label: 'Médecin' },
        { value: 'infirmier', label: 'Infirmier / Infirmière' },
        { value: 'laborantin', label: 'Laborantin' },
        { value: 'pharmacien', label: 'Pharmacien' }
    ];

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
        fetchServices();
    }, []);

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

    const handleSelectChange = (value, name) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
        setApiError(null);
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.nom.trim()) newErrors.nom = 'Nom obligatoire';
        if (!formData.date_naissance) newErrors.date_naissance = 'Date de naissance obligatoire';
        if (!formData.email.trim()) newErrors.email = 'Email obligatoire';
        if (!formData.contact.trim()) {
            newErrors.contact = 'Contact obligatoire';
        } else if (!/^6\d{8}$/.test(formData.contact)) {
            newErrors.contact = 'Format invalide (ex: 6XXXXXXXX)';
        }
        if (!formData.poste) newErrors.poste = 'Poste obligatoire';



        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const formatErrorMessage = (errorData) => {
        if (typeof errorData === 'string') return errorData;
        if (errorData.erreurs) {
            const messages = [];
            for (const [field, fieldErrors] of Object.entries(errorData.erreurs)) {
                const errorList = Array.isArray(fieldErrors) ? fieldErrors : [fieldErrors];
                messages.push(`${field}: ${errorList.join(', ')}`);
            }
            return messages.join('\n');
        }
        if (errorData.detail) return errorData.detail;
        return JSON.stringify(errorData);
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        setApiError(null);

        try {
            const dataToSend = {
                nom: formData.nom.trim(),
                prenom: formData.prenom.trim() || '',
                date_naissance: formData.date_naissance,
                email: formData.email.trim().toLowerCase(),
                contact: formData.contact.trim(),
                poste: formData.poste
            };

            if (formData.service) {
                dataToSend.service = parseInt(formData.service, 10);
            }
            if (formData.adresse && formData.adresse.trim()) {
                dataToSend.adresse = formData.adresse.trim();
            }

            if (formData.poste === 'medecin') {
                await createMedecin(dataToSend);
                message.success('Médecin créé avec succès. Un email contenant son mot de passe lui a été envoyé.');
            } else {
                await createPersonnel(dataToSend);
                message.success('Membre du personnel médical créé avec succès.');
            }

            resetForm();
        } catch (error) {
            console.error('Error creating medical staff:', error);
            const errorData = error.response?.data || {};
            setApiError(formatErrorMessage(errorData));
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

    return (
        <CustomDashboard linkList={newAdminNavLink} requiredRole={"Admin"}>
            <AdminNavBar />
            <div className="p-6 max-w-4xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-start to-primary-end flex items-center justify-center text-white shadow-md">
                            <User className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Ajouter du Personnel Médical</h1>
                            <p className="text-gray-500 text-sm">Enregistrer un nouveau médecin, infirmier, laborantin ou pharmacien</p>
                        </div>
                    </div>

                    <Card className="shadow-lg border-gray-100 rounded-2xl overflow-hidden bg-white/80 backdrop-blur-sm">
                        {apiError && (
                            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-start gap-3">
                                <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-red-800">Une erreur est survenue</h4>
                                    <p className="text-red-700 text-sm whitespace-pre-line mt-1">{apiError}</p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nom *</label>
                                    <Input
                                        name="nom"
                                        placeholder="Nom de famille"
                                        value={formData.nom}
                                        onChange={handleChange}
                                        className={`rounded-xl h-11 ${errors.nom ? 'border-red-500' : ''}`}
                                    />
                                    {errors.nom && <span className="text-red-500 text-xs mt-1 block">{errors.nom}</span>}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Prénom</label>
                                    <Input
                                        name="prenom"
                                        placeholder="Prénom"
                                        value={formData.prenom}
                                        onChange={handleChange}
                                        className="rounded-xl h-11"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Date de Naissance *</label>
                                    <div className="relative">
                                        <Input
                                            type="date"
                                            name="date_naissance"
                                            value={formData.date_naissance}
                                            onChange={handleChange}
                                            className={`rounded-xl h-11 ${errors.date_naissance ? 'border-red-500' : ''}`}
                                        />
                                    </div>
                                    {errors.date_naissance && <span className="text-red-500 text-xs mt-1 block">{errors.date_naissance}</span>}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Poste Médical *</label>
                                    <Select
                                        placeholder="Sélectionner le poste"
                                        value={formData.poste || undefined}
                                        onChange={(val) => handleSelectChange(val, 'poste')}
                                        className={`w-full h-11 rounded-xl ${errors.poste ? 'border-red-500' : ''}`}
                                        options={MEDICAL_ROLES}
                                    />
                                    {errors.poste && <span className="text-red-500 text-xs mt-1 block">{errors.poste}</span>}
                                </div>



                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Service Affecté</label>
                                    <Select
                                        placeholder="Sélectionner le service"
                                        value={formData.service || undefined}
                                        onChange={(val) => handleSelectChange(val, 'service')}
                                        className="w-full h-11 rounded-xl"
                                        options={services.map(s => ({ value: s.id, label: s.nom_service }))}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                                    <Input
                                        type="email"
                                        name="email"
                                        placeholder="exemple@fultang.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className={`rounded-xl h-11 ${errors.email ? 'border-red-500' : ''}`}
                                    />
                                    {errors.email && <span className="text-red-500 text-xs mt-1 block">{errors.email}</span>}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Numéro de Contact *</label>
                                    <Input
                                        name="contact"
                                        placeholder="6XXXXXXXX"
                                        value={formData.contact}
                                        onChange={handleChange}
                                        className={`rounded-xl h-11 ${errors.contact ? 'border-red-500' : ''}`}
                                    />
                                    {errors.contact && <span className="text-red-500 text-xs mt-1 block">{errors.contact}</span>}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Adresse</label>
                                    <Input
                                        name="adresse"
                                        placeholder="Adresse de résidence"
                                        value={formData.adresse}
                                        onChange={handleChange}
                                        className="rounded-xl h-11"
                                    />
                                </div>


                            </div>

                            <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
                                <Button
                                    type="default"
                                    onClick={resetForm}
                                    className="h-11 rounded-xl px-6 font-medium text-gray-600 border-gray-200 hover:bg-gray-50 transition-colors"
                                >
                                    Réinitialiser
                                </Button>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    loading={loading}
                                    className="h-11 rounded-xl px-8 font-semibold bg-gradient-to-r from-primary-start to-primary-end border-none shadow-md hover:shadow-lg transition-all"
                                >
                                    Enregistrer le Personnel
                                </Button>
                            </div>
                        </form>
                    </Card>
                </motion.div>
            </div>
        </CustomDashboard>
    );
}

export default AddMedicalStaff;
