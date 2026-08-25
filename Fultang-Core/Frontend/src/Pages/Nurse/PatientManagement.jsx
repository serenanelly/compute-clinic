import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { nurseNavLink } from "./nurseNavLink.js";
import { NurseNavBar } from "./NurseNavBar.jsx";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { nurseApi } from "../../services/nurseApi.js";
import { AppRoutesPaths } from "../../Router/appRouterPaths.js";
import { Search, Users, Eye, Activity, Filter, Phone, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 3;

export const PatientManagement = () => {
    const navigate = useNavigate();
    const [patients, setPatients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [error, setError] = useState("");

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Filter state
    const [sexeFilter, setSexeFilter] = useState("TOUS");
    const [showFilters, setShowFilters] = useState(false);

    const calculateAge = (dateNaissance) => {
        if (!dateNaissance) return "—";
        const birth = new Date(dateNaissance);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };

    const loadPatients = useCallback(async (search = "", page = 1) => {
        try {
            setIsLoading(true);
            setError("");
            const result = await nurseApi.getPatients(search, page, PAGE_SIZE);
            setPatients(result.patients);
            setTotalCount(result.count);
            setTotalPages(result.totalPages);
            setCurrentPage(page);
        } catch (err) {
            setError("Erreur lors du chargement des patients.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPatients("", 1);
    }, [loadPatients]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            loadPatients(searchQuery, 1);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchQuery, loadPatients]);

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handlePrevPage = () => {
        if (currentPage > 1) loadPatients(searchQuery, currentPage - 1);
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) loadPatients(searchQuery, currentPage + 1);
    };

    // Client-side sex filter applied on top of paginated results
    const visiblePatients = sexeFilter === "TOUS"
        ? patients
        : patients.filter(p => p.sexe === sexeFilter);

    const firstItem = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const lastItem = Math.min(currentPage * PAGE_SIZE, totalCount);

    return (
        <CustomDashboard linkList={nurseNavLink} requiredRole="nurse">
            <NurseNavBar>
                <div className="p-6 h-[calc(100vh-100px)] flex flex-col bg-gray-50/50 overflow-y-auto scrollbar">
                    
                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                                <Users className="w-7 h-7 mr-2 text-primary-start" />
                                Gestion des Patients
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                {totalCount} patient(s) enregistré(s) dans le système
                            </p>
                        </div>
                    </div>

                    {/* Filters and Search Bar */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col gap-3">
                        <div className="flex flex-col md:flex-row gap-4 items-center">
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                                <input 
                                    type="text"
                                    placeholder="Rechercher par nom, prénom ou matricule..."
                                    value={searchQuery}
                                    onChange={handleSearchChange}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-start focus:border-primary-start transition-all outline-none"
                                />
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <button 
                                    onClick={() => setShowFilters(v => !v)}
                                    className={`flex items-center px-4 py-2 border rounded-lg text-sm transition-colors ${showFilters ? 'bg-primary-start text-white border-primary-start' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <Filter className="w-4 h-4 mr-2" />
                                    Filtres
                                </button>
                            </div>
                        </div>

                        {/* Filter Panel */}
                        {showFilters && (
                            <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Sexe :</span>
                                    {["TOUS", "M", "F"].map(val => (
                                        <button
                                            key={val}
                                            onClick={() => setSexeFilter(val)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${sexeFilter === val ? 'bg-primary-start text-white border-primary-start' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            {val === "TOUS" ? "Tous" : val === "M" ? "Masculin" : "Féminin"}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Patients Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loading />
                            </div>
                        ) : error ? (
                            <div className="p-8 text-center text-red-500 font-medium">{error}</div>
                        ) : visiblePatients.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Users className="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-700">Aucun patient trouvé</h3>
                                <p className="text-gray-500">Essayez de modifier votre recherche ou les filtres.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Patient</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Sexe / Âge</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Dernière visite</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {visiblePatients.map((patient) => (
                                            <tr key={patient.id} className="hover:bg-blue-50/30 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center">
                                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold mr-3 shadow-sm">
                                                            {patient.nom?.charAt(0)}{patient.prenom?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-gray-800">{patient.nom} {patient.prenom}</div>
                                                            <div className="text-xs text-gray-500 font-mono">{patient.matricule || "—"}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${patient.sexe === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                                                            {patient.sexe}
                                                        </span>
                                                        <span className="text-sm font-medium text-gray-600 mt-1">{calculateAge(patient.date_naissance)} ans</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center text-sm text-gray-600">
                                                        <Phone className="w-3.5 h-3.5 mr-2 text-gray-400" />
                                                        {patient.telephone}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-gray-700 font-medium">{patient.derniere_visite}</div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end space-x-2">
                                                        <button 
                                                            onClick={() => navigate(AppRoutesPaths.patientDetailsPage.replace(':id', patient.id))}
                                                            title="Prendre paramètres"
                                                            className="p-2 text-primary-start hover:bg-primary-start hover:text-white rounded-lg transition-all"
                                                        >
                                                            <Activity className="w-5 h-5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => navigate(AppRoutesPaths.consultationHistoryPage.replace(':id', patient.id))}
                                                            title="Voir dossier"
                                                            className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-all"
                                                        >
                                                            <Eye className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="mt-4 flex items-center justify-between px-2">
                        <p className="text-sm text-gray-500">
                            {totalCount === 0
                                ? "Aucun résultat"
                                : `Affichage de ${firstItem} à ${lastItem} sur ${totalCount} patients`}
                        </p>
                        <div className="flex items-center space-x-1">
                            <button
                                onClick={handlePrevPage}
                                disabled={currentPage <= 1}
                                className="p-2 border border-gray-300 rounded-md text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                .reduce((acc, p, idx, arr) => {
                                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                                    acc.push(p);
                                    return acc;
                                }, [])
                                .map((item, idx) =>
                                    item === '...' ? (
                                        <span key={`ellipsis-${idx}`} className="px-2 py-1 text-gray-400 text-sm">…</span>
                                    ) : (
                                        <button
                                            key={item}
                                            onClick={() => loadPatients(searchQuery, item)}
                                            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${item === currentPage ? 'bg-primary-start text-white' : 'border border-gray-300 hover:bg-gray-50'}`}
                                        >
                                            {item}
                                        </button>
                                    )
                                )}
                            <button
                                onClick={handleNextPage}
                                disabled={currentPage >= totalPages}
                                className="p-2 border border-gray-300 rounded-md text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </NurseNavBar>
        </CustomDashboard>
    );
};

export default PatientManagement;
