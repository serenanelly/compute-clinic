import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Progress, Table, Alert, Spin, Tag, Select } from 'antd';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  AlertCircle
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import AccountantLayout from '../AccountantLayout';
import AccountantPageHeader from '../AccountantPageHeader';
import { BarChart3 } from 'lucide-react';
import { getTableauDeBordData, getEvolutionMensuelle, getQuittancesValidees, getQuittancesAComptabiliser } from '../../../services/accountantApi';
import { Link } from 'react-router-dom';
import { AppRoutesPaths } from '../../../Router/appRouterPaths';
import { useFeedback } from '../../../contexts/FeedbackContext';

const { Option } = Select;

const MOIS_NOMS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export function AccountantHomePage() {
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [recentQuittances, setRecentQuittances] = useState([]);
  const [pendingCompta, setPendingCompta] = useState({ count: 0, total: 0 });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { showError } = useFeedback();

  useEffect(() => {
    loadDashboardData();
  }, [selectedYear]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [kpis, evolution, quittances, aComptabiliser] = await Promise.all([
        getTableauDeBordData(),
        getEvolutionMensuelle(selectedYear),
        getQuittancesValidees(),
        getQuittancesAComptabiliser(),
      ]);

      setKpiData(kpis);

      // Map evolution data for Recharts
      if (evolution && evolution.mois) {
        const mappedCharts = evolution.mois.map(item => ({
          name: MOIS_NOMS[item.mois - 1] || `Mois ${item.mois}`,
          // Aligné sur les cartes : dépenses comptables (classe 6) et résultat comptable,
          // même source de vérité que le tableau de bord (grand-livre), au lieu des
          // flux de trésorerie opérationnels (OP décaissés + dépenses menues).
          Recettes: item.recettes,
          Dépenses: item.depenses_comptabilisees ?? item.depenses,
          Résultat: item.resultat_comptable ?? item.resultat
        }));
        setChartData(mappedCharts);
      }

      // Keep only 5 most recent validated quittances
      if (quittances) {
        setRecentQuittances(quittances.slice(0, 5));
      }

      const list = aComptabiliser?.quittances || aComptabiliser || [];
      const arr = Array.isArray(list) ? list : [];
      const totalPending = arr.reduce((acc, q) => acc + parseFloat(q.montant || 0), 0);
      setPendingCompta({ count: aComptabiliser?.nombre ?? arr.length, total: totalPending });

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      showError('Erreur lors du chargement des statistiques du tableau de bord.', 'Erreur API');
    } finally {
      setLoading(false);
    }
  };

  const formatFCFA = (val) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(val || 0).replace('XAF', 'FCFA');
  };

  if (loading && !kpiData) {
    return (
      <AccountantLayout>
        <div className="flex items-center justify-center h-[70vh]">
          <Spin size="large" tip="Chargement des données comptables..." />
        </div>
      </AccountantLayout>
    );
  }

  const kpis = kpiData?.kpis || {};
  const budget = kpiData?.budget || {};
  const ecritures = kpiData?.ecritures || {};

  const columns = [
    {
      title: 'N° Quittance',
      dataIndex: 'numero_quittance',
      key: 'numero_quittance',
      render: (text) => <span className="font-semibold text-primary-end">{text}</span>
    },
    {
      title: 'Date',
      dataIndex: 'date_paiement',
      key: 'date_paiement',
      render: (text) => new Date(text).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    },
    {
      title: 'Motif',
      dataIndex: 'Motif',
      key: 'Motif',
      ellipsis: true,
    },
    {
      title: 'Mode',
      dataIndex: 'mode_paiement',
      key: 'mode_paiement',
      render: (text) => (
        <Tag color="blue" className="capitalize">
          {text?.replace('_', ' ')}
        </Tag>
      )
    },
    {
      title: 'Montant',
      dataIndex: 'Montant_paye',
      key: 'Montant_paye',
      align: 'right',
      render: (val) => <span className="font-bold text-green-600">{formatFCFA(val)}</span>
    }
  ];

  return (
    <AccountantLayout>
      <div className="space-y-6">
        <AccountantPageHeader
          title="Vue d'ensemble financière"
          subtitle="Indicateurs clés de performance et états de la trésorerie"
          icon={BarChart3}
          badge={
            <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1">
              Exercice {selectedYear}
            </span>
          }
        />

        {pendingCompta.count > 0 && (
          <Alert
            type="warning"
            showIcon
            message={`${pendingCompta.count} quittance(s) validée(s) en attente de comptabilisation (${formatFCFA(pendingCompta.total)})`}
            description={
              <span>
                Les recettes caisse n'apparaissent dans les états financiers qu'après génération de l'écriture.{' '}
                <Link to={AppRoutesPaths.accountantComptabilisation} className="font-semibold text-[#1A73A3] underline">
                  Aller à la comptabilisation
                </Link>
              </span>
            }
            className="rounded-xl"
          />
        )}

        {/* KPI Cards Grid — 3 par ligne, 2 lignes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Recettes */}
          <div className="bg-white rounded-2xl shadow-sm border-l-4 border-emerald-500 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Recettes Totales</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-gray-800 leading-tight">{formatFCFA(kpis.recettes_comptabilisees ?? kpis.total_recettes)}</p>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" /> Comptabilisées (classe 7)
              {(kpis.recettes_en_attente ?? 0) > 0 && (
                <span className="text-amber-600 font-medium"> · {formatFCFA(kpis.recettes_en_attente)} en attente</span>
              )}
            </p>
          </div>

          {/* Dépenses */}
          <div className="bg-white rounded-2xl shadow-sm border-l-4 border-rose-500 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-rose-600">Dépenses Totales</span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-rose-600" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-gray-800 leading-tight">{formatFCFA(kpis.total_depenses)}</p>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3" /> Sorties caisse + OP exécutés
              {(kpis.depenses_comptabilisees ?? 0) > 0 && (
                <span className="text-gray-500 font-medium"> · {formatFCFA(kpis.depenses_comptabilisees)} comptabilisées (cl. 6)</span>
              )}
            </p>
          </div>

          {/* Résultat Net */}
          <div className={`bg-white rounded-2xl shadow-sm border-l-4 p-5 hover:shadow-md transition-shadow ${(kpis.resultat_net ?? 0) >= 0 ? 'border-sky-500' : 'border-amber-500'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-bold uppercase tracking-widest ${(kpis.resultat_net ?? 0) >= 0 ? 'text-sky-600' : 'text-amber-600'}`}>Résultat Net</span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${(kpis.resultat_net ?? 0) >= 0 ? 'bg-sky-50' : 'bg-amber-50'}`}>
                <Scale className={`w-5 h-5 ${(kpis.resultat_net ?? 0) >= 0 ? 'text-sky-600' : 'text-amber-600'}`} />
              </div>
            </div>
            <p className={`text-2xl font-extrabold leading-tight ${(kpis.resultat_net ?? 0) >= 0 ? 'text-sky-700' : 'text-amber-700'}`}>{formatFCFA(kpis.resultat_net)}</p>
            <p className="text-xs text-gray-400 mt-1">
              Marge nette : <span className="font-semibold">{kpis.marge_nette_pct ?? 0}%</span>
              {kpis.resultat_net_comptable != null && (
                <span className="text-gray-400"> · Comptable : {formatFCFA(kpis.resultat_net_comptable)}</span>
              )}
            </p>
          </div>

          {/* Trésorerie */}
          <div className="bg-white rounded-2xl shadow-sm border-l-4 border-[#1A73A3] p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-[#1A73A3]">Solde Trésorerie</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-[#1A73A3]" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-gray-800 leading-tight">{formatFCFA(kpis.solde_tresorerie)}</p>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Classe 5 — Disponibilités</p>
          </div>

          {/* Créances */}
          <div className="bg-white rounded-2xl shadow-sm border-l-4 border-violet-500 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-violet-600">Créances Clients</span>
              <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-violet-600" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-gray-800 leading-tight">{formatFCFA(kpis.creances_clients)}</p>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Montant dû par les clients</p>
          </div>

          {/* Dettes */}
          <div className="bg-white rounded-2xl shadow-sm border-l-4 border-orange-400 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-orange-500">Dettes Fournisseurs</span>
              <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-500" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-gray-800 leading-tight">{formatFCFA(kpis.dettes_fournisseurs)}</p>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><ArrowDownRight className="w-3 h-3" /> Montant dû aux fournisseurs</p>
          </div>
        </div>

        {/* Charts & Budget Section */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Card title="Évolution Mensuelle des Flux Financiers" className="shadow-sm" bordered={false}>
              <div className="h-[350px]">
                {chartData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <AlertCircle className="w-12 h-12 mb-2 stroke-1" />
                    <p>Aucune écriture comptable validée pour cet exercice.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorRecettes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorDepenses" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(tick) => (tick / 1000) + "k"} />
                      <Tooltip formatter={(value) => formatFCFA(value)} />
                      <Legend />
                      <Area type="monotone" dataKey="Recettes" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRecettes)" />
                      <Area type="monotone" dataKey="Dépenses" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorDepenses)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </Col>

          {/* Budget & Statistics */}
          <Col xs={24} lg={8}>
            <div className="space-y-6">
              {/* Budget Card */}
              <Card
                title="Suivi Budgétaire"
                className="shadow-sm"
                bordered={false}
                extra={<span className="text-[10px] text-gray-400 font-medium">Enveloppe — ≠ trésorerie</span>}
              >
                <p className="text-xs text-gray-400 mb-3 -mt-1">Plafond d&apos;autorisation (hors bilan), distinct du solde caisse/banque.</p>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Prévu global</span>
                    <span className="font-bold text-gray-700">{formatFCFA(budget.prevu)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Consommé</span>
                    <span className="font-bold text-gray-700">{formatFCFA(budget.consomme)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-t pt-2">
                    <span className="text-gray-600 font-medium">Disponible</span>
                    <span className="font-bold text-emerald-600">{formatFCFA(budget.disponible)}</span>
                  </div>

                  <div className="pt-2">
                    <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                      <span>Taux de consommation</span>
                      <span>{budget.taux_consommation || 0}%</span>
                    </div>
                    <Progress
                      percent={budget.taux_consommation || 0}
                      status={budget.taux_consommation > 90 ? "exception" : "active"}
                      strokeColor={budget.taux_consommation > 90 ? "#f43f5e" : "#10b981"}
                      showInfo={false}
                    />
                  </div>
                </div>
              </Card>

              {/* Transactions Summary */}
              <Card title="Statuts des Écritures" className="shadow-sm" bordered={false}>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 p-3 rounded-lg border">
                    <p className="text-xs text-gray-500 font-semibold uppercase">Total</p>
                    <p className="text-xl font-bold text-gray-800 mt-1">{ecritures.total || 0}</p>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                    <p className="text-xs text-emerald-600 font-semibold uppercase">Validées</p>
                    <p className="text-xl font-bold text-emerald-700 mt-1">{ecritures.validees || 0}</p>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                    <p className="text-xs text-amber-600 font-semibold uppercase">Brouillon</p>
                    <p className="text-xl font-bold text-amber-700 mt-1">{ecritures.brouillons || 0}</p>
                  </div>
                </div>
              </Card>
            </div>
          </Col>
        </Row>

        {/* Recent Validated Receipts */}
        <Card title="Dernières Quittances Validées" className="shadow-sm" bordered={false}>
          <Table
            columns={columns}
            dataSource={recentQuittances}
            rowKey="idQuittance"
            pagination={false}
            locale={{ emptyText: 'Aucune quittance validée' }}
            size="middle"
          />
        </Card>
      </div>
    </AccountantLayout>
  );
}

export default AccountantHomePage;