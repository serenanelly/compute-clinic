import { XIcon, Stethoscope, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Alert, Select } from "antd";
import axios from "axios";
import axiosInstance from "../../Utils/axiosInstance.js";
import { PERSONNEL_MEDECINS_URL } from "../../Utils/gatewayUrls.js";
import { getToken } from "../../Utils/authToken.js";

export function CreateVisitModal({ isOpen, onClose, patient, setSuccessMessage, setCanOpenSuccessModal }) {
    CreateVisitModal.propTypes = {
        isOpen: PropTypes.bool.isRequired,
        onClose: PropTypes.func.isRequired,
        patient: PropTypes.object,
        setSuccessMessage: PropTypes.func.isRequired,
        setCanOpenSuccessModal: PropTypes.func.isRequired,
    };

    const [formData, setFormData] = useState({
        motif: '',
        id_medecin: '',
    });
    const [doctors, setDoctors] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [doctorsError, setDoctorsError] = useState("");

    useEffect(() => {
        if (!isOpen) {
            setFormData({ motif: '', id_medecin: '' });
            setError("");
            return;
        }

        const fetchDoctors = async () => {
            setDoctorsError("");
            try {
                const token = getToken();
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const response = await axios.get(PERSONNEL_MEDECINS_URL(), { headers });
                const mapped = Array.isArray(response.data)
                    ? response.data
                    : (response.data?.results || []);
                setDoctors(mapped);
                if (mapped.length === 0) {
                    setDoctorsError(
                        "Aucun médecin trouvé dans le service personnel. Vous pouvez quand même créer la visite."
                    );
                }
            } catch (err) {
                console.error("Erreur chargement médecins:", err);
                setDoctors([]);
                setDoctorsError(
                    "Liste des médecins indisponible (vérifiez que le service personnel est démarré). "
                    + "Vous pouvez créer la visite sans sélectionner de médecin."
                );
            }
        };
        fetchDoctors();
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.motif?.trim()) {
            setError("Le motif de la visite est obligatoire.");
            return;
        }

        setIsSubmitting(true);
        setError("");

        try {
            const response = await axiosInstance.post("/visites/", {
                patient: patient.id,
                motif_visite: formData.motif.trim(),
            });

            if (response.status === 201 || response.status === 200) {
                const medLabel = formData.id_medecin
                    ? doctors.find((d) => String(d.id_personnel || d.id) === String(formData.id_medecin))
                    : null;
                const medecinNote = medLabel
                    ? ` — orienté Dr. ${medLabel.nom}`
                    : "";
                setSuccessMessage(
                    `Visite créée avec succès pour ${patient.nom}${medecinNote} !`
                );
                setCanOpenSuccessModal(true);
                onClose();
            }
        } catch (err) {
            const detail = err.response?.data;
            const msg = typeof detail === 'object'
                ? Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' — ')
                : null;
            setError(msg || "Impossible de créer la visite. Vérifiez que le service medical est démarré.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !patient) return null;

    const doctorOptions = doctors.map((d) => ({
        value: String(d.id_personnel || d.id),
        label: `Dr. ${d.nom || ''} ${d.prenom || ''}`.trim(),
    }));

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 flex justify-between items-center text-white">
                    <div>
                        <h3 className="text-xl font-bold">Ouvrir un dossier de visite</h3>
                        <p className="text-blue-100 text-xs">
                            Patient : {patient.nom} {patient.prenom}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && <Alert message={error} type="error" showIcon className="rounded-xl" />}
                    {doctorsError && (
                        <Alert
                            message={doctorsError}
                            type="warning"
                            showIcon
                            icon={<AlertTriangle className="w-4 h-4" />}
                            className="rounded-xl"
                        />
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Stethoscope className="w-4 h-4 text-blue-500" />
                            Motif de la visite <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.motif}
                            onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] transition-all"
                            placeholder="Ex: Fièvre persistante, Consultation de routine..."
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-500" />
                            Médecin disponible
                            <span className="text-gray-400 font-normal text-xs">(optionnel)</span>
                        </label>
                        <Select
                            className="w-full"
                            placeholder={
                                doctors.length
                                    ? "Sélectionner un médecin"
                                    : "Aucun médecin chargé — visite possible sans"
                            }
                            value={formData.id_medecin || undefined}
                            allowClear
                            onChange={(val) => setFormData({ ...formData, id_medecin: val || '' })}
                            options={doctorOptions}
                            size="large"
                            notFoundContent="Aucun médecin — confirmez quand même la visite"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            La sélection oriente le patient ; la visite est enregistrée même sans médecin.
                        </p>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <CheckCircle className="w-5 h-5" />
                            {isSubmitting ? "Création…" : "Confirmer la visite"}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all"
                        >
                            Annuler
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
