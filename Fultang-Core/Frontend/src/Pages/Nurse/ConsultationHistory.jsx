import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { nurseNavLink } from "../Nurse/nurseNavLink.js";
import { NurseNavBar } from "../Nurse/NurseNavBar.jsx";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { nurseApi } from "../../services/nurseApi.js";
import { 
    ArrowLeft, Calendar, ChevronDown, ChevronRight,
    Stethoscope, FlaskConical, Syringe, Pill,
    CheckCircle2, Clock, AlertCircle, MessageCircle,
    BedDouble
} from 'lucide-react';

export const ConsultationHistory = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);
    const [visites, setVisites] = useState([]);
    const [hospitalisations, setHospitalisations] = useState([]);
    const [orphanSoins, setOrphanSoins] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openVisiteId, setOpenVisiteId] = useState(null);

    useEffect(() => { loadData(); }, [id]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const patientData = await nurseApi.getPatientDetails(id);
            setPatient(patientData);
            
            const visitesData = await nurseApi.getPatientVisites(id);
            setVisites(visitesData);
            
            const hospData = await nurseApi.getPatientHospitalizations(id);
            setHospitalisations(hospData);
            
            const soinsData = await nurseApi.getPatientSoins(id);
            // On isole les soins qui ne sont rattachés à aucune visite (soins d'hospitalisation continus)
            setOrphanSoins(soinsData.filter(s => !s.visite));
            
            if (visitesData.length > 0) setOpenVisiteId(visitesData[0].id);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const calculateAge = (d) => {
        if (!d) return "—";
        const b = new Date(d), t = new Date();
        let a = t.getFullYear() - b.getFullYear();
        if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
        return a;
    };

    const toggleVisite = (visiteId) => {
        setOpenVisiteId(openVisiteId === visiteId ? null : visiteId);
    };
    
    // Trouver l'hospitalisation en cours s'il y en a une
    const activeHosp = hospitalisations.find(h => h.statut === 'EN_COURS');

    return (
        <CustomDashboard linkList={nurseNavLink} requiredRole="nurse">
            <NurseNavBar>
                <div className="p-6 h-[calc(100vh-100px)] flex flex-col bg-gray-50/50 overflow-y-auto scrollbar">
                    
                    {/* Header */}
                    <div className="flex items-center mb-6">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-full transition-all mr-4 shadow-sm border border-transparent hover:border-gray-100">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Dossier Médical</h2>
                            <p className="text-sm text-gray-500">
                                {patient?.nom} {patient?.prenom} • {patient?.sexe} • {calculateAge(patient?.date_naissance)} ans
                            </p>
                        </div>
                    </div>

                    {isLoading ? <div className="flex justify-center items-center h-64"><Loading /></div> : (
                        <div className="space-y-6">
                            
                            {/* BLOC HOSPITALISATION EN COURS (Nouveau) */}
                            {activeHosp && (
                                <div className="bg-white rounded-xl border border-blue-200 shadow-md overflow-hidden">
                                    <div className="px-5 py-4 bg-blue-50/50 flex items-center justify-between border-b border-blue-100">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 border border-blue-200">
                                                <BedDouble className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-blue-900 text-sm">Hospitalisation — {activeHosp.motif}</p>
                                                <p className="text-xs text-blue-600/70">Chambre assignée</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-700 uppercase">
                                            En Cours
                                        </span>
                                    </div>
                                    
                                    <div className="p-5">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Soins Administrés pendant le séjour</h3>
                                        {orphanSoins.length === 0 ? (
                                            <p className="text-sm text-gray-400 italic">Aucun soin continu enregistré pour le moment.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {orphanSoins.map((soin) => (
                                                    <div key={soin.id} className={`p-3 rounded-xl border text-sm ${soin.observation?.includes("ANOMALIE") ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Syringe className="w-3.5 h-3.5 text-amber-600" />
                                                            <span className="font-bold text-gray-800">{soin.nom}</span>
                                                            <span className="text-xs text-gray-400">{soin.type_soin}</span>
                                                        </div>
                                                        {soin.motif && (
                                                            <p className="text-xs text-gray-500 mb-1"><span className="font-semibold">Motif:</span> {soin.motif}</p>
                                                        )}
                                                        {soin.observation && (
                                                            <p className={`text-xs leading-relaxed ${soin.observation.includes("ANOMALIE") ? 'text-amber-800 font-semibold' : 'text-gray-600'}`}>
                                                                <MessageCircle className="w-3 h-3 inline mr-1" />
                                                                {soin.observation}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Timeline des visites passées */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-gray-400 uppercase ml-2">Historique des Visites (Consultations / Urgences)</h3>
                                {visites.length === 0 ? (
                                    <div className="bg-white p-12 text-center rounded-2xl border border-gray-100">
                                        <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                        <p className="text-gray-500">Aucune visite enregistrée pour ce patient.</p>
                                    </div>
                                ) : (
                                    visites.map((visite) => {
                                        const isOpen = openVisiteId === visite.id;
                                        const hasAnomalie = visite.soins?.some(s => s.observation?.includes("ANOMALIE"));

                                        return (
                                            <div key={visite.id} className={`bg-white rounded-xl border overflow-hidden transition-all ${hasAnomalie ? 'border-amber-200' : 'border-gray-100'} ${isOpen ? 'shadow-md' : 'shadow-sm'}`}>
                                                <button 
                                                    onClick={() => toggleVisite(visite.id)}
                                                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${visite.statut === 'EN_COURS' ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50 border border-gray-200'}`}>
                                                            <Calendar className={`w-5 h-5 ${visite.statut === 'EN_COURS' ? 'text-indigo-600' : 'text-gray-400'}`} />
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="font-bold text-gray-800 text-sm">
                                                                {new Date(visite.date_heure).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                            </p>
                                                            <p className="text-xs text-gray-500">{visite.motif_visite}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {hasAnomalie && <AlertCircle className="w-4 h-4 text-amber-500" />}
                                                        
                                                        {visite.statut === 'EN_COURS' ? (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                                                En cours
                                                            </span>
                                                        ) : visite.examens.some(e => e.statut === 'EN_ATTENTE') ? (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                                                Clôturée (Examens en attente)
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                                                Consultation clôturée
                                                            </span>
                                                        )}
                                                        
                                                        {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                                    </div>
                                                </button>

                                                {isOpen && (
                                                    <div className="px-5 pb-5 pt-2 border-t border-gray-100 space-y-4">
                                                        {visite.consultations.map((c) => (
                                                            <div key={c.id} className="p-4 bg-indigo-50/30 rounded-xl border border-indigo-100/50">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <Stethoscope className="w-4 h-4 text-indigo-600" />
                                                                    <span className="text-xs font-bold text-indigo-700 uppercase">Consultation — {c.medecin_charge}</span>
                                                                </div>
                                                                {c.symptomes.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                                                        {c.symptomes.map((s, i) => (
                                                                            <span key={i} className="text-xs bg-white text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                                                                                {s.nom} <span className="text-gray-400">({s.localisation})</span>
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {c.diagnostics.map((d, i) => (
                                                                    <div key={i} className="mb-3 text-sm">
                                                                        <span className="font-bold text-gray-800">{d.libelle}</span>
                                                                        <span className="text-gray-500"> → {d.conclusion}</span>
                                                                    </div>
                                                                ))}
                                                                {c.prescriptions.length > 0 && (
                                                                    <div className="space-y-2 mt-2">
                                                                        <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center">
                                                                            <Pill className="w-3 h-3 mr-1" /> Prescription
                                                                        </p>
                                                                        {c.prescriptions.map((p, i) => (
                                                                            <div key={i} className="bg-white p-2.5 rounded-lg border border-indigo-100 text-sm flex justify-between items-start">
                                                                                <div>
                                                                                    <span className="font-bold text-gray-800">{p.nom}</span>
                                                                                    <span className="text-gray-400 text-xs ml-2">{p.type_medicament} • {p.quantite}</span>
                                                                                    <p className="text-xs text-gray-500 mt-0.5">{p.posologie}</p>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {visite.examens.length > 0 && (
                                                            <div className="flex flex-wrap gap-2">
                                                                {visite.examens.map((ex) => (
                                                                    <div key={ex.id} className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-100 text-sm">
                                                                        <FlaskConical className="w-3.5 h-3.5 text-purple-500" />
                                                                        <span className="font-medium text-purple-800">{ex.nom}</span>
                                                                        <span className="text-[10px] text-purple-400">{ex.anatomie}</span>
                                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ex.statut === 'REALISE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                            {ex.statut === 'REALISE' ? '✓' : '⏳'}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {visite.soins.length > 0 && visite.soins.map((soin) => (
                                                            <div key={soin.id} className={`p-3 rounded-xl border text-sm ${soin.observation?.includes("ANOMALIE") ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Syringe className="w-3.5 h-3.5 text-amber-600" />
                                                                    <span className="font-bold text-gray-800">{soin.nom}</span>
                                                                    <span className="text-xs text-gray-400">{soin.type_soin}</span>
                                                                </div>
                                                                {soin.observation && (
                                                                    <p className={`text-xs leading-relaxed ${soin.observation.includes("ANOMALIE") ? 'text-amber-800 font-semibold' : 'text-gray-600'}`}>
                                                                        <MessageCircle className="w-3 h-3 inline mr-1" />
                                                                        {soin.observation}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </NurseNavBar>
        </CustomDashboard>
    );
};

export default ConsultationHistory;
