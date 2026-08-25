import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { doctorNavLink } from "./lib/doctorNavLink.js";
import { DoctorNavBar } from "./DoctorComponents/DoctorNavBar.jsx";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { doctorApi } from "../../services/doctorApi.js";
import { AppRoutesPaths } from "../../Router/appRouterPaths.js";
import { Users, Search, FolderOpen, History, Phone, Calendar as CalendarIcon, UserRound, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 3;

export const DoctorPatientList = () => {
    const [patients, setPatients] = useState([]);
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const navigate = useNavigate();

    const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
    const visiblePatients = filteredPatients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    useEffect(() => {
        fetchPatients();
    }, []);

    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredPatients(patients);
        } else {
            const lowerSearch = searchTerm.toLowerCase();
            const filtered = patients.filter(p => 
                p.nom.toLowerCase().includes(lowerSearch) || 
                p.prenom.toLowerCase().includes(lowerSearch) ||
                (p.matricule && p.matricule.toLowerCase().includes(lowerSearch))
            );
            setFilteredPatients(filtered);
        }
        setCurrentPage(1);
    }, [searchTerm, patients]);

    const fetchPatients = async () => {
        try {
            setIsLoading(true);
            const data = await doctorApi.getPatients();
            setPatients(data);
            setFilteredPatients(data);
        } catch (error) {
            console.error("Failed to fetch patients", error);
        } finally {
            setIsLoading(false);
        }
    };

    const startIndex = (currentPage - 1) * PAGE_SIZE + 1;
    const endIndex = Math.min(currentPage * PAGE_SIZE, filteredPatients.length);

    return (
        <CustomDashboard linkList={doctorNavLink} requiredRole="medecin">
            <DoctorNavBar>
                <div className="p-6 h-[calc(100vh-100px)] flex flex-col bg-gray-50/50">
                    
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                                <Users className="w-7 h-7 mr-2 text-primary-start" />
                                Base de Données Patients
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">Recherche et consultation des dossiers médicaux</p>
                        </div>
                        <div className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg font-medium shadow-sm">
                            Total: {filteredPatients.length} patient{filteredPatients.length > 1 ? 's' : ''}
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input 
                                type="text" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Rechercher par nom, prénom ou matricule..." 
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-primary-start outline-none"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                        {isLoading ? (
                            <div className="flex-1 flex justify-center items-center"><Loading /></div>
                        ) : (
                            <>
                                <div className="overflow-y-auto flex-1 scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-white shadow-sm z-10">
                                            <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                                                <th className="p-4 pl-6">Identité</th>
                                                <th className="p-4">Contact</th>
                                                <th className="p-4">Dernière visite</th>
                                                <th className="p-4 pr-6 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredPatients.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="p-12 text-center text-gray-500">
                                                        <UserRound className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                                        <p className="font-medium">Aucun patient trouvé</p>
                                                        <p className="text-sm mt-1 text-gray-400">Essayez avec d'autres termes de recherche.</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                visiblePatients.map((patient) => (
                                                    <tr key={patient.id} className="hover:bg-gray-50 transition-colors group">
                                                        <td className="p-4 pl-6">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-primary-start/10 rounded-full flex justify-center items-center text-primary-start font-bold">
                                                                    {patient.nom.charAt(0)}{patient.prenom.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-gray-800">{patient.nom} {patient.prenom}</div>
                                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                                        ID: {patient.matricule || patient.id.substring(0, 8)} • {patient.sexe}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center text-sm text-gray-600">
                                                                <Phone className="w-4 h-4 mr-2 text-gray-400" />
                                                                {patient.telephone}
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center text-sm text-gray-600">
                                                                <CalendarIcon className="w-4 h-4 mr-2 text-gray-400" />
                                                                {patient.derniere_visite}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 pr-6 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <button 
                                                                    onClick={() => navigate(AppRoutesPaths.doctorConsultationHistoryDetails?.replace(':id', patient.id) || `/doctor/consultation-history/details/${patient.id}`)}
                                                                    title="Historique de consultations"
                                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                >
                                                                    <History className="w-5 h-5" />
                                                                </button>
                                                                <button 
                                                                    onClick={() => navigate(AppRoutesPaths.doctorPatientMedicalFolderPage.replace(':id', patient.id))}
                                                                    className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-primary-start hover:text-white shadow-sm transition-all"
                                                                >
                                                                    <FolderOpen className="w-4 h-4 mr-2" />
                                                                    Dossier Médical
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
                                {filteredPatients.length > 0 && (
                                    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50/50">
                                        <span className="text-sm text-gray-500">
                                            Affichage de {startIndex} à {endIndex} sur {filteredPatients.length} patients
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
                            </>
                        )}
                    </div>
                </div>
            </DoctorNavBar>
        </CustomDashboard>
    );
};

export default DoctorPatientList;
