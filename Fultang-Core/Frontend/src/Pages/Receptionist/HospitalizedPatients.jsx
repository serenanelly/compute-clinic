import { useState, useEffect } from 'react';
import { DashBoard } from '../../GlobalComponents/DashBoard';
import { ReceptionistNavBar } from './ReceptionistNavBar';
import { receptionistNavLink } from './receptionistNavLink';
import { 
    BedDouble, 
    Search, 
    Stethoscope, 
    ArrowRight, 
    MapPin, 
    CheckCircle2,
    Clock,
    AlertCircle,
    LayoutGrid,
    List as ListIcon
} from 'lucide-react';
import axiosInstance from "../../Utils/axiosInstance";
import { FinalizeHospitalizationModal } from "./FinalizeHospitalizationModal";
import { Spin, Tooltip } from 'antd';
import dayjs from "dayjs";
import PropTypes from 'prop-types';

export const HospitalizedPatients = () => {
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' ou 'admitted'
    const [hospitalizations, setHospitalizations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedHosp, setSelectedHosp] = useState(null);
    const [viewMode, setViewMode] = useState('list'); // 'table' ou 'list'
    const [searchQuery, setSearchQuery] = useState("");

    const fetchHospitalizations = async () => {
        setIsLoading(true);
        try {
            // Charger les hospitalisations en cours et en attente
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

    // Helpers pour adapter au modèle réel Hospitalisation
    // Champs réels: patient(FK UUID), room_id(UUID), doctor_id(UUID), motif, statut(EN_COURS/SORTIE)
    const getPatientNom = (h) => {
        if (h.patient_details?.nom) return `${h.patient_details.nom} ${h.patient_details.prenom || ''}`;
        return `Patient #${h.patient}`;
    };
    const getMedecinNom = (h) => {
        if (h.medecin_details?.nom) return `Dr. ${h.medecin_details.nom} ${h.medecin_details.prenom || ''}`;
        return `Médecin #${h.doctor_id}`;
    };
    const getService = (h) => h.service || h.visite_service || "Service N/A";
    const getChambre = (h) => h.id_chambre || h.room_id || "N/A";
    const getStatut = (h) => h.statut || "EN_COURS";
    // Pour la compatibilité: "EN_ATTENTE" du mock = "EN_COURS" du backend
    const isEnAttente = (h) => getStatut(h) === 'EN_ATTENTE' || getStatut(h) === 'EN_COURS';
    const isAdmis = (h) => getStatut(h) === 'ADMIS' || getStatut(h) === 'SORTIE';

    const filteredHospitalizations = hospitalizations.filter(h =>
        getPatientNom(h).toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(h.patient || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const pendingAdmissions = filteredHospitalizations.filter(isEnAttente);
    const activeHospitalizations = filteredHospitalizations.filter(isAdmis);

    const handleFinalize = (hosp) => {
        setSelectedHosp(hosp);
        setIsModalOpen(true);
    };

    return (
        <DashBoard linkList={receptionistNavLink} requiredRole="RECEPTIONIST">
            <ReceptionistNavBar>
            <div className="p-8 pb-20">
                {/* En-tête */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                            <BedDouble className="w-7 h-7 mr-2 text-primary-start" />
                            Hospitalisations
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Gestion des admissions et suivi des lits occupés</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-white p-1 rounded-2xl shadow-sm border border-gray-100 flex gap-1">
                            <button 
                                onClick={() => setViewMode('table')} 
                                className={`p-2.5 rounded-xl transition-all ${viewMode === 'table' ? 'bg-primary-start text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
                                title="Vue Tableau"
                            >
                                <LayoutGrid className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => setViewMode('list')} 
                                className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-primary-start text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
                                title="Vue Liste"
                            >
                                <ListIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sélecteur d'onglets (Style Premium) */}
                <div className="flex gap-4 mb-10 overflow-x-auto pb-2 scrollbar-hide">
                    <button 
                        onClick={() => setActiveTab('pending')}
                        className={`flex items-center gap-4 px-8 py-5 rounded-[2rem] transition-all whitespace-nowrap ${
                            activeTab === 'pending' 
                            ? 'bg-primary-end text-white shadow-2xl shadow-primary-end/20 scale-100' 
                            : 'bg-white text-gray-400 border border-gray-100 hover:bg-gray-50'
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${activeTab === 'pending' ? 'bg-white/20' : 'bg-gray-50'}`}>
                            <Clock className={`w-5 h-5 ${activeTab === 'pending' ? 'text-white animate-pulse' : 'text-gray-300'}`} />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-50 leading-none mb-1">En attente</p>
                            <p className="text-lg font-black">{pendingAdmissions.length} Demandes</p>
                        </div>
                    </button>

                    <button 
                        onClick={() => setActiveTab('admitted')}
                        className={`flex items-center gap-4 px-8 py-5 rounded-[2rem] transition-all whitespace-nowrap ${
                            activeTab === 'admitted' 
                            ? 'bg-primary-end text-white shadow-2xl shadow-primary-end/20 scale-100' 
                            : 'bg-white text-gray-400 border border-gray-100 hover:bg-gray-50'
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${activeTab === 'admitted' ? 'bg-white/20' : 'bg-gray-50'}`}>
                            <CheckCircle2 className={`w-5 h-5 ${activeTab === 'admitted' ? 'text-white' : 'text-gray-300'}`} />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-50 leading-none mb-1">Admis</p>
                            <p className="text-lg font-black">{activeHospitalizations.length} Hospitalisés</p>
                        </div>
                    </button>
                </div>

                {/* Barre de Recherche */}
                <div className="relative mb-10 group">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-start/5 to-primary-end/5 rounded-[2rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
                    <input 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        className="w-full pl-16 pr-6 py-5 bg-white border border-gray-100 rounded-[2rem] shadow-sm outline-none focus:ring-4 focus:ring-primary-start/10 transition-all text-gray-700 font-bold placeholder:text-gray-300" 
                        placeholder="Rechercher une hospitalisation (patient, matricule...)" 
                    />
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-white/50 rounded-[3rem] border-2 border-dashed border-gray-100">
                        <Spin size="large" className="primary-spin mb-6" />
                        <p className="font-black text-gray-300 uppercase tracking-widest text-xs">Synchronisation des dossiers...</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {activeTab === 'pending' ? (
                            pendingAdmissions.length > 0 ? (
                                viewMode === 'list' ? (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                        {pendingAdmissions.map(hosp => (
                                            <div 
                                                key={hosp.id} 
                                                className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:translate-x-2 transition-all cursor-pointer relative group flex flex-col md:flex-row items-center gap-8"
                                            >
                                                <div className="flex-1 flex items-center gap-6">
                                                    <div className="w-16 h-16 bg-gradient-to-br from-primary-start to-primary-end rounded-[1.5rem] flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-primary-start/20 group-hover:rotate-6 transition-transform">
                                                        {hosp.patient_details?.nom[0]}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <h3 className="font-black text-gray-900 text-xl tracking-tight">{getPatientNom(hosp)}</h3>
                                                            <span className="text-[10px] font-black uppercase text-primary-end bg-primary-end/10 px-3 py-1 rounded-full border border-primary-end/20">En attente</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-6 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                                            <span className="flex items-center gap-2 text-primary-end font-black"><span className="opacity-30">Patient:</span> {getPatientNom(hosp)}</span>
                                                            <span className="flex items-center gap-2"><Stethoscope className="w-3.5 h-3.5" /> {getMedecinNom(hosp)}</span>
                                                            <span className="flex items-center gap-2 text-primary-end"><MapPin className="w-3.5 h-3.5" /> {getService(hosp)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-4">
                                                    <button 
                                                        onClick={() => handleFinalize(hosp)}
                                                        className="bg-gradient-to-r from-primary-start to-primary-end text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 shadow-xl shadow-primary-start/20 transition-all flex items-center gap-2"
                                                    >
                                                        Finaliser <ArrowRight className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    /* TABLE VIEW FOR PENDING */
                                    <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden border border-gray-50 animate-in fade-in duration-700">
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] border-b border-gray-50">
                                                <tr>
                                                    <th className="px-10 py-6">Patient</th>
                                                    <th className="px-10 py-6">Service Demandé</th>
                                                    <th className="px-10 py-6">Médecin & Date</th>
                                                    <th className="px-10 py-6 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {pendingAdmissions.map(hosp => (
                                                    <tr key={hosp.id} className="hover:bg-gray-50/50 transition-all group">
                                                        <td className="px-10 py-6">
                                                            <div className="flex flex-col">
                                                                <p className="font-black text-gray-900 text-base leading-none mb-1">{getPatientNom(hosp)}</p>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter"></span>
                                                                    <span className="text-[8px] font-black uppercase text-primary-end bg-primary-end/10 px-2 py-0.5 rounded-full border border-primary-end/10">En attente</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-10 py-6">
                                                                    <span className="text-[8px] font-black uppercase text-primary-end bg-primary-end/10 px-2 py-0.5 rounded-full border border-primary-end/10">{getService(hosp)}</span>
                                                        </td>
                                                        <td className="px-10 py-6">
                                                            <div className="text-sm font-bold text-gray-700">{getMedecinNom(hosp)}</div>
                                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{dayjs(hosp.created_at || hosp.date_decision).format('DD/MM/YYYY')}</div>
                                                        </td>
                                                        <td className="px-10 py-6 text-right">
                                                            <button 
                                                                onClick={() => handleFinalize(hosp)}
                                                                className="bg-gradient-to-r from-primary-start to-primary-end text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 shadow-lg shadow-primary-start/20 transition-all"
                                                            >
                                                                Finaliser
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            ) : (
                                <EmptyView icon={<AlertCircle className="w-12 h-12 text-gray-200" />} title="Aucune admission trouvée" subtitle="Vérifiez vos critères de recherche ou attendez une nouvelle demande." />
                            )
                        ) : (
                            activeHospitalizations.length > 0 ? (
                                viewMode === 'table' ? (
                                    <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden border border-gray-50 animate-in fade-in duration-700">
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] border-b border-gray-50">
                                                <tr>
                                                    <th className="px-10 py-6 text-left">Patient</th>
                                                    <th className="px-10 py-6 text-left">Service & Chambre</th>
                                                    <th className="px-10 py-6 text-left">Admission</th>
                                                    <th className="px-10 py-6 text-left">Médecin</th>
                                                    <th className="px-10 py-6 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {activeHospitalizations.map(hosp => (
                                                    <tr key={hosp.id} className="hover:bg-gray-50/50 transition-all group">
                                                        <td className="px-10 py-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 bg-primary-end/10 rounded-xl flex items-center justify-center text-primary-end font-black text-[10px]">
                                                                    {getPatientNom(hosp).substring(0, 2).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <div className="font-black text-gray-900 leading-none mb-1">{getPatientNom(hosp)}</div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter"></div>
                                                                        <span className="text-[8px] font-black uppercase text-primary-end bg-primary-end/10 px-2 py-0.5 rounded-full border border-primary-end/10">Admis</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-10 py-6">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-black text-primary-end uppercase">{getService(hosp)}</span>
                                                                <span className="text-xs font-bold text-gray-500">Chambre {getChambre(hosp)}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-10 py-6">
                                                            <div className="text-sm font-bold text-gray-600">{dayjs(hosp.date_admission).format('DD/MM/YYYY')}</div>
                                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter italic">{dayjs(hosp.date_admission).format('HH:mm')}</div>
                                                        </td>
                                                        <td className="px-10 py-6">
                                                            <div className="text-sm font-black text-gray-900">{getMedecinNom(hosp)}</div>
                                                        </td>
                                                        <td className="px-10 py-6 text-right">
                                                            <Tooltip title="Voir dossier">
                                                                <button className="p-3 bg-gray-50 text-gray-400 hover:bg-primary-end hover:text-white rounded-xl transition-all border border-transparent hover:border-gray-100">
                                                                    <ArrowRight className="w-4 h-4" />
                                                                </button>
                                                            </Tooltip>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    /* LIST VIEW FOR ADMITTED */
                                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                        {activeHospitalizations.map(hosp => (
                                            <div 
                                                key={hosp.id} 
                                                className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:translate-x-2 transition-all cursor-pointer relative group flex flex-col md:flex-row items-center gap-8"
                                            >
                                                <div className="flex-1 flex items-center gap-6">
                                                    <div className="w-16 h-16 bg-gradient-to-br from-primary-end/5 to-primary-end/20 rounded-[1.5rem] flex items-center justify-center text-primary-end font-black text-2xl shadow-lg shadow-primary-end/10 group-hover:rotate-6 transition-transform">
                                                        <BedDouble className="w-8 h-8" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <h3 className="font-black text-gray-900 text-xl tracking-tight">{getPatientNom(hosp)}</h3>
                                                            <span className="text-[10px] font-black uppercase text-primary-end bg-primary-end/10 px-3 py-1 rounded-full border border-primary-end/20">Admis</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-6 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                                            <span className="flex items-center gap-2 text-primary-end font-black"><span className="opacity-30">Chambre:</span> {getChambre(hosp)}</span>
                                                            <span className="flex items-center gap-2"><Stethoscope className="w-3.5 h-3.5" /> {getMedecinNom(hosp)}</span>
                                                            <span className="flex items-center gap-2 text-primary-end"><Clock className="w-3.5 h-3.5" /> {dayjs(hosp.created_at || hosp.date_admission).format('DD MMM YYYY')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-4">
                                                    <button className="bg-gray-50 text-gray-400 p-4 rounded-2xl hover:bg-primary-end hover:text-white transition-all shadow-inner">
                                                        <ArrowRight className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            ) : (
                                <EmptyView icon={<BedDouble className="w-12 h-12 text-gray-200" />} title="Aucun patient trouvé" subtitle="Le service hospitalier ne contient aucun patient correspondant." />
                            )
                        )}
                    </div>
                )}

                <FinalizeHospitalizationModal 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    hospitalization={selectedHosp}
                    onFinalized={fetchHospitalizations}
                />
            </div>
            </ReceptionistNavBar>
        </DashBoard>
    );
};

const EmptyView = ({ icon, title, subtitle }) => (
    <div className="bg-white rounded-[3.5rem] border border-gray-100 shadow-sm min-h-[500px] flex flex-col items-center justify-center p-12 text-center animate-in zoom-in-95 duration-700">
        <div className="bg-gray-50 p-8 rounded-[2.5rem] mb-8 border border-gray-50 shadow-inner">
            {icon}
        </div>
        <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">{title}</h3>
        <p className="text-gray-400 font-bold max-w-sm">
            {subtitle}
        </p>
    </div>
);

EmptyView.propTypes = {
    icon: PropTypes.node,
    title: PropTypes.string,
    subtitle: PropTypes.string
};

export default HospitalizedPatients;
