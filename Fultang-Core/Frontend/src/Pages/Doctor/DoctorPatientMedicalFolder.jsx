import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { doctorNavLink } from "./lib/doctorNavLink.js";
import { DoctorNavBar } from "./DoctorComponents/DoctorNavBar.jsx";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { doctorApi } from "../../services/doctorApi.js";
import { AppRoutesPaths } from "../../Router/appRouterPaths.js";
import { 
    FolderOpen, ArrowLeft, Calendar, FileText, Pill, FlaskConical, Stethoscope, AlertTriangle, AlertCircle, History,
    HeartPulse, Weight, Ruler, Thermometer, Activity
} from 'lucide-react';

export const DoctorPatientMedicalFolder = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const [patientData, setPatientData] = useState(null);
    const [visites, setVisites] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        fetchFolder();
    }, [id]);

    const fetchFolder = async () => {
        try {
            setIsLoading(true);
            const [dossier, patientVisites] = await Promise.all([
                doctorApi.getPatientDossier(id),
                doctorApi.getPatientVisites(id)
            ]);
            setPatientData(dossier);
            setVisites(patientVisites);
        } catch (error) {
            console.error("Failed to load medical folder", error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (isoString) => {
        return new Date(isoString).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    if (isLoading) {
        return (
            <CustomDashboard linkList={doctorNavLink} requiredRole="medecin">
                <DoctorNavBar><div className="flex justify-center items-center h-full"><Loading /></div></DoctorNavBar>
            </CustomDashboard>
        );
    }

    return (
        <CustomDashboard linkList={doctorNavLink} requiredRole="medecin">
            <DoctorNavBar>
                <div className="p-6 h-[calc(100vh-100px)] flex flex-col bg-gray-50/50 overflow-hidden">
                    
                    {/* Top Bar */}
                    <div className="flex items-center mb-6">
                        <button 
                            onClick={() => navigate(-1)}
                            className="p-2 mr-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                                <FolderOpen className="w-6 h-6 mr-2 text-primary-start" />
                                Dossier Médical Global
                            </h2>
                        </div>
                    </div>

                    <div className="flex gap-6 h-full overflow-hidden">
                        
                        {/* Left Column: Identité & Antécédents */}
                        <div className="w-1/3 flex flex-col gap-6 overflow-y-auto scrollbar pb-6">
                            
                            {/* Profile Card */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
                                <div className="w-24 h-24 mx-auto bg-primary-start/10 rounded-full flex justify-center items-center text-primary-start font-bold text-3xl mb-4 border-4 border-white shadow-sm">
                                    {patientData?.nom?.charAt(0)}{patientData?.prenom?.charAt(0)}
                                </div>
                                <h3 className="text-xl font-bold text-gray-800">{patientData?.nom} {patientData?.prenom}</h3>
                                <p className="text-gray-500 font-mono text-sm mt-1">ID: {patientData?.matricule || patientData?.id?.substring(0,8)}</p>
                                
                                <div className="mt-6 grid grid-cols-2 gap-4 text-left">
                                    <div className="bg-gray-50 p-3 rounded-lg">
                                        <p className="text-xs font-bold text-gray-400 uppercase">Âge</p>
                                        <p className="font-semibold text-gray-700">{patientData?.age ? `${patientData.age} ans` : 'N/A'}</p>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg">
                                        <p className="text-xs font-bold text-gray-400 uppercase">Sexe</p>
                                        <p className="font-semibold text-gray-700">{patientData?.sexe || 'N/A'}</p>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                                        <p className="text-xs font-bold text-gray-400 uppercase">Groupe Sanguin</p>
                                        <p className="font-semibold text-gray-700">
                                            {patientData?.donnees_cliniques?.groupe_sanguin
                                                ? `${patientData.donnees_cliniques.groupe_sanguin} ${patientData.donnees_cliniques.facteur_rhesus === 'POSITIF' ? '+' : patientData.donnees_cliniques.facteur_rhesus === 'NEGATIF' ? '-' : ''}`.trim()
                                                : 'Non spécifié'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Constantes Card */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                                    <HeartPulse className="w-5 h-5 mr-2 text-red-500" />
                                    Dernières Constantes Vitales
                                </h4>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="border border-gray-100 p-3 rounded-xl flex items-center gap-3">
                                        <Weight className="w-8 h-8 text-blue-500 bg-blue-50 p-1.5 rounded-lg" />
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Poids</p>
                                            <p className="font-bold text-gray-700 text-sm">{patientData?.donnees_cliniques?.poids ? `${patientData.donnees_cliniques.poids} kg` : '—'}</p>
                                        </div>
                                    </div>
                                    <div className="border border-gray-100 p-3 rounded-xl flex items-center gap-3">
                                        <Ruler className="w-8 h-8 text-indigo-500 bg-indigo-50 p-1.5 rounded-lg" />
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Taille</p>
                                            <p className="font-bold text-gray-700 text-sm">{patientData?.donnees_cliniques?.taille ? `${patientData.donnees_cliniques.taille} cm` : '—'}</p>
                                        </div>
                                    </div>
                                    <div className="border border-gray-100 p-3 rounded-xl flex items-center gap-3">
                                        <Thermometer className="w-8 h-8 text-amber-500 bg-amber-50 p-1.5 rounded-lg" />
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Température</p>
                                            <p className="font-bold text-gray-700 text-sm">{patientData?.donnees_cliniques?.temperature ? `${patientData.donnees_cliniques.temperature} °C` : '—'}</p>
                                        </div>
                                    </div>
                                    <div className="border border-gray-100 p-3 rounded-xl flex items-center gap-3">
                                        <Activity className="w-8 h-8 text-emerald-500 bg-emerald-50 p-1.5 rounded-lg" />
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Tension Art.</p>
                                            <p className="font-bold text-gray-700 text-sm">{patientData?.donnees_cliniques?.tension_arterielle ? `${patientData.donnees_cliniques.tension_arterielle} mmHg` : '—'}</p>
                                        </div>
                                    </div>
                                    <div className="border border-gray-100 p-3 rounded-xl flex items-center gap-3">
                                        <HeartPulse className="w-8 h-8 text-rose-500 bg-rose-50 p-1.5 rounded-lg" />
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Pouls</p>
                                            <p className="font-bold text-gray-700 text-sm">{patientData?.donnees_cliniques?.pouls ? `${patientData.donnees_cliniques.pouls} bpm` : '—'}</p>
                                        </div>
                                    </div>
                                    <div className="border border-gray-100 p-3 rounded-xl flex items-center gap-3">
                                        <Activity className="w-8 h-8 text-teal-500 bg-teal-50 p-1.5 rounded-lg" />
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Saturation O₂</p>
                                            <p className="font-bold text-gray-700 text-sm">{patientData?.donnees_cliniques?.taux_oxygene ? `${patientData.donnees_cliniques.taux_oxygene} %` : '—'}</p>
                                        </div>
                                    </div>
                                    <div className="border border-gray-100 p-3 rounded-xl flex items-center gap-3 col-span-2">
                                        <FlaskConical className="w-8 h-8 text-purple-500 bg-purple-50 p-1.5 rounded-lg" />
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Électrophorèse d'Hb</p>
                                            <p className="font-bold text-gray-700 text-sm">{patientData?.donnees_cliniques?.electrophorese_hb || '—'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Medical Background */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                                    <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" />
                                    Antécédents & Allergies
                                </h4>
                                
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">Allergies</p>
                                        <div className="flex flex-wrap gap-2">
                                            {patientData?.allergies?.length > 0 ? patientData.allergies.map((a, i) => (
                                                <span key={i} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-bold border border-red-100">
                                                    {a.declencheur}
                                                </span>
                                            )) : <span className="text-sm text-gray-500">Aucune allergie</span>}
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">Maladies Chroniques</p>
                                        <div className="flex flex-wrap gap-2">
                                            {patientData?.maladies_chroniques?.length > 0 ? patientData.maladies_chroniques.map((m, i) => (
                                                <span key={i} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-bold border border-purple-100">
                                                    {m.nom}
                                                </span>
                                            )) : <span className="text-sm text-gray-500">Aucune maladie signalée</span>}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">Antécédents Médicaux/Chirurgicaux</p>
                                        <ul className="text-sm text-gray-600 space-y-1">
                                            {patientData?.antecedents?.length > 0 ? patientData.antecedents.map((a, i) => (
                                                <li key={i}>• {a.description}</li>
                                            )) : <li className="italic text-gray-400">Aucun antécédent</li>}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Historical Timeline */}
                        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                            <div className="p-6 border-b border-gray-100">
                                <h4 className="font-bold text-gray-800 text-lg flex items-center">
                                    <History className="w-5 h-5 mr-2 text-primary-start" />
                                    Historique des visites et consultations
                                </h4>
                            </div>
                            
                            <div className="p-6 overflow-y-auto scrollbar flex-1 bg-gray-50/50">
                                {visites.length === 0 ? (
                                    <div className="text-center p-12 text-gray-400">
                                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>Aucune visite enregistrée pour ce patient.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 before:to-transparent">
                                        {visites.map((visite, index) => (
                                            <div key={visite.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                                
                                                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-white text-primary-start shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                                    <Calendar className="w-5 h-5" />
                                                </div>
                                                
                                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="font-bold text-gray-800 flex items-center">
                                                            {formatDate(visite.date_heure)}
                                                        </div>
                                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${visite.statut === 'EN_COURS' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                                            {visite.statut}
                                                        </span>
                                                    </div>
                                                    
                                                    <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded-lg italic">
                                                        "{visite.motif_visite}"
                                                    </p>

                                                    {visite.consultations?.length > 0 ? (
                                                        <div className="space-y-3">
                                                            {visite.consultations.map((consult, cidx) => (
                                                                <div key={cidx} className="border-t pt-3">
                                                                    
                                                                    {/* Diagnostics */}
                                                                    {consult.diagnostics?.length > 0 && (
                                                                        <div className="mb-2">
                                                                            <p className="text-xs font-bold text-gray-400 flex items-center mb-1"><Stethoscope className="w-3 h-3 mr-1"/> Diagnostics</p>
                                                                            <ul className="text-sm text-gray-700 pl-4 list-disc marker:text-primary-start">
                                                                                {consult.diagnostics.map((d, i) => <li key={i}>{d.libelle}</li>)}
                                                                            </ul>
                                                                        </div>
                                                                    )}

                                                                    {/* Ordonnances */}
                                                                    {consult.prescriptions?.length > 0 && (
                                                                        <div className="mb-2">
                                                                            <p className="text-xs font-bold text-gray-400 flex items-center mb-1"><Pill className="w-3 h-3 mr-1"/> Médicaments</p>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {consult.prescriptions.map((p, i) => (
                                                                                    <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">{p.medicament || "M"}</span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* Examens */}
                                                                    {consult.examens?.length > 0 && (
                                                                        <div className="mb-2">
                                                                            <p className="text-xs font-bold text-gray-400 flex items-center mb-1"><FlaskConical className="w-3 h-3 mr-1"/> Examens prescrits</p>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {consult.examens.map((e, i) => (
                                                                                    <span key={i} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100">{e.nom_examen || "E"}</span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-gray-400 flex items-center mt-4">
                                                            <AlertCircle className="w-3 h-3 mr-1" /> Aucune consultation détaillée enregistrée.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </DoctorNavBar>
        </CustomDashboard>
    );
};

export default DoctorPatientMedicalFolder;
