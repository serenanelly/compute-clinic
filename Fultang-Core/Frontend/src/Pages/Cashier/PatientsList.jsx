import { useState, useEffect, useCallback } from "react";
import { AlertCircle, Search, User, Filter, History, Wallet, CheckCircle2, Receipt, AlertTriangle } from "lucide-react";
import PropTypes from "prop-types";
import PatientInvoiceModal from "./PatientInvoiceModal.jsx";
import { searchPatientsForHistory } from "../../services/caissierApi.js";

const formatFcfa = (value) =>
    new Intl.NumberFormat("fr-FR").format(Number(value) || 0);

export default function PatientsList({ patientsList, onRefresh }) {
    PatientsList.propTypes = {
        patientsList: PropTypes.array.isRequired,
        onRefresh: PropTypes.func,
    };

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [filterService, setFilterService] = useState("all");
    const [assistantFilter, setAssistantFilter] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState("facturer");
    const [selectedPatient, setSelectedPatient] = useState(null);

    const filteredAssistant = patientsList.filter((patient) => {
        const montantRestant = Number(patient.montant_restant_total ?? patient.montant_restant ?? 0);
        if (montantRestant <= 0 && !patient.alerte_impayes_anciens) {
            return false;
        }
        const fullName = `${patient.nom || ""} ${patient.prenom || ""}`.toLowerCase();
        const matricule = (patient.matricule || "").toLowerCase();
        const term = assistantFilter.toLowerCase();
        const matchSearch = fullName.includes(term) || matricule.includes(term);
        const matchService = filterService === "all" || patient.service_courant === filterService;
        return matchSearch && matchService;
    });

    const services = [...new Set(patientsList.map((p) => p.service_courant).filter(Boolean))];

    const openModal = (patient, mode) => {
        setSelectedPatient(patient);
        setModalMode(mode);
        setModalOpen(true);
    };

    const handleModalClose = () => {
        setModalOpen(false);
        setSelectedPatient(null);
    };

    const handleSuccess = () => {
        if (onRefresh) onRefresh();
        if (searchQuery.trim().length >= 2) runSearch(searchQuery);
    };

    const runSearch = useCallback(async (query) => {
        const q = query.trim();
        if (q.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearchLoading(true);
        try {
            const response = await searchPatientsForHistory(q);
            setSearchResults(response.success ? response.data || [] : []);
        } catch (err) {
            console.error("Search error:", err);
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim().length >= 2) runSearch(searchQuery);
            else setSearchResults([]);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchQuery, runSearch]);

    const renderDueBadge = (patient) => {
        const reste = patient.montant_restant_total ?? patient.montant_restant ?? 0;
        if (!reste && !patient.alerte_impayes_anciens) return null;
        return (
            <div className="mt-1 flex flex-wrap gap-1">
                {Number(reste) > 0 && (
                    <span className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                        {formatFcfa(reste)} FCFA dus
                    </span>
                )}
                {patient.alerte_impayes_anciens && (
                    <span className="text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {patient.nb_impayes_anciens || 1} impayé(s) ancien(s)
                    </span>
                )}
            </div>
        );
    };

    const renderSearchResultActions = (patient) => (
        <div className="flex flex-wrap gap-2">
            <button
                type="button"
                onClick={() => openModal(patient, "facturer")}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm"
            >
                <Wallet className="w-4 h-4" />
                Facturer
            </button>
            <button
                type="button"
                onClick={() => openModal(patient, "historique")}
                className="flex items-center gap-1.5 px-4 py-2 border-2 border-blue-500 text-blue-700 rounded-lg hover:bg-blue-50 font-semibold text-sm"
            >
                <History className="w-4 h-4" />
                Historique
            </button>
        </div>
    );

    return (
        <div className="w-full mx-auto space-y-8">
            {/* Encaissement walk-in */}
            <section className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1">
                    <Wallet className="w-5 h-5 text-green-600" />
                    <h2 className="text-lg font-bold text-gray-800">Encaissement patient</h2>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                    Le patient se présente au guichet — recherchez-le par nom ou matricule pour voir
                    son parcours, les impayés et enregistrer la quittance.
                </p>
                <div className="relative max-w-xl">
                    <input
                        type="text"
                        placeholder="Nom, prénom ou matricule (min. 2 caractères)…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                </div>

                {searchQuery.trim().length >= 2 && (
                    <div className="mt-4">
                        {searchLoading ? (
                            <p className="text-sm text-gray-500">Recherche en cours…</p>
                        ) : searchResults.length === 0 ? (
                            <p className="text-sm text-gray-500">Aucun patient trouvé.</p>
                        ) : (
                            <ul className="space-y-2">
                                {searchResults.map((p) => (
                                    <li
                                        key={p.id}
                                        className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3"
                                    >
                                        <div>
                                            <p className="font-semibold text-gray-900">{p.prenom} {p.nom}</p>
                                            <p className="text-sm text-gray-500">{p.matricule}</p>
                                            {p.nb_quittances > 0 && (
                                                <p className="text-xs text-green-700 mt-0.5">
                                                    {p.nb_quittances} quittance{p.nb_quittances > 1 ? "s" : ""} — {formatFcfa(p.total_encaisse)} FCFA encaissés
                                                </p>
                                            )}
                                            {renderDueBadge(p)}
                                        </div>
                                        {renderSearchResultActions(p)}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </section>

            {/* Panneau assistant impayés Medical */}
            <section>
                <h2 className="text-xl font-bold text-gray-800 mb-2">
                    Patients avec impayés (assistant Medical)
                </h2>
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4">
                    Liste indicative alimentée par le microservice Medical. Un patient peut aussi arriver
                    directement au guichet sans y figurer — utilisez la recherche ci-dessus.
                </p>

                <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                    <div className="relative w-full md:w-1/3">
                        <input
                            type="text"
                            placeholder="Filtrer (nom ou matricule)"
                            value={assistantFilter}
                            onChange={(e) => setAssistantFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="text-gray-400 w-4 h-4" />
                        <select
                            value={filterService}
                            onChange={(e) => setFilterService(e.target.value)}
                            className="border border-gray-300 rounded-md p-2"
                        >
                            <option value="all">Tous les services</option>
                            {services.map((service) => (
                                <option key={service} value={service}>{service}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {filteredAssistant.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <AlertCircle className="h-10 w-10 text-gray-400 mb-3" />
                        <p className="text-gray-600 font-medium">Aucun patient avec impayé détecté</p>
                        <p className="text-sm text-gray-500 mt-1">Utilisez la recherche ci-dessus pour un patient walk-in.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredAssistant.map((patient) => {
                            const prestations = patient.prestations_a_payer || [];
                            const montantRestant = patient.montant_restant_total ?? patient.montant_restant ?? 0;
                            const peutFacturer = Number(montantRestant) > 0;

                            return (
                                <div key={patient.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                            <User className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold">{patient.prenom} {patient.nom}</p>
                                            <p className="text-sm text-gray-500">{patient.matricule}</p>
                                            {renderDueBadge(patient)}
                                            {prestations.length > 0 && (
                                                <ul className="mt-2 text-xs text-gray-600 space-y-0.5">
                                                    {prestations.slice(0, 3).map((pr) => (
                                                        <li key={pr.id || pr.libelle}>{pr.libelle} — {formatFcfa(pr.montant)} FCFA</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => openModal(patient, "historique")} className="px-3 py-2 border border-blue-500 text-blue-700 rounded-lg text-sm font-semibold">
                                            <History className="w-4 h-4 inline mr-1" />Historique
                                        </button>
                                        {peutFacturer ? (
                                            <button type="button" onClick={() => openModal(patient, "facturer")} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold">
                                                <Wallet className="w-4 h-4 inline mr-1" />Facturer
                                            </button>
                                        ) : (
                                            <span className="px-3 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm">
                                                <CheckCircle2 className="w-4 h-4 inline mr-1" />Soldé
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <PatientInvoiceModal
                isOpen={modalOpen}
                mode={modalMode}
                onClose={handleModalClose}
                patient={selectedPatient}
                onSuccess={handleSuccess}
            />
        </div>
    );
}
