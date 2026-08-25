import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { nurseNavLink } from "./nurseNavLink.js";
import { NurseNavBar } from "./NurseNavBar.jsx";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { nurseApi } from "../../services/nurseApi.js";
import { AppRoutesPaths } from "../../Router/appRouterPaths.js";
import { Calendar, Clock, User, MessageSquare, ChevronRight, Plus, CalendarDays, X, Search, CheckCircle2 } from 'lucide-react';
import axiosInstance from "../../Utils/axiosInstance.js";
import { getGatewayBaseUrl } from "../../Utils/gatewayUrls.js";
import { STATUT_CONFIG, isOverdue } from "../../Utils/statutRdv.js";

const StatutBadge = ({ statut }) => {
    const cfg = STATUT_CONFIG[statut] || { label: statut || '—', color: 'bg-gray-50 text-gray-600 border-gray-200' };
    return <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase ${cfg.color}`}>{cfg.label}</span>;
};

export const NurseAppointments = () => {
    const [appointments, setAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("TOUS");
    const [timeFilter, setTimeFilter] = useState("TODAY");
    const navigate = useNavigate();

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [modalError, setModalError] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);

    // Patient autocomplete
    const [patientQuery, setPatientQuery] = useState("");
    const [patientSuggestions, setPatientSuggestions] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null); // { id, nom, prenom }
    const [isSearchingPatients, setIsSearchingPatients] = useState(false);

    // Doctor autocomplete
    const [doctorQuery, setDoctorQuery] = useState("");
    const [doctorSuggestions, setDoctorSuggestions] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState(null); // { id, nom, prenom, specialite }
    const [isSearchingDoctors, setIsSearchingDoctors] = useState(false);
    const [allDoctors, setAllDoctors] = useState([]);

    const [formData, setFormData] = useState({
        motif: '',
        date: '',
        heure: ''
    });

    // -------------------------------------------------------
    // Load appointments
    // -------------------------------------------------------
    const loadAppointments = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await nurseApi.getAppointments();
            setAppointments(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAppointments();
    }, [loadAppointments]);

    const isToday = (dateStr) => {
        // Convertir la date UTC en heure locale pour la comparaison
        const d = new Date(dateStr);
        const today = new Date();
        return (
            d.getFullYear() === today.getFullYear() &&
            d.getMonth() === today.getMonth() &&
            d.getDate() === today.getDate()
        );
    };

    const isThisWeek = (dateStr) => {
        const d = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        nextWeek.setHours(23, 59, 59, 999);
        return d >= today && d <= nextWeek;
    };

    // -------------------------------------------------------
    // Filtering
    // -------------------------------------------------------
    const filteredAppointments = appointments.filter(apt => {
        const matchesStatus = statusFilter === "TOUS" ? true : apt.statut === statusFilter;
        let matchesTime = true;
        if (timeFilter === "TODAY") matchesTime = isToday(apt.date_heure);
        else if (timeFilter === "WEEK") matchesTime = isThisWeek(apt.date_heure);
        return matchesStatus && matchesTime;
    });

    // -------------------------------------------------------
    // Doctor name resolver — personnel_concerne may be UUID or plain name
    // -------------------------------------------------------
    const resolveDoctorLabel = (apt) => {
        const raw = apt.personnel_concerne;
        if (!raw) return "N/A";
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(raw));
        if (!isUUID) return raw; // already a readable name
        // If it resolved to a doctor in allDoctors, use their name
        const found = allDoctors.find(d => (d.id_personnel || d.id) === raw);
        if (found) return `${found.nom} ${found.prenom || ''}`.trim();
        return `Dr. #${String(raw).slice(0, 8)}`;
    };

    // -------------------------------------------------------
    // Modal helpers — open / close
    // -------------------------------------------------------
    const openModal = () => {
        setPatientQuery("");
        setPatientSuggestions([]);
        setSelectedPatient(null);
        setDoctorQuery("");
        setDoctorSuggestions([]);
        setSelectedDoctor(null);
        setFormData({ motif: '', date: '', heure: '' });
        setModalError("");
        setShowSuccess(false);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    // -------------------------------------------------------
    // Load all doctors at component mount (for name resolution in list)
    // -------------------------------------------------------
    useEffect(() => {
        const fetchDoctors = async () => {
            try {
                const response = await axiosInstance.get(`${getGatewayBaseUrl()}/personnel/medecins/`);
                const list = Array.isArray(response.data) ? response.data : (response.data?.results || []);
                setAllDoctors(list);
            } catch (err) {
                console.error("Erreur chargement médecins:", err);
            }
        };
        fetchDoctors();
    }, []);

    // -------------------------------------------------------
    // When modal opens, populate doctor suggestions
    // -------------------------------------------------------
    useEffect(() => {
        if (isModalOpen && allDoctors.length > 0) {
            setDoctorSuggestions([]);
        }
        if (!isModalOpen) {
            setPatientSuggestions([]);
            setPatientQuery("");
            setDoctorSuggestions([]);
            setDoctorQuery("");
        }
    }, [isModalOpen, allDoctors]);

    // -------------------------------------------------------
    // Patient search — debounced, uniquement après frappe
    // -------------------------------------------------------
    useEffect(() => {
        if (!isModalOpen) return;
        if (selectedPatient) return;

        // Rien à afficher si la saisie est vide
        if (!patientQuery.trim()) {
            setPatientSuggestions([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearchingPatients(true);
            try {
                const response = await axiosInstance.get("/patients/", {
                    params: { page_size: 10, search: patientQuery.trim() }
                });
                const list = Array.isArray(response.data) ? response.data : (response.data?.results || []);
                setPatientSuggestions(list);
            } catch (err) {
                console.error("Erreur recherche patients:", err);
            } finally {
                setIsSearchingPatients(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [patientQuery, isModalOpen, selectedPatient]);

    // -------------------------------------------------------
    // Doctor search — filter from allDoctors, uniquement après frappe
    // -------------------------------------------------------
    useEffect(() => {
        if (!isModalOpen || selectedDoctor) return;
        const q = doctorQuery.trim().toLowerCase();
        if (!q) {
            setDoctorSuggestions([]);
        } else {
            setDoctorSuggestions(
                allDoctors.filter(d =>
                    `${d.nom} ${d.prenom || ''} ${d.specialite || ''}`.toLowerCase().includes(q)
                ).slice(0, 8)
            );
        }
    }, [doctorQuery, allDoctors, isModalOpen, selectedDoctor]);

    // -------------------------------------------------------
    // Form submit
    // -------------------------------------------------------
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedPatient) { setModalError("Veuillez sélectionner un patient."); return; }
        if (!selectedDoctor)  { setModalError("Veuillez sélectionner un médecin."); return; }
        if (!formData.date || !formData.heure) { setModalError("Veuillez renseigner la date et l'heure."); return; }

        setIsSaving(true);
        setModalError("");
        try {
            const payload = {
                patient: selectedPatient.id,
                motif: formData.motif || "Consultation",
                personnel_concerne: selectedDoctor.id_personnel || selectedDoctor.id,
                date_heure: `${formData.date}T${formData.heure}:00Z`,
                // RDV pris par l'infirmier → routé vers le médecin.
                cree_par_role: 'INFIRMIER'
            };
            await nurseApi.createAppointment(payload);
            setShowSuccess(true);
            setTimeout(() => {
                closeModal();
                loadAppointments();
            }, 1400);
        } catch (err) {
            setModalError("Erreur lors de la création du rendez-vous. Réessayez.");
        } finally {
            setIsSaving(false);
        }
    };

    // -------------------------------------------------------
    // Render
    // -------------------------------------------------------
    return (
        <CustomDashboard linkList={nurseNavLink} requiredRole="nurse">
            <NurseNavBar>
                <div className="p-6 h-[calc(100vh-100px)] flex flex-col bg-gray-50/50 overflow-y-auto scrollbar">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                                <Calendar className="w-7 h-7 mr-2 text-primary-start" />
                                Planning des Rendez-vous
                            </h2>
                        </div>
                        <div className="flex gap-4">
                            {/* Time filter */}
                            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
                                {["TODAY", "WEEK", "ALL"].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setTimeFilter(t)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeFilter === t ? 'bg-primary-start text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        {t === 'TODAY' ? "Aujourd'hui" : t === 'WEEK' ? 'Cette semaine' : 'Tout voir'}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={openModal}
                                className="flex items-center px-4 py-2 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-lg font-bold shadow-md hover:opacity-90 transition-all"
                            >
                                <Plus className="w-5 h-5 mr-2" />
                                Fixer un RDV
                            </button>
                        </div>
                    </div>

                    {/* Status Tabs */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {["TOUS", "PROGRAMME", "TERMINE", "REPORTE", "ANNULE"].map((stat) => (
                            <button
                                key={stat}
                                onClick={() => setStatusFilter(stat)}
                                className={`px-6 py-2 rounded-full text-sm font-bold border transition-all ${statusFilter === stat ? 'bg-white border-primary-start text-primary-start shadow-sm' : 'bg-transparent border-gray-200 text-gray-500'}`}
                            >
                                {stat === 'TOUS' ? 'Tous' : stat === 'PROGRAMME' ? 'Programmés' : stat === 'TERMINE' ? 'Terminés' : stat === 'REPORTE' ? 'Reportés' : 'Annulés'}
                            </button>
                        ))}
                    </div>

                    {/* Appointment List */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-64"><Loading /></div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {filteredAppointments.length === 0 ? (
                                    <div className="p-16 text-center">
                                        <CalendarDays className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                        <p className="text-gray-500 font-medium">Aucun rendez-vous</p>
                                    </div>
                                ) : (
                                    filteredAppointments.map((apt) => (
                                        <div key={apt.id} className="p-5 hover:bg-gray-50 transition-colors group">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex flex-col items-center justify-center border border-blue-100">
                                                        <Clock className="w-3.5 h-3.5 text-primary-start mb-0.5" />
                                                        <span className="text-xs font-bold text-primary-start">
                                                            {new Date(apt.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-gray-800">
                                                            {apt.patient?.nom} {apt.patient?.prenom}
                                                        </h4>
                                                        <p className="text-sm text-gray-500 flex items-center mt-0.5">
                                                            <MessageSquare className="w-3 h-3 mr-1" />
                                                            {apt.motif}
                                                            {" • "}
                                                            <User className="w-3 h-3 mx-1" />
                                                            {resolveDoctorLabel(apt)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {isOverdue(apt) && (
                                                        <span className="px-3 py-1 rounded-full text-[10px] font-bold border bg-orange-50 text-orange-700 border-orange-200 uppercase">En retard</span>
                                                    )}
                                                    <StatutBadge statut={apt.statut} />
                                                    <button
                                                        onClick={() => navigate(AppRoutesPaths.consultationHistoryPage.replace(':id', apt.patient?.id))}
                                                        className="p-2 text-gray-300 hover:text-primary-start hover:bg-gray-100 rounded-lg transition-all"
                                                    >
                                                        <ChevronRight className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* ===================== MODAL ===================== */}
                    {isModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                                {/* Modal header */}
                                <div className="bg-gradient-to-r from-primary-start to-primary-end p-6 text-white flex justify-between items-center">
                                    <h3 className="text-xl font-bold">Fixer un nouveau RDV</h3>
                                    <button onClick={closeModal} className="p-1 hover:bg-white/20 rounded-lg transition-all">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Success overlay */}
                                {showSuccess ? (
                                    <div className="p-12 flex flex-col items-center justify-center gap-4">
                                        <CheckCircle2 className="w-16 h-16 text-green-500 animate-bounce" />
                                        <p className="text-lg font-bold text-gray-800">Rendez-vous enregistré !</p>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                                        {modalError && (
                                            <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-lg">
                                                {modalError}
                                            </div>
                                        )}

                                        {/* Patient autocomplete */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                Patient <span className="text-red-500">*</span>
                                            </label>
                                            {selectedPatient ? (
                                                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                                                    <span className="font-bold text-gray-800 text-sm">
                                                        {selectedPatient.nom} {selectedPatient.prenom}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setSelectedPatient(null); setPatientQuery(""); }}
                                                        className="text-gray-400 hover:text-red-500 ml-2"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        value={patientQuery}
                                                        onChange={e => setPatientQuery(e.target.value)}
                                                        placeholder="Rechercher par nom ou matricule..."
                                                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start outline-none text-sm"
                                                        autoComplete="off"
                                                    />
                                                    {(patientSuggestions.length > 0 || isSearchingPatients) && (
                                                        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                            {isSearchingPatients ? (
                                                                <div className="px-4 py-3 text-sm text-gray-400">Recherche...</div>
                                                            ) : (
                                                                patientSuggestions.map(p => (
                                                                    <button
                                                                        key={p.id}
                                                                        type="button"
                                                                        onClick={() => { setSelectedPatient(p); setPatientQuery(""); setPatientSuggestions([]); }}
                                                                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors text-sm border-b border-gray-50 last:border-0"
                                                                    >
                                                                        <span className="font-bold text-gray-800">{p.nom} {p.prenom}</span>
                                                                        <span className="text-gray-400 text-xs ml-2 font-mono">#{p.id?.slice(0, 8)}</span>
                                                                    </button>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Doctor autocomplete */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                Médecin concerné <span className="text-red-500">*</span>
                                            </label>
                                            {selectedDoctor ? (
                                                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                                                    <span className="font-bold text-gray-800 text-sm">
                                                        {selectedDoctor.nom} {selectedDoctor.prenom}
                                                        {selectedDoctor.specialite && (
                                                            <span className="text-xs text-gray-500 ml-2">({selectedDoctor.specialite})</span>
                                                        )}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setSelectedDoctor(null); setDoctorQuery(""); }}
                                                        className="text-gray-400 hover:text-red-500 ml-2"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        value={doctorQuery}
                                                        onChange={e => setDoctorQuery(e.target.value)}
                                                        placeholder="Rechercher un médecin..."
                                                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start outline-none text-sm"
                                                        autoComplete="off"
                                                    />
                                                    {doctorSuggestions.length > 0 && (
                                                        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                            {isSearchingDoctors ? (
                                                                <div className="px-4 py-3 text-sm text-gray-400">Recherche...</div>
                                                            ) : (
                                                                doctorSuggestions.map(d => (
                                                                    <button
                                                                        key={d.id_personnel || d.id}
                                                                        type="button"
                                                                        onClick={() => { setSelectedDoctor(d); setDoctorQuery(""); setDoctorSuggestions([]); }}
                                                                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors text-sm border-b border-gray-50 last:border-0"
                                                                    >
                                                                        <span className="font-bold text-gray-800">{d.nom} {d.prenom}</span>
                                                                        {d.specialite && (
                                                                            <span className="text-gray-400 text-xs ml-2">— {d.specialite}</span>
                                                                        )}
                                                                    </button>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Motif */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motif de consultation</label>
                                            <textarea
                                                value={formData.motif}
                                                onChange={e => setFormData({ ...formData, motif: e.target.value })}
                                                rows="2"
                                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start outline-none text-sm"
                                                placeholder="Ex: Contrôle tension..."
                                            />
                                        </div>

                                        {/* Date & Heure */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                    Date <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    value={formData.date}
                                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start outline-none text-sm"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                    Heure <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="time"
                                                    value={formData.heure}
                                                    onChange={e => setFormData({ ...formData, heure: e.target.value })}
                                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start outline-none text-sm"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Submit */}
                                        <div className="pt-2">
                                            <button
                                                type="submit"
                                                disabled={isSaving}
                                                className="w-full py-3 bg-gradient-to-r from-primary-start to-primary-end text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-all disabled:opacity-60"
                                            >
                                                {isSaving ? "Enregistrement..." : "Confirmer le rendez-vous"}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </NurseNavBar>
        </CustomDashboard>
    );
};

export default NurseAppointments;
