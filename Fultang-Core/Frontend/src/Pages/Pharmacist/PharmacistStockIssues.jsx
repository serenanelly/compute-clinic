import React, { useState, useEffect } from 'react';
import { PharmacistDashBoard } from "./Components/PharmacistDashboard.jsx";
import { PharmacistNavLink } from "./PharmacistNavLink.js";
import { Search, Filter, AlertTriangle, CheckCircle, Clock, X, FileOutput } from "lucide-react";
import { getHospitalisations } from "../../services/pharmacistApi.js";

export const PharmacistStockIssues = () => {
  const [exitData, setExitData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterMatricule, setFilterMatricule] = useState("");
  const [filterNom, setFilterNom] = useState("");
  const [filterPrenom, setFilterPrenom] = useState("");
  const [filterStatus, setFilterStatus] = useState("Tous");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getHospitalisations();
      const formatted = data.map(hosp => ({
        id: hosp.id,
        patientId: hosp.patient?.matricule || 'Inconnu',
        name: hosp.patient?.nom || 'Patient inconnu',
        initials: (hosp.patient?.nom?.[0] || '?') + (hosp.patient?.prenom?.[0] || ''),
        statusText: hosp.statut || 'EN_COURS',
        statusBg: hosp.statut === 'TERMINE' ? 'bg-emerald-50' : 'bg-blue-50',
        statusColor: hosp.statut === 'TERMINE' ? 'text-emerald-700' : 'text-blue-700',
        exitDate: hosp.date_sortie || 'Non définie',
        avatarBg: "bg-primary-start/10",
        avatarText: "text-primary-start"
      }));
      setExitData(formatted);
    } catch (error) {
      console.error("Failed to load hospitalisations", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const clearFilters = () => {
    setFilterMatricule("");
    setFilterNom("");
    setFilterPrenom("");
    setFilterStatus("Tous");
  };

  const activeFiltersCount = [filterMatricule, filterNom, filterPrenom, filterStatus !== "Tous"].filter(Boolean).length;

  const filteredData = exitData.filter(p => {
    const matchMatricule = !filterMatricule || p.patientId.toLowerCase().includes(filterMatricule.toLowerCase());
    const matchNom = !filterNom || p.name.toLowerCase().includes(filterNom.toLowerCase());
    const matchPrenom = !filterPrenom || p.name.toLowerCase().includes(filterPrenom.toLowerCase());
    const matchStatus = filterStatus === "Tous" || p.statusText === filterStatus;
    return matchMatricule && matchNom && matchPrenom && matchStatus;
  });

  return (
    <PharmacistDashBoard linkList={PharmacistNavLink} requiredRole="pharmacien">
      <div className="bg-slate-50 text-slate-800 min-h-screen p-8 flex flex-col gap-8 overflow-y-auto scrollbar">
        
        <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <FileOutput className="w-7 h-7 mr-2 text-primary-start" />
                    Sortie Patient
                </h2>
                <p className="text-sm text-gray-500 mt-1">Gérez la sortie du patient et générez les fiches de conciliation.</p>
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
                  <input type="text" placeholder="ex. PAT..." value={filterMatricule} onChange={e => setFilterMatricule(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-end/30" />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-[12px] font-medium text-slate-600">nom : String</label>
                  <input type="text" placeholder="ex. Mbarga" value={filterNom} onChange={e => setFilterNom(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-end/30" />
                </div>
                <button onClick={clearFilters} className="px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 h-[38px] shadow-sm">
                  Effacer
                </button>
              </div>
            </div>
          )}

          {/* LISTE DES SORTIES */}
          <div className="flex flex-col">
            {loading ? (
                <div className="py-12 text-center text-slate-500 text-sm">Chargement des données API...</div>
            ) : filteredData.map((item, index) => (
              <div 
                key={item.id || index}
                onClick={() => setExpandedId(item.id)}
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
                    <span className="text-[13px] text-slate-500">{item.patientId} · Sortie prévue : {item.exitDate}</span>
                  </div>
                </div>
                <div className="mt-3 sm:mt-0 flex justify-end">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${item.statusBg} ${item.statusColor}`}>
                    {item.statusText}
                  </span>
                </div>
              </div>
            ))}
            {!loading && filteredData.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-sm bg-white border border-slate-200 rounded-xl">
                Aucune sortie trouvée.
              </div>
            )}
          </div>

          {/* MODAL DÉTAILS SORTIE */}
          {expandedId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-all" onClick={() => setExpandedId(null)}>
              {(() => {
                const item = exitData.find(p => p.id === expandedId);
                if (!item) return null;
                return (
                  <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="bg-gradient-to-r from-primary-start to-primary-end p-8 flex justify-between items-center text-white shrink-0 sticky top-0 z-10 rounded-t-2xl">
                      <div>
                        <h3 className="text-2xl font-black uppercase tracking-tight">Préparation de Sortie</h3>
                        <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">
                          Patient — {item.name} · {item.patientId}
                        </p>
                      </div>
                      <button onClick={() => setExpandedId(null)} className="p-3 hover:bg-white/20 rounded-2xl transition-all">
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="p-6 bg-[#faf9f8] flex flex-col gap-6">
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-center">
                            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Hospitalisation {item.statusText}</h3>
                            <p className="text-sm text-slate-500">Les données complètes de sortie devraient être chargées depuis l'API ici.</p>
                            
                            <button className="mt-5 w-full py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-all text-[14px] shadow-sm flex items-center justify-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                Finaliser — générer la fiche
                            </button>
                        </div>
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

export default PharmacistStockIssues;
