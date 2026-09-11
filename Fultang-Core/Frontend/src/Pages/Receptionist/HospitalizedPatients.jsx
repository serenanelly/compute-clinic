import { useState, useEffect } from 'react';
import { DashBoard } from '../../GlobalComponents/DashBoard';
import { ReceptionistNavBar } from './ReceptionistNavBar';
import { receptionistNavLink } from './receptionistNavLink';
import { BedDouble, Search, MapPin, LayoutGrid, List as ListIcon } from 'lucide-react';
import axiosInstance from "../../Utils/axiosInstance";
import { Spin } from 'antd';
import PropTypes from 'prop-types';

export const HospitalizedPatients = () => {
    const [hospitalizations, setHospitalizations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState('list');
    const [searchQuery, setSearchQuery] = useState("");

    const fetchHospitalizations = async () => {
        setIsLoading(true);
        try {
            const response = await axiosInstance.get("/hospitalisations/");
            const data = response.data;
            const list = Array.isArray(data) ? data : (data.results || []);
            setHospitalizations(list);
        } catch (err) {
            console.error("Erreur chargement hospitalisations:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHospitalizations();
    }, []);

    const getPatientNom = (h) => {
        if (h.patient_details?.nom) return `${h.patient_details.nom} ${h.patient_details.prenom || ''}`.trim();
        return `Patient #${h.patient}`;
    };

    const getService = (h) => h.service || h.visite_service || "—";
    const formatChambre = (h) => {
        const roomId = h.room_id || h.id_chambre;
        if (!roomId) return "—";
        return h.room_nom || h.chambre || `Chambre ${String(roomId).slice(0, 8)}…`;
    };

    const isHospitalise = (h) => {
        const statut = h.statut || 'EN_COURS';
        return statut === 'EN_COURS' && Boolean(h.room_id || h.id_chambre);
    };

    const hospitalized = hospitalizations.filter(isHospitalise);

    const filteredHospitalizations = hospitalized.filter(h =>
        getPatientNom(h).toLowerCase().includes(searchQuery.toLowerCase()) ||
        getService(h).toLowerCase().includes(searchQuery.toLowerCase()) ||
        formatChambre(h).toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <DashBoard linkList={receptionistNavLink} requiredRole="RECEPTIONIST">
            <ReceptionistNavBar>
            <div className="p-8 pb-20">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center" data-testid="page-title">
                            <BedDouble className="w-7 h-7 mr-2 text-primary-start" />
                            Hospitalisations
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Patients hospitalisés — consultation du service et de la chambre (lecture seule)
                        </p>
                    </div>
                    <div className="bg-white p-1 rounded-2xl shadow-sm border border-gray-100 flex gap-1">
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`p-2.5 rounded-xl transition-all ${viewMode === 'table' ? 'bg-primary-start text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
                            title="Vue Tableau"
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-primary-start text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
                            title="Vue Liste"
                        >
                            <ListIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="relative mb-10 group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-16 pr-6 py-5 bg-white border border-gray-100 rounded-[2rem] shadow-sm outline-none focus:ring-4 focus:ring-primary-start/10 transition-all text-gray-700 font-bold placeholder:text-gray-300"
                        placeholder="Rechercher (patient, service, chambre…)"
                    />
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-white/50 rounded-[3rem] border-2 border-dashed border-gray-100">
                        <Spin size="large" className="primary-spin mb-6" />
                        <p className="font-black text-gray-300 uppercase tracking-widest text-xs">Chargement…</p>
                    </div>
                ) : filteredHospitalizations.length === 0 ? (
                    <EmptyView
                        icon={<BedDouble className="w-12 h-12 text-gray-200" />}
                        title="Aucun patient hospitalisé"
                        subtitle="Aucun séjour en cours avec chambre attribuée."
                    />
                ) : viewMode === 'table' ? (
                    <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden border border-gray-50">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] border-b border-gray-50">
                                <tr>
                                    <th className="px-10 py-6">Patient</th>
                                    <th className="px-10 py-6">Service</th>
                                    <th className="px-10 py-6">Chambre</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredHospitalizations.map(hosp => (
                                    <tr key={hosp.id} className="hover:bg-gray-50/50 transition-all">
                                        <td className="px-10 py-6 font-black text-gray-900">{getPatientNom(hosp)}</td>
                                        <td className="px-10 py-6 text-sm font-bold text-primary-end uppercase">{getService(hosp)}</td>
                                        <td className="px-10 py-6 text-sm font-bold text-gray-600">{formatChambre(hosp)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredHospitalizations.map(hosp => (
                            <div
                                key={hosp.id}
                                className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-6"
                            >
                                <div className="w-14 h-14 bg-gradient-to-br from-primary-start/10 to-primary-end/10 rounded-2xl flex items-center justify-center text-primary-start">
                                    <BedDouble className="w-7 h-7" />
                                </div>
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Patient</p>
                                        <p className="font-black text-gray-900">{getPatientNom(hosp)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Service</p>
                                        <p className="font-bold text-primary-end uppercase">{getService(hosp)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Chambre</p>
                                        <p className="font-bold text-gray-700 flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                            {formatChambre(hosp)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            </ReceptionistNavBar>
        </DashBoard>
    );
};

const EmptyView = ({ icon, title, subtitle }) => (
    <div className="bg-white rounded-[3.5rem] border border-gray-100 shadow-sm min-h-[400px] flex flex-col items-center justify-center p-12 text-center">
        <div className="bg-gray-50 p-8 rounded-[2.5rem] mb-8 border border-gray-50 shadow-inner">
            {icon}
        </div>
        <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">{title}</h3>
        <p className="text-gray-400 font-bold max-w-sm">{subtitle}</p>
    </div>
);

EmptyView.propTypes = {
    icon: PropTypes.node,
    title: PropTypes.string,
    subtitle: PropTypes.string,
};

export default HospitalizedPatients;
