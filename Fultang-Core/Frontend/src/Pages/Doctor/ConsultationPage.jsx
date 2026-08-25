import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { doctorNavLink } from "./lib/doctorNavLink.js";
import { DoctorNavBar } from "./DoctorComponents/DoctorNavBar.jsx";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { doctorApi } from "../../services/doctorApi.js";
import { 
    Stethoscope, User, Activity, FileText, Pill, FlaskConical, 
    Save, Plus, AlertCircle, Heart, Thermometer, Droplets, CheckCircle,
    HeartPulse, Weight, Ruler
} from 'lucide-react';
import { AppRoutesPaths } from "../../Router/appRouterPaths.js";
import axiosInstance from "../../Utils/axiosInstance.js";

export const ConsultationPage = () => {
    const [searchParams] = useSearchParams();
    const patientId = searchParams.get('patient');
    const visiteId = searchParams.get('visite');
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('dossier');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [patientData, setPatientData] = useState(null);
    const [donneesCliniques, setDonneesCliniques] = useState(null);
    const [consultationId, setConsultationId] = useState(null);

    // States for forms
    const [symptomes, setSymptomes] = useState([]);
    const [newSymptome, setNewSymptome] = useState({ nom: '', description: '', date_apparition: '' });

    const [diagnostics, setDiagnostics] = useState([]);
    const [newDiagnostic, setNewDiagnostic] = useState({ libelle: '', description: '', type: 'PRINCIPAL' });

    const [prescriptions, setPrescriptions] = useState([]);
    const [newPrescription, setNewPrescription] = useState({ medicament: '', posologie: '', duree: '' });

    const [examens, setExamens] = useState([]);
    const [newExamen, setNewExamen] = useState({ nom_examen: '', motif: '' });

    const [hospitalisation, setHospitalisation] = useState({ service: '', motif: '', urgence: false });

    useEffect(() => {
        if (!patientId || !visiteId) {
            navigate(AppRoutesPaths.doctorPage);
            return;
        }
        initConsultation();
    }, [patientId, visiteId]);

    const initConsultation = useCallback(async () => {
        try {
            setIsLoading(true);
            
            // Reset COMPLET — empêche les données de la consultation précédente de rester
            setSymptomes([]);
            setDiagnostics([]);
            setPrescriptions([]);
            setExamens([]);
            setPatientData(null);
            setDonneesCliniques(null);
            setConsultationId(null);
            setHospitalisation({ service: '', motif: '', urgence: false });
            setNewSymptome({ nom: '', description: '', date_apparition: '' });
            setNewDiagnostic({ libelle: '', description: '', type: 'PRINCIPAL' });
            setNewPrescription({ medicament: '', posologie: '', duree: '' });
            setNewExamen({ nom_examen: '', motif: '' });
            setActiveTab('dossier');
            
            // 1. Fetch Patient Dossier
            const dossier = await doctorApi.getPatientDossier(patientId);
            setPatientData(dossier);
            setDonneesCliniques(dossier.donnees_cliniques || null);

            const waitingPatients = await doctorApi.getWaitingPatients();
            const currentVisite = waitingPatients.find(v => v.id === visiteId);
            if (!dossier.donnees_cliniques && currentVisite?.donnees_cliniques) {
                setDonneesCliniques(currentVisite.donnees_cliniques);
            }

            // 2. Chercher une consultation existante POUR CETTE VISITE PRÉCISE uniquement
            const existingConsultations = await doctorApi.getConsultations({ visite: visiteId });
            // Filtrer côté client pour s'assurer qu'on ne charge que la consultation de cette visite
            const consultationForThisVisite = Array.isArray(existingConsultations)
                ? existingConsultations.find(c => c.visite === visiteId)
                : null;

            if (consultationForThisVisite) {
                setConsultationId(consultationForThisVisite.id);
                // Ne charger que si des données existent réellement pour cette visite
                if (consultationForThisVisite.symptomes?.length > 0) setSymptomes(consultationForThisVisite.symptomes);
                if (consultationForThisVisite.diagnostics?.length > 0) setDiagnostics(consultationForThisVisite.diagnostics);
                if (consultationForThisVisite.prescriptions?.length > 0) setPrescriptions(consultationForThisVisite.prescriptions);
                if (consultationForThisVisite.examens?.length > 0) setExamens(consultationForThisVisite.examens);
            } else {
                // Aucune consultation pour cette visite → on en crée une nouvelle, vierge
                const newConsult = await doctorApi.createConsultation(visiteId, {
                    motif: currentVisite?.motif_visite || "Consultation générale",
                    patient: patientId
                });
                setConsultationId(newConsult.id);
            }

        } catch (error) {
            console.error("Failed to init consultation", error);
        } finally {
            setIsLoading(false);
        }
    }, [patientId, visiteId]);

    const handleAddSymptome = async (e) => {
        e.preventDefault();
        if(!newSymptome.nom) return;
        try {
            setIsSaving(true);
            const added = await doctorApi.addSymptome(consultationId, newSymptome);
            setSymptomes([...symptomes, added]);
            setNewSymptome({ nom: '', description: '', date_apparition: '' });
        } catch (error) {
            alert("Erreur lors de l'ajout du symptôme");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddDiagnostic = async (e) => {
        e.preventDefault();
        if(!newDiagnostic.libelle) return;
        try {
            setIsSaving(true);
            const added = await doctorApi.addDiagnostic(consultationId, newDiagnostic);
            setDiagnostics([...diagnostics, added]);
            setNewDiagnostic({ libelle: '', description: '', type: 'PRINCIPAL' });
        } catch (error) {
            alert("Erreur lors de l'ajout du diagnostic");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddPrescription = async (e) => {
        e.preventDefault();
        if(!newPrescription.medicament) return;
        try {
            setIsSaving(true);
            
            // Le backend attend : nom, quantite, type_medicament, posologie
            const payload = {
                nom: newPrescription.medicament,
                quantite: newPrescription.duree || "Quantité non précisée",
                type_medicament: "Générique", // Valeur par défaut
                posologie: newPrescription.posologie
            };
            
            const added = await doctorApi.addPrescription(consultationId, payload);
            setPrescriptions([...prescriptions, added]); 
            setNewPrescription({ medicament: '', posologie: '', duree: '' });
        } catch (error) {
            alert("Erreur lors de la prescription");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddExamen = async (e) => {
        e.preventDefault();
        if(!newExamen.nom_examen) return;
        try {
            setIsSaving(true);
            
            // Le backend attend "nom" et non "nom_examen"
            const payload = {
                nom: newExamen.nom_examen,
                motif: newExamen.motif || "Examen de routine"
            };
            
            const added = await doctorApi.prescribeExam(consultationId, payload);
            setExamens([...examens, added]);
            setNewExamen({ nom_examen: '', motif: '' });
        } catch (error) {
            alert("Erreur lors de la prescription d'examen");
        } finally {
            setIsSaving(false);
        }
    };

    const handleHospitaliser = async (e) => {
        e.preventDefault();
        if(!hospitalisation.service || !hospitalisation.motif) return;
        try {
            setIsSaving(true);
            await doctorApi.createHospitalisation(visiteId, hospitalisation);
            alert("Demande d'hospitalisation envoyée avec succès.");
            setHospitalisation({ service: '', motif: '', urgence: false });
        } catch (error) {
            alert("Erreur lors de la demande d'hospitalisation.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleTerminerConsultation = async () => {
        if(window.confirm("Voulez-vous clôturer cette consultation ?")) {
            try {
                await doctorApi.updateVisiteStatus(visiteId, 'TERMINE');
                // Chercher et mettre à jour le RDV correspondant
                try {
                    const rdvResponse = await axiosInstance.get('/patient/rendez-vous/', {
                        params: { patient: patientId }
                    });
                    const rdvs = rdvResponse.data.results || rdvResponse.data;
                    const matchingRdv = rdvs.find(r => 
                        r.statut === 'PROGRAMME' && 
                        r.patient === patientId
                    );
                    if (matchingRdv) {
                        await axiosInstance.patch(`/patient/rendez-vous/${matchingRdv.id}/`, { statut: 'TERMINE' });
                    }
                } catch (e) {
                    console.warn("RDV non mis à jour:", e);
                }
                navigate(AppRoutesPaths.doctorPage);
            } catch (error) {
                alert("Erreur lors de la clôture.");
            }
        }
    };

    const tabs = [
        { id: 'dossier', label: 'Dossier & Constantes', icon: User },
        { id: 'symptomes', label: 'Symptômes', icon: AlertCircle, count: symptomes.length },
        { id: 'diagnostic', label: 'Diagnostic', icon: Stethoscope, count: diagnostics.length },
        { id: 'ordonnance', label: 'Ordonnance', icon: Pill, count: prescriptions.length },
        { id: 'examens', label: 'Examens', icon: FlaskConical, count: examens.length },
        { id: 'hospitalisation', label: 'Hospitalisation', icon: Activity },
    ];

    if (isLoading) {
        return (
            <CustomDashboard linkList={doctorNavLink} requiredRole="medecin">
                <DoctorNavBar>
                    <div className="flex justify-center items-center h-full"><Loading /></div>
                </DoctorNavBar>
            </CustomDashboard>
        );
    }

    return (
        <CustomDashboard linkList={doctorNavLink} requiredRole="medecin">
            <DoctorNavBar>
                <div className="p-6 h-[calc(100vh-100px)] flex flex-col bg-gray-50/50">
                    
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-primary-start/10 rounded-full flex justify-center items-center text-primary-start font-bold text-xl">
                                {patientData?.nom?.charAt(0)}{patientData?.prenom?.charAt(0)}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">
                                    {patientData?.nom} {patientData?.prenom}
                                </h2>
                                <p className="text-sm text-gray-500">
                                    {patientData?.age ? `${patientData.age} ans` : 'Âge inconnu'} • {patientData?.sexe} • {patientData?.matricule || "ID: "+patientData?.id.substring(0,8)}
                                </p>
                            </div>
                        </div>
                        <div>
                            <button 
                                onClick={handleTerminerConsultation}
                                className="flex items-center px-6 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg shadow-md hover:opacity-90 transition-all"
                            >
                                <CheckCircle className="w-5 h-5 mr-2" />
                                Terminer la consultation
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex flex-1 gap-6 overflow-hidden">
                        
                        {/* Sidebar Tabs */}
                        <div className="w-64 flex flex-col gap-2">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center justify-between p-4 rounded-xl font-medium transition-all ${
                                            isActive 
                                                ? 'bg-gradient-to-r from-primary-start to-primary-end text-white shadow-md' 
                                                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                        }`}
                                    >
                                        <div className="flex items-center">
                                            <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                                            {tab.label}
                                        </div>
                                        {tab.count !== undefined && tab.count > 0 && (
                                            <span className={`px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                {tab.count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-y-auto p-6 scrollbar">
                            
                            {/* TAB: DOSSIER & CONSTANTES */}
                            {activeTab === 'dossier' && (
                                <div className="animate-fade-in-up">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Constantes Vitales (Prises par l'infirmier)</h3>
                                     {donneesCliniques ? (
                                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                             <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center">
                                                 <Heart className="w-8 h-8 text-red-500 mr-4" />
                                                 <div>
                                                     <p className="text-xs text-red-600 uppercase font-bold">Tension</p>
                                                     <p className="text-lg font-bold text-red-700">{donneesCliniques.tension_arterielle || "—"} mmHg</p>
                                                 </div>
                                             </div>
                                             <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-center">
                                                 <Thermometer className="w-8 h-8 text-orange-500 mr-4" />
                                                 <div>
                                                     <p className="text-xs text-orange-600 uppercase font-bold">Température</p>
                                                     <p className="text-lg font-bold text-orange-700">{donneesCliniques.temperature || "—"} °C</p>
                                                 </div>
                                             </div>
                                             <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center">
                                                 <Weight className="w-8 h-8 text-blue-500 mr-4" />
                                                 <div>
                                                     <p className="text-xs text-blue-600 uppercase font-bold">Poids</p>
                                                     <p className="text-lg font-bold text-blue-700">{donneesCliniques.poids || "—"} kg</p>
                                                 </div>
                                             </div>
                                             <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center">
                                                 <Ruler className="w-8 h-8 text-indigo-500 mr-4" />
                                                 <div>
                                                     <p className="text-xs text-indigo-600 uppercase font-bold">Taille</p>
                                                     <p className="text-lg font-bold text-indigo-700">{donneesCliniques.taille || "—"} cm</p>
                                                 </div>
                                             </div>
                                             <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex items-center">
                                                 <HeartPulse className="w-8 h-8 text-rose-500 mr-4" />
                                                 <div>
                                                     <p className="text-xs text-rose-600 uppercase font-bold">Pouls</p>
                                                     <p className="text-lg font-bold text-rose-700">{donneesCliniques.pouls || "—"} bpm</p>
                                                 </div>
                                             </div>
                                             <div className="bg-teal-50 p-4 rounded-xl border border-teal-100 flex items-center">
                                                 <Activity className="w-8 h-8 text-teal-500 mr-4" />
                                                 <div>
                                                     <p className="text-xs text-teal-600 uppercase font-bold">Saturation SpO₂</p>
                                                     <p className="text-lg font-bold text-teal-700">{donneesCliniques.taux_oxygene || "—"} %</p>
                                                 </div>
                                             </div>
                                             <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex items-center col-span-2">
                                                 <FlaskConical className="w-8 h-8 text-purple-500 mr-4" />
                                                 <div>
                                                     <p className="text-xs text-purple-600 uppercase font-bold">Groupe & Électrophorèse Hb</p>
                                                     <p className="text-base font-bold text-purple-700">
                                                         {donneesCliniques.groupe_sanguin
                                                             ? `${donneesCliniques.groupe_sanguin}${donneesCliniques.facteur_rhesus === 'POSITIF' ? '+' : donneesCliniques.facteur_rhesus === 'NEGATIF' ? '-' : ''}`
                                                             : '—'} 
                                                         {donneesCliniques.electrophorese_hb ? ` • ${donneesCliniques.electrophorese_hb}` : ''}
                                                     </p>
                                                 </div>
                                             </div>
                                         </div>
                                    ) : (
                                        <div className="bg-gray-50 text-gray-500 p-6 rounded-xl text-center italic mb-8">
                                            Aucune constante vitale enregistrée pour cette visite.
                                        </div>
                                    )}

                                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Historique Médical</h3>
                                    <div className="space-y-4">
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <p className="text-sm font-bold text-gray-500 mb-1">Allergies connues</p>
                                            <p className="text-gray-800">{patientData?.allergies?.length > 0 ? patientData.allergies.map(a => a.declencheur).join(', ') : 'Aucune allergie signalée'}</p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <p className="text-sm font-bold text-gray-500 mb-1">Antécédents</p>
                                            <p className="text-gray-800">{patientData?.antecedents?.length > 0 ? patientData.antecedents.map(a => a.description).join(', ') : 'Aucun antécédent'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: SYMPTÔMES */}
                            {activeTab === 'symptomes' && (
                                <div className="animate-fade-in-up">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Symptômes Déclarés</h3>
                                    
                                    <form onSubmit={handleAddSymptome} className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 flex items-end gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Symptôme</label>
                                            <input type="text" value={newSymptome.nom} onChange={e => setNewSymptome({...newSymptome, nom: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none" placeholder="Ex: Maux de tête" required />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description / Durée</label>
                                            <input type="text" value={newSymptome.description} onChange={e => setNewSymptome({...newSymptome, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none" placeholder="Ex: Depuis 3 jours, intense" />
                                        </div>
                                        <button type="submit" disabled={isSaving} className="px-4 py-2 bg-primary-start text-white rounded-lg font-bold flex items-center shadow-md">
                                            <Plus className="w-4 h-4 mr-1" /> {isSaving ? '...' : 'Ajouter'}
                                        </button>
                                    </form>

                                    <ul className="space-y-3">
                                        {symptomes.length === 0 ? <p className="text-gray-400 italic">Aucun symptôme renseigné.</p> : symptomes.map((s, i) => (
                                            <li key={s.id || i} className="p-4 bg-amber-50 border border-amber-100 rounded-lg shadow-sm">
                                                <p className="font-bold text-amber-800">{s.nom || s.symptome || s.libelle || "—"}</p>
                                                {(s.description || s.duree) && (
                                                    <p className="text-sm text-amber-600 mt-1">{s.description || s.duree}</p>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* TAB: DIAGNOSTIC */}
                            {activeTab === 'diagnostic' && (
                                <div className="animate-fade-in-up">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Diagnostics</h3>
                                    
                                    <form onSubmit={handleAddDiagnostic} className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 flex flex-col gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Diagnostic</label>
                                            <input type="text" value={newDiagnostic.libelle} onChange={e => setNewDiagnostic({...newDiagnostic, libelle: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none" placeholder="Ex: Paludisme sévère" required />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Détails</label>
                                            <textarea value={newDiagnostic.description} onChange={e => setNewDiagnostic({...newDiagnostic, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none" rows="2" placeholder="Observations cliniques..."></textarea>
                                        </div>
                                        <div className="flex justify-end">
                                            <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary-start text-white rounded-lg font-bold flex items-center shadow-md">
                                                <Save className="w-4 h-4 mr-2" /> {isSaving ? 'Enregistrement...' : 'Poser le diagnostic'}
                                            </button>
                                        </div>
                                    </form>

                                    <ul className="space-y-3">
                                        {diagnostics.length === 0 ? <p className="text-gray-400 italic">Aucun diagnostic posé.</p> : diagnostics.map((d, i) => (
                                            <li key={i} className="p-4 bg-blue-50 border border-blue-100 rounded-lg shadow-sm">
                                                <p className="font-bold text-blue-800">{d.libelle}</p>
                                                <p className="text-sm text-blue-600 mt-1">{d.description}</p>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* TAB: ORDONNANCE */}
                            {activeTab === 'ordonnance' && (
                                <div className="animate-fade-in-up">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Prescription Médicamenteuse</h3>
                                    
                                    <form onSubmit={handleAddPrescription} className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 flex items-end gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Médicament</label>
                                            <input type="text" value={newPrescription.medicament} onChange={e => setNewPrescription({...newPrescription, medicament: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none" placeholder="Ex: Paracétamol 1000mg" required />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Posologie / Durée</label>
                                            <input type="text" value={newPrescription.posologie} onChange={e => setNewPrescription({...newPrescription, posologie: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none" placeholder="Ex: 1 cp matin et soir (5 jrs)" required />
                                        </div>
                                        <button type="submit" disabled={isSaving} className="px-4 py-2 bg-primary-start text-white rounded-lg font-bold flex items-center shadow-md">
                                            <Plus className="w-4 h-4 mr-1" /> {isSaving ? '...' : 'Prescrire'}
                                        </button>
                                    </form>

                                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                                <tr>
                                                    <th className="p-3 pl-4">Médicament</th>
                                                    <th className="p-3">Posologie</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {prescriptions.length === 0 ? (
                                                    <tr><td colSpan="2" className="p-4 text-center text-gray-400 italic">Ordonnance vide</td></tr>
                                                ) : prescriptions.map((p, i) => (
                                                    <tr key={i}>
                                                        <td className="p-3 pl-4 font-medium text-gray-800">{p.nom || p.medicament || p.nom_medicament}</td>
                                                        <td className="p-3 text-gray-600">{p.posologie}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TAB: EXAMENS */}
                            {activeTab === 'examens' && (
                                <div className="animate-fade-in-up">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Demande d'examens (Labo / Imagerie)</h3>
                                    
                                    <form onSubmit={handleAddExamen} className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 flex items-end gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type d'examen</label>
                                            <input type="text" value={newExamen.nom_examen} onChange={e => setNewExamen({...newExamen, nom_examen: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none" placeholder="Ex: Goutte épaisse, Échographie..." required />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motif / Indications</label>
                                            <input type="text" value={newExamen.motif} onChange={e => setNewExamen({...newExamen, motif: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none" placeholder="Ex: Suspicion paludisme" />
                                        </div>
                                        <button type="submit" disabled={isSaving} className="px-4 py-2 bg-primary-start text-white rounded-lg font-bold flex items-center shadow-md">
                                            <Plus className="w-4 h-4 mr-1" /> {isSaving ? '...' : 'Demander'}
                                        </button>
                                    </form>

                                    <ul className="space-y-3">
                                        {examens.length === 0 ? <p className="text-gray-400 italic">Aucun examen demandé.</p> : examens.map((e, i) => (
                                            <li key={i} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                                                <div>
                                                    <p className="font-bold text-gray-800">{e.nom || e.nom_examen || e.examen}</p>
                                                    <p className="text-sm text-gray-500">{e.motif || "Sans indication"}</p>
                                                </div>
                                                <span className="px-2 py-1 bg-yellow-50 text-yellow-700 text-xs font-bold rounded-full border border-yellow-200">
                                                    En attente
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* TAB: HOSPITALISATION */}
                            {activeTab === 'hospitalisation' && (
                                <div className="animate-fade-in-up">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Demande d'Hospitalisation</h3>
                                    
                                    <form onSubmit={handleHospitaliser} className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 flex flex-col gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Service / Unité</label>
                                            <input type="text" value={hospitalisation.service} onChange={e => setHospitalisation({...hospitalisation, service: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none" placeholder="Ex: Médecine Générale, Pédiatrie..." required />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motif d'hospitalisation</label>
                                            <textarea value={hospitalisation.motif} onChange={e => setHospitalisation({...hospitalisation, motif: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none" rows="2" placeholder="Justification clinique..." required></textarea>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <input type="checkbox" id="urgence" checked={hospitalisation.urgence} onChange={e => setHospitalisation({...hospitalisation, urgence: e.target.checked})} className="w-4 h-4 text-red-600 rounded" />
                                            <label htmlFor="urgence" className="text-sm font-bold text-red-600">Marquer comme urgence absolue</label>
                                        </div>
                                        <div className="flex justify-end mt-2">
                                            <button type="submit" disabled={isSaving} className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold flex items-center shadow-md transition-colors">
                                                <Activity className="w-4 h-4 mr-2" /> {isSaving ? 'Envoi...' : 'Demander l\'hospitalisation'}
                                            </button>
                                        </div>
                                    </form>
                                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                                        <p className="font-bold flex items-center"><AlertCircle className="w-4 h-4 mr-2"/> Note</p>
                                        <p className="mt-1">La demande sera envoyée à la réception / administration pour l'attribution d'une chambre (AdminChambresPage).</p>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </DoctorNavBar>
        </CustomDashboard>
    );
};

export default ConsultationPage;
