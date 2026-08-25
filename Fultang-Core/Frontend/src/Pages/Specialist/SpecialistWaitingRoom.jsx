import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { specialistNavLink } from "./lib/specialistNavLink.js";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { doctorApi } from "../../services/doctorApi.js";
import { AppRoutesPaths } from "../../Router/appRouterPaths.js";
import {
    Clock, Activity, FileText, ChevronRight, ChevronLeft, Stethoscope,
    Heart, Thermometer, Droplets, RefreshCw, Microscope
} from 'lucide-react';

const PAGE_SIZE = 3;

export const SpecialistWaitingRoom = () => {
    const [patients, setPatients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const navigate = useNavigate();

    const totalPages = Math.max(1, Math.ceil(patients.length / PAGE_SIZE));
    const visiblePatients = patients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    useEffect(() => { fetchWaitingPatients(); }, []);

    const fetchWaitingPatients = async () => {
        try {
            setIsLoading(true);
            setError("");
            const data = await doctorApi.getWaitingPatients('specialist');
            setPatients(data);
            setCurrentPage(1);
        } catch {
            setError("Impossible de charger la liste des patients référés.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleConsulter = (patientId, visiteId) => {
        navigate(`/specialist/consultation?patient=${patientId}&visite=${visiteId}`);
    };

    const handleVoirDossier = (patientId) => {
        navigate(AppRoutesPaths.specialistPatientDossier.replace(':id', patientId));
    };

    const formatTime = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

    const renderVitalSigns = (dc) => {
        if (!dc) return <span className="text-xs text-gray-400 italic">Paramètres non pris</span>;
        return (
            <div className="flex gap-2 flex-wrap text-xs">
                {dc.pouls && <span className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium"><Heart className="w-3 h-3" />{dc.pouls} bpm</span>}
                {dc.poids && <span className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium"><Droplets className="w-3 h-3" />{dc.poids} kg</span>}
                {dc.taux_oxygene && <span className="flex items-center gap-1 bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium"><Thermometer className="w-3 h-3" />SpO₂ {dc.taux_oxygene}%</span>}
            </div>
        );
    };

    const startIndex = (currentPage - 1) * PAGE_SIZE + 1;
    const endIndex = Math.min(currentPage * PAGE_SIZE, patients.length);

    return (
        <CustomDashboard linkList={specialistNavLink} requiredRole="medecin_specialiste">
            <div className="p-6 h-[calc(100vh-60px)] flex flex-col bg-gray-50/50">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                            <Microscope className="w-7 h-7 mr-2 text-purple-600" />
                            Salle d'attente — Spécialiste
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Patients référés en attente de consultation spécialisée</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchWaitingPatients}
                            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-white rounded-lg border border-gray-200 transition-all shadow-sm"
                            title="Rafraîchir"
                        >
                            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <div className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg font-medium flex items-center shadow-sm">
                            <Activity className="w-4 h-4 mr-2 text-purple-400" />
                            {patients.length} patient{patients.length > 1 ? 's' : ''} en attente
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm mb-6">{error}</div>
                )}

                {isLoading ? (
                    <div className="flex-1 flex justify-center items-center"><Loading /></div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                                        <th className="p-4 pl-6">Patient</th>
                                        <th className="p-4">Âge / Sexe</th>
                                        <th className="p-4">Motif de référence</th>
                                        <th className="p-4">Paramètres vitaux</th>
                                        <th className="p-4">Heure d'arrivée</th>
                                        <th className="p-4 pr-6 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {patients.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="p-12 text-center text-gray-500">
                                                <Microscope className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                                                <p className="font-medium">Aucun patient référé en attente</p>
                                                <p className="text-sm text-gray-400 mt-1">La salle d'attente est vide pour le moment.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        visiblePatients.map((item) => (
                                            <tr key={item.id} className="hover:bg-purple-50/30 transition-colors duration-150 group">
                                                <td className="p-4 pl-6">
                                                    <div className="font-semibold text-gray-800">{item.patient.nom} {item.patient.prenom}</div>
                                                    <div className="text-xs text-gray-400 font-mono mt-0.5">{item.patient.matricule || item.patient.id?.substring(0, 8)}</div>
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-gray-600 text-sm">
                                                        {item.patient.age ? `${item.patient.age} ans` : '—'} • {item.patient.sexe}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center text-gray-600 text-sm">
                                                        <FileText className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                                                        <span className="line-clamp-2">{item.motif_visite || "—"}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4">{renderVitalSigns(item.donnees_cliniques)}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center font-medium text-gray-600 text-sm">
                                                        <Clock className="w-4 h-4 mr-2 text-gray-400" />
                                                        {formatTime(item.date_heure)}
                                                    </div>
                                                    <div className="text-xs text-gray-400 mt-0.5">{formatDate(item.date_heure)}</div>
                                                </td>
                                                <td className="p-4 pr-6 text-right">
                                                    <div className="flex justify-end items-center space-x-2">
                                                        <button
                                                            onClick={() => handleVoirDossier(item.patient.id)}
                                                            title="Consulter le dossier médical"
                                                            className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-all"
                                                        >
                                                            <FileText className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleConsulter(item.patient.id, item.id)}
                                                            className="inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:opacity-90 shadow-sm hover:shadow-md transition-all duration-300"
                                                        >
                                                            <Stethoscope className="w-4 h-4 mr-1.5" />
                                                            Consulter
                                                            <ChevronRight className="w-4 h-4 ml-1 opacity-90" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {patients.length > 0 && (
                            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50/50">
                                <span className="text-sm text-gray-500">
                                    Affichage de {startIndex} à {endIndex} sur {patients.length} patients
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setCurrentPage(p => p - 1)}
                                        disabled={currentPage === 1}
                                        className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${currentPage === page ? 'bg-purple-600 text-white shadow-sm' : 'border border-gray-200 text-gray-500 hover:bg-white'}`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setCurrentPage(p => p + 1)}
                                        disabled={currentPage === totalPages}
                                        className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </CustomDashboard>
    );
};

export default SpecialistWaitingRoom;
