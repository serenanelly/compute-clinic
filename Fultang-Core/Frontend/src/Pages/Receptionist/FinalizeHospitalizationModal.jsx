import React, { useState, useEffect } from 'react';
import { Modal, Select, Alert, Spin } from 'antd';
import { 
    XIcon, 
    BedDouble, 
    User, 
    Stethoscope, 
    Home, 
    CheckCircle2, 
    MapPin,
    Calendar,
    ArrowRight
} from "lucide-react";
import axiosInstance from "../../Utils/axiosInstance";
import { getGatewayBaseUrl } from "../../Utils/gatewayUrls.js";
import dayjs from "dayjs";

export const FinalizeHospitalizationModal = ({ isOpen, onClose, hospitalization, onFinalized }) => {
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (isOpen && hospitalization?.service) {
            fetchRooms();
            setSelectedRoom(null);
            setError(null);
            setShowSuccess(false);
        }
    }, [isOpen, hospitalization]);

    const fetchRooms = async () => {
        setIsLoadingRooms(true);
        try {
            const gatewayUrl = getGatewayBaseUrl();
            const response = await axiosInstance.get(`${gatewayUrl}/infrastructure/salles/`);
            const raw = response.data;
            const allRooms = Array.isArray(raw) ? raw : (raw?.results || []);

            // Filter rooms that belong to this hospitalization's service and are DISPONIBLE
            const filteredRooms = allRooms.filter(r =>
                (!hospitalization?.service || r.service_nom === hospitalization.service) &&
                r.statut === 'DISPONIBLE'
            );
            setRooms(filteredRooms);
        } catch (err) {
            console.error("Erreur chargement chambres:", err);
            setError("Impossible de charger les chambres disponibles.");
            setRooms([]);
        } finally {
            setIsLoadingRooms(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedRoom) {
            setError("Veuillez choisir une chambre.");
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            await axiosInstance.post(`/hospitalisations/${hospitalization.id}/assigner-chambre/`, {
                room_id: selectedRoom,
            });
            
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                if (onFinalized) onFinalized();
                onClose();
            }, 1500);
        } catch (err) {
            setError("Une erreur est survenue lors de la finalisation.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!hospitalization) return null;

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            footer={null}
            closeIcon={null}
            width={700}
            centered
            className="custom-modal-hospitalization"
            styles={{
                mask: { backdropFilter: 'blur(8px)', background: 'rgba(255, 255, 255, 0.4)' },
                content: { borderRadius: '2.5rem', padding: 0, overflow: 'hidden' }
            }}
        >
            <div className="relative overflow-hidden bg-white">
                {/* Header Gradient */}
                <div className="bg-gradient-to-r from-primary-start to-primary-end p-8 flex justify-between items-center text-white">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner">
                            <BedDouble className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight uppercase leading-none mb-1">
                                Finaliser l'Admission
                            </h2>
                            <p className="text-xs font-bold text-blue-50/80 italic tracking-wide">Attribution de chambre et validation finale</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-3 hover:bg-white/10 rounded-full transition-all"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-10">

                    {error && (
                        <Alert 
                            message={error} 
                            type="error" 
                            showIcon 
                            className="mb-8 rounded-2xl font-bold border-red-100 bg-red-50 text-red-600 p-4" 
                        />
                    )}

                    <form onSubmit={handleSubmit} className="space-y-8 relative">
                        {/* Infos Immuables */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <User className="w-3 h-3" /> Patient
                                </label>
                                <div className="text-sm font-black text-gray-900 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-[10px] text-gray-400">#{hospitalization.id_patient}</div>
                                    {hospitalization.patient_details?.nom} {hospitalization.patient_details?.prenom}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Calendar className="w-3 h-3" /> Décision prise le
                                </label>
                                <div className="text-sm font-bold text-gray-600 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                    {dayjs(hospitalization.date_decision).format('DD MMMM YYYY à HH:mm')}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Stethoscope className="w-3 h-3" /> Médecin référent
                                </label>
                                <div className="text-sm font-black text-primary-end bg-primary-end/5 p-4 rounded-2xl border border-primary-end/10 shadow-sm flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                                        <Stethoscope className="w-4 h-4" />
                                    </div>
                                    {hospitalization.medecin_details?.nom} {hospitalization.medecin_details?.prenom}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <MapPin className="w-3 h-3" /> Service d'accueil
                                </label>
                                <div className="text-sm font-black text-primary-end bg-primary-end/5 p-4 rounded-2xl border border-primary-end/10 shadow-sm flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                                        <MapPin className="w-4 h-4" />
                                    </div>
                                    {hospitalization.service || "Service N/A"}
                                </div>
                            </div>
                        </div>

                        {/* Choix de la chambre */}
                        <div className="space-y-4">
                            <label htmlFor="room-select" className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 px-2">
                                <Home className="w-4 h-4 text-primary-end" /> Choisir une chambre disponible <span className="text-red-500">*</span>
                            </label>
                            
                            <Select
                                id="room-select"
                                data-testid="room-select"
                                className="w-full h-16"
                                placeholder={isLoadingRooms ? "Chargement des chambres..." : "Sélectionner un lit..."}
                                loading={isLoadingRooms}
                                disabled={isLoadingRooms || isSubmitting}
                                value={selectedRoom}
                                onChange={setSelectedRoom}
                                dropdownStyle={{ borderRadius: '1.5rem', padding: '0.5rem' }}
                                size="large"
                            >
                                {rooms.map(room => (
                                    <Select.Option key={room.id} value={room.id}>
                                        <div className="flex justify-between items-center py-1">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center">
                                                    <BedDouble className="w-4 h-4 text-gray-400" />
                                                </div>
                                                <span className="font-black text-gray-900">Salle {room.nom}</span>
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-tighter bg-primary-end/10 text-primary-end px-3 py-1 rounded-full">
                                                {room.type_salle_details?.nom || room.type_salle || "Chambre"}
                                            </span>
                                        </div>
                                    </Select.Option>
                                ))}
                            </Select>
                            
                            {rooms.length === 0 && !isLoadingRooms && (
                                <p className="text-xs font-bold text-red-500 bg-red-50 p-4 rounded-2xl flex items-center gap-2 border border-red-100">
                                    <XIcon className="w-4 h-4" /> Aucune chambre disponible dans ce service pour le moment.
                                </p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-5 rounded-3xl font-black text-gray-400 hover:bg-gray-100 transition-all uppercase text-xs tracking-widest border border-transparent"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                data-testid="submit-admission"
                                disabled={isSubmitting || !selectedRoom}
                                className="flex-2 bg-gradient-to-r from-primary-start to-primary-end text-white py-5 px-10 rounded-3xl font-black shadow-xl shadow-primary-end/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 uppercase text-xs tracking-widest min-w-[280px]"
                            >
                                {isSubmitting ? (
                                    <Spin size="small" className="white-spin" />
                                ) : (
                                    <>
                                        Valider l'admission <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Success Overlay */}
                        {showSuccess && (
                            <div data-testid="success-overlay" className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in zoom-in-95 duration-300 rounded-3xl -m-4">
                                <CheckCircle2 className="w-20 h-20 text-green-500 mb-4 animate-bounce" />
                                <h4 className="text-2xl font-bold text-gray-900">Admission Validée !</h4>
                                <p className="text-gray-500 italic font-medium">Le patient a été admis en chambre {rooms.find(r => r.id === selectedRoom)?.numero}.</p>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </Modal>
    );
};
