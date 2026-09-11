import { useState, useEffect, useMemo } from 'react';
import { Modal, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';
import { createPersonnel } from '../../../services/personnelApi';
import { createMedecin } from '../../../services/medecinsApi';
import { getAllServices } from '../../../services/servicesApi';
import { getMyFunctionalServices } from '../../../services/tenantConfigApi';
import { FultangDatePicker } from '../../../GlobalComponents/FultangDatePicker.jsx';
import { isValidPhone, phoneErrorMessage } from '../../../Utils/phoneValidation.js';
import { formatApiError } from '../../../Utils/formatApiError.js';
import {
    buildPostesOptions,
    getServiceId,
    MEDICAL_SPECIALITES,
    POSTE_CATEGORIES,
    POSTE_TO_FUNCTIONAL_SERVICE,
} from '../../../constants/personnelPostes.js';

/**
 * Modal pour ajouter un nouveau personnel.
 *
 * Le mot de passe temporaire est auto-généré côté backend et renvoyé UNE
 * SEULE FOIS dans la réponse de création (`temporary_password`) — aucun
 * envoi d'email n'existe dans ce service (pas d'infrastructure SMTP) : il
 * doit donc être communiqué manuellement par l'administrateur, affiché
 * ici juste après la création puisqu'il ne sera plus jamais récupérable
 * ensuite (seule sa version hashée est stockée).
 * Si le poste est 'medecin', utilise l'endpoint /api/medecins/ avec le champ specialite.
 */
export function AddPersonnelModal({ isOpen, onClose, onSuccess }) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [services, setServices] = useState([]);
    const [servicesError, setServicesError] = useState(null);
    const [apiError, setApiError] = useState(null);
    const [createdCredentials, setCreatedCredentials] = useState(null);
    const [disabledFunctionalServices, setDisabledFunctionalServices] = useState(new Set());
    const [categorie, setCategorie] = useState('');

    const ALL_POSTES = useMemo(() => buildPostesOptions(t), [t]);
    // Un poste dont le service fonctionnel associé est désactivé pour cet
    // établissement n'est pas proposé — voir POSTE_TO_FUNCTIONAL_SERVICE.
    const POSTES = ALL_POSTES.filter((p) => {
        const serviceCode = POSTE_TO_FUNCTIONAL_SERVICE[p.value];
        return !serviceCode || !disabledFunctionalServices.has(serviceCode);
    });
    const filteredPostes = categorie
        ? POSTES.filter(p => POSTE_CATEGORIES[categorie]?.postes.includes(p.value))
        : POSTES;

    const [formData, setFormData] = useState({
        nom: '',
        prenom: '',
        date_naissance: '',
        email: '',
        contact: '',
        poste: '',
        specialite: '',
        service: '',
        adresse: '',
        date_embauche: null,
    });

    useEffect(() => {
        if (isOpen) {
            fetchServices();
            fetchFunctionalServices();
            setApiError(null);
        }
    }, [isOpen]);

    const fetchFunctionalServices = async () => {
        try {
            const data = await getMyFunctionalServices();
            const disabled = new Set((Array.isArray(data) ? data : []).filter((s) => !s.enabled).map((s) => s.code));
            setDisabledFunctionalServices(disabled);
        } catch (error) {
            // Pas de tenant résolu (ex: compte du pool non assigné) ou erreur
            // réseau : ne bloque pas la création, on propose alors tous les
            // postes sans filtrage plutôt que de casser le formulaire.
            console.error('Erreur de chargement de la configuration des services fonctionnels:', error);
            setDisabledFunctionalServices(new Set());
        }
    };

    const fetchServices = async () => {
        setServicesError(null);
        try {
            const response = await getAllServices();
            const servicesData = response.results || response.data || response || [];
            setServices(Array.isArray(servicesData) ? servicesData : []);
        } catch (error) {
            console.error('Error fetching services:', error);
            setServices([]);
            setServicesError("Impossible de charger la liste des services. Vérifiez la connexion ou créez d'abord un service.");
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
        if (!formData.date_embauche) newErrors.date_embauche = "La date d'embauche est obligatoire";
        if (!formData.email.trim()) newErrors.email = t('services.required');
        if (!formData.contact.trim()) {
            newErrors.contact = t('services.required');
        } else if (!isValidPhone(formData.contact)) {
            newErrors.contact = phoneErrorMessage(t('personnel.contact'));
        }
        if (!formData.poste) newErrors.poste = t('services.required');
        if (formData.poste === 'medecin' && !formData.specialite) {
            newErrors.specialite = 'La spécialité est obligatoire pour un médecin';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setLoading(true);
        setApiError(null);

        try {
            const dataToSend = {
                nom: formData.nom.trim(),
                prenom: formData.prenom.trim() || '',
                date_naissance: formData.date_naissance,
                date_embauche: formData.date_embauche?.format?.('YYYY-MM-DD') || formData.date_embauche,
                email: formData.email.trim().toLowerCase(),
                contact: formData.contact.trim(),
                poste: formData.poste,
            };

            if (formData.service) {
                dataToSend.service = parseInt(formData.service, 10);
            }
            if (formData.adresse?.trim()) {
                dataToSend.adresse = formData.adresse.trim();
            }

            // Si le poste est medecin, utiliser l'endpoint /api/medecins/ avec le champ specialite
            if (formData.poste === 'medecin') {
                dataToSend.specialite = formData.specialite;
            }
            const created = formData.poste === 'medecin'
                ? await createMedecin(dataToSend)
                : await createPersonnel(dataToSend);

            resetForm();
            onSuccess();

            // Le mot de passe temporaire n'est renvoyé qu'à cet instant —
            // on garde la modale ouverte pour l'afficher plutôt que de la
            // fermer immédiatement (onClose() plus bas, une fois noté).
            if (created?.temporary_password) {
                setCreatedCredentials({ email: dataToSend.email, password: created.temporary_password });
            } else {
                onClose();
            }
        } catch (error) {
            console.error('Error creating personnel:', error);
            setApiError(formatApiError(error, t('personnel.createError')));
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            nom: '', prenom: '', date_naissance: '', date_embauche: null, email: '',
            contact: '', poste: '', specialite: '', service: '', adresse: '',
        });
        setCategorie('');
        setErrors({});
        setApiError(null);
    };

    const handleCloseAfterCredentials = () => {
        setCreatedCredentials(null);
        onClose();
    };

    const isMedecin = formData.poste === 'medecin';

    if (createdCredentials) {
        return (
            <Modal
                title={<div className="flex items-center gap-2"><User className="w-5 h-5 text-primary-end" /><span>{t('personnel.addPersonnel')}</span></div>}
                open={isOpen}
                onCancel={handleCloseAfterCredentials}
                onOk={handleCloseAfterCredentials}
                okText="J'ai noté ces identifiants"
                cancelButtonProps={{ style: { display: 'none' } }}
                width={520}
            >
                <div className="py-2">
                    <Alert
                        type="success"
                        showIcon
                        message="Personnel créé avec succès"
                        description="Ce mot de passe temporaire ne sera plus jamais affiché — transmettez-le vous-même à la personne concernée."
                    />
                    <div className="mt-4 space-y-2 rounded-lg bg-gray-50 border border-gray-200 p-4 font-mono text-sm">
                        <p><span className="text-gray-500">Email :</span> {createdCredentials.email}</p>
                        <p><span className="text-gray-500">Mot de passe temporaire :</span> {createdCredentials.password}</p>
                    </div>
                </div>
            </Modal>
        );
    }

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
                {apiError && (
                    <Alert type="error" message={t('common.error')} description={apiError} showIcon closable onClose={() => setApiError(null)} />
                )}
                {servicesError && (
                    <Alert type="warning" message="Services indisponibles" description={servicesError} showIcon />
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('personnel.firstName')}</label>
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
                            {t('personnel.hireDate')} <span className="text-red-500">*</span>
                        </label>
                        <FultangDatePicker
                            value={formData.date_embauche}
                            onChange={(d) => {
                                setFormData(prev => ({ ...prev, date_embauche: d }));
                                if (errors.date_embauche) setErrors(prev => ({ ...prev, date_embauche: null }));
                            }}
                        />
                        {errors.date_embauche && <p className="text-red-500 text-xs mt-1">{errors.date_embauche}</p>}
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
                            placeholder="677123456 ou +33…" maxLength={16}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-end ${errors.contact ? 'border-red-500' : 'border-gray-300'}`} />
                        <p className="text-xs text-gray-500 mt-1">{t('services.phoneFormat')}</p>
                        {errors.contact && <p className="text-red-500 text-xs mt-1">{errors.contact}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                        <select value={categorie} onChange={(e) => { setCategorie(e.target.value); setFormData(prev => ({ ...prev, poste: '' })); }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end">
                            <option value="">Toutes</option>
                            <option value="medical">{POSTE_CATEGORIES.medical.label}</option>
                            <option value="admin">{POSTE_CATEGORIES.admin.label}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('personnel.position')} <span className="text-red-500">*</span>
                        </label>
                        <select name="poste" value={formData.poste} onChange={handleChange}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-end ${errors.poste ? 'border-red-500' : 'border-gray-300'}`}>
                            <option value="">{t('services.selectPosition')}</option>
                            {filteredPostes.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                        {errors.poste && <p className="text-red-500 text-xs mt-1">{errors.poste}</p>}
                    </div>
                    {isMedecin && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Spécialité <span className="text-red-500">*</span>
                            </label>
                            <select name="specialite" value={formData.specialite} onChange={handleChange}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-end ${errors.specialite ? 'border-red-500' : 'border-gray-300'}`}>
                                <option value="">— Sélectionner —</option>
                                {MEDICAL_SPECIALITES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            {errors.specialite && <p className="text-red-500 text-xs mt-1">{errors.specialite}</p>}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('personnel.service')}</label>
                        <select name="service" value={formData.service} onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end">
                            <option value="">{services.length === 0 ? '— Aucun service —' : t('personnel.selectService')}</option>
                            {services.map(s => {
                                const sid = getServiceId(s);
                                return <option key={sid} value={sid}>{s.nom_service}</option>;
                            })}
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
