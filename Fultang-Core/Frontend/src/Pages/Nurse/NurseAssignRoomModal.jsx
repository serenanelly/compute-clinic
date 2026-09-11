import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axiosInstance from '../../Utils/axiosInstance.js';
import { getGatewayBaseUrl } from '../../Utils/gatewayUrls.js';
import { BedDouble, X, Home, MapPin, CheckCircle2 } from 'lucide-react';
import { Loading } from '../../GlobalComponents/Loading.jsx';

export default function NurseAssignRoomModal({ isOpen, onClose, hospitalization, onAssigned }) {
    NurseAssignRoomModal.propTypes = {
        isOpen: PropTypes.bool.isRequired,
        onClose: PropTypes.func.isRequired,
        hospitalization: PropTypes.object,
        onAssigned: PropTypes.func,
    };

    const [rooms, setRooms] = useState([]);
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [selectedLit, setSelectedLit] = useState('');
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (!isOpen || !hospitalization) return;
        setSelectedRoomId('');
        setSelectedLit('');
        setError('');
        setShowSuccess(false);
        fetchRooms();
    }, [isOpen, hospitalization?.id]);

    const fetchRooms = async () => {
        setIsLoadingRooms(true);
        try {
            const response = await axiosInstance.get(`${getGatewayBaseUrl()}/infrastructure/salles/`);
            const raw = response.data;
            const allRooms = Array.isArray(raw) ? raw : (raw?.results || []);
            const service = hospitalization?.service;
            const filtered = allRooms.filter((r) => {
                const disponible = r.statut === 'DISPONIBLE' && (r.nb_places_disponibles ?? r.capacite ?? 0) > 0;
                if (!disponible) return false;
                if (!service) return true;
                return r.service_nom === service || String(r.service) === String(service);
            });
            setRooms(filtered);
        } catch (err) {
            console.error('Erreur chargement salles:', err);
            setError('Impossible de charger les salles disponibles.');
            setRooms([]);
        } finally {
            setIsLoadingRooms(false);
        }
    };

    const selectedRoom = rooms.find((r) => String(r.id) === String(selectedRoomId));
    const litCount = selectedRoom
        ? Math.max(
            1,
            selectedRoom.nb_places_disponibles
                ?? selectedRoom.nb_lits
                ?? selectedRoom.capacite
                ?? 1,
        )
        : 0;
    const litOptions = Array.from({ length: litCount }, (_, i) => String(i + 1));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedRoomId) {
            setError('Veuillez choisir une salle.');
            return;
        }
        if (!selectedLit) {
            setError('Veuillez choisir un lit.');
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            await axiosInstance.post(`/hospitalisations/${hospitalization.id}/assigner-chambre/`, {
                room_id: selectedRoomId,
                numero_lit: selectedLit,
            });
            setShowSuccess(true);
            setTimeout(async () => {
                setShowSuccess(false);
                if (onAssigned) await onAssigned();
                onClose();
            }, 1200);
        } catch (err) {
            setError(err.response?.data?.error || 'Impossible d\'affecter la salle et le lit.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !hospitalization) return null;

    const inputClass = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-start outline-none text-sm';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="bg-gradient-to-r from-primary-start to-primary-end p-6 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <BedDouble className="w-6 h-6" />
                            Affecter salle et lit
                        </h3>
                        <p className="text-sm opacity-90 mt-1">
                            {hospitalization.patient?.nom} {hospitalization.patient?.prenom}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-white/20 rounded-full">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {showSuccess ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-3">
                        <CheckCircle2 className="w-16 h-16 text-green-500" />
                        <p className="font-bold text-gray-800">Affectation enregistrée</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {error && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        {hospitalization.service && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">
                                <MapPin className="w-4 h-4 text-primary-start" />
                                Service : <span className="font-bold">{hospitalization.service}</span>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                <Home className="w-3.5 h-3.5 inline mr-1" />
                                Salle
                            </label>
                            {isLoadingRooms ? (
                                <div className="py-6 flex justify-center"><Loading /></div>
                            ) : (
                                <select
                                    value={selectedRoomId}
                                    onChange={(e) => {
                                        setSelectedRoomId(e.target.value);
                                        setSelectedLit('');
                                    }}
                                    className={inputClass}
                                >
                                    <option value="">— Choisir une salle —</option>
                                    {rooms.map((room) => (
                                        <option key={room.id} value={room.id}>
                                            {room.nom || `Salle ${room.numero}`}
                                            {room.service_nom ? ` (${room.service_nom})` : ''}
                                            {' — '}
                                            {room.nb_places_disponibles ?? room.nb_lits ?? room.capacite ?? '?'} place(s)
                                        </option>
                                    ))}
                                </select>
                            )}
                            {!isLoadingRooms && rooms.length === 0 && (
                                <p className="text-xs text-amber-700 mt-2">Aucune salle disponible pour ce service.</p>
                            )}
                        </div>

                        {selectedRoomId && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                    <BedDouble className="w-3.5 h-3.5 inline mr-1" />
                                    Lit
                                </label>
                                <select
                                    value={selectedLit}
                                    onChange={(e) => setSelectedLit(e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">— Choisir un lit —</option>
                                    {litOptions.map((lit) => (
                                        <option key={lit} value={lit}>Lit {lit}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !selectedRoomId || !selectedLit}
                                className="flex-1 py-3 bg-gradient-to-r from-primary-start to-primary-end text-white font-bold rounded-xl disabled:opacity-50"
                            >
                                {isSubmitting ? 'Enregistrement…' : 'Confirmer l\'affectation'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
