import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Search, MoreHorizontal, Phone, MapPin, ClipboardList, Calendar, Bed, User, LayoutGrid, List as ListIcon, ChevronLeft, ChevronRight, Mail, Users } from 'lucide-react';
import { AddNewPatientModal } from './addNewPatientModal';
import { CreateVisitModal } from './CreateVisitModal';
import { ViewPatientDetailsModal } from './ViewPatientDetailsModal';
import { EditPatientInfosModal } from './EditPatientInfosModal';
import { ScheduleAppointmentModal } from './ScheduleAppointmentModal';
import { DashBoard } from '../../GlobalComponents/DashBoard';
import { ReceptionistNavBar } from './ReceptionistNavBar';
import { receptionistNavLink } from './receptionistNavLink';
import { Alert, Tag, Dropdown } from 'antd';
import axiosInstance from "../../Utils/axiosInstance.js";
import {
    formatSexeLabel,
    getSexeTagColor,
    getPatientContact,
    getPatientVille,
} from "../../Utils/patientDisplay.js";

export const Receptionist = () => {
    const [isRegModalOpen, setIsRegModalOpen] = useState(false);
    const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isApptModalOpen, setIsApptModalOpen] = useState(false);
    
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [canOpenSuccessModal, setCanOpenSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    
    const [searchQuery, setSearchQuery] = useState("");
    const [patients, setPatients] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState(null);

    const [viewMode, setViewMode] = useState('list'); // 'table' ou 'list'
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    const [totalPatients, setTotalPatients] = useState(0);

    const fetchPatients = useCallback(async () => {
        setIsSearching(true);
        setError(null);
        try {
            const params = { page: currentPage, page_size: pageSize };
            if (searchQuery) params.search = searchQuery;

            const response = await axiosInstance.get("/patients/", { params });
            const data = response.data;

            // DRF retourne { count, results } en mode paginé
            if (data && Array.isArray(data.results)) {
                setPatients(data.results);
                setTotalPatients(data.count || 0);
            } else if (Array.isArray(data)) {
                // Fallback si pas de pagination
                setPatients(data);
                setTotalPatients(data.length);
            } else {
                setPatients([]);
                setTotalPatients(0);
            }
        } catch (err) {
            console.error("Erreur chargement patients:", err);
            setError("Impossible de charger la liste des patients. Vérifiez que le serveur est démarré.");
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery, currentPage]);

    useEffect(() => {
        const timeoutId = setTimeout(fetchPatients, searchQuery ? 300 : 0);
        return () => clearTimeout(timeoutId);
    }, [fetchPatients]);

    const getContact = (p) => getPatientContact(p) || "N/A";
    const getVille = (p) => getPatientVille(p) || "N/A";

    const openViewModal = (p) => { setSelectedPatient(p); setIsViewModalOpen(true); };
    const openEditModal = (p) => { setSelectedPatient(p); setIsEditModalOpen(true); };
    const openVisitModal = (p) => { setSelectedPatient(p); setIsVisitModalOpen(true); };
    const openApptModal = (p) => { setSelectedPatient(p); setIsApptModalOpen(true); };

    const getPatientActions = (p) => [
        { key: 'edit', label: 'Modifier le dossier', icon: <User className="w-4 h-4" />, onClick: () => openEditModal(p) },
        { key: 'visit', label: 'Créer une visite', icon: <ClipboardList className="w-4 h-4" />, onClick: () => openVisitModal(p) },
        { key: 'appointment', label: 'Prendre Rendez-vous', icon: <Calendar className="w-4 h-4" />, onClick: () => openApptModal(p) },
    ];

    return (
        <DashBoard linkList={receptionistNavLink} requiredRole="RECEPTIONIST">
            <ReceptionistNavBar>
            <div className="p-8 pb-20">
                {/* En-tête */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                            <Users className="w-7 h-7 mr-2 text-primary-start" />
                            Patients
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Gestion de la base de données clinique</p>
                    </div>
                    <div className="flex items-center gap-3">
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
                        <button 
                            onClick={() => setIsRegModalOpen(true)} 
                            className="inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-lg text-sm font-medium hover:opacity-90 shadow-sm hover:shadow-md transition-all duration-300"
                        >
                            <UserPlus className="w-4 h-4 mr-1.5" />
                            Nouveau Patient
                        </button>
                    </div>
                </div>

                {/* Barre de Recherche */}
                <div className="relative mb-10 group">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-start/5 to-primary-end/5 rounded-[2rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
                    <input 
                        value={searchQuery} 
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} 
                        className="w-full pl-16 pr-6 py-5 bg-white border border-gray-100 rounded-[2rem] shadow-sm outline-none focus:ring-4 focus:ring-primary-start/10 transition-all text-gray-700 font-bold placeholder:text-gray-300" 
                        placeholder="Rechercher par nom, matricule, téléphone..." 
                    />
                </div>

                {isSearching && <div className="py-20 text-center"><div className="w-12 h-12 border-4 border-primary-start border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="font-black text-gray-300 uppercase tracking-widest text-xs">Recherche en cours...</p></div>}
                
                {!isSearching && error && <Alert message={error} type="error" showIcon className="mb-8 rounded-2xl p-4 shadow-sm" />}
                
                {!isSearching && !error && patients.length === 0 && (
                    <div className="py-24 text-center bg-white rounded-[3rem] border border-dashed border-gray-200">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6"><Search className="w-10 h-10 text-gray-200" /></div>
                        <h3 className="font-black text-gray-300 uppercase tracking-widest">Aucun patient trouvé</h3>
                    </div>
                )}

                {!isSearching && !error && patients.length > 0 && (
                    <div className="space-y-4">
                        {viewMode === 'table' ? (
                            /* VUE TABLEAU */
                            <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden border border-gray-50">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] border-b border-gray-50">
                                        <tr>
                                            <th className="px-10 py-6">Informations Patient</th>
                                            <th className="px-10 py-6">ID / Matricule</th>
                                            <th className="px-10 py-6">Contact & Ville</th>
                                            <th className="px-10 py-6 text-right">Options</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {patients.map(p => (
                                            <tr key={p.id} onClick={() => openViewModal(p)} className="hover:bg-gray-50/50 transition-all cursor-pointer group">
                                                <td className="px-10 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-start/5 to-primary-end/5 flex items-center justify-center text-primary-start font-black text-xl border border-primary-start/10 group-hover:scale-110 transition-transform">{p.nom[0]}</div>
                                                        <div>
                                                            <p className="font-black text-gray-900 text-base">{p.nom} {p.prenom}</p>
                                                            <div className="flex gap-2 mt-1">
                                                                <Tag color={getSexeTagColor(p.sexe)} className="rounded-lg font-black text-[9px] border-none px-2 uppercase tracking-tighter">{formatSexeLabel(p.sexe)}</Tag>
                                                                <span className="text-[10px] text-gray-400 font-bold uppercase">{p.date_naissance}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-6">
                                                    <span className="text-xs font-black bg-gray-100 text-gray-400 px-3 py-1.5 rounded-xl tracking-widest">{p.matricule || `#${p.id}`}</span>
                                                </td>
                                                <td className="px-10 py-6 text-sm font-bold text-gray-500">
                                                    <div className="flex items-center gap-2 mb-1"><Phone className="w-3.5 h-3.5 text-primary-end" /> {getContact(p)}</div>
                                                    <div className="flex items-center gap-2 opacity-60"><MapPin className="w-3.5 h-3.5 text-primary-start" /> {getVille(p)}</div>
                                                </td>
                                                <td className="px-10 py-6 text-right" onClick={e => e.stopPropagation()}>
                                                    <Dropdown menu={{ items: getPatientActions(p) }} trigger={['click']} placement="bottomRight">
                                                        <button className="p-3 hover:bg-white hover:shadow-md rounded-2xl transition-all border border-transparent hover:border-gray-100">
                                                            <MoreHorizontal className="w-6 h-6 text-gray-300" />
                                                        </button>
                                                    </Dropdown>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            /* VUE LISTE */
                            <div className="space-y-4">
                                {patients.map(p => (
                                    <div 
                                        key={p.id} 
                                        onClick={() => openViewModal(p)} 
                                        className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:translate-x-2 transition-all cursor-pointer relative group flex flex-col md:flex-row items-center gap-8"
                                    >
                                        <div className="flex-1 flex items-center gap-6">
                                            <div className="w-16 h-16 bg-gradient-to-br from-primary-start to-primary-end rounded-[1.5rem] flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-primary-start/20 group-hover:rotate-6 transition-transform">
                                                {p.nom[0]}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h3 className="font-black text-gray-900 text-xl tracking-tight">{p.nom} {p.prenom}</h3>
                                                    <Tag color={getSexeTagColor(p.sexe)} className="rounded-lg font-black text-[9px] border-none px-3 py-0.5 uppercase tracking-widest">{formatSexeLabel(p.sexe)}</Tag>
                                                </div>
                                                <div className="flex flex-wrap gap-6 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                                    <span className="flex items-center gap-2 text-primary-end font-black"><span className="opacity-30">Matricule:</span> {p.matricule || `#${p.id}`}</span>
                                                    <span className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {getContact(p)}</span>
                                                    <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {getVille(p)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                                            <button 
                                                onClick={() => openEditModal(p)}
                                                title="Modifier les informations du patient"
                                                className="bg-gray-50 hover:bg-primary-start hover:text-white p-4 rounded-2xl transition-all text-gray-400 shadow-inner group/edit"
                                            >
                                                <User className="w-5 h-5" />
                                            </button>
                                            <Dropdown menu={{ items: getPatientActions(p) }} trigger={['click']} placement="bottomRight">
                                                <button className="p-4 hover:bg-gray-50 rounded-2xl transition-all text-gray-300">
                                                    <MoreHorizontal className="w-6 h-6" />
                                                </button>
                                            </Dropdown>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pagination */}
                        <div className="mt-12 flex justify-center items-center gap-6">
                            <button 
                                disabled={currentPage === 1} 
                                onClick={() => setCurrentPage(p => p - 1)} 
                                className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md disabled:opacity-20 disabled:cursor-not-allowed text-primary-start transition-all"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            
                            <div className="bg-white px-8 py-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                                <span className="text-xs font-black text-gray-300 uppercase tracking-[0.2em]">Page</span>
                                <span className="text-xl font-black text-gray-900">{currentPage}</span>
                                <span className="text-xs font-black text-gray-200 uppercase tracking-widest">sur {Math.ceil(totalPatients / pageSize)}</span>
                            </div>

                            <button 
                                disabled={currentPage >= Math.ceil(totalPatients / pageSize)} 
                                onClick={() => setCurrentPage(p => p + 1)} 
                                className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md disabled:opacity-20 disabled:cursor-not-allowed text-primary-start transition-all"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Modals */}
                <AddNewPatientModal isOpen={isRegModalOpen} onClose={() => setIsRegModalOpen(false)} setCanOpenSuccessModal={setCanOpenSuccessModal} setSuccessMessage={setSuccessMessage} setIsLoading={setIsLoading} onPatientAdded={fetchPatients} />
                <CreateVisitModal isOpen={isVisitModalOpen} onClose={() => setIsVisitModalOpen(false)} patient={selectedPatient} setCanOpenSuccessModal={setCanOpenSuccessModal} setSuccessMessage={setSuccessMessage} />
                <ViewPatientDetailsModal isOpen={isViewModalOpen} patient={selectedPatient} onClose={() => setIsViewModalOpen(false)} />
                <EditPatientInfosModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} patientData={selectedPatient} setCanOpenSuccessModal={setCanOpenSuccessModal} setSuccessMessage={setSuccessMessage} setIsLoading={setIsLoading} onUpdateSuccess={fetchPatients} />
                <ScheduleAppointmentModal isOpen={isApptModalOpen} onClose={() => setIsApptModalOpen(false)} patient={selectedPatient} onAppointmentScheduled={() => { setSuccessMessage("Rendez-vous programmé avec succès !"); setCanOpenSuccessModal(true); }} />
            </div>
            </ReceptionistNavBar>
        </DashBoard>
    );
};

export default Receptionist;
