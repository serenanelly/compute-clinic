import React, { useState, useEffect } from 'react';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { specialistNavLink } from "./lib/specialistNavLink.js";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { doctorApi } from "../../services/doctorApi.js";
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { STATUT_CONFIG, isOverdue } from "../../Utils/statutRdv.js";

const StatutBadge = ({ statut }) => {
    const cfg = STATUT_CONFIG[statut] || { label: statut || '—', color: 'bg-gray-50 text-gray-600 border-gray-200' };
    return <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase ${cfg.color}`}>{cfg.label}</span>;
};

export const SpecialistAppointments = () => {
    const [appointments, setAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        try {
            setIsLoading(true);
            const data = await doctorApi.getAppointments();
            
            // On conserve les rendez-vous confirmés ou en attente
            setAppointments(data);
        } catch (error) {
            console.error("Failed to fetch appointments", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Vérifie si un RDV est dépassé (heure passée et toujours PROGRAMME)
    const isOverdue = (apt) => {
        return apt.statut === 'PROGRAMME' && new Date(apt.date_heure) < new Date();
    };

    // Filter appointments for today
    const getTodayAppointments = () => {
        const today = new Date();
        return appointments.filter(a => {
            const aptDate = new Date(a.date_heure);
            return aptDate.getDate() === today.getDate() && aptDate.getMonth() === today.getMonth();
        }).sort((a,b) => new Date(a.date_heure) - new Date(b.date_heure));
    };

    // Filter appointments for the week
    const getWeekAppointments = () => {
        return appointments.sort((a,b) => new Date(a.date_heure) - new Date(b.date_heure));
    };

    const handleEventClick = (apt) => {
        const timeStr = new Date(apt.date_heure).toLocaleString('fr-FR');
        alert(`Patient: ${apt.patient?.nom} ${apt.patient?.prenom}\nHeure: ${timeStr}\nMotif: ${apt.motif}\nType: ${apt.type_consultation}\nStatut: ${apt.statut}`);
    };

    return (
        <CustomDashboard linkList={specialistNavLink} requiredRole="medecin_specialiste">
            <div className="p-6 h-[calc(100vh-60px)] flex flex-col bg-gray-50/50">
                
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                            <CalendarIcon className="w-7 h-7 mr-2 text-purple-600" />
                            Mon Agenda
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Gérez vos rendez-vous de suivi et nouvelles consultations</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex-1 flex justify-center items-center"><Loading /></div>
                ) : (
                    <div className="flex gap-6 flex-1 overflow-hidden">
                        
                        {/* Custom Simple Calendar Area */}
                        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-y-auto scrollbar">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-gray-800 text-lg">Prochains rendez-vous</h3>
                                <div className="flex items-center gap-2">
                                    <button className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"><ChevronLeft className="w-5 h-5 text-gray-500" /></button>
                                    <span className="font-medium text-sm text-gray-600">Cette semaine</span>
                                    <button className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"><ChevronRight className="w-5 h-5 text-gray-500" /></button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {getWeekAppointments().length === 0 ? (
                                    <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                                        <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>Aucun rendez-vous planifié</p>
                                    </div>
                                ) : (
                                    getWeekAppointments().map(apt => (
                                        <div 
                                            key={apt.id} 
                                            onClick={() => handleEventClick(apt)}
                                            className="flex items-center justify-between p-4 bg-purple-50/50 hover:bg-purple-50 border border-purple-100 rounded-xl cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col items-center justify-center w-14 h-14 bg-white rounded-lg border border-purple-200 shadow-sm text-purple-700">
                                                    <span className="text-xs font-bold uppercase">{new Date(apt.date_heure).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                                                    <span className="text-xl font-bold leading-none">{new Date(apt.date_heure).getDate()}</span>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-800 text-lg">{apt.patient?.nom} {apt.patient?.prenom}</h4>
                                                    <div className="flex items-center text-sm text-gray-500 mt-1">
                                                        <Clock className="w-3.5 h-3.5 mr-1 text-purple-500" />
                                                        {new Date(apt.date_heure).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                                                        <span className="mx-2">•</span>
                                                        <span className="text-gray-600">{apt.motif}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                {isOverdue(apt) && (
                                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">En retard</span>
                                                )}
                                                <StatutBadge statut={apt.statut} />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        
                        {/* Today's Summary */}
                        <div className="w-80 flex flex-col gap-4">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                                    <Clock className="w-5 h-5 mr-2 text-purple-600" />
                                    Aujourd'hui
                                </h3>
                                
                                {getTodayAppointments().length === 0 ? (
                                    <p className="text-gray-400 text-sm italic text-center py-4">Aucun rendez-vous prévu aujourd'hui</p>
                                ) : (
                                    <div className="space-y-3">
                                        {getTodayAppointments().map(apt => (
                                            <div key={apt.id} className="p-3 border rounded-lg hover:border-purple-300 transition-colors bg-gray-50">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-gray-800 text-sm">
                                                        {new Date(apt.date_heure).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                                                    </span>
                                                    <div className="flex flex-col items-end gap-1">
                                                        {isOverdue(apt) && (
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-orange-100 text-orange-700">En retard</span>
                                                        )}
                                                        <StatutBadge statut={apt.statut} />
                                                    </div>
                                                </div>
                                                <p className="font-semibold text-gray-700 text-sm truncate">{apt.patient?.nom} {apt.patient?.prenom}</p>
                                                <p className="text-xs text-gray-500 truncate mt-0.5">{apt.motif}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                    </div>
                )}
            </div>
        </CustomDashboard>
    );
};

export default SpecialistAppointments;
