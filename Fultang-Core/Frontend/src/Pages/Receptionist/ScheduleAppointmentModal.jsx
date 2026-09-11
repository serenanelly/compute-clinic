import { XIcon, Calendar, Clock, User, MessageSquare, CheckCircle2, Search } from "lucide-react";
import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Alert, Select, DatePicker, TimePicker, ConfigProvider } from "antd";
import frFR from "antd/locale/fr_FR";
import dayjs from "dayjs";
import axiosInstance from "../../Utils/axiosInstance.js";
import { getGatewayBaseUrl } from "../../Utils/gatewayUrls.js";

export function ScheduleAppointmentModal({ isOpen, onClose, patient, appointmentToEdit, onAppointmentScheduled }) {
    ScheduleAppointmentModal.propTypes = {
        isOpen: PropTypes.bool.isRequired,
        onClose: PropTypes.func.isRequired,
        patient: PropTypes.object, // Optionnel si on choisit dans le modal
        appointmentToEdit: PropTypes.object, // Optionnel pour la modification
        onAppointmentScheduled: PropTypes.func // Callback après succès
    };

    const [doctors, setDoctors] = useState([]);
    const [patients, setPatients] = useState([]);
    const [isSearchingPatients, setIsSearchingPatients] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [showLocalSuccess, setShowLocalSuccess] = useState(false);

    const [formData, setFormData] = useState({
        id_patient: '',
        id_medecin: '',
        date: null,
        heure: null,
        raison: ''
    });

    // Charger les médecins depuis la Gateway (/personnel/medecins/)
    useEffect(() => {
        const fetchDoctors = async () => {
            try {
                const response = await axiosInstance.get(`${getGatewayBaseUrl()}/personnel/medecins/`);
                const mappedDoctors = Array.isArray(response.data)
                    ? response.data
                    : (response.data?.results || []);
                setDoctors(mappedDoctors);
            } catch (err) {
                console.error("Erreur chargement médecins:", err);
            }
        };
        if (isOpen) fetchDoctors();
    }, [isOpen]);

    // Pré-remplir si modification ou patient sélectionné
    useEffect(() => {
        if (isOpen) {
            if (appointmentToEdit) {
                setFormData({
                    id_patient: appointmentToEdit.id_patient || appointmentToEdit.patient,
                    id_medecin: appointmentToEdit.id_medecin || appointmentToEdit.personnel_concerne,
                    date: dayjs(appointmentToEdit.date_heure),
                    heure: dayjs(appointmentToEdit.date_heure),
                    raison: appointmentToEdit.raison || appointmentToEdit.motif || ''
                });
            } else if (patient) {
                setFormData(prev => ({ ...prev, id_patient: patient.id }));
            } else {
                setFormData({ id_patient: '', id_medecin: '', date: null, heure: null, raison: '' });
            }
        }
    }, [isOpen, patient, appointmentToEdit]);

    // Charger les patients au montage (ou quand le modal s'ouvre sans patient présélectionné)
    useEffect(() => {
        if (isOpen && !patient && !appointmentToEdit) {
            const fetchInitialPatients = async () => {
                setIsSearchingPatients(true);
                try {
                    const response = await axiosInstance.get("/patients/", { params: { page_size: 20 } });
                    // DRF ModelViewSet avec pagination = response.data.results
                    const patientsList = Array.isArray(response.data) ? response.data : (response.data?.results || []);
                    setPatients(patientsList);
                } catch (err) {
                    console.error("Erreur patients:", err);
                } finally {
                    setIsSearchingPatients(false);
                }
            };
            fetchInitialPatients();
        }
    }, [isOpen, patient, appointmentToEdit]);

    const handleSearchPatients = async (value) => {
        setIsSearchingPatients(true);
        try {
            const response = await axiosInstance.get("/patients/", { params: { search: value } });
            const patientsList = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            setPatients(patientsList);
        } catch (err) {
            console.error("Erreur recherche patients:", err);
        } finally {
            setIsSearchingPatients(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { id_patient, id_medecin, date, heure, raison } = formData;

        if (!id_patient || !id_medecin || !date || !heure) {
            setError("Veuillez remplir tous les champs obligatoires.");
            return;
        }

        setIsSubmitting(true);
        setError("");

        // Combiner date et heure
        const date_heure = date.hour(heure.hour()).minute(heure.minute()).second(0).toISOString();

        const payload = {
            patient: id_patient, // Clé FK
            personnel_concerne: id_medecin, // Nom ou ID
            date_heure,
            motif: raison || 'Consultation',
            statut: appointmentToEdit ? appointmentToEdit.statut : 'PROGRAMME',
            // RDV pris par la réception → routé vers l'infirmier ET le médecin.
            cree_par_role: appointmentToEdit ? appointmentToEdit.cree_par_role : 'RECEPTIONNISTE'
        };

        try {
            if (appointmentToEdit) {
                await axiosInstance.patch(`/patient/rendez-vous/${appointmentToEdit.id}/`, payload);
            } else {
                await axiosInstance.post("/patient/rendez-vous/", payload);
            }
            
            setShowLocalSuccess(true);
            setTimeout(() => {
                setShowLocalSuccess(false);
                if (onAppointmentScheduled) onAppointmentScheduled();
                onClose();
            }, 1500);
        } catch (err) {
            setError("Une erreur est survenue lors de l'enregistrement du rendez-vous.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <ConfigProvider locale={frFR}>
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-white/20">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary-start to-primary-end p-8 flex justify-between items-center text-white">
                        <div>
                            <h3 className="text-2xl font-black uppercase tracking-tight">
                                {appointmentToEdit ? "Modifier le rendez-vous" : "Planifier un rendez-vous"}
                            </h3>
                            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">Organisation du planning clinique</p>
                        </div>
                        <button onClick={onClose} className="p-3 hover:bg-white/20 rounded-2xl transition-all">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto max-h-[70vh] relative">
                        {error && <Alert message={error} type="error" showIcon className="rounded-2xl font-bold" />}
                        <Alert
                            type="info"
                            showIcon
                            className="rounded-2xl"
                            message="CORR-A3-005 : la réception et l'infirmier peuvent programmer un RDV. Le médecin consulte son planning ; seule la réception ouvre le dossier de visite et encaisse à la caisse."
                        />

                        {/* Success Overlay */}
                        {showLocalSuccess && (
                            <div data-testid="success-overlay" className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in zoom-in-95 duration-300 rounded-b-[2.5rem]">
                                <CheckCircle2 className="w-20 h-20 text-green-500 mb-4 animate-bounce" />
                                <h4 className="text-2xl font-bold text-gray-900">Rendez-vous enregistré !</h4>
                                <p className="text-gray-500 italic font-medium">Planning mis à jour avec succès.</p>
                            </div>
                        )}

                        {/* Sélection du Patient */}
                        <div className="space-y-3">
                            <label htmlFor="patient-select" className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <User className="w-4 h-4 text-primary-start" /> Patient <span className="text-red-500">*</span>
                            </label>
                            {patient ? (
                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary-start text-white flex items-center justify-center font-black">{patient.nom[0]}</div>
                                    <span className="font-bold text-gray-700">{patient.nom} {patient.prenom}</span>
                                </div>
                            ) : (
                                <Select
                                    id="patient-select"
                                    data-testid="patient-select"
                                    showSearch
                                    className="w-full h-14"
                                    placeholder="Rechercher un patient par nom ou matricule..."
                                    onSearch={handleSearchPatients}
                                    onChange={(val) => setFormData({ ...formData, id_patient: val })}
                                    loading={isSearchingPatients}
                                    filterOption={false}
                                    size="large"
                                    options={patients.map(p => ({ value: p.id, label: `${p.nom} ${p.prenom} (#${p.id})` }))}
                                />
                            )}
                        </div>

                        {/* Sélection du Médecin */}
                        <div className="space-y-3">
                            <label htmlFor="doctor-select" className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary-end" /> Médecin consultant <span className="text-red-500">*</span>
                            </label>
                            <Select
                                id="doctor-select"
                                data-testid="doctor-select"
                                className="w-full h-14"
                                placeholder="Choisir le médecin..."
                                value={formData.id_medecin}
                                onChange={(val) => setFormData({ ...formData, id_medecin: val })}
                                size="large"
                                options={doctors.map(d => ({ value: d.id_personnel || d.id, label: `${d.nom} ${d.prenom} (${d.specialite || 'Généraliste'})` }))}
                            />
                        </div>

                        {/* Date et Heure */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label htmlFor="appointment-date" className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-primary-start" /> Date <span className="text-red-500">*</span>
                                </label>
                                <DatePicker 
                                    id="appointment-date"
                                    className="w-full h-14 rounded-2xl border-gray-200" 
                                    size="large"
                                    format="DD/MM/YYYY"
                                    placeholder="Sélectionner la date"
                                    value={formData.date}
                                    onChange={(date) => setFormData({ ...formData, date })}
                                    disabledDate={(current) => current && current < dayjs().startOf('day')}
                                />
                            </div>
                            <div className="space-y-3">
                                <label htmlFor="appointment-time" className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-primary-end" /> Heure <span className="text-red-500">*</span>
                                </label>
                                <TimePicker 
                                    id="appointment-time"
                                    className="w-full h-14 rounded-2xl border-gray-200" 
                                    size="large"
                                    format="HH:mm"
                                    placeholder="Sélectionner l'heure"
                                    minuteStep={15}
                                    value={formData.heure}
                                    onChange={(heure) => setFormData({ ...formData, heure })}
                                />
                            </div>
                        </div>

                        {/* Raison */}
                        <div className="space-y-3">
                            <label htmlFor="reason-textarea" className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-primary-start" /> Motif du rendez-vous
                            </label>
                            <textarea
                                id="reason-textarea"
                                value={formData.raison}
                                onChange={(e) => setFormData({ ...formData, raison: e.target.value })}
                                className="w-full p-5 bg-gray-50 border border-gray-100 rounded-3xl outline-none focus:ring-4 focus:ring-primary-start/10 transition-all text-sm font-bold min-h-[100px]"
                                placeholder="Précisez la raison de la consultation..."
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4 pt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-10 py-5 text-gray-400 font-black uppercase text-xs tracking-widest hover:bg-gray-50 rounded-3xl transition-all"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                data-testid="submit-button"
                                disabled={isSubmitting}
                                className="flex-1 bg-gradient-to-r from-primary-start to-primary-end text-white py-5 rounded-3xl font-black shadow-xl shadow-primary-end/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 uppercase text-xs tracking-widest"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                {appointmentToEdit ? "Enregistrer les modifications" : "Confirmer le rendez-vous"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </ConfigProvider>
    );
}
