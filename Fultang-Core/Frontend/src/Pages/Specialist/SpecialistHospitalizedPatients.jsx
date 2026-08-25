import React, { useState, useEffect } from 'react';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { specialistNavLink } from "./lib/specialistNavLink.js";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { doctorApi } from "../../services/doctorApi.js";
import { BedDouble, Activity, Calendar, User, Search, Thermometer, Heart, FileText, Settings, ShieldAlert } from 'lucide-react';

export const SpecialistHospitalizedPatients = () => {
    const [hospitalisations, setHospitalisations] = useState([]);
    const [filteredHosps, setFilteredHosps] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => { fetchHospitalisations(); }, []);

    useEffect(() => {
        if (!search.trim()) {
            setFilteredHosps(hospitalisations);
        } else {
            const lowerSearch = search.toLowerCase();
            const filtered = hospitalisations.filter(h => 
                (h.patient?.nom?.toLowerCase().includes(lowerSearch)) || 
                (h.patient?.prenom?.toLowerCase().includes(lowerSearch)) ||
                (h.motif?.toLowerCase().includes(lowerSearch))
            );
            setFilteredHosps(filtered);
        }
    }, [search, hospitalisations]);

    const fetchHospitalisations = async () => {
        try {
            setIsLoading(true);
            const data = await doctorApi.getHospitalisations({ statut: 'EN_COURS' });
            // Ideally we'd filter by specialist ID, but for now we just show all active hospitalizations
            setHospitalisations(data);
            setFilteredHosps(data);
        } catch (error) {
            console.error("Failed to fetch hospitalized patients", error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (isoString) => {
        if (!isoString) return "—";
        return new Date(isoString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const calculateDuration = (startDate) => {
        if (!startDate) return "—";
        const start = new Date(startDate);
        const now = new Date();
        const diffDays = Math.ceil((now - start) / (1000 * 60 * 60 * 24));
        return `${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    };

    return (
        <CustomDashboard linkList={specialistNavLink} requiredRole="medecin_specialiste">
            <div className="p-6 h-[calc(100vh-60px)] flex flex-col bg-gray-50/50">
                
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                            <BedDouble className="w-7 h-7 mr-2 text-purple-600" />
                            Patients Hospitalisés (Mon Service)
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Gérez vos patients admis et suivez l'évolution clinique</p>
                    </div>
                </div>

                <div className="flex gap-4 mb-6">
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center px-4">
                        <Search className="w-5 h-5 text-gray-400 mr-3" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Rechercher un patient admis..."
                            className="flex-1 py-2.5 bg-transparent border-none outline-none text-gray-700"
                        />
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                    {isLoading ? (
                        <div className="flex-1 flex justify-center items-center"><Loading /></div>
                    ) : (
                        <div className="overflow-y-auto flex-1 scrollbar p-4">
                            {filteredHosps.length === 0 ? (
                                <div className="h-full flex flex-col justify-center items-center text-gray-400">
                                    <BedDouble className="w-16 h-16 mb-4 text-gray-200" />
                                    <p className="text-lg font-medium text-gray-500">Aucun patient hospitalisé</p>
                                    <p className="text-sm">Il n'y a pas de patients admis dans votre service actuellement.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {filteredHosps.map(hosp => (
                                        <div key={hosp.id} className="border border-purple-100 bg-white rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
                                            
                                            {/* Card Header */}
                                            <div className="bg-gradient-to-r from-purple-50 to-white p-4 border-b border-purple-100 flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 font-bold flex justify-center items-center flex-shrink-0">
                                                        {hosp.patient?.nom?.charAt(0)}{hosp.patient?.prenom?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-gray-800 text-lg leading-tight">{hosp.patient?.nom} {hosp.patient?.prenom}</h3>
                                                        <p className="text-xs text-gray-500">{hosp.patient?.age ? `${hosp.patient.age} ans` : ''} • {hosp.patient?.sexe}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 mb-1">
                                                        En cours
                                                    </span>
                                                    <p className="text-xs font-medium text-gray-500">Admis il y a {calculateDuration(hosp.date_entree)}</p>
                                                </div>
                                            </div>
                                            
                                            {/* Card Body */}
                                            <div className="p-4 flex-1 flex flex-col gap-3">
                                                <div className="flex gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                                    <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                                                    <div>
                                                        <span className="font-semibold text-gray-700">Motif: </span>
                                                        {hosp.motif || "Non spécifié"}
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-4 text-sm mt-1">
                                                    <div className="flex items-center text-gray-600 bg-purple-50 px-2 py-1 rounded">
                                                        <Activity className="w-4 h-4 text-purple-500 mr-1.5" />
                                                        <span className="font-medium text-purple-700">Service: {hosp.service || "Général"}</span>
                                                    </div>
                                                    <div className="flex items-center text-gray-500">
                                                        <Calendar className="w-4 h-4 text-gray-400 mr-1.5" />
                                                        Entrée: {formatDate(hosp.date_entree)}
                                                    </div>
                                                </div>
                                                
                                                <div className="mt-3 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                                                    <h4 className="text-xs font-bold text-blue-800 uppercase flex items-center mb-2">
                                                        <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Actes Techniques & Soins
                                                    </h4>
                                                    <p className="text-xs text-blue-600/80 italic">
                                                        Les actes invasifs et soins spécialisés seront disponibles une fois le module SoinAdministre activé.
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            {/* Card Footer */}
                                            <div className="p-3 border-t bg-gray-50 flex justify-end gap-2">
                                                <button className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-100 transition-colors">
                                                    Voir dossier
                                                </button>
                                                <button className="px-3 py-1.5 text-xs font-bold text-white bg-purple-600 rounded hover:bg-purple-700 transition-colors shadow-sm flex items-center">
                                                    <Settings className="w-3.5 h-3.5 mr-1" /> Gérer hospitalisation
                                                </button>
                                            </div>

                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </CustomDashboard>
    );
};

export default SpecialistHospitalizedPatients;
