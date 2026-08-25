import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { doctorNavLink } from "./lib/doctorNavLink.js";
import { DoctorNavBar } from "./DoctorComponents/DoctorNavBar.jsx";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { doctorApi } from "../../services/doctorApi.js";
import { AppRoutesPaths } from "../../Router/appRouterPaths.js";
import { Clock, Activity, FileText, ChevronRight, ChevronLeft, Stethoscope, Heart, Thermometer, Droplets, RefreshCw } from 'lucide-react';

const PAGE_SIZE = 3;

export const DoctorWaitingRoom = () => {
    const [patients, setPatients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const navigate = useNavigate();

    const totalPages = Math.max(1, Math.ceil(patients.length / PAGE_SIZE));
    const visiblePatients = patients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    useEffect(() => {
        fetchWaitingPatients();
    }, []);

    const fetchWaitingPatients = async () => {
        try {
            setIsLoading(true);
            setError("");
            const data = await doctorApi.getWaitingPatients();
            setPatients(data);
            setCurrentPage(1);
        } catch (err) {
            setError("Impossible de charger la liste des patients en attente.");
        } finally {
            setIsLoading(false);
        }
    };

    // Un patient peut venir d'une visite (id réel) OU d'un rendez-vous (item.source === 'rdv').
    // Dans le cas d'un RDV, on crée d'abord une vraie visite (la consultation en a besoin),
    // on clôture le RDV, puis on ouvre la consultation sur cette visite.
    const handleConsulter = async (item) => {
        try {
            let visiteId = item.id;
            if (item.source === 'rdv') {
                const visite = await doctorApi.createVisite(item.patient.id, item.motif_visite || "Consultation");
                visiteId = visite.id;
                if (item.rdvId) await doctorApi.terminerRendezVous(item.rdvId);
            }
            navigate(`/doctor/consultation?patient=${item.patient.id}&visite=${visiteId}`);
        } catch (err) {
            setError("Impossible de démarrer la consultation pour ce patient.");
        }
    };

    const handleVoirDossier = (patientId) => {
        navigate(AppRoutesPaths.doctorPatientMedicalFolderPage.replace(':id', patientId));
    };

    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const renderVitalSigns = (donneesCliniques) => {
        if (!donneesCliniques) {
            return (
                <span className="text-xs text-gray-400 italic">
                    Paramètres non pris
                </span>
            );
        }

        return (
            <div className="flex gap-3 text-xs">
                {donneesCliniques.tension_arterielle && (
                    <span className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                        <Heart className="w-3 h-3" />
                        {donneesCliniques.tension_arterielle}
                    </span>
                )}
                {donneesCliniques.temperature && (
                    <span className="flex items-center gap-1 bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                        <Thermometer className="w-3 h-3" />
                        {donneesCliniques.temperature}°C
                    </span>
                )}
                {donneesCliniques.poids && (
                    <span className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                        <Droplets className="w-3 h-3" />
                        {donneesCliniques.poids} kg
                    </span>
                )}
            </div>
        );
    };

    const startIndex = (currentPage - 1) * PAGE_SIZE + 1;
    const endIndex = Math.min(currentPage * PAGE_SIZE, patients.length);

    return (
        <CustomDashboard linkList={doctorNavLink} requiredRole="medecin">
            <DoctorNavBar>
                <div className="p-6 h-[calc(100vh-100px)] flex flex-col bg-gray-50/50">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                                <Stethoscope className="w-7 h-7 mr-2 text-primary-start" />
                                Salle d'attente
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">Patients en attente de consultation</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={fetchWaitingPatients}
                                className="p-2 text-gray-400 hover:text-primary-start hover:bg-white rounded-lg border border-gray-200 transition-all shadow-sm"
                                title="Rafraîchir"
                            >
                                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                            <div className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg font-medium flex items-center shadow-sm">
                                <Activity className="w-4 h-4 mr-2 text-gray-400" />
                                {patients.length} patient{patients.length > 1 ? 's' : ''} en attente
                            </div>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm mb-6">
                            {error}
                        </div>
                    )}

                    {/* Table */}
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
                                            <th className="p-4">Paramètres vitaux</th>
                                            <th className="p-4">Heure d'arrivée</th>
                                            <th className="p-4 pr-6 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {patients.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="p-12 text-center text-gray-500">
                                                    <Stethoscope className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                                                    <p className="font-medium">Aucun patient en attente</p>
                                                    <p className="text-sm text-gray-400 mt-1">La salle d'attente est vide pour le moment.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            visiblePatients.map((item) => (
                                                <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-150 group">
                                                    <td className="p-4 pl-6">
                                                        <div className="font-semibold text-gray-800">
                                                            {item.patient.nom} {item.patient.prenom}
                                                        </div>
                                                        <div className="text-xs text-gray-400 font-mono mt-0.5">
                                                            {item.patient.matricule || item.patient.id?.substring(0, 8)}
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
                                                            {item.motif_visite || "—"}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        {renderVitalSigns(item.donnees_cliniques)}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center font-medium text-gray-600 text-sm">
                                                            <Clock className="w-4 h-4 mr-2 text-gray-400" />
                                                            {formatTime(item.date_heure)}
                                                        </div>
                                                        <div className="text-xs text-gray-400 mt-0.5">
                                                            {formatDate(item.date_heure)}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 pr-6 text-right">
                                                        <div className="flex justify-end items-center space-x-2">
                                                            <button
                                                                onClick={() => handleVoirDossier(item.patient.id)}
                                                                title="Voir dossier médical"
                                                                className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-all"
                                                            >
                                                                <FileText className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleConsulter(item)}
                                                                className="inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-lg text-sm font-medium hover:opacity-90 shadow-sm hover:shadow-md transition-all duration-300"
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
                                                className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${currentPage === page ? 'bg-primary-start text-white shadow-sm' : 'border border-gray-200 text-gray-500 hover:bg-white'}`}
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
            </DoctorNavBar>
        </CustomDashboard>
    );
};

export default DoctorWaitingRoom;
