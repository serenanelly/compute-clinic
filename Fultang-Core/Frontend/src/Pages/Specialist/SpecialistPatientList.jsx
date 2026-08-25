import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { specialistNavLink } from "./lib/specialistNavLink.js";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { doctorApi } from "../../services/doctorApi.js";
import { AppRoutesPaths } from "../../Router/appRouterPaths.js";
import { UserRound, Search, FolderOpen, Stethoscope, ChevronRight, ChevronLeft } from 'lucide-react';

const PAGE_SIZE = 3;

export const SpecialistPatientList = () => {
    const [patients, setPatients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const navigate = useNavigate();

    const totalPages = Math.max(1, Math.ceil(patients.length / PAGE_SIZE));
    const visiblePatients = patients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const startIndex = patients.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const endIndex = Math.min(currentPage * PAGE_SIZE, patients.length);

    useEffect(() => { fetchPatients(); }, []);

    const fetchPatients = async (q = "") => {
        try {
            setIsLoading(true);
            const data = await doctorApi.getPatients(q);
            setPatients(data);
            setCurrentPage(1);
        } catch {
            console.error("Erreur chargement patients");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchPatients(search);
    };

    return (
        <CustomDashboard linkList={specialistNavLink} requiredRole="medecin_specialiste">
            <div className="p-6 h-[calc(100vh-60px)] flex flex-col bg-gray-50/50">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                            <UserRound className="w-7 h-7 mr-2 text-purple-600" />
                            Mes Patients
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Recherchez et consultez le dossier médical de vos patients</p>
                    </div>
                    <div className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg font-medium shadow-sm">
                        Total : {patients.length} patient{patients.length > 1 ? 's' : ''}
                    </div>
                </div>

                <form onSubmit={handleSearch} className="flex gap-3 mb-6">
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center px-4">
                        <Search className="w-5 h-5 text-gray-400 mr-3" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Rechercher par nom, prénom ou matricule..."
                            className="flex-1 py-3 bg-transparent border-none outline-none text-gray-700"
                        />
                    </div>
                    <button type="submit" className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl shadow-sm hover:opacity-90 transition-all">
                        Rechercher
                    </button>
                </form>

                {isLoading ? (
                    <div className="flex-1 flex justify-center items-center"><Loading /></div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                                        <th className="p-4 pl-6">Patient</th>
                                        <th className="p-4">Matricule</th>
                                        <th className="p-4">Date de naissance</th>
                                        <th className="p-4">Sexe</th>
                                        <th className="p-4">Téléphone</th>
                                        <th className="p-4 pr-6 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {patients.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="p-12 text-center text-gray-400">
                                                <UserRound className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                                                <p className="font-medium">Aucun patient trouvé</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        visiblePatients.map((p) => (
                                            <tr key={p.id} className="hover:bg-purple-50/30 transition-colors group">
                                                <td className="p-4 pl-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm flex-shrink-0">
                                                            {p.nom?.charAt(0)}{p.prenom?.charAt(0)}
                                                        </div>
                                                        <span className="font-semibold text-gray-800">{p.nom} {p.prenom}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-sm font-mono text-gray-500">{p.matricule || p.id?.substring(0, 8)}</td>
                                                <td className="p-4 text-sm text-gray-600">
                                                    {p.date_naissance ? new Date(p.date_naissance).toLocaleDateString('fr-FR') : '—'}
                                                </td>
                                                <td className="p-4 text-sm text-gray-600">{p.sexe || '—'}</td>
                                                <td className="p-4 text-sm text-gray-600">{p.telephone || '—'}</td>
                                                <td className="p-4 pr-6 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => navigate(AppRoutesPaths.specialistPatientDossier.replace(':id', p.id))}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 font-medium"
                                                        >
                                                            <FolderOpen className="w-4 h-4" /> Dossier
                                                        </button>
                                                        <button
                                                            onClick={() => navigate(`/specialist/consultation?patient=${p.id}`)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:opacity-90 font-medium"
                                                        >
                                                            <Stethoscope className="w-4 h-4" /> Consulter <ChevronRight className="w-3 h-3" />
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

export default SpecialistPatientList;
