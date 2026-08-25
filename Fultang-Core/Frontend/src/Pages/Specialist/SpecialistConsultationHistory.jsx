import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { specialistNavLink } from "./lib/specialistNavLink.js";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { doctorApi } from "../../services/doctorApi.js";
import { AppRoutesPaths } from "../../Router/appRouterPaths.js";
import { History, Calendar, Stethoscope, Search, ChevronRight, Microscope } from 'lucide-react';

export const SpecialistConsultationHistory = () => {
    const [consultations, setConsultations] = useState([]);
    const [filteredConsultations, setFilteredConsultations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        fetchHistory();
    }, []);

    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredConsultations(consultations);
        } else {
            const lowerSearch = searchTerm.toLowerCase();
            const filtered = consultations.filter(c => 
                (c.patientDetails?.nom?.toLowerCase().includes(lowerSearch)) || 
                (c.patientDetails?.prenom?.toLowerCase().includes(lowerSearch)) ||
                (c.motif?.toLowerCase().includes(lowerSearch))
            );
            setFilteredConsultations(filtered);
        }
    }, [searchTerm, consultations]);

    const fetchHistory = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const consultData = await doctorApi.getConsultations();
            
            if (!Array.isArray(consultData)) {
                setError(`Format inattendu.`);
                return;
            }
            
            // We sort by latest first
            // Note: If we had auth, we would filter only consultations done by this specific specialist.
            const sorted = [...consultData].sort((a, b) => {
                const da = a.date_heure ? new Date(a.date_heure) : 0;
                const db = b.date_heure ? new Date(b.date_heure) : 0;
                return db - da;
            });
            setConsultations(sorted);
            setFilteredConsultations(sorted);
        } catch (error) {
            console.error("Failed to fetch specialist consultation history", error);
            setError(error?.response?.data ? JSON.stringify(error.response.data) : error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (isoString) => {
        const d = new Date(isoString);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <CustomDashboard linkList={specialistNavLink} requiredRole="medecin_specialiste">
            <div className="p-6 h-[calc(100vh-60px)] flex flex-col bg-gray-50/50">
                
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                            <Microscope className="w-7 h-7 mr-2 text-purple-600" />
                            Historique des Consultations Spécialisées
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Retrouvez toutes vos consultations, actes techniques et diagnostics ciblés</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Rechercher par patient ou motif de consultation..." 
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                        <strong>Erreur de chargement :</strong> {error}
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                    {isLoading ? (
                        <div className="flex-1 flex justify-center items-center"><Loading /></div>
                    ) : (
                        <div className="overflow-y-auto flex-1 scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-white shadow-sm z-10">
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                                        <th className="p-4 pl-6">Date</th>
                                        <th className="p-4">Patient</th>
                                        <th className="p-4">Motif d'intervention</th>
                                        <th className="p-4">Bilan Spécialisé</th>
                                        <th className="p-4 pr-6 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredConsultations.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="p-12 text-center text-gray-500">
                                                <Microscope className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                                <p className="font-medium">Aucune consultation trouvée</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredConsultations.map((consult) => (
                                            <tr key={consult.id} className="hover:bg-purple-50/30 transition-colors group">
                                                <td className="p-4 pl-6">
                                                    <div className="flex items-center text-sm font-medium text-gray-700">
                                                        <Calendar className="w-4 h-4 mr-2 text-purple-600" />
                                                        {consult.date_heure ? formatDate(consult.date_heure) : "Date inconnue"}
                                                    </div>
                                                </td>
                                                <td className="p-4 font-bold text-gray-800">
                                                    {consult.patientDetails?.nom || "Patient"} {consult.patientDetails?.prenom || ""}
                                                </td>
                                                <td className="p-4 text-sm text-gray-600">
                                                    {consult.motif || "Non spécifié"}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex gap-2 text-xs">
                                                        {consult.diagnostics?.length > 0 && <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-bold">{consult.diagnostics.length} Diagnostic(s) Cible(s)</span>}
                                                        {consult.examens?.length > 0 && <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-bold">{consult.examens.length} Examen(s) Spécialisé(s)</span>}
                                                        {/* We can fake some stats if we want, or just show prescriptions */}
                                                        {consult.prescriptions?.length > 0 && <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200 font-bold">{consult.prescriptions.length} Ordo(s)</span>}
                                                    </div>
                                                </td>
                                                <td className="p-4 pr-6 text-right">
                                                    {consult.patientDetails?.id && (
                                                        <button 
                                                            onClick={() => navigate(AppRoutesPaths.specialistPatientDossier.replace(':id', consult.patientDetails.id))}
                                                            className="inline-flex items-center text-purple-700 bg-purple-100 hover:bg-purple-200 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
                                                        >
                                                            Voir Dossier <ChevronRight className="w-4 h-4 ml-1" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </CustomDashboard>
    );
};

export default SpecialistConsultationHistory;
