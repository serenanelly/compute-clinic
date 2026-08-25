import { XIcon, ChevronRight, ChevronLeft, Save, CheckCircle2, Camera, Upload, RotateCcw, User } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { createPatientWithDetails } from "../../services/patientRegistrationApi.js";
import { Alert, Steps, DatePicker, ConfigProvider } from "antd";
import frFR from "antd/locale/fr_FR";
import dayjs from "dayjs";
import "dayjs/locale/fr";

dayjs.locale("fr");

// Options pour les choice boxes
const NATIONALITIES = ["Camerounaise", "Gabonaise", "Tchadienne", "Centrafricaine", "Congolaise", "Nigériane", "Autre"];
const COUNTRIES = ["Cameroun", "Gabon", "Tchad", "RCA", "Congo", "Nigéria", "Autre"];
const CITIES = ["Yaoundé", "Douala", "Garoua", "Bamenda", "Bafoussam", "Ngaoundéré", "Bertoua", "Ebolowa", "Maroua", "Kribi", "Autre"];

export function AddNewPatientModal({ isOpen, onClose, setCanOpenSuccessModal, setSuccessMessage, setIsLoading, onPatientAdded }) {
    AddNewPatientModal.propTypes = {
        isOpen: PropTypes.bool.isRequired,
        onClose: PropTypes.func.isRequired,
        setCanOpenSuccessModal: PropTypes.func.isRequired,
        setSuccessMessage: PropTypes.func.isRequired,
        setIsLoading: PropTypes.func.isRequired,
        onPatientAdded: PropTypes.func,
    }

    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showLocalSuccess, setShowLocalSuccess] = useState(false);
    
    // État pour la photo
    const [photoPreview, setPhotoPreview] = useState(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    const [formData, setFormData] = useState({
        nom: '',
        prenom: '',
        sexe: 'MASCULIN',
        date_naissance: null,
        lieu_naissance: '',
        nationalite: 'Camerounaise',
        statut_matrimonial: 'CELIBATAIRE',
        num_securite_sociale: '',
        nombre_enfants: 0,
        profession: '',
        email: '',
        nom_proche: '',
        prenom_proche: '',
        lien_parente: '',
        contact_proche: '',
        pays: 'Cameroun',
        ville: 'Yaoundé',
        quartier: '',
        rue: '',
        code_postal: '',
        adresse: '',
        contact: '',
        photo: null
    });

    const [errors, setErrors] = useState({});
    const [apiError, setApiError] = useState("");
    const [age, setAge] = useState(null);

    useEffect(() => {
        if (formData.date_naissance) {
            const birthDate = dayjs(formData.date_naissance);
            const today = dayjs();
            setAge(today.diff(birthDate, 'year'));
        } else {
            setAge(null);
        }
    }, [formData.date_naissance]);

    // Champs "nom" : uniquement lettres (accents), espaces, tirets et apostrophes
    // (ex. "Jean-Pierre", "N'Doumbé"). On refuse chiffres, virgules et autres symboles.
    const NAME_FIELDS = ['nom', 'prenom', 'nom_proche', 'prenom_proche'];
    // Champs téléphone : uniquement des chiffres, limités à 9 (format Cameroun).
    const PHONE_FIELDS = ['contact', 'contact_proche'];

    const handleChange = (e) => {
        const { name } = e.target;
        let value = e.target.value;

        if (NAME_FIELDS.includes(name)) {
            value = value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s'-]/g, '');
        } else if (PHONE_FIELDS.includes(name)) {
            value = value.replace(/\D/g, '').slice(0, 9);
        }

        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    };

    const handleDateChange = (date) => {
        setFormData(prev => ({ ...prev, date_naissance: date }));
        if (errors.date_naissance) setErrors(prev => ({ ...prev, date_naissance: null }));
    };

    // --- Logique Photo ---
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result);
                setFormData(prev => ({ ...prev, photo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const startCamera = async () => {
        setIsCameraActive(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Erreur caméra:", err);
            setIsCameraActive(false);
            alert("Impossible d'accéder à la caméra");
        }
    };

    const takePhoto = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            setPhotoPreview(dataUrl);
            setFormData(prev => ({ ...prev, photo: dataUrl }));
            stopCamera();
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        }
        setIsCameraActive(false);
    };

    const resetPhoto = () => {
        setPhotoPreview(null);
        setFormData(prev => ({ ...prev, photo: null }));
    };

    const nextStep = () => {
        if (validateStep(step)) {
            setStep(prev => prev + 1);
        }
    };

    const prevStep = () => {
        setStep(prev => prev - 1);
    };

    // --- Validation & Submit ---
    const phoneRegex = /^6\d{8}$/;

    const validatePhone = (value, fieldName, label, errs) => {
        if (!value?.trim()) {
            errs[fieldName] = `${label} est obligatoire`;
        } else {
            const digits = value.replace(/[\s+]/g, '');
            if (!phoneRegex.test(digits)) {
                errs[fieldName] = `${label} doit être un numéro à 9 chiffres commençant par 6 (ex: 6XXXXXXXX)`;
            }
        }
    };

    const validateStep = (currentStep) => {
        const newErrors = {};
        if (currentStep === 1) {
            if (!formData.nom.trim()) newErrors.nom = "Le nom est obligatoire";
            if (!formData.date_naissance) newErrors.date_naissance = "La date de naissance est obligatoire";
            if (!formData.lieu_naissance.trim()) newErrors.lieu_naissance = "Le lieu de naissance est obligatoire";
        } else if (currentStep === 2) {
            if (!formData.nom_proche.trim()) newErrors.nom_proche = "Le nom du proche est obligatoire";
            if (!formData.lien_parente.trim()) newErrors.lien_parente = "Le lien de parenté est obligatoire";
            validatePhone(formData.contact_proche, 'contact_proche', 'Le numéro du proche', newErrors);
        } else if (currentStep === 3) {
            if (formData.contact?.trim()) {
                const digits = formData.contact.replace(/[\s+]/g, '');
                if (!phoneRegex.test(digits)) {
                    newErrors.contact = "Le téléphone doit être un numéro à 9 chiffres commençant par 6 (ex: 6XXXXXXXX)";
                }
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        
        // Valider l'étape actuelle avant de soumettre
        if (!validateStep(step)) return;
        
        // S'assurer que les étapes précédentes sont aussi valides
        if (step >= 2 && !validateStep(1)) {
            setStep(1);
            return;
        }
        if (step >= 3 && !validateStep(2)) {
            setStep(2);
            return;
        }

        setIsLoading(true);
        setIsSubmitting(true);
        setApiError("");

        try {
            const created = await createPatientWithDetails(formData);
            if (created?.id) {
                setIsLoading(false);
                setSuccessMessage(`Patient ${created.nom} créé avec succès (matricule ${created.matricule || ''}) !`);
                if (onPatientAdded) onPatientAdded();
                setShowLocalSuccess(true);
                setTimeout(() => {
                    setShowLocalSuccess(false);
                    setIsSubmitting(false);
                    finish();
                }, 1500);
            }
        } catch (error) {
            console.error("Registration Error Detail:", error.response?.data);
            setIsLoading(false);
            setIsSubmitting(false);
            const data = error.response?.data;
            let message = "Erreur lors de l'enregistrement.";
            if (typeof data === 'object' && data !== null) {
                message = Object.entries(data)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                    .join(' — ');
            } else if (typeof data === 'string') {
                message = data;
            }
            setApiError(message);
        }
    };

    const finish = () => {
        setCanOpenSuccessModal(true);
        onClose();
        resetForm();
    };

    const resetForm = () => {
        setStep(1);
        setIsSubmitting(false);
        setPhotoPreview(null);
        setFormData({
            nom: '', prenom: '', sexe: 'MASCULIN', date_naissance: null, lieu_naissance: '',
            nationalite: 'Camerounaise', statut_matrimonial: 'CELIBATAIRE',
            num_securite_sociale: '', nombre_enfants: 0, profession: '', email: '',
            nom_proche: '', prenom_proche: '', lien_parente: '', contact_proche: '',
            pays: 'Cameroun', ville: 'Yaoundé', quartier: '', rue: '', code_postal: '', adresse: '', contact: '', photo: null
        });
        setErrors({});
        setApiError("");
    };

    if (!isOpen) return null;

    const inputClass = (name) => `w-full px-4 py-2.5 border rounded-xl transition-all duration-200 focus:ring-2 focus:ring-primary-end outline-none ${errors[name] ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-primary-end'}`;

    return (
        <ConfigProvider locale={frFR}>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300 text-gray-800">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary-start to-primary-end p-6 flex justify-between items-center text-white">
                        <div>
                            <h3 className="text-2xl font-bold">Enregistrement Patient</h3>
                            <p className="text-blue-50/80 text-sm">Dossier administratif (identité, contact, urgence)</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><XIcon className="w-6 h-6" /></button>
                    </div>

                    {/* Progress Tracker */}
                    <div className="px-8 py-6 bg-gray-50 border-b">
                        <Steps current={step - 1} items={[{ title: 'Identité' }, { title: 'Urgence' }, { title: 'Compléments' }]} />
                    </div>

                    {/* Form Content */}
                    <div className="flex-1 overflow-y-auto p-8 relative">
                        {apiError && <Alert message={apiError} type="error" showIcon className="mb-6 rounded-xl" />}

                        {/* Success Overlay */}
                        {showLocalSuccess && (
                            <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in zoom-in-95 duration-300">
                                <CheckCircle2 className="w-20 h-20 text-green-500 mb-4 animate-bounce" />
                                <h4 className="text-2xl font-bold">Patient enregistré !</h4>
                                <p className="text-gray-500 italic">Dossier médical créé avec succès.</p>
                            </div>
                        )}

                        {/* STEP 1: IDENTITÉ */}
                        {step === 1 && (
                            <div className="flex flex-col lg:flex-row gap-10 animate-in slide-in-from-right-4 duration-300">
                                {/* Zone Photo */}
                                <div className="w-full lg:w-64 space-y-4">
                                    <h4 className="text-sm font-bold text-gray-500 uppercase">Photo du Patient</h4>
                                    <div className="aspect-square bg-gray-100 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden relative group">
                                        {isCameraActive ? (
                                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                        ) : photoPreview ? (
                                            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-center p-4">
                                                <User className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                                <p className="text-xs text-gray-400">Aucune photo</p>
                                            </div>
                                        )}
                                        
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {!isCameraActive ? (
                                                <>
                                                    <label className="p-2 bg-white text-gray-800 rounded-full cursor-pointer hover:bg-gray-100"><Upload className="w-5 h-5" /><input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} /></label>
                                                    <button onClick={startCamera} className="p-2 bg-white text-gray-800 rounded-full hover:bg-gray-100"><Camera className="w-5 h-5" /></button>
                                                </>
                                            ) : (
                                                <button onClick={takePhoto} className="px-4 py-2 bg-white text-gray-800 rounded-full font-bold text-sm">Capturer</button>
                                            )}
                                        </div>
                                    </div>
                                    {photoPreview && <button onClick={resetPhoto} className="w-full py-2 text-xs text-red-500 font-bold flex items-center justify-center gap-1 hover:underline"><RotateCcw className="w-3 h-3" /> Réinitialiser la photo</button>}
                                    <canvas ref={canvasRef} className="hidden" />
                                </div>

                                {/* Données Identité */}
                                <div className="flex-1 space-y-6">
                                    <h4 className="text-lg font-bold text-secondary border-b pb-2">Données Personnelles</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label htmlFor="nom" className="block text-sm font-semibold text-gray-700 mb-2">Nom <span className="text-red-500">*</span></label>
                                            <input id="nom" name="nom" value={formData.nom} onChange={handleChange} className={inputClass('nom')} placeholder="Nom de famille" />
                                            {errors.nom && <p className="text-red-500 text-xs mt-1 font-medium">{errors.nom}</p>}
                                        </div>
                                        <div>
                                            <label htmlFor="prenom" className="block text-sm font-semibold text-gray-700 mb-2">Prénom(s)</label>
                                            <input id="prenom" name="prenom" value={formData.prenom} onChange={handleChange} className={inputClass()} placeholder="Prénoms" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Date de Naissance <span className="text-red-500">*</span></label>
                                            <div className="flex gap-2">
                                                <DatePicker 
                                                    className={`w-full py-2.5 rounded-xl ${errors.date_naissance ? 'border-red-500 bg-red-50' : 'border-gray-200'}`} 
                                                    onChange={handleDateChange} 
                                                    value={formData.date_naissance} 
                                                    format="DD/MM/YYYY"
                                                    placeholder="Sélectionner la date"
                                                />
                                                {age !== null && <span className="flex items-center px-4 bg-blue-50 text-blue-700 rounded-xl font-bold text-sm border border-blue-100 whitespace-nowrap">{age} ans</span>}
                                            </div>
                                            {errors.date_naissance && <p className="text-red-500 text-xs mt-1 font-medium">{errors.date_naissance}</p>}
                                        </div>
                                        <div>
                                            <label htmlFor="sexe" className="block text-sm font-semibold text-gray-700 mb-2">Sexe <span className="text-red-500">*</span></label>
                                            <select id="sexe" name="sexe" value={formData.sexe} onChange={handleChange} className={inputClass()}>
                                                <option value="MASCULIN">Masculin</option>
                                                <option value="FEMININ">Féminin</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="lieu_naissance" className="block text-sm font-semibold text-gray-700 mb-2">Lieu de Naissance <span className="text-red-500">*</span></label>
                                            <input id="lieu_naissance" name="lieu_naissance" value={formData.lieu_naissance} onChange={handleChange} className={inputClass('lieu_naissance')} placeholder="Ville ou Localité" />
                                            {errors.lieu_naissance && <p className="text-red-500 text-xs mt-1 font-medium">{errors.lieu_naissance}</p>}
                                        </div>
                                        <div>
                                            <label htmlFor="nationalite" className="block text-sm font-semibold text-gray-700 mb-2">Nationalité</label>
                                            <select id="nationalite" name="nationalite" value={formData.nationalite} onChange={handleChange} className={inputClass()}>
                                                {NATIONALITIES.map(nat => <option key={nat} value={nat}>{nat}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="statut_matrimonial" className="block text-sm font-semibold text-gray-700 mb-2">Statut Matrimonial</label>
                                            <select id="statut_matrimonial" name="statut_matrimonial" value={formData.statut_matrimonial} onChange={handleChange} className={inputClass()}>
                                                <option value="CELIBATAIRE">Célibataire</option>
                                                <option value="MARIE">Marié(e)</option>
                                                <option value="VEUF">Veuf(ve)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="num_securite_sociale" className="block text-sm font-semibold text-gray-700 mb-2">N° Sécurité Sociale</label>
                                            <input id="num_securite_sociale" name="num_securite_sociale" value={formData.num_securite_sociale} onChange={handleChange} className={inputClass()} placeholder="Ex: 1-90-..." />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: URGENCE */}
                        {step === 2 && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                <h4 className="text-lg font-bold text-secondary border-b pb-2">Personne à Prévenir</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="nom_proche" className="block text-sm font-semibold text-gray-700 mb-2">Nom <span className="text-red-500">*</span></label>
                                        <input id="nom_proche" name="nom_proche" value={formData.nom_proche} onChange={handleChange} className={inputClass('nom_proche')} placeholder="Nom du contact d'urgence" />
                                        {errors.nom_proche && <p className="text-red-500 text-xs mt-1 font-medium">{errors.nom_proche}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="prenom_proche" className="block text-sm font-semibold text-gray-700 mb-2">Prénom(s)</label>
                                        <input id="prenom_proche" name="prenom_proche" value={formData.prenom_proche} onChange={handleChange} className={inputClass()} placeholder="Prénoms" />
                                    </div>
                                    <div>
                                        <label htmlFor="lien_parente" className="block text-sm font-semibold text-gray-700 mb-2">Lien de parenté <span className="text-red-500">*</span></label>
                                        <select id="lien_parente" name="lien_parente" value={formData.lien_parente} onChange={handleChange} className={inputClass('lien_parente')}>
                                            <option value="">Sélectionner...</option>
                                            <option value="PERE">Père</option>
                                            <option value="MERE">Mère</option>
                                            <option value="FRERE_SOEUR">Frère / Sœur</option>
                                            <option value="CONJOINT">Conjoint(e)</option>
                                            <option value="AMI">Ami(e)</option>
                                            <option value="AUTRE">Autre</option>
                                        </select>
                                        {errors.lien_parente && <p className="text-red-500 text-xs mt-1 font-medium">{errors.lien_parente}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="contact_proche" className="block text-sm font-semibold text-gray-700 mb-2">Téléphone <span className="text-red-500">*</span></label>
                                        <input id="contact_proche" name="contact_proche" value={formData.contact_proche} onChange={handleChange} className={inputClass('contact_proche')} placeholder="Ex: 6XXXXXXXX" inputMode="numeric" maxLength={9} />
                                        {errors.contact_proche && <p className="text-red-500 text-xs mt-1 font-medium">{errors.contact_proche}</p>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: COMPLÉMENTS */}
                        {step === 3 && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                <h4 className="text-lg font-bold text-secondary border-b pb-2">Adresse & Compléments</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="pays" className="block text-sm font-semibold text-gray-700 mb-2">Pays</label>
                                        <select id="pays" name="pays" value={formData.pays} onChange={handleChange} className={inputClass()}>
                                            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="ville" className="block text-sm font-semibold text-gray-700 mb-2">Ville</label>
                                        <select id="ville" name="ville" value={formData.ville} onChange={handleChange} className={inputClass()}>
                                            {CITIES.map(v => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="quartier" className="block text-sm font-semibold text-gray-700 mb-2">Quartier</label>
                                        <input id="quartier" name="quartier" value={formData.quartier} onChange={handleChange} className={inputClass()} placeholder="Quartier" />
                                    </div>
                                    <div>
                                        <label htmlFor="rue" className="block text-sm font-semibold text-gray-700 mb-2">Rue</label>
                                        <input id="rue" name="rue" value={formData.rue} onChange={handleChange} className={inputClass()} placeholder="Rue / Avenue" />
                                    </div>
                                    <div>
                                        <label htmlFor="nombre_enfants" className="block text-sm font-semibold text-gray-700 mb-2">Nombre d'enfants</label>
                                        <input id="nombre_enfants" type="number" name="nombre_enfants" value={formData.nombre_enfants} onChange={handleChange} className={inputClass()} min="0" />
                                    </div>
                                    <div>
                                        <label htmlFor="profession" className="block text-sm font-semibold text-gray-700 mb-2">Profession</label>
                                        <input id="profession" name="profession" value={formData.profession} onChange={handleChange} className={inputClass()} placeholder="Métier" />
                                    </div>
                                    <div>
                                        <label htmlFor="contact" className="block text-sm font-semibold text-gray-700 mb-2">Téléphone Perso</label>
                                        <input id="contact" name="contact" value={formData.contact} onChange={handleChange} className={inputClass('contact')} placeholder="Ex: 6XXXXXXXX" inputMode="numeric" maxLength={9} />
                                        {errors.contact && <p className="text-red-500 text-xs mt-1 font-medium">{errors.contact}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                                        <input id="email" name="email" value={formData.email} onChange={handleChange} className={inputClass()} placeholder="Email du patient" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-gray-50 border-t flex justify-between items-center">
                        <button 
                            onClick={step === 1 ? onClose : prevStep} 
                            disabled={isSubmitting} 
                            className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-all flex items-center gap-2"
                        >
                            {step === 1 ? "Annuler" : <><ChevronLeft className="w-5 h-5" /> Retour</>}
                        </button>
                        <div className="flex gap-3">
                            {(step === 1 || step === 2) && (
                                <button 
                                    onClick={nextStep} 
                                    className="px-8 py-2.5 bg-secondary text-white font-bold rounded-xl shadow-lg hover:opacity-90 flex items-center gap-2"
                                >
                                    Suivant <ChevronRight className="w-5 h-5" />
                                </button>
                            )}
                            {step === 3 && (
                                <button 
                                    onClick={handleSubmit} 
                                    disabled={isSubmitting} 
                                    className="px-8 py-2.5 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 flex items-center gap-2"
                                >
                                    <Save className="w-5 h-5" /> Enregistrer
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </ConfigProvider>
    );
}