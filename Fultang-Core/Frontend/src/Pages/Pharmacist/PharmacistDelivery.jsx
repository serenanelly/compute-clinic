import React, { useState, useEffect } from 'react';
import { PharmacistDashBoard } from "./Components/PharmacistDashboard.jsx";
import { PharmacistNavLink } from "./PharmacistNavLink.js";
import { Filter, X, Link, CheckCircle, Loader2, Package } from "lucide-react";
import { getPrescriptions, delivrerMedicament } from "../../services/pharmacistApi.js";

export const PharmacistDelivery = () => {
  const [deliveryData, setDeliveryData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterMatricule, setFilterMatricule] = useState("");
  const [filterNom, setFilterNom] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // État de délivrance en cours : { [prescriptionId]: boolean }
  const [delivering, setDelivering] = useState({});

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getPrescriptions();

      // Ne garder que les prescriptions VALIDEE
      const validees = data.filter(p => p.statut === 'VALIDEE');

      // Regrouper par patient (patientDbId)
      const patientMap = new Map();
      validees.forEach(pres => {
        const pInfo = pres.patient_info;
        if (!pInfo) return;

        if (!patientMap.has(pInfo.id)) {
          patientMap.set(pInfo.id, {
            patientDbId: pInfo.id,
            id: pInfo.mat,
            name: pInfo.fullName,
            initials: pInfo.initials,
            avatarBg: "bg-primary-end/10",
            avatarText: "text-primary-end",
            source: "Consultation",
            date: pres.date_heure
              ? new Date(pres.date_heure).toLocaleString('fr-FR')
              : 'Date inconnue',
            prescriptions: [],
          });
        }
        patientMap.get(pInfo.id).prescriptions.push(pres);
      });

      setDeliveryData(Array.from(patientMap.values()));
    } catch (error) {
      console.error("Erreur de chargement", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Délivrer un médicament individuel
  const handleDeliver = async (prescriptionId, quantite) => {
    try {
      setDelivering(prev => ({ ...prev, [prescriptionId]: true }));
      await delivrerMedicament(prescriptionId, quantite ?? 1);

      // Mettre à jour localement le statut du médicament
      setDeliveryData(prev =>
        prev
          .map(patient => ({
            ...patient,
            prescriptions: patient.prescriptions.map(pres =>
              pres.id === prescriptionId ? { ...pres, statut: 'DELIVREE' } : pres
            ),
          }))
          // Retirer le patient si TOUS ses médicaments sont maintenant délivrés
          .filter(patient =>
            patient.prescriptions.some(pres =>
              pres.id === prescriptionId
                ? false  // celui qu'on vient de délivrer
                : pres.statut !== 'DELIVREE'
            ) ||
            // garde le patient si d'autres sont encore non délivrés après cet update
            patient.prescriptions.filter(pres => pres.id !== prescriptionId).some(pres => pres.statut !== 'DELIVREE')
            // cas où c'était le dernier → le patient disparaît
            // on recalcule proprement ci-dessous
          )
      );

      // Recalcul propre : retirer patients où tous les médicaments (après update) sont délivrés
      setDeliveryData(prev => {
        const updated = prev.map(patient => ({
          ...patient,
          prescriptions: patient.prescriptions.map(pres =>
            pres.id === prescriptionId ? { ...pres, statut: 'DELIVREE' } : pres
          ),
        }));
        // Filtrer : garder seulement les patients qui ont encore au moins un médicament non délivré
        return updated.filter(patient =>
          patient.prescriptions.some(pres => pres.statut !== 'DELIVREE')
        );
      });

      // Fermer le modal si le patient n'a plus rien à délivrer
      setExpandedId(prev => {
        const patient = deliveryData.find(p => p.id === prev);
        if (!patient) return null;
        const remaining = patient.prescriptions.filter(
          pres => pres.id !== prescriptionId && pres.statut !== 'DELIVREE'
        );
        return remaining.length === 0 ? null : prev;
      });

    } catch (e) {
      console.error("Erreur lors de la délivrance", e);
      alert("Erreur lors de la délivrance.");
    } finally {
      setDelivering(prev => ({ ...prev, [prescriptionId]: false }));
    }
  };

  const clearFilters = () => {
    setFilterMatricule("");
    setFilterNom("");
  };

  const activeFiltersCount = [filterMatricule, filterNom].filter(Boolean).length;

  const filteredData = deliveryData.filter(p => {
    const matchMatricule = !filterMatricule || p.id.toLowerCase().includes(filterMatricule.toLowerCase());
    const matchNom = !filterNom || p.name.toLowerCase().includes(filterNom.toLowerCase());
    return matchMatricule && matchNom;
  });

  return (
    <PharmacistDashBoard linkList={PharmacistNavLink} requiredRole="pharmacien">
      <div className="bg-slate-50 text-slate-800 min-h-screen p-8 flex flex-col gap-8 overflow-y-auto scrollbar">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <Link className="w-7 h-7 mr-2 text-primary-start" />
              Délivrance
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Délivrez les médicaments des prescriptions validées.
            </p>
          </div>
        </div>

        <div className="flex flex-col bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">

          {/* Barre filtres */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <span className="text-slate-500 text-[13px] font-medium">
              {filteredData.length} patient{filteredData.length !== 1 ? 's' : ''} à servir
            </span>
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
                  <label className="text-[13px] font-medium text-slate-600">Matricule patient</label>
                  <input
                    type="text"
                    placeholder="ex. PAT-2026-04765"
                    value={filterMatricule}
                    onChange={e => setFilterMatricule(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-end/30"
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-[13px] font-medium text-slate-600">Nom</label>
                  <input
                    type="text"
                    placeholder="ex. Biya"
                    value={filterNom}
                    onChange={e => setFilterNom(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-end/30"
                  />
                </div>
                <button
                  onClick={clearFilters}
                  className="px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 h-[38px] shadow-sm"
                >
                  Effacer
                </button>
              </div>
            </div>
          )}

          {/* Liste des patients */}
          <div className="flex flex-col">
            {loading ? (
              <div className="py-12 text-center text-slate-500 text-sm">Chargement...</div>
            ) : filteredData.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm bg-white border border-slate-200 rounded-xl">
                Aucun patient en attente de délivrance.
              </div>
            ) : filteredData.map((item, index) => (
              <div
                key={item.patientDbId || index}
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
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
                    <span className="text-[13px] text-slate-500">
                      {item.id} · {item.source} · {item.date}
                    </span>
                  </div>
                </div>
                <div className="mt-3 sm:mt-0 flex items-center gap-2 justify-end">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                    <Package className="w-3 h-3" />
                    {item.prescriptions.length} médicament{item.prescriptions.length > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MODAL DÉLIVRANCE */}
        {expandedId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setExpandedId(null)}
          >
            {(() => {
              const item = deliveryData.find(p => p.id === expandedId);
              if (!item) return null;

              const pendingMeds = item.prescriptions.filter(p => p.statut !== 'DELIVREE');
              const doneMeds = item.prescriptions.filter(p => p.statut === 'DELIVREE');

              return (
                <div
                  className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col"
                  onClick={e => e.stopPropagation()}
                >
                  {/* En-tête */}
                  <div className="bg-gradient-to-r from-primary-start to-primary-end p-6 flex justify-between items-center text-white sticky top-0 z-10 rounded-t-2xl">
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Délivrance</h3>
                      <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">
                        {item.name} · {item.id}
                      </p>
                    </div>
                    <button onClick={() => setExpandedId(null)} className="p-2 hover:bg-white/20 rounded-xl transition-all">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 bg-[#faf9f8] flex flex-col gap-6">

                    {/* Médicaments à délivrer */}
                    {pendingMeds.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <span className="text-[13px] font-semibold text-slate-600">
                          À délivrer ({pendingMeds.length})
                        </span>
                        {pendingMeds.map((pres, idx) => (
                          <MedicamentCard
                            key={pres.id}
                            pres={pres}
                            idx={idx}
                            delivering={delivering}
                            onDeliver={handleDeliver}
                          />
                        ))}
                      </div>
                    )}

                    {/* Médicaments déjà délivrés */}
                    {doneMeds.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <span className="text-[13px] font-semibold text-slate-400">
                          Déjà délivrés ({doneMeds.length})
                        </span>
                        {doneMeds.map((pres, idx) => (
                          <div key={pres.id} className="bg-white border border-blue-100 rounded-xl p-4 opacity-60">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-[14px] font-medium text-slate-700">{pres.nom}</span>
                                {pres.type_medicament && (
                                  <span className="text-[12px] text-slate-400 ml-2">— {pres.type_medicament}</span>
                                )}
                              </div>
                              <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-[11px] font-semibold">
                                <CheckCircle className="w-3.5 h-3.5" /> Délivré
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {pendingMeds.length === 0 && (
                      <div className="py-8 text-center text-emerald-600 font-semibold text-sm">
                        ✓ Tous les médicaments ont été délivrés.
                      </div>
                    )}

                  </div>
                </div>
              );
            })()}
          </div>
        )}

      </div>
    </PharmacistDashBoard>
  );
};

/**
 * Carte d'un médicament à délivrer avec champ quantité éditable.
 */
const MedicamentCard = ({ pres, idx, delivering, onDeliver }) => {
  const [quantite, setQuantite] = useState(pres.quantite ?? 1);

  return (
    <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-[14px] font-semibold text-slate-900">
            Médicament #{idx + 1} — {pres.nom}
          </span>
          {pres.type_medicament && (
            <span className="text-[12px] text-slate-400 ml-2">({pres.type_medicament})</span>
          )}
        </div>
        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-[11px] font-semibold border border-amber-100">
          Validée
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-[12px] font-medium text-primary-end">Posologie</p>
          <p className="text-[14px] font-medium text-slate-900">{pres.posologie || 'Non spécifiée'}</p>
        </div>
        <div>
          <p className="text-[12px] font-medium text-primary-end mb-1">Quantité à délivrer</p>
          <input
            type="number"
            min="1"
            value={quantite}
            onChange={e => setQuantite(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-start/30"
          />
        </div>
      </div>

      <div className="flex justify-end pt-3 border-t border-slate-100">
        <button
          onClick={() => onDeliver(pres.id, quantite)}
          disabled={delivering[pres.id]}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all disabled:opacity-60"
        >
          {delivering[pres.id] ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Délivrance...</>
          ) : (
            <><CheckCircle className="w-4 h-4" /> Délivrer</>
          )}
        </button>
      </div>
    </div>
  );
};

export default PharmacistDelivery;
