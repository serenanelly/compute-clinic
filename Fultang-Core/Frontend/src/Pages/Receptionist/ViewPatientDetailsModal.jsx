import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import userIcon from "../../assets/userIcon.png";
import { Mail, Phone, MapPin, Calendar, User, XIcon, Heart, Users, Briefcase, Hash, Loader2 } from 'lucide-react';
import { getPatientDossier } from "../../services/medicalDossierApi.js";
import { mapDossierToForm, mapListPatientToForm } from "../../services/patientRegistrationApi.js";
import { getGatewayBaseUrl } from "../../Utils/gatewayUrls";

/** Construit l'URL complète d'une photo patient (chemin relatif ou absolu). */
const resolvePhotoUrl = (photo) => {
    if (!photo) return null;
    if (photo.startsWith('http') || photo.startsWith('data:')) return photo;
    // Chemin relatif Django ex: /media/patients/photos/patient_xxx.png
    // getGatewayBaseUrl() cible le hostname courant (résolution de tenant
    // par sous-domaine) — un env var statique enverrait cette requête vers
    // un hostname fixe au lieu du tenant réellement ouvert dans le navigateur.
    return `${getGatewayBaseUrl()}/medical${photo}`;
};

export function ViewPatientDetailsModal({ isOpen, patient, onClose }) {
    ViewPatientDetailsModal.propTypes = {
        isOpen: PropTypes.bool.isRequired,
        patient: PropTypes.object,
        onClose: PropTypes.func.isRequired
    };

    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !patient?.id) return;

        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const dossier = await getPatientDossier(patient.id);
                if (cancelled) return;
                setDetails({
                    ...mapDossierToForm(dossier),
                    photo: dossier.photo || patient.photo,
                    id: patient.id,
                    matricule: dossier.matricule || patient.matricule,
                });
            } catch (err) {
                console.warn("Erreur chargement dossier complet dans ViewModal:", err);
                if (!cancelled) {
                    setDetails({
                        ...mapListPatientToForm(patient),
                        photo: patient.photo,
                        id: patient.id,
                        matricule: patient.matricule,
                    });
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [patient?.id, isOpen]);

    if (!isOpen || !patient) return null;

    const currentDetails = details || {
        ...mapListPatientToForm(patient),
        photo: patient.photo,
        id: patient.id,
        matricule: patient.matricule,
    };

    console.log("DEBUG VIEW DETAILS:", { details, patient, currentDetails });

    const SectionTitle = ({ icon: Icon, title }) => (
        <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <Icon className="w-5 h-5 text-primary-end" />
            <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wider text-sm">{title}</h3>
        </div>
    );

    const InfoItem = ({ label, value, icon: Icon }) => (
        <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-gray-400 uppercase">{label}</p>
            <div className="flex items-center gap-2">
                {Icon && <Icon className="w-3.5 h-3.5 text-gray-400" />}
                <p className="text-gray-900 font-bold">{(value !== null && value !== undefined && value !== '') ? value : "Non renseigné"}</p>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20">
                {/* Header Section */}
                <div className="relative bg-gradient-to-r from-primary-start to-primary-end p-8 text-white">
                    <button 
                        onClick={onClose} 
                        className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors backdrop-blur-md"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                    
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="relative">
                            <div className="w-32 h-32 rounded-[2rem] bg-white p-1 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
                                <div className="w-full h-full rounded-[1.8rem] overflow-hidden bg-gray-100">
                                    <img 
                                        src={resolvePhotoUrl(currentDetails.photo) || userIcon} 
                                        alt="Profil" 
                                        className="w-full h-full object-cover"
                                        onError={(e) => { e.target.src = userIcon; }}
                                    />
                                </div>
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 rounded-full border-4 border-white shadow-lg"></div>
                        </div>

                        <div className="text-center md:text-left flex-1 w-full">
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                                <h2 className="text-3xl font-black tracking-tight">{currentDetails.nom} {currentDetails.prenom}</h2>
                                <span className="px-3 py-1 bg-white/20 rounded-lg text-xs font-bold backdrop-blur-md border border-white/10">
                                    {currentDetails.matricule || `#${currentDetails.id}`}
                                </span>
                                {loading && <Loader2 className="w-5 h-5 animate-spin text-white/70 ml-2" />}
                            </div>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-blue-50 font-medium">
                                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-sm">
                                    <User className="w-4 h-4" /> {currentDetails.sexe}
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-sm">
                                    <Calendar className="w-4 h-4" /> {currentDetails.date_naissance}
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-sm">
                                    <Hash className="w-4 h-4" /> {currentDetails.num_securite_sociale || "Pas de SSN"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {/* Identité Détaillée */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <SectionTitle icon={User} title="Détails Personnels" />
                            <div className="grid grid-cols-2 gap-y-6">
                                <InfoItem label="Lieu de Naissance" value={currentDetails.lieu_naissance} icon={MapPin} />
                                <InfoItem label="Nationalité" value={currentDetails.nationalite} />
                                <InfoItem label="Statut Matrimonial" value={currentDetails.statut_matrimonial} icon={Heart} />
                                <InfoItem label="Nombre d'enfants" value={currentDetails.nombre_enfants} />
                                <InfoItem label="Profession" value={currentDetails.profession} icon={Briefcase} />
                            </div>
                        </div>

                        {/* Coordonnées */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <SectionTitle icon={MapPin} title="Contact & Adresse" />
                            <div className="grid grid-cols-1 gap-y-6">
                                <InfoItem label="Téléphone" value={currentDetails.contact} icon={Phone} />
                                <InfoItem label="Email" value={currentDetails.email} icon={Mail} />
                                <div className="pt-2 border-t mt-2">
                                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Adresse Complète</p>
                                    <div className="p-3 bg-gray-50 rounded-xl">
                                        <p className="text-gray-700 font-bold leading-relaxed">
                                            {currentDetails.rue ? `${currentDetails.rue}, ` : ""}
                                            {currentDetails.quartier ? `${currentDetails.quartier}, ` : ""}
                                            {currentDetails.ville}, {currentDetails.pays}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Urgence */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 md:col-span-2">
                            <SectionTitle icon={Users} title="Contact d'Urgence (Proche)" />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InfoItem label="Nom du Proche" value={currentDetails.nom_proche || currentDetails.prenom_proche ? `${currentDetails.nom_proche} ${currentDetails.prenom_proche}`.trim() : ""} />
                                <InfoItem label="Lien de Parenté" value={currentDetails.lien_parente} />
                                <InfoItem label="Téléphone d'Urgence" value={currentDetails.contact_proche} icon={Phone} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-white border-t flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-10 py-3 bg-gradient-to-r from-primary-start to-primary-end text-white font-bold rounded-2xl hover:scale-[1.02] transition-all shadow-lg shadow-primary-end/20 active:scale-95"
                    >
                        Fermer le dossier
                    </button>
                </div>
            </div>
        </div>
    );
}