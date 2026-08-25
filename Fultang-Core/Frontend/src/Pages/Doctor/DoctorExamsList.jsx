import React, { useState, useEffect } from 'react';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { doctorNavLink } from "./lib/doctorNavLink.js";
import { DoctorNavBar } from "./DoctorComponents/DoctorNavBar.jsx";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { doctorApi } from "../../services/doctorApi.js";
import { FlaskConical, Search, CheckCircle, Clock } from 'lucide-react';

export const DoctorExamsList = () => {
    const [examens, setExamens] = useState([]);
    const [filteredExamens, setFilteredExamens] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("TOUS");

    useEffect(() => {
        fetchExamens();
    }, []);

    useEffect(() => {
        let filtered = examens;

        if (statusFilter !== "TOUS") {
            filtered = filtered.filter(e => e.statut === statusFilter);
        }

        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(e => 
                (e.nom?.toLowerCase().includes(lowerSearch)) || 
                (e.patient?.nom?.toLowerCase().includes(lowerSearch)) ||
                (e.patient?.prenom?.toLowerCase().includes(lowerSearch))
            );
        }
        setFilteredExamens(filtered);
    }, [searchTerm, statusFilter, examens]);

    const fetchExamens = async () => {
        try {
            setIsLoading(true);
            const data = await doctorApi.getExamens();
            setExamens(data);
            setFilteredExamens(data);
        } catch (error) {
            console.error("Failed to fetch exams", error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (isoString) => {
        if (!isoString) return "—";
        return new Date(isoString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <CustomDashboard linkList={doctorNavLink} requiredRole="medecin">
            <DoctorNavBar>
                <div className="p-6 h-[calc(100vh-100px)] flex flex-col bg-gray-50/50">
                    
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                                <FlaskConical className="w-7 h-7 mr-2 text-primary-start" />
                                Suivi des Examens
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">Vérifiez l'arrivée des résultats du laboratoire</p>
                        </div>
                    </div>

                    <div className="flex gap-4 mb-6">
                        <div className="flex-1 bg-white p-2 rounded-xl shadow-sm border border-gray-200 relative">
                            <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                            <input 
                                type="text" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Rechercher par examen ou patient..." 
                                className="w-full pl-12 pr-4 py-1 bg-transparent border-none focus:ring-0 outline-none"
                            />
                        </div>
                        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
                            {["TOUS", "EN_ATTENTE", "REALISE"].map(stat => (
                                <button key={stat} onClick={() => setStatusFilter(stat)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusFilter === stat ? 'bg-primary-start text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>
                                    {stat === 'TOUS' ? 'Tous' : stat === 'EN_ATTENTE' ? 'En Attente' : 'Résultats dispo'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                        {isLoading ? (
                            <div className="flex-1 flex justify-center items-center"><Loading /></div>
                        ) : (
                            <div className="overflow-y-auto flex-1 scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-white shadow-sm z-10">
                                        <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                                            <th className="p-4 pl-6">Examen</th>
                                            <th className="p-4">Patient</th>
                                            <th className="p-4">Prescrit le</th>
                                            <th className="p-4">Statut</th>
                                            <th className="p-4 pr-6">Résultat</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredExamens.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="p-12 text-center text-gray-500">
                                                    <FlaskConical className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                                    <p className="font-medium">Aucun examen trouvé</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredExamens.map((exam) => (
                                                <tr key={exam.id} className="hover:bg-gray-50 transition-colors group">
                                                    <td className="p-4 pl-6">
                                                        <div className="font-bold text-gray-800">{exam.nom || exam.nom_examen || "Examen sans nom"}</div>
                                                        <div className="text-xs text-gray-500 mt-0.5">{exam.motif || "Pas de motif spécifié"}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-medium text-gray-700">{exam.patient?.nom} {exam.patient?.prenom}</div>
                                                    </td>
                                                    <td className="p-4 text-sm text-gray-600">
                                                        {formatDate(exam.date_prescription)}
                                                    </td>
                                                    <td className="p-4">
                                                        {exam.statut === 'EN_ATTENTE' ? (
                                                            <span className="flex items-center text-xs font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded w-max">
                                                                <Clock className="w-3 h-3 mr-1" /> En attente
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded w-max">
                                                                <CheckCircle className="w-3 h-3 mr-1" /> Réalisé
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 pr-6">
                                                        {exam.statut === 'REALISE' && exam.resultat ? (
                                                            <div className="text-sm text-gray-700 p-2 bg-gray-50 rounded border">
                                                                <span className="font-bold">Valeur:</span> {exam.resultat.valeur_mesuree} <br/>
                                                                <span className="text-xs text-gray-500">{exam.resultat.observations}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 italic text-sm">—</span>
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
            </DoctorNavBar>
        </CustomDashboard>
    );
};

export default DoctorExamsList;
