import React, { useState, useEffect } from 'react';
import { PharmacistDashBoard } from "./Components/PharmacistDashboard.jsx";
import { PharmacistNavLink } from "./PharmacistNavLink.js";
import {
  Plus,
  Search,
  ClipboardList,
  FileText,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShoppingCart,
  RefreshCw,
  ArrowUpRight,
  TrendingUp,
  Inbox,
  Pill,
  LayoutDashboard,
  Calendar,
  AlertCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export const PharmacistHome = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Nouveaux états pour la recherche
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("name");
  const [searchStockQuery, setSearchStockQuery] = useState("");

  // Données de la file d'attente
  const queueData = [
    {
      id: "PAT-2026-04872",
      name: "Mbarga Jean",
      statusText: "Prescription reçue — à analyser",
      time: "5 min",
      dotColor: "bg-primary-start"
    },
    {
      id: "PAT-2026-04801",
      name: "Ndoumou Claire",
      statusText: "Interaction oméprazole ↔ clopidogrel détectée",
      time: "18 min",
      dotColor: "bg-red-500"
    },
    {
      id: "PAT-2026-04765",
      name: "Biya André",
      statusText: "Validée — prête à délivrer",
      time: "22 min",
      dotColor: "bg-primary-end"
    },
    {
      id: "PAT-2026-04710",
      name: "Essomba Pierre",
      statusText: "Conciliation médicamenteuse en cours",
      time: "34 min",
      dotColor: "bg-amber-500"
    },
    {
      id: "PAT-2026-04698",
      name: "Mvogo Sophie",
      statusText: "Délivrée — fiche de sortie à générer",
      time: "41 min",
      dotColor: "bg-primary-end"
    }
  ];

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

  // Données de stock
  const stockData = [
    {
      name: "Clopidogrel 75mg",
      statusText: "Stock critique — 8 unités · réapprovisionnement urgent",
      dotColor: "bg-red-600"
    },
    {
      name: "Pantoprazole 40mg",
      statusText: "Stock bas — 23 unités · à planifier",
      dotColor: "bg-amber-600"
    }
  ];

  const filteredStock = stockData.filter(med => {
    if (!searchStockQuery) return true;
    return med.name.toLowerCase().includes(searchStockQuery.toLowerCase());
  });

  // Mise à jour de l'heure en temps réel
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const formatDate = (date) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('fr-FR', options);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <PharmacistDashBoard linkList={PharmacistNavLink} requiredRole="pharmacien" requiredFunctionalService="PHARMACIE">
      <div className="bg-slate-50 text-slate-800 min-h-screen p-8 flex flex-col gap-8 overflow-y-auto scrollbar">

        {/* EN-TÊTE DYNAMIQUE */}
        <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <LayoutDashboard className="w-7 h-7 mr-2 text-primary-start" />
                    Tableau de Bord Pharmacie
                </h2>
                <p className="text-sm text-gray-500 mt-1">Gestion de la dispensation des médicaments, des stocks et de la comptabilité matière.</p>
            </div>
            <div className="flex items-center gap-3">
                <button
                    onClick={handleRefresh}
                    className={`p-2 text-gray-400 hover:text-primary-start hover:bg-white rounded-lg border border-gray-200 transition-all shadow-sm`}
                    title="Rafraîchir"
                >
                    <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>
        </div>

        {/* CARTES DE MÉTRIQUES (NOUVEAU DESIGN) */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2 shadow-sm transition-transform hover:-translate-y-0.5">
              <span className="text-sm font-medium text-slate-600 leading-tight">Prescriptions<br />reçues</span>
              <div>
                <span className="text-2xl font-bold text-slate-900 block leading-none">24</span>
                <span className="text-xs font-medium text-primary-end mt-1 block">↑ 3 vs hier</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2 shadow-sm transition-transform hover:-translate-y-0.5">
              <span className="text-sm font-medium text-slate-600 leading-tight">À valider</span>
              <div>
                <span className="text-2xl font-bold text-amber-600 block leading-none">7</span>
                <span className="text-xs text-slate-500 mt-1 block">en attente</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2 shadow-sm transition-transform hover:-translate-y-0.5">
              <span className="text-sm font-medium text-slate-600 leading-tight">Anomalies<br />ouvertes</span>
              <div>
                <span className="text-2xl font-bold text-red-600 block leading-none">2</span>
                <span className="text-xs text-slate-500 mt-1 block">non résolues</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2 shadow-sm transition-transform hover:-translate-y-0.5">
              <span className="text-sm font-medium text-slate-600 leading-tight">Délivrances</span>
              <div>
                <span className="text-2xl font-bold text-slate-900 block leading-none">15</span>
                <span className="text-xs font-medium text-primary-end mt-1 block">63 % du jour</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2 shadow-sm transition-transform hover:-translate-y-0.5">
              <span className="text-sm font-medium text-slate-600 leading-tight">Conciliations</span>
              <div>
                <span className="text-2xl font-bold text-slate-900 block leading-none">9</span>
                <span className="text-xs text-slate-500 mt-1 block">réalisées</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-2 shadow-sm transition-transform hover:-translate-y-0.5">
              <span className="text-sm font-medium text-slate-600 leading-tight">Fiches de sortie</span>
              <div>
                <span className="text-2xl font-bold text-slate-900 block leading-none">5</span>
                <span className="text-xs text-slate-500 mt-1 block">générées</span>
              </div>
            </div>

          </div>

          {/* ALERTE BANNIÈRE */}
          <div className="bg-red-50 border border-red-200 rounded-lg py-3 px-4 flex items-center gap-3 mt-1">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <span className="text-sm font-medium text-red-700">
              2 prescriptions bloquées par une anomalie non résolue — délivrance impossible avant correction
            </span>
          </div>
        </div>

        {/* FILE D'ATTENTE EN COURS (NOUVEAU DESIGN) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="border-b border-slate-200 pb-4 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-sm font-medium text-slate-500 shrink-0">File d'attente en cours</h3>

            {/* CONTRÔLES DE RECHERCHE */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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

            {filteredQueue.length > 0 ? (
              filteredQueue.map((patient, index) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors -mx-6 px-6 cursor-pointer gap-2 sm:gap-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${patient.dotColor} shrink-0`}></div>
                    <span className="font-semibold text-slate-900 text-sm">{patient.name}</span>
                    <span className="text-slate-500 text-xs font-medium">· {patient.id}</span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 text-sm w-full sm:w-auto">
                    <span className="text-slate-600 truncate ml-5 sm:ml-0">{patient.statusText}</span>
                    <span className="text-slate-400 text-xs w-10 text-right shrink-0">{patient.time}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-500 text-sm">
                Aucun patient trouvé pour "{searchQuery}"
              </div>
            )}

          </div>
        </div>

        {/* ALERTES STOCK PHARMACIE (NOUVEAU DESIGN) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col mt-6">
          <div className="border-b border-slate-200 pb-4 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-sm font-medium text-slate-500 shrink-0">Alertes stock pharmacie</h3>

            {/* CONTRÔLES DE RECHERCHE */}
            <div className="flex items-center w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher un médicament..."
                  value={searchStockQuery}
                  onChange={(e) => setSearchStockQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-end/30 focus:border-primary-end transition-all"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col">

            {filteredStock.length > 0 ? (
              filteredStock.map((med, index) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors -mx-6 px-6 cursor-pointer gap-2 sm:gap-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${med.dotColor} shrink-0`}></div>
                    <span className="font-semibold text-slate-900 text-sm">{med.name}</span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 text-sm w-full sm:w-auto">
                    <span className="text-slate-600 truncate ml-5 sm:ml-0">{med.statusText}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-500 text-sm">
                Aucun médicament trouvé pour "{searchStockQuery}"
              </div>
            )}

          </div>
        </div>

        {/* Accès rapide — Comptabilité matière */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mt-6">
          <h3 className="text-sm font-medium text-slate-500 mb-4">Gestion stock & comptabilité matière</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: "Liste des médicaments", path: "/pharmacist/medication-list", icon: Pill },
              { label: "Émettre un besoin", path: "/pharmacist/emit-need", icon: ClipboardList },
              { label: "Ventes du jour", path: "/pharmacist/daily-sales", icon: ShoppingCart },
              { label: "Inventaire", path: "/pharmacist/inventory", icon: Activity },
              { label: "Rapports", path: "/pharmacist/reports", icon: FileText },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-primary-end hover:bg-slate-50 transition-all text-left"
                >
                  <Icon className="w-5 h-5 text-primary-end shrink-0" />
                  <span className="text-sm font-semibold text-slate-800">{item.label}</span>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 ml-auto" />
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </PharmacistDashBoard>
  );
};

export default PharmacistHome;

