import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { nurseNavLink } from "./nurseNavLink.js";
import { NurseNavBar } from "./NurseNavBar.jsx";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { nurseApi } from "../../services/nurseApi.js";
import { AppRoutesPaths } from "../../Router/appRouterPaths.js";
import { FlaskConical, Search, Clock, FileText, CheckCircle2, AlertCircle, ChevronRight, X, Info } from 'lucide-react';

export const NurseExams = () => {
    const [exams, setExams] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("TOUS");
    const [selectedExam, setSelectedExam] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadExams();
    }, []);

    const loadExams = async () => {
        try {
            setIsLoading(true);
            const data = await nurseApi.getExams();
            setExams(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenResult = (ex) => {
        if (ex.statut === 'REALISE') {
            setSelectedExam(ex);
            setIsModalOpen(true);
        } else {
            navigate(AppRoutesPaths.consultationHistoryPage.replace(':id', ex.patient.id || "P-4587"));
        }
    };

    const filteredExams = exams.filter(ex => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = ex.nom.toLowerCase().includes(term) ||
            (ex.patient?.nom || '').toLowerCase().includes(term) ||
            (ex.patient?.prenom || '').toLowerCase().includes(term);
        
        const matchesStatus = statusFilter === 'TOUS' || ex.statut === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const getStatusStyle = (statut) => {
        switch (statut) {
            case 'EN_ATTENTE': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'REALISE': return 'bg-green-100 text-green-700 border-green-200';
            case 'ANNULE': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <CustomDashboard linkList={nurseNavLink} requiredRole="nurse" requiredFunctionalService="SOINS_INFIRMIERS">
            <NurseNavBar>
                <div className="p-6 h-[calc(100vh-100px)] flex flex-col bg-gray-50/50 overflow-y-auto scrollbar">
                    
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                                <FlaskConical className="w-7 h-7 mr-2 text-primary-start" />
                                Suivi des Examens
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">Gérez et suivez l'avancement des examens biologiques et radiologiques</p>
                        </div>
                        <div className="flex flex-col xl:flex-row gap-4 w-full md:w-auto">
                            <div className="flex bg-gray-200/50 p-1 rounded-xl">
                                {['TOUS', 'EN_ATTENTE', 'REALISE'].map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => setStatusFilter(status)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                            statusFilter === status 
                                                ? 'bg-white text-primary-start shadow-sm' 
                                                : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        {status === 'TOUS' ? 'Tous' : status === 'EN_ATTENTE' ? 'En Attente' : 'Réalisés'}
                                    </button>
                                ))}
                            </div>
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Chercher un patient ou examen..."
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-start outline-none transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Exams List */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1">
                        {isLoading ? <div className="flex justify-center items-center h-64"><Loading /></div> : (
                            <div className="divide-y divide-gray-100">
                                {filteredExams.length === 0 ? (
                                    <div className="p-16 text-center">
                                        <AlertCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                        <p className="text-gray-500 font-medium">Aucun examen trouvé.</p>
                                    </div>
                                ) : (
                                    filteredExams.map((ex) => (
                                        <div key={ex.id} className="p-5 hover:bg-gray-50 transition-colors group">
                                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
                                                        <FileText className="w-6 h-6 text-indigo-500" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-lg font-bold text-gray-800">{ex.nom}</h4>
                                                            {ex.anatomie && (
                                                                <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded uppercase tracking-wider">
                                                                    {ex.anatomie}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-500">
                                                            <span className="font-semibold text-gray-700">{ex.patient.nom} {ex.patient.prenom}</span>
                                                            <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {new Date(ex.date_prescription).toLocaleDateString('fr-FR')}</span>
                                                            <span className="italic">Motif : {ex.motif}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusStyle(ex.statut)}`}>
                                                        {ex.statut}
                                                    </span>
                                                    <button 
                                                        onClick={() => handleOpenResult(ex)}
                                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${ex.statut === 'REALISE' ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                                    >
                                                        {ex.statut === 'REALISE' ? 'Voir résultat' : 'Détails'}
                                                        <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Result Modal */}
                    {isModalOpen && selectedExam && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up">
                                <div className="bg-gradient-to-r from-green-600 to-green-500 p-6 text-white flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xl font-bold flex items-center">
                                            <CheckCircle2 className="w-6 h-6 mr-2" />
                                            Résultats de l'examen
                                        </h3>
                                        <p className="text-sm opacity-90">{selectedExam.nom} • {selectedExam.patient.nom} {selectedExam.patient.prenom}</p>
                                    </div>
                                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-all">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="p-8 space-y-6">
                                    <div className="grid grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center">
                                                <Info className="w-3.5 h-3.5 mr-1.5" /> Observations
                                            </h4>
                                            <p className="text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100 italic">
                                                "{selectedExam.resultat?.observations || "Aucune observation."}"
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center">
                                                <FlaskConical className="w-3.5 h-3.5 mr-1.5" /> Zone Anatomique
                                            </h4>
                                            <p className="text-gray-700 font-bold bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                                {selectedExam.anatomie || "Non précisée"}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Résultats détaillés</h4>
                                        <div className="text-gray-800 bg-white p-5 rounded-xl border-2 border-dashed border-gray-200 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                                            {selectedExam.resultat?.resultats}
                                        </div>
                                    </div>

                                    <div className="bg-amber-50 p-5 rounded-xl border border-amber-100">
                                        <h4 className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2 flex items-center">
                                            <FileText className="w-3.5 h-3.5 mr-1.5" /> Interprétation Médicale
                                        </h4>
                                        <p className="text-amber-900 font-semibold italic">
                                            {selectedExam.resultat?.interpretation}
                                        </p>
                                    </div>
                                </div>
                                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                                    <button 
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-all"
                                    >
                                        Fermer
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </NurseNavBar>
        </CustomDashboard>
    );
};

export default NurseExams;
