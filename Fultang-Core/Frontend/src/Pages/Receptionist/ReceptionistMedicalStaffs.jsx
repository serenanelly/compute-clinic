import React, { useState } from 'react';
import { DashBoard } from '../../GlobalComponents/DashBoard';
import { ReceptionistNavBar } from './ReceptionistNavBar';
import { receptionistNavLink } from './receptionistNavLink';
import { Users, Search, Stethoscope, Phone, Mail, Clock, MapPin, Activity } from 'lucide-react';
import { Tag } from 'antd';

export const ReceptionistMedicalStaffs = () => {
    const [searchQuery, setSearchQuery] = useState("");

    const mockStaffs = [
        { id: "M-001", nom: "Kameni", prenom: "Marc", role: "Médecin Généraliste", specialite: "Médecine Générale", contact: "+237 690 123 456", email: "m.kameni@computeclinic.cm", statut: "DISPONIBLE", garde: "08:00 - 18:00" },
        { id: "M-002", nom: "Ndongo", prenom: "Sylvie", role: "Médecin Spécialiste", specialite: "Pédiatrie", contact: "+237 671 234 567", email: "s.ndongo@computeclinic.cm", statut: "EN CONSULTATION", garde: "09:00 - 17:00" },
        { id: "M-003", nom: "Awono", prenom: "Luc", role: "Médecin Spécialiste", specialite: "Cardiologie", contact: "+237 692 345 678", email: "l.awono@computeclinic.cm", statut: "INDISPONIBLE", garde: "10:00 - 19:00" },
        { id: "I-001", nom: "Mbia", prenom: "Cécile", role: "Infirmier", specialite: "Urgences", contact: "+237 673 456 789", email: "c.mbia@computeclinic.cm", statut: "DISPONIBLE", garde: "00:00 - 08:00" },
        { id: "I-002", nom: "Fouda", prenom: "Joseph", role: "Infirmier", specialite: "Soins Intensifs", contact: "+237 694 567 890", email: "j.fouda@computeclinic.cm", statut: "DISPONIBLE", garde: "08:00 - 16:00" }
    ];

    const filteredStaffs = mockStaffs.filter(s => 
        s.nom.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.prenom.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.specialite.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.role.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusColor = (statut) => {
        if (statut === 'DISPONIBLE') return 'success';
        if (statut === 'EN CONSULTATION') return 'processing';
        return 'error';
    };

    return (
        <DashBoard linkList={receptionistNavLink} requiredRole="RECEPTIONIST">
            <ReceptionistNavBar>
            <div className="p-8 pb-20">
                {/* En-tête */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                            <Activity className="w-7 h-7 mr-2 text-primary-start" />
                            Personnel Médical
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Annuaire et disponibilités des équipes</p>
                    </div>
                </div>

                {/* Barre de Recherche */}
                <div className="relative mb-10 group">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-start/5 to-primary-end/5 rounded-[2rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
                    <input 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        className="w-full pl-16 pr-6 py-5 bg-white border border-gray-100 rounded-[2rem] shadow-sm outline-none focus:ring-4 focus:ring-primary-start/10 transition-all text-gray-700 font-bold placeholder:text-gray-300" 
                        placeholder="Rechercher un médecin, un infirmier, une spécialité..." 
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredStaffs.map(staff => (
                        <div key={staff.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all p-6 group">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex gap-4 items-center">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-start to-primary-end flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary-start/20">
                                        {staff.nom[0]}{staff.prenom[0]}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-gray-900 text-lg leading-tight">Dr. {staff.nom} {staff.prenom}</h3>
                                        <span className="text-xs font-bold text-gray-400 tracking-wider uppercase">{staff.role}</span>
                                    </div>
                                </div>
                                <Tag color={getStatusColor(staff.statut)} className="rounded-lg font-black text-[9px] border-none px-2 uppercase tracking-tighter m-0">
                                    {staff.statut}
                                </Tag>
                            </div>

                            <div className="space-y-3 mb-6 bg-gray-50/50 p-4 rounded-[1.5rem] border border-gray-50">
                                <div className="flex items-center gap-3 text-sm font-bold text-gray-600">
                                    <Stethoscope className="w-4 h-4 text-primary-end" />
                                    <span>{staff.specialite}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm font-bold text-gray-600">
                                    <Clock className="w-4 h-4 text-primary-start" />
                                    <span>Garde : <span className="text-gray-900">{staff.garde}</span></span>
                                </div>
                                <div className="flex items-center gap-3 text-sm font-bold text-gray-600">
                                    <Phone className="w-4 h-4 text-green-500" />
                                    <span>{staff.contact}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm font-bold text-gray-600">
                                    <Mail className="w-4 h-4 text-blue-400" />
                                    <span className="truncate">{staff.email}</span>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button className="text-primary-start bg-primary-start/5 hover:bg-primary-start hover:text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2 w-full justify-center">
                                    <Phone className="w-3.5 h-3.5" />
                                    Contacter
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredStaffs.length === 0 && (
                    <div className="py-24 text-center bg-white rounded-[3rem] border border-dashed border-gray-200 mt-6">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6"><Users className="w-10 h-10 text-gray-200" /></div>
                        <h3 className="font-black text-gray-300 uppercase tracking-widest">Aucun personnel trouvé</h3>
                    </div>
                )}
            </div>
            </ReceptionistNavBar>
        </DashBoard>
    );
};

export default ReceptionistMedicalStaffs;
