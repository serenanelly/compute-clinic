import React, { useState, useEffect } from 'react';
import { PharmacistDashBoard } from "./Components/PharmacistDashboard.jsx";
import { PharmacistNavLink } from "./PharmacistNavLink.js";
import {
  RefreshCw, Filter, Check, X, FileText,
  AlertTriangle, ShieldAlert, PackageX, Loader2
} from "lucide-react";
import {
  getPrescriptions,
  validerPrescription,
  getPatientAllergies,
  checkMedicamentEnStock
} from "../../services/pharmacistApi.js";

export const PharmacistPrescriptions = () => {
  const [prescriptionsData, setPrescriptionsData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterMatricule, setFilterMatricule] = useState("");
  const [filterNom, setFilterNom] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Données enrichies du modal ouvert
  const [modalAllergies, setModalAllergies] = useState([]);
  const [modalStockStatus, setModalStockStatus] = useState({}); // { [medId]: true|false|null }
  const [modalLoading, setModalLoading] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getPrescriptions();

      // Ne garder que les prescriptions EN_ATTENTE
      const enAttente = data.filter(p => p.statut === 'EN_ATTENTE');

      // Regrouper par consultation
      const grouped = enAttente.reduce((acc, curr) => {
        if (!acc[curr.consultation]) {
          acc[curr.consultation] = {
            id: curr.consultation,
            patientId: curr.patient_info?.mat || 'Inconnu',
            patientDbId: curr.patient_info?.id || null,
            name: curr.patient_info?.fullName || 'Inconnu',
            initials: curr.patient_info?.initials || '?',
            doctor: curr.medecin || 'Non spécifié',
            date: curr.date_heure
              ? new Date(curr.date_heure).toLocaleString('fr-FR')
              : 'Date inconnue',
            avatarBg: "bg-primary-start/10",
            avatarText: "text-primary-start",
            medications: [],
          };
        }
        acc[curr.consultation].medications.push(curr);
        return acc;
      }, {});

      setPrescriptionsData(Object.values(grouped));
    } catch (error) {
      console.error("Failed to load prescriptions", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { setCurrentPage(1); }, [filterMatricule, filterNom]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData().finally(() => setTimeout(() => setIsRefreshing(false), 600));
  };

  // Ouvrir le modal et charger allergies + stock
  const openModal = async (item) => {
    setExpandedId(item.id);
    setModalAllergies([]);
    setModalStockStatus({});
    setModalLoading(true);
    try {
      // Allergies du patient
      const allergies = item.patientDbId
        ? await getPatientAllergies(item.patientDbId)
        : [];
      setModalAllergies(allergies);

      // Vérification stock pour chaque médicament
      const stockChecks = await Promise.all(
        item.medications.map(med =>
          checkMedicamentEnStock(med.nom).then(ok => ({ id: med.id, ok }))
        )
      );
      const stockMap = {};
      stockChecks.forEach(({ id, ok }) => { stockMap[id] = ok; });
      setModalStockStatus(stockMap);
    } catch (e) {
      console.error("Erreur chargement modal", e);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setExpandedId(null);
    setModalAllergies([]);
    setModalStockStatus({});
  };

  // Valider toutes les lignes de prescription d'une consultation
  const handleValidate = async (item) => {
    // Vérifier qu'aucun médicament n'est absent du stock (false = absent)
    const manquants = item.medications.filter(med => modalStockStatus[med.id] === false);
    if (manquants.length > 0) {
      alert(
        `Impossible de valider : les médicaments suivants sont absents du stock :\n` +
        manquants.map(m => `• ${m.nom}`).join('\n')
      );
      return;
    }

    try {
      setValidating(true);
      await Promise.all(item.medications.map(med => validerPrescription(med.id)));
      closeModal();
      handleRefresh();
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la validation de la prescription.");
    } finally {
      setValidating(false);
    }
  };

  const clearFilters = () => {
    setFilterMatricule("");
    setFilterNom("");
  };

  const activeFiltersCount = [filterMatricule, filterNom].filter(Boolean).length;

  const filteredPrescriptions = prescriptionsData.filter(p => {
    const matchMatricule = !filterMatricule || p.patientId.toLowerCase().includes(filterMatricule.toLowerCase());
    const matchNom = !filterNom || p.name.toLowerCase().includes(filterNom.toLowerCase());
    return matchMatricule && matchNom;
  });

  const totalPages = Math.ceil(filteredPrescriptions.length / itemsPerPage);
  const paginatedPrescriptions = filteredPrescriptions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <PharmacistDashBoard linkList={PharmacistNavLink} requiredRole="pharmacien">
      <div className="bg-slate-50 text-slate-800 min-h-screen p-8 flex flex-col gap-8 overflow-y-auto scrollbar">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <FileText className="w-7 h-7 mr-2 text-primary-start" />
              Prescriptions à valider
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Vérifiez les médicaments et validez les prescriptions avant délivrance.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-400 hover:text-primary-start hover:bg-white rounded-lg border border-gray-200 transition-all shadow-sm"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-primary-start' : ''}`} />
          </button>
        </div>

        <div className="flex flex-col bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">

          {/* Barre filtres */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <span className="text-slate-500 text-[13px] font-medium">
              {filteredPrescriptions.length} prescription{filteredPrescriptions.length !== 1 ? 's' : ''} en attente
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
                    placeholder="ex. PAT-2026-04872"
                    value={filterMatricule}
                    onChange={(e) => setFilterMatricule(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-[13px] font-medium text-slate-600">Nom</label>
                  <input
                    type="text"
                    placeholder="ex. Mbarga"
                    value={filterNom}
                    onChange={(e) => setFilterNom(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
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

          {/* Liste */}
          <div className="flex flex-col">
            {loading ? (
              <div className="py-12 text-center text-slate-500 text-sm">Chargement...</div>
            ) : paginatedPrescriptions.map((item, index) => (
              <div
                key={item.id || index}
                onClick={() => openModal(item)}
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
                      {item.patientId} · {item.doctor} · {item.date}
                    </span>
                  </div>
                </div>
                <div className="mt-3 sm:mt-0 flex justify-end">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-secondary/10 text-secondary">
                    En attente
                  </span>
                </div>
              </div>
            ))}

            {!loading && filteredPrescriptions.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-sm bg-white border border-slate-200 rounded-xl">
                Aucune prescription en attente de validation.
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 mt-2 pt-5 px-2">
                <div className="text-sm text-slate-500">
                  Affichage de{' '}
                  <span className="font-medium text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span>
                  {' '}à{' '}
                  <span className="font-medium text-slate-900">{Math.min(currentPage * itemsPerPage, filteredPrescriptions.length)}</span>
                  {' '}sur{' '}
                  <span className="font-medium text-slate-900">{filteredPrescriptions.length}</span> résultats
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg disabled:opacity-40"
                  >Précédent</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-primary-start text-white border border-primary-start'
                          : 'bg-white text-slate-600 border border-transparent hover:bg-slate-100'
                      }`}
                    >{page}</button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg disabled:opacity-40"
                  >Suivant</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MODAL VALIDATION */}
        {expandedId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={closeModal}
          >
            {(() => {
              const item = prescriptionsData.find(p => p.id === expandedId);
              if (!item) return null;

              const hasStockIssue = item.medications.some(med => modalStockStatus[med.id] === false);

              return (
                <div
                  className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col"
                  onClick={e => e.stopPropagation()}
                >
                  {/* En-tête */}
                  <div className="flex items-start justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                    <div>
                      <h2 className="text-xl font-bold text-primary-start">Validation de prescription</h2>
                      <p className="text-sm text-slate-500 mt-1 font-medium">
                        {item.name} · {item.patientId}
                      </p>
                    </div>
                    <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                      <X className="w-5 h-5 text-slate-500" />
                    </button>
                  </div>

                  <div className="p-6 bg-[#faf9f8] flex flex-col gap-6">

                    {/* Infos patient */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-[14px] shrink-0 ${item.avatarBg} ${item.avatarText}`}>
                          {item.initials}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 text-[17px]">{item.name}</span>
                          <p className="text-[13px] text-slate-500 mt-0.5">{item.patientId}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-[12px] font-medium text-slate-500">Prescripteur</span>
                          <p className="text-[14px] font-medium text-slate-900">{item.doctor}</p>
                        </div>
                        <div>
                          <span className="text-[12px] font-medium text-slate-500">Date</span>
                          <p className="text-[14px] font-medium text-slate-900">{item.date}</p>
                        </div>
                      </div>
                    </div>

                    {/* Allergies */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <ShieldAlert className="w-4 h-4 text-orange-500" />
                        <span className="text-[13px] font-semibold text-slate-700">Allergies du patient</span>
                      </div>
                      {modalLoading ? (
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
                        </div>
                      ) : modalAllergies.length === 0 ? (
                        <p className="text-[13px] text-slate-400 italic">Aucune allergie connue.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {modalAllergies.map((allergy, i) => (
                            <span
                              key={i}
                              className="px-3 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-full text-[12px] font-semibold"
                            >
                              {allergy.nom || allergy.substance || allergy}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Médicaments prescrits + vérif stock */}
                    <div className="flex flex-col gap-3">
                      <span className="text-[13px] font-medium text-slate-500">Médicaments prescrits</span>
                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        {item.medications.map((med, idx) => {
                          const inStock = modalStockStatus[med.id];
                          return (
                            <div
                              key={med.id || idx}
                              className={`flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-slate-100 last:border-b-0 ${
                                inStock === false ? 'bg-red-50' : ''
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="text-[14px] font-medium text-slate-900">
                                  {med.nom}
                                  {med.type_medicament ? ` — ${med.type_medicament}` : ''}
                                </span>
                                <span className="text-[12px] text-slate-500">
                                  Posologie : {med.posologie || 'Non spécifiée'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-2 md:mt-0">
                                <span className="text-[13px] font-semibold text-slate-600">
                                  Qté : {med.quantite ?? 1}
                                </span>
                                {modalLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                ) : inStock === false ? (
                                  <span className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-[11px] font-semibold">
                                    <PackageX className="w-3.5 h-3.5" /> Absent du stock
                                  </span>
                                ) : inStock === true ? (
                                  <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-semibold">
                                    <Check className="w-3.5 h-3.5" /> En stock
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 bg-slate-100 text-slate-400 rounded-full text-[11px] font-semibold">
                                    Stock inconnu
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Avertissement stock manquant */}
                    {hasStockIssue && (
                      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-[13px] text-red-700 font-medium">
                          Un ou plusieurs médicaments sont absents du stock. Veuillez approvisionner avant de valider.
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 mt-2 pt-6 border-t border-slate-200">
                      <button
                        onClick={closeModal}
                        disabled={validating}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-[14px] transition-all border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm disabled:opacity-50"
                      >
                        <X className="w-4 h-4" /> Annuler
                      </button>
                      <button
                        onClick={() => handleValidate(item)}
                        disabled={validating || hasStockIssue}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-[14px] transition-all shadow-sm ${
                          hasStockIssue
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                            : 'bg-primary-start text-white hover:opacity-90 border border-primary-start'
                        }`}
                      >
                        {validating ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Validation...</>
                        ) : (
                          <><Check className="w-4 h-4" /> Valider la prescription</>
                        )}
                      </button>
                    </div>

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

export default PharmacistPrescriptions;
