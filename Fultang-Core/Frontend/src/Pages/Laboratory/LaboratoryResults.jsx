import React, { useState } from 'react';
import { LaboratoryDashboard } from "./Components/LaboratoryDashboard.jsx";
import { LaboratoryHeader } from "./Components/LaboratoryHeader.jsx";
import { LaboratoryNavLink } from "./LaboratoryNavLink.js";
import { Filter, FileText, X, Loader2, CheckCircle } from "lucide-react";
import { useLaboratoryData } from "../../hooks/useLaboratoryData";
import './LaboratoryStyles.css';
import { APP_NAME, brandFooter } from '../../constants/branding.js';

export const LaboratoryResults = () => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [filters, setFilters] = useState({
    mat: '', nom: '', prenom: '', statut: '', nomex: '', prio: ''
  });

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value.toLowerCase() });
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ mat: '', nom: '', prenom: '', statut: '', nomex: '', prio: '' });
    setCurrentPage(1);
  };

  const { resultPatients, exams, validerResultat, isLoading, error, patients } = useLaboratoryData();

  const filteredPatients = resultPatients.filter(p => {
    return p.mat.toLowerCase().includes(filters.mat) &&
           p.nom.toLowerCase().includes(filters.nom) &&
           p.prenom.toLowerCase().includes(filters.prenom) &&
           (filters.nomex === '' || p.nomex === filters.nomex) &&
           (filters.prio === '' || p.prio === filters.prio);
  });

  const totalItems = filteredPatients.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const currentItems = filteredPatients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <LaboratoryDashboard linkList={LaboratoryNavLink} requiredRole="laboratory-assistant" requiredFunctionalService="LABORATOIRE">
      <div className="bg-[#f5f5f5] text-[#1a1a1a] min-h-screen p-8 flex flex-col gap-8 overflow-y-auto scrollbar">
        
        {/* EN-TÊTE DYNAMIQUE */}
        <LaboratoryHeader 
          icon={FileText}
          title="Résultats" 
          subtitle="Consultation des résultats générés et validation finale." 
          tagText={`Laboratoire ${APP_NAME} Actif`}
        />

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
          
          {/* HEADER AVEC BOUTON FILTRE */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-[#185FA5]">{totalItems} examen(s) affiché(s)</span>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showFilters 
                  ? 'bg-[#185FA5] text-white border border-[#185FA5]' 
                  : 'bg-white border border-slate-200 text-[#185FA5] hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filtres
            </button>
          </div>

          {/* FILTER BAR */}
          {showFilters && (
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 mb-6 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-[#185FA5] mb-1.5">Matricule patient</label>
                  <input 
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-[#185FA5] focus:ring-1 focus:ring-[#185FA5] placeholder:text-slate-400" 
                    name="mat" value={filters.mat} onChange={handleFilterChange} type="text" placeholder="ex. PAT-2026-04872" 
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-[#185FA5] mb-1.5">Nom</label>
                  <input 
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-[#185FA5] focus:ring-1 focus:ring-[#185FA5] placeholder:text-slate-400" 
                    name="nom" value={filters.nom} onChange={handleFilterChange} type="text" placeholder="ex. Mbarga" 
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-[#185FA5] mb-1.5">Prénom</label>
                  <input 
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-[#185FA5] focus:ring-1 focus:ring-[#185FA5] placeholder:text-slate-400" 
                    name="prenom" value={filters.prenom} onChange={handleFilterChange} type="text" placeholder="ex. Jean" 
                  />
                </div>
                <div>
                  <button 
                    className="px-5 py-2 bg-white text-slate-700 font-semibold border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors h-[38px] flex items-center justify-center" 
                    onClick={clearFilters}
                  >
                    Effacer
                  </button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-[#185FA5] mb-1.5">Statut examen</label>
                  <select 
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-[#185FA5] focus:ring-1 focus:ring-[#185FA5] opacity-50 cursor-not-allowed" 
                    name="statut" value="realise" disabled
                  >
                    <option value="realise">REALISE (Fixé)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-[#185FA5] mb-1.5">Type d'examen</label>
                  <select 
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-[#185FA5] focus:ring-1 focus:ring-[#185FA5]" 
                    name="nomex" value={filters.nomex} onChange={handleFilterChange}
                  >
                    <option value="">Tous types</option>
                    <option value="biochimie">Biochimie</option>
                    <option value="hematologie">Hématologie</option>
                    <option value="microbiologie">Microbiologie</option>
                    <option value="coagulation">Coagulation</option>
                    <option value="immunologie">Immunologie</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-[#185FA5] mb-1.5">Priorité (métier)</label>
                  <select 
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-[#185FA5] focus:ring-1 focus:ring-[#185FA5]" 
                    name="prio" value={filters.prio} onChange={handleFilterChange}
                  >
                    <option value="">Toutes les priorités</option>
                    <option value="urgence">Urgence</option>
                    <option value="standard">Standard</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-6">
            
            {isLoading && (
               <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl">
                 Chargement des résultats en cours...
               </div>
            )}
            
            {error && (
               <div className="py-8 text-center text-red-500 text-sm border border-dashed border-red-200 bg-red-50 rounded-xl">
                 {error}
               </div>
            )}

            {/* LISTE DES PATIENTS */}
            {!isLoading && !error && (
            <div className="w-full flex flex-col gap-3">
              {currentItems.length > 0 ? currentItems.map(p => (
                <div 
                  key={p.id} 
                  className={`bg-white border rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between cursor-pointer transition-all ${
                    selectedPatient === p.id 
                      ? 'border-[#185FA5] ring-1 ring-[#185FA5] shadow-sm' 
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`} 
                  onClick={() => setSelectedPatient(p.id === selectedPatient ? null : p.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      p.avatarColor === 'av-blue' ? 'bg-blue-50 text-[#185FA5]' :
                      p.avatarColor === 'av-coral' ? 'bg-red-50 text-red-600' :
                      p.avatarColor === 'av-teal' ? 'bg-teal-50 text-teal-600' :
                      p.avatarColor === 'av-amber' ? 'bg-amber-50 text-amber-600' :
                      'bg-purple-50 text-purple-600'
                    }`}>
                      {p.initials}
                    </div>
                    <div className="flex flex-col">
                      <p className="font-semibold text-slate-900 text-sm">
                        {p.fullName}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{p.mat} · {p.info}</p>
                    </div>
                  </div>
                  
                  <div className="mt-3 xl:mt-0 xl:ml-4 flex items-center justify-end shrink-0">
                    {p.urgency ? (
                       <span className="px-3 py-1 bg-red-50 text-red-600 border border-red-100 rounded-full text-xs font-medium whitespace-nowrap">Urgence</span>
                    ) : p.statut === 'en_attente' ? (
                       <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-xs font-medium whitespace-nowrap">En attente résultats</span>
                    ) : (
                       <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-medium whitespace-nowrap">Validé et Transmis</span>
                    )}
                  </div>
                </div>
              )) : (
                <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl">Aucun examen ne correspond aux critères</div>
              )}

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
            )}

            {/* DETAILS PANEL (MODAL) */}
            {selectedPatient && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-all" 
                onClick={() => setSelectedPatient(null)}
              >
                {(() => {
                  const patientData = patients.find(p => p.id === selectedPatient);
                  return (
                <div 
                  className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col" 
                  onClick={e => e.stopPropagation()}
                >
                  <div className="bg-gradient-to-r from-primary-start to-primary-end p-8 flex justify-between items-center text-white shrink-0 sticky top-0 z-10 rounded-t-2xl">
                    <div>
                      <h3 className="text-2xl font-black uppercase tracking-tight">Dossier de résultats</h3>
                      {patientData && (
                        <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">
                          Consultation des résultats — {patientData.fullName} · {patientData.mat}
                        </p>
                      )}
                    </div>
                    <button onClick={() => setSelectedPatient(null)} className="p-3 hover:bg-white/20 rounded-2xl transition-all">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-6">
                    {(() => {
                      const patientExams = (exams[selectedPatient] || []).filter(e => e.status === 'realise');
                      
                      if (patientExams.length === 0) {
                        return (
                          <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl">
                            Aucun examen réalisé pour ce patient.
                          </div>
                        );
                      }

                      return (
                        <div className="flex flex-col">
                          {patientExams.map(exam => (
                            <ResultExamCard
                              key={exam.id}
                              examId={exam.id}
                              examName={exam.name}
                              motif={exam.motif}
                              anatomie={exam.anatomie}
                              medecin={exam.medecin}
                              resultats={exam.resultats}
                              observations={exam.observations}
                              interpretation={exam.interpretation}
                              validateur={exam.validateur}
                              date={exam.date}
                              isWarn={exam.isWarn}
                              estValide={exam.estValide}
                              onValider={(id) => validerResultat(id, `Biologiste ${APP_NAME}`)}
                              onCancel={() => setSelectedPatient(null)}
                            />
                          ))}

                          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl mt-4">
                            <span className="text-[#185FA5] text-lg font-bold">ℹ</span>
                            <span className="text-sm font-medium text-[#185FA5]">{patientExams.length} Résultat(s) d'examen(s) généré(s) et transmis dans le dossier</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                  );
                })()}
              </div>
            )}
          </div>

        </div>
      </div>
    </LaboratoryDashboard>
  );
};

const ResultExamCard = ({ examId, examName, motif, anatomie, medecin, resultats, observations, interpretation, validateur, date, isWarn, estValide, onValider, onCancel }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleValider = async () => {
    setIsSubmitting(true);
    try {
      await onValider(examId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-slate-800">Examen : {examName}</span>
          <span className="text-xs text-slate-500 mt-1">motif : {motif} · anatomie : {anatomie}</span>
        </div>
        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold shrink-0 ml-4 ${estValide ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {estValide ? 'VALIDE' : 'REALISE — en attente de validation'}
        </span>
      </div>

      {isWarn && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <span className="text-red-600 font-bold">⚠</span>
          <span className="text-sm font-medium text-red-700">Valeur critique signalée — alerte envoyée au prescripteur</span>
        </div>
      )}

      <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mt-2">
        <p className="text-sm font-semibold text-[#185FA5] mb-4">Résultat d'examen</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Médecin prescripteur</p>
            <p className="text-sm font-medium text-slate-800">{medecin || 'Non renseigné'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Résultats</p>
            <p className={`text-sm font-medium ${isWarn ? 'text-red-600' : 'text-slate-800'}`}>{resultats}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs text-slate-500 mb-1">Observations</p>
            <p className="text-sm text-slate-800">{observations}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs text-slate-500 mb-1">Interprétation</p>
            <p className="text-sm text-slate-800">{interpretation}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
        <div>
          <p className="text-xs text-slate-500 mb-1">Validé par (biologiste)</p>
          <p className="text-sm font-medium text-slate-800">{validateur || (estValide ? `Biologiste ${APP_NAME}` : 'Non validé')}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Date de validation</p>
          <p className="text-sm text-slate-800">{date || (estValide ? 'Validé' : 'En attente')}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Transmis dans le dossier</p>
          <p className={`text-sm font-semibold ${estValide ? 'text-emerald-600' : 'text-amber-600'}`}>
            {estValide ? '✓ Effectué' : '⏳ Non transmis'}
          </p>
        </div>
      </div>

      {!estValide && onValider && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 flex-1 py-2.5 text-slate-600 border border-slate-200 bg-white rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" /> Annuler
          </button>
          <button
            onClick={handleValider}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 flex-1 py-2.5 text-white bg-[#185FA5] rounded-lg text-sm font-semibold hover:bg-[#144d8a] transition-colors disabled:opacity-60"
          >
            {isSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Validation...</>
              : <><CheckCircle className="w-4 h-4" /> Valider et transmettre</>
            }
          </button>
        </div>
      )}
    </div>
  );
};

export default LaboratoryResults;
