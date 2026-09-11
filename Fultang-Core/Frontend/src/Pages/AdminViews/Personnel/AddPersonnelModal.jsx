import { useState, useEffect } from 'react';
import { Modal, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';
import { createPersonnel } from '../../../services/personnelApi';
import { createMedecin } from '../../../services/medecinsApi';
import { getAllServices } from '../../../services/servicesApi';
import { getMyFunctionalServices } from '../../../services/tenantConfigApi';

/**
 * Correspondance poste → service fonctionnel (Tenant Configuration) —
 * copie frontend de POSTE_TO_FUNCTIONAL_SERVICE (service-personnel/api/views.py),
 * uniquement pour ne PAS PROPOSER un poste dont le service est désactivé
 * pour cet établissement. Le blocage réel reste toujours côté backend
 * (HasFunctionalServiceEnabled) — ceci n'est qu'un affichage cohérent,
 * jamais la seule protection.
 */
const POSTE_TO_FUNCTIONAL_SERVICE = {
    pharmacien: 'PHARMACIE',
    laborantin: 'LABORATOIRE',
    infirmier: 'SOINS_INFIRMIERS',
};

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
    const [apiError, setApiError] = useState(null);
    const [createdCredentials, setCreatedCredentials] = useState(null);
    const [disabledFunctionalServices, setDisabledFunctionalServices] = useState(new Set());

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

    const ALL_POSTES = [
        { value: 'receptioniste', label: t('personnel.positions.receptioniste') },
        { value: 'caissier', label: t('personnel.positions.caissier') },
        { value: 'infirmier', label: t('personnel.positions.infirmier') },
        { value: 'medecin', label: t('personnel.positions.medecin') },
        { value: 'laborantin', label: t('personnel.positions.laborantin') },
        { value: 'pharmacien', label: t('personnel.positions.pharmacien') },
        { value: 'comptable', label: t('personnel.positions.comptable') },
        { value: 'directeur', label: t('personnel.positions.directeur') }
    ];

    // Un poste dont le service fonctionnel associé est désactivé pour cet
    // établissement n'est pas proposé — voir POSTE_TO_FUNCTIONAL_SERVICE.
    const POSTES = ALL_POSTES.filter((p) => {
        const serviceCode = POSTE_TO_FUNCTIONAL_SERVICE[p.value];
        return !serviceCode || !disabledFunctionalServices.has(serviceCode);
    });

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

    const handleCloseAfterCredentials = () => {
        setCreatedCredentials(null);
        onClose();
    };

    // Verifier si le poste selectionne est medecin
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
