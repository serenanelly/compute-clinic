import { useState, useEffect } from 'react';
import { DashBoard } from '../../GlobalComponents/DashBoard';
import { ReceptionistNavBar } from './ReceptionistNavBar';
import { receptionistNavLink } from './receptionistNavLink';
import { Calendar, Search, Clock, User, MoreHorizontal, CheckCircle, Trash2, Edit2, Plus, LayoutGrid, List as ListIcon } from 'lucide-react';
import { ScheduleAppointmentModal } from './ScheduleAppointmentModal';
import { Alert, Dropdown, Modal } from 'antd';
import axiosInstance from "../../Utils/axiosInstance.js";
import { getGatewayBaseUrl } from "../../Utils/gatewayUrls.js";
import { STATUT_CONFIG, isOverdue } from "../../Utils/statutRdv.js";
import dayjs from 'dayjs';

const StatutBadge = ({ statut }) => {
    const cfg = STATUT_CONFIG[statut] || { label: statut || '—', color: 'bg-gray-50 text-gray-600 border-gray-200' };
    return <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase ${cfg.color}`}>{cfg.label}</span>;
};

export const Appointments = () => {
    const [appointments, setAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [confirmingId, setConfirmingId] = useState(null);
    const [viewMode, setViewMode] = useState('list');
    const [searchQuery, setSearchQuery] = useState("");

    const patientNameCache = {};
    const doctorNameCache = {};

    const fetchAppointments = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axiosInstance.get("/patient/rendez-vous/");
            const data = response.data;
            const list = Array.isArray(data) ? data : (data.results || []);

            const enriched = await Promise.all(list.map(async (apt) => {
                let patientLabel = "";
                if (apt.patient_details?.nom) {
                    patientLabel = `${apt.patient_details.nom} ${apt.patient_details.prenom || ''}`.trim();
                } else if (apt.patient_nom) {
                    patientLabel = apt.patient_nom;
                } else if (apt.patient) {
                    const key = String(apt.patient);
                    if (!patientNameCache[key]) {
                        try {
                            const r = await axiosInstance.get(`/patients/${key}/`);
                            patientNameCache[key] = `${r.data.nom} ${r.data.prenom || ''}`.trim();
                        } catch { patientNameCache[key] = `Patient #${key}`; }
                    }
                    patientLabel = patientNameCache[key];
                }

                let medecinLabel = "";
                const rawMedecin = apt.personnel_concerne;
                if (apt.medecin_details?.nom) {
                    medecinLabel = `${apt.medecin_details.nom} ${apt.medecin_details.prenom || ''}`.trim();
                } else if (rawMedecin) {
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(rawMedecin));
                    if (isUUID) {
                        const key = String(rawMedecin);
                        if (!doctorNameCache[key]) {
                            try {
                                const r = await axiosInstance.get(`${getGatewayBaseUrl()}/personnel/medecins/${key}/`);
                                doctorNameCache[key] = `${r.data.nom} ${r.data.prenom || ''}`.trim();
                            } catch { doctorNameCache[key] = `Dr. #${key.slice(0, 8)}`; }
                        }
                        medecinLabel = doctorNameCache[key];
                    } else {
                        medecinLabel = rawMedecin;
                    }
                } else {
                    medecinLabel = "N/A";
                }
                return { ...apt, _patientLabel: patientLabel, _medecinLabel: medecinLabel };
            }));

            setAppointments(enriched);
        } catch (err) {
            console.error("Erreur chargement rendez-vous:", err);
            setError("Impossible de charger le planning. Vérifiez que le serveur est démarré.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAppointments(); }, []);

    const getPatientNom = (apt) => apt._patientLabel || `Patient #${apt.patient}`;
    const getMedecinNom = (apt) => apt._medecinLabel || apt.personnel_concerne || "N/A";
    const getMotif = (apt) => apt.raison || apt.motif || "Consultation";
    const getStatut = (apt) => apt.status || apt.statut || "PROGRAMME";

    const handleConfirmer = async (apt) => {
        setConfirmingId(apt.id);
        try {
            await axiosInstance.patch(`/patient/rendez-vous/${apt.id}/`, { statut: 'CONFIRME' });
            fetchAppointments();
        } catch (err) {
            console.error("Erreur confirmation RDV:", err);
        } finally {
            setConfirmingId(null);
        }
    };

    const handleDelete = async (id) => {
        Modal.confirm({
            title: 'Annuler ce rendez-vous ?',
            content: 'Cette action est irréversible.',
            okText: 'Oui, annuler',
            okType: 'danger',
            cancelText: 'Non',
            onOk: async () => {
                try {
                    await axiosInstance.delete(`/patient/rendez-vous/${id}/`);
                    fetchAppointments();
                } catch (err) { console.error("Erreur suppression:", err); }
            }
        });
    };

    const getActions = (apt) => [
        { key: 'edit', label: 'Modifier / Reporter', icon: <Edit2 className="w-4 h-4" />, onClick: () => { setSelectedAppointment(apt); setIsModalOpen(true); } },
        { key: 'delete', label: 'Annuler le RDV', icon: <Trash2 className="w-4 h-4 text-red-500" />, danger: true, onClick: () => handleDelete(apt.id) },
    ];

    const filteredAppointments = appointments.filter(apt =>
        getPatientNom(apt).toLowerCase().includes(searchQuery.toLowerCase()) ||
        getMedecinNom(apt).toLowerCase().includes(searchQuery.toLowerCase()) ||
        getMotif(apt).toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <DashBoard linkList={receptionistNavLink} requiredRole="RECEPTIONIST">
            <ReceptionistNavBar>
                <div className="p-8 pb-24">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                                <Calendar className="w-7 h-7 mr-2 text-primary-start" />
                                Planning RDV
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">Gestion des consultations programmées</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="bg-white p-1 rounded-2xl shadow-sm border border-gray-100 flex gap-1">
                                <button onClick={() => setViewMode('table')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'table' ? 'bg-primary-start text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`} title="Vue Tableau">
                                    <LayoutGrid className="w-5 h-5" />
                                </button>
                                <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-primary-start text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`} title="Vue Liste">
                                    <ListIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <button
                                onClick={() => { setSelectedAppointment(null); setIsModalOpen(true); }}
                                className="bg-gradient-to-r from-primary-start to-primary-end text-white px-8 py-3.5 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all uppercase text-xs tracking-widest flex items-center gap-3"
                            >
                                <Plus className="w-5 h-5" /> Nouveau Rendez-vous
                            </button>
                        </div>
                    </div>

                    {/* Légende des statuts */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {Object.entries(STATUT_CONFIG).map(([key, cfg]) => (
                            <span key={key} className={`px-3 py-1 rounded-full text-[10px] font-bold border ${cfg.color}`}>{cfg.label}</span>
                        ))}
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold border bg-orange-50 text-orange-700 border-orange-200">En retard</span>
                    </div>

                    {/* Barre de Recherche */}
                    <div className="relative mb-8">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-16 pr-6 py-4 bg-white border border-gray-100 rounded-[2rem] shadow-sm outline-none focus:ring-4 focus:ring-primary-start/10 transition-all text-gray-700 font-bold placeholder:text-gray-300"
                            placeholder="Rechercher un rendez-vous (patient, médecin...)"
                        />
                    </div>

                    {isLoading && (
                        <div className="py-24 text-center">
                            <div className="w-12 h-12 border-4 border-primary-start border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="font-black text-gray-300 uppercase tracking-widest text-xs">Chargement du planning...</p>
                        </div>
                    )}

                    {!isLoading && error && <Alert message={error} type="error" showIcon className="mb-8 rounded-2xl p-4 shadow-sm" />}

                    {!isLoading && !error && filteredAppointments.length === 0 && (
                        <div className="py-24 text-center bg-white rounded-[3rem] border border-dashed border-gray-200">
                            <Calendar className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                            <h3 className="font-black text-gray-200 uppercase tracking-widest">Aucun rendez-vous trouvé</h3>
                        </div>
                    )}

                    {!isLoading && !error && filteredAppointments.length > 0 && (
                        <div className="space-y-4">
                            {viewMode === 'table' ? (
                                /* VUE TABLEAU */
                                <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden border border-gray-50">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] border-b border-gray-50">
                                            <tr>
                                                <th className="px-8 py-5">Date & Heure</th>
                                                <th className="px-8 py-5">Patient</th>
                                                <th className="px-8 py-5">Médecin & Motif</th>
                                                <th className="px-8 py-5">Statut</th>
                                                <th className="px-8 py-5 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {filteredAppointments.map(apt => (
                                                <tr key={apt.id} className="hover:bg-gray-50/50 transition-all">
                                                    <td className="px-8 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-primary-start/5 flex flex-col items-center justify-center border border-primary-start/10">
                                                                <span className="text-[8px] font-black text-primary-start uppercase">{dayjs(apt.date_heure).format('MMM')}</span>
                                                                <span className="text-sm font-black text-gray-900">{dayjs(apt.date_heure).format('DD')}</span>
                                                            </div>
                                                            <span className="text-sm font-black text-primary-end">{dayjs(apt.date_heure).format('HH:mm')}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 font-black text-gray-900">{getPatientNom(apt)}</td>
                                                    <td className="px-8 py-5">
                                                        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                                            <User className="w-3.5 h-3.5 text-primary-start" /> {getMedecinNom(apt)}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                                            <Clock className="w-3.5 h-3.5" /> {getMotif(apt)}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <div className="flex flex-col gap-1">
                                                            <StatutBadge statut={getStatut(apt)} />
                                                            {isOverdue(apt) && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-50 text-orange-700 border border-orange-200 w-fit">En retard</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        <div className="flex justify-end items-center gap-2">
                                                            {getStatut(apt) === 'PROGRAMME' && (
                                                                <button
                                                                    onClick={() => handleConfirmer(apt)}
                                                                    disabled={confirmingId === apt.id}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-60"
                                                                >
                                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                                    {confirmingId === apt.id ? '...' : 'Confirmer'}
                                                                </button>
                                                            )}
                                                            <Dropdown menu={{ items: getActions(apt) }} trigger={['click']} placement="bottomRight">
                                                                <button className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                                                                    <MoreHorizontal className="w-5 h-5 text-gray-400" />
                                                                </button>
                                                            </Dropdown>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                /* VUE LISTE */
                                <div className="space-y-3">
                                    {filteredAppointments.map(apt => (
                                        <div key={apt.id} className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-lg transition-all flex flex-col md:flex-row items-center gap-6">
                                            {/* Date */}
                                            <div className="flex flex-col items-center justify-center bg-gray-50 w-20 h-20 rounded-[1.2rem] border border-gray-100 shrink-0">
                                                <span className="text-[9px] font-black text-gray-300 uppercase">{dayjs(apt.date_heure).format('MMM')}</span>
                                                <span className="text-2xl font-black text-gray-900 leading-none">{dayjs(apt.date_heure).format('DD')}</span>
                                                <span className="text-[9px] font-black text-primary-start uppercase mt-0.5">{dayjs(apt.date_heure).format('HH:mm')}</span>
                                            </div>

                                            {/* Infos */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <h3 className="font-black text-gray-900 text-lg">{getPatientNom(apt)}</h3>
                                                    <StatutBadge statut={getStatut(apt)} />
                                                    {isOverdue(apt) && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-50 text-orange-700 border border-orange-200">En retard</span>}
                                                </div>
                                                <div className="flex flex-wrap gap-4 text-xs font-bold text-gray-400 uppercase">
                                                    <span className="flex items-center gap-1.5 text-primary-start"><User className="w-3.5 h-3.5 opacity-50" />{getMedecinNom(apt)}</span>
                                                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 opacity-50" />{getMotif(apt)}</span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                {getStatut(apt) === 'PROGRAMME' && (
                                                    <button
                                                        onClick={() => handleConfirmer(apt)}
                                                        disabled={confirmingId === apt.id}
                                                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-60 shadow-sm"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                        {confirmingId === apt.id ? 'En cours...' : 'Confirmer'}
                                                    </button>
                                                )}
                                                <button onClick={() => { setSelectedAppointment(apt); setIsModalOpen(true); }} className="p-3 bg-gray-50 text-gray-400 hover:bg-primary-start hover:text-white rounded-xl transition-all">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <Dropdown menu={{ items: getActions(apt) }} trigger={['click']} placement="bottomRight">
                                                    <button className="p-3 hover:bg-gray-50 rounded-xl transition-all text-gray-300">
                                                        <MoreHorizontal className="w-5 h-5" />
                                                    </button>
                                                </Dropdown>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <ScheduleAppointmentModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        appointmentToEdit={selectedAppointment}
                        onAppointmentScheduled={fetchAppointments}
                    />
                </div>
            </ReceptionistNavBar>
        </DashBoard>
    );
};

export default Appointments;
