import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { doctorNavLink } from "./lib/doctorNavLink.js";
import { DoctorNavBar } from "./DoctorComponents/DoctorNavBar.jsx";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { doctorApi } from "../../services/doctorApi.js";
import { Calendar, Clock, User, MessageSquare, Plus, CalendarDays } from 'lucide-react';
import { STATUT_CONFIG, isOverdue } from "../../Utils/statutRdv.js";

const StatutBadge = ({ statut }) => {
    const cfg = STATUT_CONFIG[statut] || { label: statut || '—', color: 'bg-gray-50 text-gray-600 border-gray-200' };
    return <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase ${cfg.color}`}>{cfg.label}</span>;
};

export const AppointmentList = () => {
    const [appointments, setAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("TOUS");
    const [timeFilter, setTimeFilter] = useState("TODAY");

    useEffect(() => {
        loadAppointments();
    }, []);

    const loadAppointments = async () => {
        try {
            setIsLoading(true);
            const data = await doctorApi.getAppointments();
            setAppointments(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // Vérifie si un RDV est dépassé (heure passée et toujours PROGRAMME)
    const isOverdue = (apt) => {
        return apt.statut === 'PROGRAMME' && new Date(apt.date_heure) < new Date();
    };

    const isToday = (dateStr) => {
        const d = new Date(dateStr);
        const today = new Date();
        return d.getFullYear() === today.getFullYear() &&
               d.getMonth() === today.getMonth() &&
               d.getDate() === today.getDate();
    };

    const isThisWeek = (dateStr) => {
        const d = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        return d >= today && d <= nextWeek;
    };

    const filteredAppointments = appointments.filter(apt => {
        const matchesStatus = statusFilter === "TOUS" ? true : apt.statut === statusFilter;
        let matchesTime = true;
        if (timeFilter === "TODAY") matchesTime = isToday(apt.date_heure);
        else if (timeFilter === "WEEK") matchesTime = isThisWeek(apt.date_heure);
        return matchesStatus && matchesTime;
    });

    return (
        <CustomDashboard linkList={doctorNavLink} requiredRole="medecin">
            <DoctorNavBar>
                <div className="p-6 h-[calc(100vh-100px)] flex flex-col bg-gray-50/50 overflow-y-auto scrollbar">
                    
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                                <Calendar className="w-7 h-7 mr-2 text-primary-start" />
                                Planning des Rendez-vous
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">Vos consultations programmées</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
                                {["TODAY", "WEEK", "ALL"].map(t => (
                                    <button key={t} onClick={() => setTimeFilter(t)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeFilter === t ? 'bg-primary-start text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>
                                        {t === 'TODAY' ? "Aujourd'hui" : t === 'WEEK' ? 'Cette semaine' : 'Tout voir'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Status Tabs */}
                    <div className="flex space-x-4 mb-6">
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

                    {/* List */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1">
                        {isLoading ? <div className="flex justify-center items-center h-64"><Loading /></div> : (
                            <div className="divide-y divide-gray-100">
                                {filteredAppointments.length === 0 ? (
                                    <div className="p-16 text-center">
                                        <CalendarDays className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                        <p className="text-gray-500 font-medium">Aucun rendez-vous pour cette période.</p>
                                    </div>
                                ) : (
                                    filteredAppointments.map((apt) => (
                                        <div key={apt.id} className="p-5 hover:bg-gray-50 transition-colors group">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex flex-col items-center justify-center border border-blue-100">
                                                        <Clock className="w-3.5 h-3.5 text-primary-start mb-0.5" />
                                                        <span className="text-xs font-bold text-primary-start">{new Date(apt.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-gray-800">{apt.patient.nom} {apt.patient.prenom}</h4>
                                                        <p className="text-sm text-gray-500 flex items-center mt-0.5">
                                                            <MessageSquare className="w-3 h-3 mr-1" /> {apt.motif}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {isOverdue(apt) && (
                                                        <span className="px-3 py-1 rounded-full text-[10px] font-bold border bg-orange-50 text-orange-700 border-orange-200 uppercase">En retard</span>
                                                    )}
                                                    <StatutBadge statut={apt.statut} />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </DoctorNavBar>
        </CustomDashboard>
    );
};

export default AppointmentList;
