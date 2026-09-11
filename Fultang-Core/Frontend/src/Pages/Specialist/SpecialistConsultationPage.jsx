import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { specialistNavLink } from "./lib/specialistNavLink.js";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { doctorApi } from "../../services/doctorApi.js";
import { 
    Stethoscope, User, Activity, FileText, Pill, FlaskConical, 
    Save, Plus, AlertCircle, Heart, Thermometer, Droplets, CheckCircle, Microscope
} from 'lucide-react';
import { AppRoutesPaths } from "../../Router/appRouterPaths.js";
import axiosInstance from "../../Utils/axiosInstance.js";
import { useAuthentication } from "../../Utils/Provider.jsx";
import { getSpecialtyFields } from "../../constants/specialtyConsultationFields.js";

export const SpecialistConsultationPage = () => {
    const [searchParams] = useSearchParams();
    const patientId = searchParams.get('patient');
    const visiteId = searchParams.get('visite');
    const navigate = useNavigate();
    const { userData } = useAuthentication();
    const specialtyFields = getSpecialtyFields(userData?.specialite || userData?.specialite_medecin || '');
    const [champsSpecialite, setChampsSpecialite] = useState({});

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
            navigate(AppRoutesPaths.specialistPage);
            return;
        }
        initConsultation();
    }, [patientId, visiteId]);

    const initConsultation = useCallback(async () => {
        try {
            setIsLoading(true);
            
            // Reset complet avant chargement
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

            const waitingPatients = await doctorApi.getWaitingPatients('specialist');
            const currentVisite = waitingPatients.find(v => v.id === visiteId);
            if (!dossier.donnees_cliniques && currentVisite?.donnees_cliniques) {
                setDonneesCliniques(currentVisite.donnees_cliniques);
            }

            // 2. Chercher une consultation existante pour cette visite
            const consultationForThisVisite = await doctorApi.getConsultationByVisite(visiteId);

            if (consultationForThisVisite) {
                setConsultationId(consultationForThisVisite.id);
                if (consultationForThisVisite.symptomes?.length > 0) setSymptomes(consultationForThisVisite.symptomes);
                if (consultationForThisVisite.diagnostics?.length > 0) setDiagnostics(consultationForThisVisite.diagnostics);
                if (consultationForThisVisite.prescriptions?.length > 0) setPrescriptions(consultationForThisVisite.prescriptions);
                if (consultationForThisVisite.examens?.length > 0) setExamens(consultationForThisVisite.examens);
                if (consultationForThisVisite.champs_specialite) setChampsSpecialite(consultationForThisVisite.champs_specialite);
            } else {
                const newConsult = await doctorApi.createConsultation(visiteId, { 
                    motif: currentVisite?.motif_visite || "Consultation spécialisée",
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
            
            const payload = {
                nom: newPrescription.medicament,
                quantite: newPrescription.duree || "Quantité non précisée",
                type_medicament: "Spécialisé", 
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
            
            const payload = {
                nom: newExamen.nom_examen,
                motif: newExamen.motif?.trim() || '',
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
        if(window.confirm("Voulez-vous clôturer cette consultation spécialisée ?")) {
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
                navigate(AppRoutesPaths.specialistPage);
            } catch (error) {
                alert("Erreur lors de la clôture.");
            }
        }
    };

    const tabs = [
        { id: 'dossier', label: 'Dossier & Constantes', icon: User },
        { id: 'symptomes', label: 'Symptômes', icon: AlertCircle, count: symptomes.length },
        { id: 'diagnostic', label: 'Diagnostic Spécialisé', icon: Microscope, count: diagnostics.length },
        { id: 'ordonnance', label: 'Ordonnance', icon: Pill, count: prescriptions.length },
        { id: 'examens', label: 'Examens Spécialisés', icon: FlaskConical, count: examens.length },
        { id: 'hospitalisation', label: 'Hospitalisation', icon: Activity },
    ];

    if (isLoading) {
        return (
            <CustomDashboard linkList={specialistNavLink} requiredRole="medecin_specialiste">
                <div className="flex justify-center items-center h-full"><Loading /></div>
            </CustomDashboard>
        );
    }

    return (
        <CustomDashboard linkList={specialistNavLink} requiredRole="medecin_specialiste">
            <div className="p-6 h-[calc(100vh-60px)] flex flex-col bg-gray-50/50">
                
                {/* Header */}
                <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-purple-100 rounded-full flex justify-center items-center text-purple-700 font-bold text-xl">
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
                                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' 
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
                                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Constantes Vitales</h3>
                                {donneesCliniques ? (
                                    <div className="grid grid-cols-3 gap-4 mb-8">
                                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center">
                                            <Heart className="w-8 h-8 text-red-500 mr-4" />
                                            <div>
                                                <p className="text-xs text-red-600 uppercase font-bold">Tension</p>
                                                <p className="text-xl font-bold text-red-700">{donneesCliniques.tension_arterielle || "—"} mmHg</p>
                                            </div>
                                        </div>
                                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-center">
                                            <Thermometer className="w-8 h-8 text-orange-500 mr-4" />
                                            <div>
                                                <p className="text-xs text-orange-600 uppercase font-bold">Température</p>
                                                <p className="text-xl font-bold text-orange-700">{donneesCliniques.temperature || "—"} °C</p>
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center">
                                            <Droplets className="w-8 h-8 text-blue-500 mr-4" />
                                            <div>
                                                <p className="text-xs text-blue-600 uppercase font-bold">Poids</p>
                                                <p className="text-xl font-bold text-blue-700">{donneesCliniques.poids || "—"} kg</p>
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
                                        <p className="text-gray-800">{patientData?.antecedents?.length > 0 ? patientData.antecedents.map(a => a.description || a.nom).join(', ') : 'Aucun antécédent'}</p>
                                    </div>
                                </div>

                                {specialtyFields.length > 0 && (
                                    <div className="mt-8">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Examens spécialisés ({userData?.specialite || 'Spécialité'})</h3>
                                        <div className="space-y-4">
                                            {specialtyFields.map((field) => (
                                                <div key={field.name}>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{field.label}</label>
                                                    <textarea
                                                        value={champsSpecialite[field.name] || ''}
                                                        onChange={(e) => setChampsSpecialite({ ...champsSpecialite, [field.name]: e.target.value })}
                                                        className="w-full px-3 py-2 border rounded-lg min-h-[80px]"
                                                        placeholder={field.placeholder}
                                                    />
                                                </div>
                                            ))}
                                            {consultationId && (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        await doctorApi.updateConsultation(consultationId, { champs_specialite: champsSpecialite });
                                                        alert('Champs spécialité enregistrés.');
                                                    }}
                                                    className="px-4 py-2 bg-primary-start text-white rounded-lg font-bold"
                                                >
                                                    Enregistrer les champs spécialité
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB: SYMPTÔMES */}
                        {activeTab === 'symptomes' && (
                            <div className="animate-fade-in-up">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Symptômes Déclarés</h3>
                                
                                <form onSubmit={handleAddSymptome} className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 flex items-end gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Symptôme</label>
                                        <input type="text" value={newSymptome.nom} onChange={e => setNewSymptome({...newSymptome, nom: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none" placeholder="Ex: Douleur thoracique" required />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description / Durée</label>
                                        <input type="text" value={newSymptome.description} onChange={e => setNewSymptome({...newSymptome, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none" placeholder="Ex: Depuis 3 jours, à l'effort" />
                                    </div>
                                    <button type="submit" disabled={isSaving} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold flex items-center shadow-md">
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
                                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Diagnostics Spécialisés</h3>
                                
                                <form onSubmit={handleAddDiagnostic} className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 flex flex-col gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Diagnostic</label>
                                        <input type="text" value={newDiagnostic.libelle} onChange={e => setNewDiagnostic({...newDiagnostic, libelle: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none border-purple-200 focus:border-purple-500" placeholder="Ex: Insuffisance cardiaque congestive" required />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Détails cliniques</label>
                                        <textarea value={newDiagnostic.description} onChange={e => setNewDiagnostic({...newDiagnostic, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none border-purple-200 focus:border-purple-500" rows="2" placeholder="Observations spécialisées..."></textarea>
                                    </div>
                                    <div className="flex justify-end">
                                        <button type="submit" disabled={isSaving} className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold flex items-center shadow-md hover:bg-purple-700">
                                            <Save className="w-4 h-4 mr-2" /> {isSaving ? 'Enregistrement...' : 'Enregistrer le diagnostic'}
                                        </button>
                                    </div>
                                </form>

                                <ul className="space-y-3">
                                        {diagnostics.length === 0 ? <p className="text-gray-400 italic">Aucun diagnostic enregistré.</p> : diagnostics.map((d, i) => (
                                        <li key={i} className="p-4 bg-purple-50 border border-purple-100 rounded-lg shadow-sm">
                                            <p className="font-bold text-purple-800">{d.libelle}</p>
                                            <p className="text-sm text-purple-600 mt-1">{d.description}</p>
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
                                        <input type="text" value={newPrescription.medicament} onChange={e => setNewPrescription({...newPrescription, medicament: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none" placeholder="Ex: Furosémide 40mg" required />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Posologie / Durée</label>
                                        <input type="text" value={newPrescription.posologie} onChange={e => setNewPrescription({...newPrescription, posologie: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none" placeholder="Ex: 1 cp le matin" required />
                                    </div>
                                    <button type="submit" disabled={isSaving} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold flex items-center shadow-md">
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
                                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Demande d'examens spécialisés (Imagerie / Labo)</h3>
                                
                                <form onSubmit={handleAddExamen} className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 flex items-end gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type d'examen</label>
                                        <input type="text" value={newExamen.nom_examen} onChange={e => setNewExamen({...newExamen, nom_examen: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none border-purple-200" placeholder="Ex: Échocardiographie, IRM cérébrale..." required />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motif / Indications</label>
                                        <input type="text" value={newExamen.motif} onChange={e => setNewExamen({...newExamen, motif: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none" placeholder="Ex: Évaluation FEVG" />
                                    </div>
                                    <button type="submit" disabled={isSaving} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold flex items-center shadow-md">
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
                                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Demande d'Hospitalisation / Actes Techniques</h3>
                                
                                <form onSubmit={handleHospitaliser} className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 flex flex-col gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Service Spécialisé</label>
                                        <input type="text" value={hospitalisation.service} onChange={e => setHospitalisation({...hospitalisation, service: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none border-purple-200" placeholder="Ex: Unité de Soins Intensifs Cardiologiques (USIC)..." required />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motif d'hospitalisation / Acte prévu</label>
                                        <textarea value={hospitalisation.motif} onChange={e => setHospitalisation({...hospitalisation, motif: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none" rows="2" placeholder="Ex: Pose de stent, surveillance post-opératoire..." required></textarea>
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
                                <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg text-sm text-purple-800">
                                    <p className="font-bold flex items-center"><AlertCircle className="w-4 h-4 mr-2"/> Note</p>
                                    <p className="mt-1">La demande est transmise à l&apos;infirmier(ère) du service concerné, qui affecte le patient à une salle et un lit.</p>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </CustomDashboard>
    );
};

export default SpecialistConsultationPage;
