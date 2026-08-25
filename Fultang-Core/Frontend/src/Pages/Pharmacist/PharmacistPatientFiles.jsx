import React, { useState } from 'react';
import { PharmacistDashBoard } from "./Components/PharmacistDashboard.jsx";
import { PharmacistNavLink } from "./PharmacistNavLink.js";
import { Search, Filter, AlertTriangle, X, Folder } from "lucide-react";

import { getAllPatients, getPatientData } from "../../services/pharmacistApi.js";

export const PharmacistPatientFiles = () => {
  const [patientData, setPatientData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterMatricule, setFilterMatricule] = useState("");
  const [filterNom, setFilterNom] = useState("");
  const [filterPrenom, setFilterPrenom] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedPatientDetails, setSelectedPatientDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getAllPatients();
      const formatted = data.map(p => ({
        id: p.matricule || `PAT-${p.id}`,
        patientId: p.id,
        name: `${p.nom} ${p.prenom || ''}`.trim(),
        initials: (p.nom?.[0] || '?') + (p.prenom?.[0] || ''),
        statusText: "Dossier Complet",
        statusBg: "bg-emerald-50",
        statusColor: "text-emerald-700",
        date: "07/05/2026",
        avatarBg: "bg-primary-start/10",
        avatarText: "text-primary-start",
        raw: p
      }));
      setPatientData(formatted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handlePatientClick = async (item) => {
    setExpandedId(item.id);
    setSelectedPatientDetails(null);
    setDetailsLoading(true);
    try {
      const details = await getPatientData(item.patientId);
      setSelectedPatientDetails(details);
    } catch (err) {
      console.error("Error loading patient details:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const getDisplayPhone = (item) => {
    if (selectedPatientDetails) {
      if (selectedPatientDetails.contact_principal) return selectedPatientDetails.contact_principal;
      if (selectedPatientDetails.contacts && selectedPatientDetails.contacts.length > 0) {
        return selectedPatientDetails.contacts[0].numero;
      }
    }
    return item.raw.contact_principal || 'Non renseigné';
  };

  const getDisplayAddress = (item) => {
    if (selectedPatientDetails && selectedPatientDetails.adresse) {
      const addr = selectedPatientDetails.adresse;
      const parts = [addr.rue, addr.quartier, addr.ville, addr.pays].filter(Boolean);
      return parts.join(', ') || 'Non renseignée';
    }
    return item.raw.ville || 'Non renseignée';
  };

  const clearFilters = () => {
    setFilterMatricule("");
    setFilterNom("");
    setFilterPrenom("");
  };

  const activeFiltersCount = [filterMatricule, filterNom, filterPrenom].filter(Boolean).length;

  const filteredData = patientData.filter(p => {
    const matchMatricule = !filterMatricule || p.id.toLowerCase().includes(filterMatricule.toLowerCase());
    const matchNom = !filterNom || p.name.toLowerCase().includes(filterNom.toLowerCase());
    const matchPrenom = !filterPrenom || p.name.toLowerCase().includes(filterPrenom.toLowerCase());
    return matchMatricule && matchNom && matchPrenom;
  });

  return (
    <PharmacistDashBoard linkList={PharmacistNavLink} requiredRole="pharmacien">
      <div className="bg-slate-50 text-slate-800 min-h-screen p-8 flex flex-col gap-8 overflow-y-auto scrollbar">
        
        <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <Folder className="w-7 h-7 mr-2 text-primary-start" />
                    Dossier Patient
                </h2>
                <p className="text-sm text-gray-500 mt-1">Consultez l'historique et le dossier clinique du patient.</p>
            </div>
        </div>

        <div className="flex flex-col bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <span className="text-slate-500 text-[13px] font-medium">{filteredData.length} dossiers affichés</span>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all border ${showFilters ? 'bg-primary-start text-white border-primary-start shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-sm'}`}
            >
              <Filter className="w-4 h-4" />
              Filtres
              {activeFiltersCount > 0 && (
                <span className={`flex items-center justify-center w-5 h-5 ml-1 text-[11px] font-bold rounded-full ${showFilters ? 'bg-white text-primary-start' : 'bg-primary-start text-white'}`}>
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="bg-[#faf9f8] p-4 rounded-xl border border-slate-200 mb-6 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-[12px] font-medium text-slate-600">matricule : String</label>
                  <input type="text" placeholder="ex. PAT-2026-04710" value={filterMatricule} onChange={e => setFilterMatricule(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-end/30" />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-[12px] font-medium text-slate-600">nom : String</label>
                  <input type="text" placeholder="ex. Essomba" value={filterNom} onChange={e => setFilterNom(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-end/30" />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-[12px] font-medium text-slate-600">prénom? : String</label>
                  <input type="text" placeholder="ex. Pierre" value={filterPrenom} onChange={e => setFilterPrenom(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-end/30" />
                </div>
                <button onClick={clearFilters} className="px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 h-[38px] shadow-sm">
                  Effacer
                </button>
              </div>
            </div>
          )}

          {/* LISTE DES PATIENTS */}
          <div className="flex flex-col">
            {filteredData.map((item, index) => (
              <div 
                key={item.id || index}
                onClick={() => handlePatientClick(item)}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between transition-all cursor-pointer mb-3 ${
                  expandedId === item.id 
                    ? 'border-primary-start bg-primary-start/5 shadow-sm ring-1 ring-primary-start/20' 
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0 ${item.avatarBg} ${item.avatarText}`}>
                    {item.initials}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900 text-[15px] tracking-tight">{item.name}</span>
                    <span className="text-[13px] text-slate-500">{item.id} · Dernière visite : {item.date}</span>
                  </div>
                </div>
                <div className="mt-3 sm:mt-0 flex justify-end">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${item.statusBg} ${item.statusColor}`}>
                    {item.statusText}
                  </span>
                </div>
              </div>
            ))}
            {filteredData.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-sm bg-white border border-slate-200 rounded-xl">
                Aucun dossier trouvé.
              </div>
            )}
          </div>

          {/* MODAL DÉTAILS PATIENT */}
          {expandedId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-all" onClick={() => setExpandedId(null)}>
              {(() => {
                const item = patientData.find(p => p.id === expandedId);
                if (!item) return null;
                return (
                  <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="bg-gradient-to-r from-primary-start to-primary-end p-8 flex justify-between items-center text-white shrink-0 sticky top-0 z-10 rounded-t-2xl">
                      <div>
                        <h3 className="text-2xl font-black uppercase tracking-tight">Dossier Clinique</h3>
                        <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">
                          Patient — {item.name} · {item.id}
                        </p>
                      </div>
                      <button onClick={() => setExpandedId(null)} className="p-3 hover:bg-white/20 rounded-2xl transition-all">
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="p-6 bg-[#faf9f8] flex flex-col gap-6">
                      {item.raw ? (
                        <>
                          <div className="bg-white border border-primary-end/20 rounded-xl p-5 shadow-sm">
                            <h3 className="text-[11px] font-bold text-primary-end mb-3">Informations Personnelles</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div><p className="text-[12px] font-medium text-slate-500">matricule : String</p><p className="text-[14px] font-medium text-slate-900">{item.id}</p></div>
                              <div><p className="text-[12px] font-medium text-slate-500">nom : String</p><p className="text-[14px] font-medium text-slate-900">{item.raw.nom}</p></div>
                              <div><p className="text-[12px] font-medium text-slate-500">prénom? : String</p><p className="text-[14px] font-medium text-slate-900">{item.raw.prenom}</p></div>
                              <div><p className="text-[12px] font-medium text-slate-500">date de naissance : Date</p><p className="text-[14px] font-medium text-slate-900">{item.raw.date_naissance || 'Inconnue'}</p></div>
                              <div><p className="text-[12px] font-medium text-slate-500">sexe : String</p><p className="text-[14px] font-medium text-slate-900">{item.raw.sexe || 'Inconnu'}</p></div>
                              <div>
                                <p className="text-[12px] font-medium text-slate-500">téléphone : String</p>
                                <p className="text-[14px] font-medium text-slate-900">
                                  {detailsLoading ? (
                                    <span className="animate-pulse text-slate-400">Chargement...</span>
                                  ) : (
                                    getDisplayPhone(item)
                                  )}
                                </p>
                              </div>
                            </div>
                            
                            <div className="h-px bg-slate-100 my-4"></div>
                            <h3 className="text-[11px] font-bold text-primary-end mb-2">Adresse · résider [0..1]</h3>
                            <p className="text-[14px] font-medium text-slate-900">
                              {detailsLoading ? (
                                <span className="animate-pulse text-slate-400">Chargement...</span>
                              ) : (
                                getDisplayAddress(item)
                              )}
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="py-12 text-center text-slate-500 text-sm">
                          Détails non disponibles pour ce patient.
                        </div>
                      )}

                    </div>
                  </div>
                );
              })()}
            </div>
          )}

        </div>
      </div>
    </PharmacistDashBoard>
  );
};

export default PharmacistPatientFiles;
