import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { nurseNavLink } from "./nurseNavLink.js";
import { NurseNavBar } from "./NurseNavBar.jsx";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { nurseApi } from "../../services/nurseApi.js";
import { AppRoutesPaths } from "../../Router/appRouterPaths.js";
import { Clock, Activity, FileText, ChevronRight } from 'lucide-react';

export const WaitingRoom = () => {
    const [patients, setPatients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        fetchWaitingPatients();
    }, []);

    const fetchWaitingPatients = async () => {
        try {
            setIsLoading(true);
            const data = await nurseApi.getWaitingPatients();
            
            // Masquer les visites déjà traitées par l'infirmier
            const treatedVisits = JSON.parse(localStorage.getItem('treated_visits') || '[]');
            const filteredData = data.filter(v => !treatedVisits.includes(v.id));
            
            setPatients(filteredData);
        } catch (err) {
            setError("Impossible de charger la liste des patients en attente.");
        } finally {
            setIsLoading(false);
        }
    };

    // Si le patient vient d'un RDV (item.source === 'rdv'), il n'a pas encore de visite :
    // on en crée une à la volée et on clôture le RDV, pour que la prise de paramètres
    // et la suite (consultation médecin) fonctionnent normalement.
    const handleTakeParameters = async (item) => {
        try {
            let visiteId = item.id;
            if (item.source === 'rdv') {
                const visite = await nurseApi.createVisite(item.patient.id, item.motif_visite || "Consultation");
                visiteId = visite.id;
                if (item.rdvId) await nurseApi.terminerRendezVous(item.rdvId);
            }
            navigate(AppRoutesPaths.patientDetailsPage.replace(':id', item.patient.id) + `?visite=${visiteId}`);
        } catch (err) {
            setError("Impossible de démarrer la prise de paramètres pour ce patient.");
        }
    };

    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <CustomDashboard linkList={nurseNavLink} requiredRole="nurse">
            <NurseNavBar>
                <div className="p-6 h-[calc(100vh-100px)] flex flex-col bg-gray-50/50">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">Salle d'attente</h2>
                            <p className="text-sm text-gray-500 mt-1">Gestion des arrivées et paramètres vitaux</p>
                        </div>
                        <div className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg font-medium flex items-center shadow-sm">
                            <Activity className="w-4 h-4 mr-2 text-gray-400" />
                            {patients.length} patient{patients.length > 1 ? 's' : ''} en attente
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm mb-6">
                            {error}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex-1 flex justify-center items-center">
                            <Loading />
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                                            <th className="p-4 pl-6">Patient</th>
                                            <th className="p-4">Âge / Sexe</th>
                                            <th className="p-4">Motif</th>
                                            <th className="p-4">Heure d'arrivée</th>
                                            <th className="p-4 pr-6 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {patients.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="p-12 text-center text-gray-500">
                                                    La salle d'attente est vide pour le moment.
                                                </td>
                                            </tr>
                                        ) : (
                                            patients.map((item) => (
                                                <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-150 group">
                                                    <td className="p-4 pl-6">
                                                        <div className="font-semibold text-gray-800">
                                                            {item.patient.nom} {item.patient.prenom}
                                                        </div>
                                                        <div className="text-xs text-gray-400 font-mono mt-0.5">
                                                            {item.patient.matricule || "—"}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="text-gray-600 text-sm">
                                                            {item.patient.age ? `${item.patient.age} ans` : '—'} • {item.patient.sexe}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center text-gray-600 text-sm">
                                                            <FileText className="w-4 h-4 mr-2 text-gray-400" />
                                                            {item.motif_visite}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center font-medium text-gray-600 text-sm">
                                                            <Clock className="w-4 h-4 mr-2 text-gray-400" />
                                                            {formatTime(item.date_heure)}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 pr-6 text-right flex justify-end items-center space-x-2">
                                                        <button
                                                            onClick={() => navigate(AppRoutesPaths.consultationHistoryPage.replace(':id', item.patient.id))}
                                                            title="Voir historique"
                                                            className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-all"
                                                        >
                                                            <FileText className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleTakeParameters(item)}
                                                            className="inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-lg text-sm font-medium hover:opacity-90 shadow-sm hover:shadow-md transition-all duration-300"
                                                        >
                                                            Prendre paramètres
                                                            <ChevronRight className="w-4 h-4 ml-1 opacity-90" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </NurseNavBar>
        </CustomDashboard>
    );
};

export default WaitingRoom;
