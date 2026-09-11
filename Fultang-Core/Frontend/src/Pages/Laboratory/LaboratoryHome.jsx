import React, { useState } from 'react';
import { LaboratoryDashboard } from "./Components/LaboratoryDashboard.jsx";
import { LaboratoryHeader } from "./Components/LaboratoryHeader.jsx";
import { LaboratoryNavLink } from "./LaboratoryNavLink.js";
import { AlertTriangle, Search, LayoutDashboard } from "lucide-react";
import { useLaboratoryData } from "../../hooks/useLaboratoryData";
import './LaboratoryStyles.css';
import { APP_NAME, brandFooter } from '../../constants/branding.js';

export const LaboratoryHome = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("name");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const { patients, exams, analysePatients, resultPatients, isLoading, error } = useLaboratoryData();

  // Prepare dynamic queue data
  const queueData = analysePatients.map(p => {
    const pExams = (exams[p.id] || []).filter(e => e.status === 'en_attente');
    const examNames = pExams.map(e => e.name).join(' + ');
    const dr = pExams[0]?.medecin || p.info?.split(' · ')[1] || '';
    return {
      id: p.mat,
      name: p.fullName,
      statusText: `${examNames} ${dr ? '· ' + dr : ''}`,
      time: "En cours",
      dotColor: p.urgency ? "bg-red-500" : "bg-amber-500"
    };
  });

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const filteredQueue = queueData.filter(patient => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    if (searchFilter === "name") {
      return patient.name.toLowerCase().includes(query);
    } else if (searchFilter === "id") {
      return patient.id.toLowerCase().includes(query);
    }
    return true;
  });

  const totalItems = filteredQueue.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const currentItems = filteredQueue.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Prepare dynamic realised data
  const realisedData = resultPatients.map(p => {
    const pExams = (exams[p.id] || []).filter(e => e.status === 'realise');
    const examNames = pExams.map(e => e.name).join(' + ');
    return {
      id: p.mat,
      name: p.fullName,
      statusText: `${examNames} · Résultat transmis`,
      time: "Réalisé",
      dotColor: "bg-emerald-500"
    };
  });

  // Calculate Metrics
  const allExams = Object.values(exams).flat();
  const totalExams = allExams.length;
  const pendingExams = allExams.filter(e => e.status === 'en_attente').length;
  const doneExams = allExams.filter(e => e.status === 'realise').length;
  const criticalExams = allExams.filter(e => e.isWarn).length;
  const urgentPatients = patients.filter(p => p.urgency).length;

  return (
    <LaboratoryDashboard linkList={LaboratoryNavLink} requiredRole="laboratory-assistant" requiredFunctionalService="LABORATOIRE">
      <div className="bg-[#f5f5f5] text-[#1a1a1a] min-h-screen p-8 flex flex-col gap-8 overflow-y-auto scrollbar">
        
        {/* EN-TÊTE DYNAMIQUE */}
        <LaboratoryHeader 
          icon={LayoutDashboard}
          title="Tableau de Bord Laboratoire" 
          subtitle="Vue d'ensemble des examens du jour, alertes et statuts." 
          tagText={`Laboratoire ${APP_NAME} Actif`}
        />

        {isLoading && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-sm">
            Chargement des données du tableau de bord...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-500 text-sm">
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* CARTES DE MÉTRIQUES */}
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2 shadow-sm transition-transform hover:-translate-y-0.5">
                  <span className="text-sm font-medium text-slate-600 leading-tight">Examens<br />du jour</span>
                  <div>
                    <span className="text-2xl font-bold text-slate-900 block leading-none">{totalExams}</span>
                    <span className="text-xs font-medium text-primary-end mt-1 block">Total</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2 shadow-sm transition-transform hover:-translate-y-0.5">
                  <span className="text-sm font-medium text-slate-600 leading-tight">EN_ATTENTE</span>
                  <div>
                    <span className="text-2xl font-bold text-amber-600 block leading-none">{pendingExams}</span>
                    <span className="text-xs text-slate-500 mt-1 block">à traiter</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2 shadow-sm transition-transform hover:-translate-y-0.5">
                  <span className="text-sm font-medium text-slate-600 leading-tight">REALISE</span>
                  <div>
                    <span className="text-2xl font-bold text-primary-end block leading-none">{doneExams}</span>
                    <span className="text-xs text-slate-500 mt-1 block">résultats transmis</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2 shadow-sm transition-transform hover:-translate-y-0.5">
                  <span className="text-sm font-medium text-slate-600 leading-tight">Valeurs<br />critiques</span>
                  <div>
                    <span className="text-2xl font-bold text-red-600 block leading-none">{criticalExams}</span>
                    <span className="text-xs text-slate-500 mt-1 block">à notifier</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2 shadow-sm transition-transform hover:-translate-y-0.5">
                  <span className="text-sm font-medium text-slate-600 leading-tight">Urgences</span>
                  <div>
                    <span className="text-2xl font-bold text-slate-900 block leading-none">{urgentPatients}</span>
                    <span className="text-xs text-slate-500 mt-1 block">dossiers</span>
                  </div>
                </div>
              </div>

              {criticalExams > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg py-3 px-4 flex items-center gap-3 mt-1">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <div className="text-sm font-medium text-red-700">
                    <strong className="block mb-0.5">{criticalExams} Résultat(s) d'examen(s) avec valeurs critiques — notification prescripteur recommandée</strong>
                  </div>
                </div>
              )}
            </div>

            {/* FILE D'ATTENTE EN_ATTENTE */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
              <div className="border-b border-slate-200 pb-4 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-sm font-medium text-slate-500 shrink-0">File d'attente — Examens EN_ATTENTE</h3>

                {/* CONTRÔLES DE RECHERCHE */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={handleSearchChange}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-end/30 focus:border-primary-end transition-all"
                    />
                  </div>
                  <div className="relative w-full sm:w-auto">
                    <select
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full sm:w-auto appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-end/30 focus:border-primary-end transition-all cursor-pointer">
                      <option value="name">Par nom</option>
                      <option value="id">Par matricule</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col">
                {currentItems.length > 0 ? (
                  currentItems.map((patient, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors -mx-6 px-6 cursor-pointer gap-2 sm:gap-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${patient.dotColor} shrink-0`}></div>
                        <span className="font-semibold text-slate-900 text-sm">{patient.name}</span>
                        <span className="text-slate-500 text-xs font-medium">· {patient.id}</span>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 text-sm w-full sm:w-auto">
                        <span className="text-slate-600 truncate ml-5 sm:ml-0">{patient.statusText}</span>
                        <span className="text-slate-400 text-xs w-16 text-right shrink-0">{patient.time}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-500 text-sm">
                    Aucun examen en attente trouvé.
                  </div>
                )}
              </div>

              {/* PAGINATION */}
              {totalItems > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-200 pt-4 mt-2 gap-4">
                  <span className="text-sm text-slate-500">
                    Affichage de <span className="font-medium text-slate-900">{startItem}</span> à <span className="font-medium text-slate-900">{endItem}</span> sur <span className="font-medium text-slate-900">{totalItems}</span> résultats
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={`px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg transition-colors ${currentPage === 1 ? 'text-slate-400 bg-slate-50 cursor-not-allowed' : 'text-slate-600 bg-white hover:bg-slate-50'}`}
                    >
                      Précédent
                    </button>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 flex items-center justify-center text-sm font-medium rounded-lg transition-colors ${currentPage === page ? 'text-white bg-[#185FA5]' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        {page}
                      </button>
                    ))}

                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg transition-colors ${currentPage === totalPages ? 'text-slate-400 bg-slate-50 cursor-not-allowed' : 'text-slate-600 bg-white hover:bg-slate-50'}`}
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* EXAMENS RECEMMENT REALISES */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
              <div className="border-b border-slate-200 pb-4 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-sm font-medium text-slate-500 shrink-0">Examens récemment REALISE</h3>
              </div>
              <div className="flex flex-col">
                {realisedData.length > 0 ? (
                  realisedData.map((patient, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors -mx-6 px-6 cursor-pointer gap-2 sm:gap-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${patient.dotColor} shrink-0`}></div>
                        <span className="font-semibold text-slate-900 text-sm">{patient.name}</span>
                        <span className="text-slate-500 text-xs font-medium">· {patient.id}</span>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 text-sm w-full sm:w-auto">
                        <span className="text-slate-600 truncate ml-5 sm:ml-0">{patient.statusText}</span>
                        <span className="text-slate-400 text-xs w-16 text-right shrink-0">{patient.time}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-500 text-sm">
                    Aucun examen réalisé trouvé.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </LaboratoryDashboard>
  );
};

export default LaboratoryHome;
