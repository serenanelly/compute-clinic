import { useEffect, useState } from 'react';
import { Table, Tag, Card, Row, Col, DatePicker, Button, Space, Tabs, Alert, Empty, Select, Statistic, Tooltip } from 'antd';
import {
  FileText, RefreshCw, Printer, ArrowRightLeft, TrendingUp, TrendingDown,
  Wallet, Activity, BarChart2, Info, AlertTriangle, CheckCircle
} from 'lucide-react';
import AccountantLayout from '../AccountantLayout';
import {
  getBilan, getCompteResultat, getFluxTresorerie, getResultatParService,
  getExercices, getBudgets, getEvolutionMensuelle, getTableauDeBordData
} from '../../../services/accountantApi';
import { useFeedback } from '../../../contexts/FeedbackContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ReferenceLine
} from 'recharts';

const { RangePicker } = DatePicker;
const { Option } = Select;

const PIE_COLORS = ['#1A73A3', '#3399B0', '#50C2B9', '#051161', '#0ea5e9', '#6366f1', '#8b5cf6'];
const MOIS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

const SERVICE_LABELS = {
  maternite: 'Maternité & Gynécologie',
  pediatrie: 'Pédiatrie',
  chirurgie: 'Chirurgie Générale',
  laboratoire: "Laboratoire d'analyses",
  pharmacie: 'Pharmacie',
};

const fmt = (val) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 })
    .format(val || 0).replace('XAF', 'FCFA');

const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '0.0');

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color = '#1A73A3', trend, tooltip }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '20px 24px',
      border: '1px solid #e8edf5', boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: 8, height: '100%'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={18} color={color} />
        </div>
        {tooltip && (
          <Tooltip title={tooltip}>
            <Info size={14} color="#94a3b8" style={{ cursor: 'pointer' }} />
          </Tooltip>
        )}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{sub}</div>}
      </div>
      {trend !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          {trend >= 0
            ? <TrendingUp size={13} color="#10b981" />
            : <TrendingDown size={13} color="#ef4444" />}
          <span style={{ color: trend >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
          <span style={{ color: '#94a3b8' }}>vs mois préc.</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function RapportsPage() {
  const [activeTab, setActiveTab] = useState('evolution');
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [exercices, setExercices] = useState([]);
  const [selectedExercice, setSelectedExercice] = useState(undefined);

  // Data states
  const [bilanData, setBilanData] = useState(null);
  const [resultatData, setResultatData] = useState(null);
  const [fluxData, setFluxData] = useState(null);
  const [analytiqueData, setAnalytiqueData] = useState([]);
  const [evolutionN, setEvolutionN] = useState([]);
  const [evolutionN1, setEvolutionN1] = useState([]);
  const [dashKpis, setDashKpis] = useState(null);

  const { showError } = useFeedback();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed

  // Load exercises on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await getExercices();
        setExercices(res || []);
        const active = (res || []).find(e => e.statut === 'ouvert');
        if (active) setSelectedExercice(active.id);
      } catch (e) { console.error(e); }
    })();
  }, []);

  // Reload when tab / filters change
  useEffect(() => { loadData(); }, [activeTab, dateRange, selectedExercice]);

  const getFilters = () => {
    const filters = {};
    if (dateRange) {
      filters.date_debut = dateRange[0].format('YYYY-MM-DD');
      filters.date_fin   = dateRange[1].format('YYYY-MM-DD');
      filters.date       = dateRange[1].format('YYYY-MM-DD');
    } else if (selectedExercice) {
      const ex = exercices.find(e => e.id === selectedExercice);
      if (ex) {
        filters.date_debut = ex.date_debut;
        filters.date_fin   = ex.date_fin;
        filters.date       = ex.date_fin;
      }
    }
    return filters;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const filters = getFilters();
      if (activeTab === 'evolution') {
        const ex = exercices.find(e => e.id === selectedExercice);
        const yearN = ex?.annee || currentYear;
        const [evN, evN1, kpis] = await Promise.all([
          getEvolutionMensuelle(yearN, selectedExercice),
          getEvolutionMensuelle(yearN - 1),
          getTableauDeBordData().catch(() => null),
        ]);
        const moisN  = (evN?.mois  || []).map((m, i) => ({ ...m, name: MOIS_LABELS[i] }));
        const moisN1 = (evN1?.mois || []).map((m, i) => ({ ...m, name: MOIS_LABELS[i] }));
        const merged = moisN.map((m, i) => ({
          name: m.name,
          recettes_N:  m.recettes,
          recettes_attente_N: m.recettes_attente || 0,
          depenses_N:  m.depenses_operationnelles ?? m.depenses,
          depenses_compta_N: m.depenses_comptabilisees ?? m.depenses,
          depenses_op_N: m.depenses_operationnelles || 0,
          // Résultat net aligné sur le grand-livre (recettes cl.7 − charges cl.6),
          // cohérent avec le dashboard, la balance et le compte de résultat.
          resultat_N:  m.resultat_comptable ?? m.resultat,
          recettes_N1: moisN1[i]?.recettes || 0,
          depenses_N1: (moisN1[i]?.depenses_operationnelles ?? moisN1[i]?.depenses) || 0,
        }));
        setEvolutionN(merged);
        setEvolutionN1(moisN1);
        setDashKpis(kpis?.kpis || null);
      } else if (activeTab === 'indicateurs') {
        const kpis = await getTableauDeBordData().catch(() => null);
        setDashKpis(kpis?.kpis || null);
      } else if (activeTab === 'bilan') {
        setBilanData(await getBilan(filters));
      } else if (activeTab === 'resultat') {
        setResultatData(await getCompteResultat(filters));
      } else if (activeTab === 'flux') {
        setFluxData(await getFluxTresorerie(filters));
      } else if (activeTab === 'analytique') {
        const [repResponse, budgetsList] = await Promise.all([
          getResultatParService(filters),
          getBudgets().catch(() => []),
        ]);
        const rawServices = repResponse?.services || repResponse || [];

        // Maintenant l'API retourne recettes, depenses ET resultat
        const enriched = rawServices.map(s => {
          const serviceKey = s.service;
          const sb = (budgetsList || []).filter(b => b.service_hospitalier === serviceKey);
          const alloue = sb.reduce((sum, b) => sum + parseFloat(b.montant_prevu || 0), 0);
          const nbSorties = sb.filter(b => parseFloat(b.montant_consomme || 0) > 0).length;

          return {
            service: serviceKey,
            service_nom: SERVICE_LABELS[serviceKey] || serviceKey,
            recettes: parseFloat(s.recettes || 0),
            depenses: parseFloat(s.depenses || 0),
            resultat: parseFloat(s.resultat || 0),
            alloue,
            nbSorties,
          };
        }).filter(d => d.recettes > 0 || d.depenses > 0);

        setAnalytiqueData(enriched);
      }
    } catch (err) {
      console.error(err);
      showError('Erreur lors du chargement du rapport.', 'Échec');
    } finally {
      setLoading(false);
    }
  };

  // ─── Print handler ─────────────────────────────────────────────────────────
  const handlePrint = () => {
    const activeEx = exercices.find(e => e.id === selectedExercice);
    const dateStr = dateRange
      ? `${dateRange[0].format('DD/MM/YYYY')} au ${dateRange[1].format('DD/MM/YYYY')}`
      : activeEx
        ? `Exercice ${activeEx.code} (${new Date(activeEx.date_debut).toLocaleDateString('fr-FR')} - ${new Date(activeEx.date_fin).toLocaleDateString('fr-FR')})`
        : `Exercice ${currentYear}`;

    let body = '';

    if (activeTab === 'evolution') {
      const rows = evolutionN.map(m => `
        <tr>
          <td>${m.name}</td>
          <td style="color:#10b981;text-align:right">${fmt(m.recettes_N)}</td>
          <td style="color:#ef4444;text-align:right">${fmt(m.depenses_N)}</td>
          <td style="color:${m.resultat_N >= 0 ? '#10b981' : '#ef4444'};text-align:right;font-weight:bold">${fmt(m.resultat_N)}</td>
          <td style="color:#94a3b8;text-align:right">${fmt(m.recettes_N1)}</td>
          <td style="color:#94a3b8;text-align:right">${fmt(m.depenses_N1)}</td>
        </tr>`).join('');
      body = `
        <h2 style="color:#051161;text-align:center">ÉVOLUTION MENSUELLE DES FLUX FINANCIERS</h2>
        <p style="text-align:center;color:#64748b">${dateStr}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:20px">
          <thead>
            <tr style="background:#f1f5f9">
              <th style="padding:8px;text-align:left">Mois</th>
              <th style="padding:8px;text-align:right">Recettes ${currentYear}</th>
              <th style="padding:8px;text-align:right">Dépenses ${currentYear}</th>
              <th style="padding:8px;text-align:right">Résultat ${currentYear}</th>
              <th style="padding:8px;text-align:right">Recettes ${currentYear - 1}</th>
              <th style="padding:8px;text-align:right">Dépenses ${currentYear - 1}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    } else if (activeTab === 'indicateurs' && dashKpis) {
      const recettes = dashKpis.total_recettes || 0;
      const depenses = dashKpis.total_depenses || 0;
      const tresorerie = dashKpis.solde_tresorerie || 0;
      const creances = dashKpis.creances_clients || 0;
      const dettes = dashKpis.dettes_fournisseurs || 0;
      const resultat = dashKpis.resultat_net || 0;
      const bfr = creances - dettes;
      const tn = tresorerie - bfr;
      body = `
        <h2 style="color:#051161;text-align:center">INDICATEURS FINANCIERS CLÉS</h2>
        <p style="text-align:center;color:#64748b">${dateStr}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:20px">
          <thead><tr style="background:#f1f5f9"><th style="padding:8px;text-align:left">Indicateur</th><th style="padding:8px;text-align:right">Valeur</th><th style="padding:8px">Interprétation</th></tr></thead>
          <tbody>
            <tr><td style="padding:8px">Total Recettes (Classe 7)</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:bold">${fmt(recettes)}</td><td style="padding:8px;color:#64748b">Produits d'exploitation</td></tr>
            <tr><td style="padding:8px">Total Sorties (caisse + OP)</td><td style="padding:8px;text-align:right;color:#ef4444;font-weight:bold">${fmt(depenses)}</td><td style="padding:8px;color:#64748b">Aligné vue caissier</td></tr>
            ${dashKpis?.depenses_comptabilisees ? `<tr><td style="padding:8px">Charges comptabilisées (cl. 6)</td><td style="padding:8px;text-align:right;color:#f97316;font-weight:bold">${fmt(dashKpis.depenses_comptabilisees)}</td><td style="padding:8px;color:#64748b">Compte de résultat</td></tr>` : ''}
            <tr><td style="padding:8px">Résultat Net</td><td style="padding:8px;text-align:right;font-weight:bold;color:${resultat >= 0 ? '#10b981' : '#ef4444'}">${fmt(resultat)}</td><td style="padding:8px;color:#64748b">${resultat >= 0 ? 'Bénéfice' : 'Déficit'}</td></tr>
            <tr><td style="padding:8px">Marge Nette</td><td style="padding:8px;text-align:right;font-weight:bold">${pct(resultat, recettes)}%</td><td style="padding:8px;color:#64748b">Résultat / Recettes</td></tr>
            <tr><td style="padding:8px">Trésorerie Nette (TN)</td><td style="padding:8px;text-align:right;font-weight:bold;color:${tn >= 0 ? '#1A73A3' : '#ef4444'}">${fmt(tn)}</td><td style="padding:8px;color:#64748b">Solde trésorerie - BFR</td></tr>
            <tr><td style="padding:8px">Besoin en Fonds de Roulement (BFR)</td><td style="padding:8px;text-align:right;font-weight:bold">${fmt(bfr)}</td><td style="padding:8px;color:#64748b">Créances - Dettes</td></tr>
            <tr><td style="padding:8px">Créances Clients (411)</td><td style="padding:8px;text-align:right">${fmt(creances)}</td><td style="padding:8px;color:#64748b">Classe 4 débiteurs</td></tr>
            <tr><td style="padding:8px">Dettes Fournisseurs (401)</td><td style="padding:8px;text-align:right">${fmt(dettes)}</td><td style="padding:8px;color:#64748b">Classe 4 créditeurs</td></tr>
          </tbody>
        </table>`;
    } else if (activeTab === 'analytique') {
      const rows = analytiqueData.map(d => `
        <tr>
          <td style="padding:8px;font-weight:bold">${d.service_nom}</td>
          <td style="padding:8px;text-align:right;color:#10b981;font-weight:bold">${fmt(d.recettes)}</td>
          <td style="padding:8px;text-align:right;color:#ef4444;font-weight:bold">${fmt(d.depenses)}</td>
          <td style="padding:8px;text-align:right;font-weight:bold;color:${d.resultat >= 0 ? '#10b981' : '#ef4444'}">${fmt(d.resultat)}</td>
          <td style="padding:8px;text-align:center">${d.nbSorties || 0} sortie(s)</td>
        </tr>`).join('');
      body = `
        <h2 style="color:#051161;text-align:center">VENTILATION ANALYTIQUE PAR SERVICE</h2>
        <p style="text-align:center;color:#64748b">${dateStr}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:20px">
          <thead><tr style="background:#f1f5f9">
            <th style="padding:8px;text-align:left">Service</th>
            <th style="padding:8px;text-align:right">Recettes</th>
            <th style="padding:8px;text-align:right">Dépenses</th>
            <th style="padding:8px;text-align:right">Résultat</th>
            <th style="padding:8px;text-align:center">Sorties Budgétaires</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    } else if (activeTab === 'bilan' && bilanData) {
      body = `<h2 style="color:#051161;text-align:center">BILAN COMPTABLE SYSCOHADA</h2><p style="text-align:center">${dateStr}</p>
        <p><strong>Total Actif :</strong> ${fmt(bilanData.actif?.total_actif)}</p>
        <p><strong>Total Passif :</strong> ${fmt(bilanData.passif?.total_passif)}</p>
        <p><strong>Équilibre :</strong> ${bilanData.equilibre ? 'Bilan équilibré ✓' : 'Écart détecté ✗'}</p>`;
    } else if (activeTab === 'resultat' && resultatData) {
      body = `<h2 style="color:#051161;text-align:center">COMPTE DE RÉSULTAT</h2><p style="text-align:center">${dateStr}</p>
        <p><strong>Total Produits :</strong> ${fmt(resultatData.produits?.total)}</p>
        <p><strong>Total Charges :</strong> ${fmt(resultatData.charges?.total)}</p>
        <p><strong>Résultat Net :</strong> <span style="font-size:20px;font-weight:bold;color:${resultatData.resultat_net >= 0 ? '#10b981' : '#ef4444'}">${fmt(resultatData.resultat_net)}</span></p>`;
    } else {
      body = '<p>Aucune donnée à imprimer pour cet onglet.</p>';
    }

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Rapport Financier — Fultang</title>
      <style>body{font-family:Arial,sans-serif;padding:30px;color:#333}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}
      tr:nth-child(even){background:#f9f9f9}</style></head><body>
      <div style="text-align:center;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:20px">
        <h1 style="margin:0">Polyclinique Fultang</h1>
        <p style="margin:4px 0 0;font-size:12px;color:#666">Service de Comptabilité Financière & de Gestion</p>
        <p style="margin:2px 0 0;font-size:11px;color:#999">Généré le ${new Date().toLocaleString('fr-FR')}</p>
      </div>${body}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  // ─── Bilan columns ─────────────────────────────────────────────────────────
  const colsBilan = [
    { title: 'N° Compte', dataIndex: 'numero_compte', key: 'nc', width: '20%',
      render: t => <span style={{ fontWeight: 800, color: '#051161' }}>{t}</span> },
    { title: 'Libellé', dataIndex: 'libelle', key: 'lib', width: '55%' },
    { title: 'Solde', dataIndex: 'solde', key: 'sol', align: 'right',
      render: v => <span style={{ fontWeight: 600 }}>{fmt(Math.abs(v))}</span> },
  ];

  // ─── Analytique columns ────────────────────────────────────────────────────
  const colsAnalytique = [
    { title: 'Service', dataIndex: 'service_nom', key: 'sn',
      render: t => <span style={{ fontWeight: 700, color: '#0f172a' }}>{t}</span> },
    { title: 'Recettes', dataIndex: 'recettes', key: 'rec', align: 'right',
      render: v => <span style={{ fontWeight: 700, color: '#10b981' }}>{fmt(v)}</span> },
    { title: 'Dépenses', dataIndex: 'depenses', key: 'dep', align: 'right',
      render: v => <span style={{ fontWeight: 700, color: '#ef4444' }}>{fmt(v)}</span> },
    { title: 'Résultat', dataIndex: 'resultat', key: 'res', align: 'right',
      render: v => (
        <Tag color={v >= 0 ? 'success' : 'error'} style={{ fontWeight: 700, borderRadius: 20 }}>
          {fmt(v)}
        </Tag>
      ) },
    { title: 'Sorties Budgétaires', dataIndex: 'nbSorties', key: 'sorties', align: 'center',
      render: v => <Tag color="orange" style={{ borderRadius: 20 }}>{v || 0} ligne(s)</Tag> },
  ];

  // ─── Indicateurs financiers calculés ──────────────────────────────────────
  const buildIndicateurs = () => {
    if (!dashKpis) return null;
    const recettes   = dashKpis.total_recettes    || 0;
    const depenses   = dashKpis.total_depenses    || 0;
    const tresorerie = dashKpis.solde_tresorerie  || 0;
    const creances   = dashKpis.creances_clients  || 0;
    const dettes     = dashKpis.dettes_fournisseurs || 0;
    const resultat   = dashKpis.resultat_net      || 0;
    const marge      = dashKpis.marge_nette_pct   || 0;
    const bfr        = creances - dettes;
    const tn         = tresorerie - bfr;
    const ratioLiquidite = dettes > 0 ? (tresorerie / dettes).toFixed(2) : '∞';
    return { recettes, depenses, tresorerie, creances, dettes, resultat, marge, bfr, tn, ratioLiquidite };
  };

  // ─── Tab: Évolution Mensuelle ──────────────────────────────────────────────
  const tabEvolution = (
    <div style={{ paddingTop: 16 }}>
      <Alert
        type="info"
        showIcon
        style={{ borderRadius: 12, marginBottom: 20 }}
        message={<span style={{ fontWeight: 700 }}>À quoi sert l'évolution mensuelle ?</span>}
        description={
          <span style={{ fontSize: 13 }}>
            Ce graphique compare mois par mois les recettes et dépenses de l'exercice en cours ({currentYear})
            face à l'exercice précédent ({currentYear - 1}). Il permet d'anticiper les pics d'activité,
            de détecter les mois déficitaires et de justifier les demandes de budget supplémentaire.
            Le mois actuel est mis en évidence par une ligne de référence.
          </span>
        }
      />

      {/* Graphique comparatif N vs N-1 */}
      <Card
        title={<span style={{ fontWeight: 800, color: '#051161' }}>Recettes — {currentYear} vs {currentYear - 1}</span>}
        bordered={false}
        style={{ borderRadius: 16, border: '1px solid #e8edf5', marginBottom: 20 }}
      >
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={evolutionN} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontWeight: 600, fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <RechartsTooltip formatter={v => fmt(v)} />
              <Legend />
              <ReferenceLine x={MOIS_LABELS[currentMonth]} stroke="#1A73A3" strokeDasharray="4 4" label={{ value: 'Mois actuel', fill: '#1A73A3', fontSize: 11 }} />
              <Bar dataKey="recettes_N"  name={`Recettes ${currentYear}`}       fill="#1A73A3" radius={[4,4,0,0]} barSize={14} />
              <Bar dataKey="recettes_N1" name={`Recettes ${currentYear - 1}`}   fill="#50C2B9" radius={[4,4,0,0]} barSize={14} opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Graphique dépenses N vs N-1 */}
      <Card
        title={<span style={{ fontWeight: 800, color: '#051161' }}>Dépenses — {currentYear} vs {currentYear - 1}</span>}
        bordered={false}
        style={{ borderRadius: 16, border: '1px solid #e8edf5', marginBottom: 20 }}
      >
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={evolutionN} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontWeight: 600, fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <RechartsTooltip formatter={v => fmt(v)} />
              <Legend />
              <ReferenceLine x={MOIS_LABELS[currentMonth]} stroke="#ef4444" strokeDasharray="4 4" />
              <Bar dataKey="depenses_N"  name={`Sorties caisse / OP ${currentYear}`}     fill="#ef4444" radius={[4,4,0,0]} barSize={14} />
              <Bar dataKey="depenses_compta_N" name={`Charges comptabilisées ${currentYear}`} fill="#fca5a5" radius={[4,4,0,0]} barSize={10} />
              <Bar dataKey="depenses_N1" name={`Sorties ${currentYear - 1}`} fill="#fecaca" radius={[4,4,0,0]} barSize={14} opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Courbe résultat net mensuel */}
      <Card
        title={<span style={{ fontWeight: 800, color: '#051161' }}>Résultat Net Mensuel {currentYear}</span>}
        bordered={false}
        style={{ borderRadius: 16, border: '1px solid #e8edf5' }}
      >
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolutionN} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontWeight: 600, fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <RechartsTooltip formatter={v => fmt(v)} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
              <ReferenceLine x={MOIS_LABELS[currentMonth]} stroke="#1A73A3" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="resultat_N" name="Résultat Net" stroke="#051161" strokeWidth={2.5} dot={{ r: 4, fill: '#051161' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );

  // ─── Tab: Indicateurs Financiers ──────────────────────────────────────────
  const tabIndicateurs = () => {
    const ind = buildIndicateurs();
    if (!ind) return <Empty description="Données indisponibles" style={{ padding: 48 }} />;
    const { recettes, depenses, tresorerie, creances, dettes, resultat, marge, bfr, tn, ratioLiquidite } = ind;

    return (
      <div style={{ paddingTop: 16 }}>
        <Alert
          type="info" showIcon style={{ borderRadius: 12, marginBottom: 24 }}
          message={<span style={{ fontWeight: 700 }}>Indicateurs de santé financière</span>}
          description="Ces indicateurs sont calculés en temps réel à partir des écritures comptables validées. Ils permettent d'évaluer l'équilibre financier, la rentabilité et la capacité d'autofinancement de la clinique."
        />

        {/* Ligne 1 : Recettes / Dépenses / Résultat / Marge */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard icon={TrendingUp} label="Total Recettes (Cl. 7)" value={fmt(recettes)}
              color="#10b981" tooltip="Somme de tous les produits d'exploitation (classe 7)" />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard icon={TrendingDown} label="Total Sorties (caisse + OP)" value={fmt(depenses)}
              sub={dashKpis.depenses_comptabilisees ? `${fmt(dashKpis.depenses_comptabilisees)} comptabilisées (cl. 6)` : 'Aligné vue caissier'}
              color="#ef4444"
              tooltip="Dépenses menues + ordres de paiement exécutés (même périmètre que la caisse)" />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard
              icon={resultat >= 0 ? CheckCircle : AlertTriangle}
              label="Résultat Net"
              value={fmt(resultat)}
              sub={resultat >= 0 ? 'Bénéfice' : 'Déficit'}
              color={resultat >= 0 ? '#10b981' : '#ef4444'}
              tooltip="Recettes - Dépenses"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard icon={BarChart2} label="Marge Nette" value={`${marge}%`}
              sub="Résultat / Recettes × 100"
              color="#1A73A3"
              tooltip="Indique quelle part des recettes se transforme en bénéfice net" />
          </Col>
        </Row>

        {/* Ligne 2 : Trésorerie / BFR / TN / Ratio liquidité */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard icon={Wallet} label="Trésorerie (Cl. 5)" value={fmt(tresorerie)}
              color="#1A73A3"
              tooltip="Solde net des comptes de trésorerie (classe 5 : caisse + banque)" />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard icon={Activity} label="BFR (Besoin Fonds Roulement)" value={fmt(bfr)}
              sub="Créances - Dettes"
              color={bfr > 0 ? '#f59e0b' : '#10b981'}
              tooltip="BFR = Créances clients (411) - Dettes fournisseurs (401). Un BFR positif signifie que la clinique finance ses clients avant d'être payée par ses fournisseurs." />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard icon={ArrowRightLeft} label="Trésorerie Nette (TN)" value={fmt(tn)}
              sub="Trésorerie - BFR"
              color={tn >= 0 ? '#10b981' : '#ef4444'}
              tooltip="TN = Trésorerie - BFR. Mesure la liquidité disponible après couverture du besoin en fonds de roulement. Un TN positif est sain." />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard icon={FileText} label="Ratio Liquidité Immédiate" value={ratioLiquidite}
              sub="Trésorerie / Dettes fournisseurs"
              color={parseFloat(ratioLiquidite) >= 1 ? '#10b981' : '#ef4444'}
              tooltip="Un ratio ≥ 1 signifie que la clinique peut couvrir toutes ses dettes fournisseurs avec sa trésorerie disponible." />
          </Col>
        </Row>

        {/* Ligne 3 : Créances / Dettes */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12}>
            <KpiCard icon={TrendingUp} label="Créances Clients (411)" value={fmt(creances)}
              sub="Montants dus par les patients / assurances"
              color="#0ea5e9"
              tooltip="Somme des comptes clients débiteurs (classe 411). Ce sont des recettes à encaisser." />
          </Col>
          <Col xs={24} sm={12}>
            <KpiCard icon={TrendingDown} label="Dettes Fournisseurs (401)" value={fmt(dettes)}
              sub="Montants dus aux fournisseurs"
              color="#8b5cf6"
              tooltip="Somme des comptes fournisseurs créditeurs (classe 401). Ce sont des charges à décaisser." />
          </Col>
        </Row>

        {/* Graphique synthèse */}
        <Card
          title={<span style={{ fontWeight: 800, color: '#051161' }}>Synthèse Financière — Vue d'ensemble</span>}
          bordered={false}
          style={{ borderRadius: 16, border: '1px solid #e8edf5' }}
        >
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Recettes', valeur: recettes, fill: '#10b981' },
                  { name: 'Dépenses', valeur: depenses, fill: '#ef4444' },
                  { name: 'Résultat Net', valeur: Math.abs(resultat), fill: resultat >= 0 ? '#1A73A3' : '#f59e0b' },
                  { name: 'Trésorerie', valeur: tresorerie, fill: '#50C2B9' },
                  { name: 'Créances', valeur: creances, fill: '#0ea5e9' },
                  { name: 'Dettes', valeur: dettes, fill: '#8b5cf6' },
                ]}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontWeight: 600, fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <RechartsTooltip formatter={v => fmt(v)} />
                <Bar dataKey="valeur" name="Montant" radius={[6,6,0,0]} barSize={36}>
                  {[
                    { fill: '#10b981' }, { fill: '#ef4444' },
                    { fill: resultat >= 0 ? '#1A73A3' : '#f59e0b' },
                    { fill: '#50C2B9' }, { fill: '#0ea5e9' }, { fill: '#8b5cf6' }
                  ].map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    );
  };

  // ─── Tab: Analytique par Service ──────────────────────────────────────────
  const tabAnalytique = (
    <div style={{ paddingTop: 16 }}>
      {analytiqueData.length > 0 ? (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            {/* Camembert Recettes */}
            <Col xs={24} md={8}>
              <Card
                title={<span style={{ fontWeight: 800, color: '#051161', fontSize: 13 }}>Répartition des Recettes</span>}
                bordered={false} style={{ borderRadius: 16, border: '1px solid #e8edf5', height: '100%' }}
              >
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analytiqueData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                        paddingAngle={4} dataKey="recettes" nameKey="service_nom">
                        {analytiqueData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={v => fmt(v)} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>

            {/* Camembert Dépenses */}
            <Col xs={24} md={8}>
              <Card
                title={<span style={{ fontWeight: 800, color: '#051161', fontSize: 13 }}>Répartition des Dépenses</span>}
                bordered={false} style={{ borderRadius: 16, border: '1px solid #e8edf5', height: '100%' }}
              >
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analytiqueData.filter(d => d.depenses > 0)} cx="50%" cy="50%"
                        innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="depenses" nameKey="service_nom">
                        {analytiqueData.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={v => fmt(v)} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>

            {/* Camembert Sorties Budgétaires par Service */}
            <Col xs={24} md={8}>
              <Card
                title={<span style={{ fontWeight: 800, color: '#051161', fontSize: 13 }}>Sorties Budgétaires par Service</span>}
                bordered={false} style={{ borderRadius: 16, border: '1px solid #e8edf5', height: '100%' }}
              >
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytiqueData.filter(d => d.depenses > 0)}
                        cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                        paddingAngle={4} dataKey="depenses" nameKey="service_nom"
                        label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                        labelLine={false}
                      >
                        {analytiqueData.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 4) % PIE_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={v => fmt(v)} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Montant total des dépenses consommées par service
                </div>
              </Card>
            </Col>
          </Row>

          {/* Graphique barres groupées */}
          <Card
            title={<span style={{ fontWeight: 800, color: '#051161' }}>Rentabilité par Service — Recettes vs Dépenses</span>}
            bordered={false} style={{ borderRadius: 16, border: '1px solid #e8edf5', marginBottom: 20 }}
          >
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytiqueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="service_nom" tickLine={false} axisLine={false}
                    tick={{ fill: '#64748b', fontWeight: 600, fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false}
                    tickFormatter={v => `${(v/1000000).toFixed(1)}M`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <RechartsTooltip formatter={v => fmt(v)} />
                  <Legend />
                  <Bar dataKey="recettes" name="Recettes" fill="#10b981" radius={[4,4,0,0]} barSize={18} />
                  <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" radius={[4,4,0,0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Tableau détaillé */}
          <Table
            columns={colsAnalytique}
            dataSource={analytiqueData}
            rowKey="service"
            loading={loading}
            pagination={false}
            size="middle"
            style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #e8edf5' }}
            locale={{ emptyText: 'Aucune donnée analytique sur cette période' }}
          />
        </>
      ) : (
        <Empty description="Aucune donnée analytique disponible" style={{ padding: 48 }} />
      )}
    </div>
  );

  // ─── Tab: Bilan ────────────────────────────────────────────────────────────
  const tabBilan = (
    <div style={{ paddingTop: 16 }}>
      {bilanData ? (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={24} sm={8}>
              <div style={{ background: '#eff6ff', borderRadius: 14, padding: '20px 24px', textAlign: 'center', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Actif</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#051161', marginTop: 4 }}>{fmt(bilanData.actif?.total_actif)}</div>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ background: '#fefce8', borderRadius: 14, padding: '20px 24px', textAlign: 'center', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Passif</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#051161', marginTop: 4 }}>{fmt(bilanData.passif?.total_passif)}</div>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ background: bilanData.equilibre ? '#f0fdf4' : '#fff1f2', borderRadius: 14, padding: '20px 24px', textAlign: 'center', border: `1px solid ${bilanData.equilibre ? '#bbf7d0' : '#fecdd3'}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Équilibre</div>
                <Tag color={bilanData.equilibre ? 'success' : 'error'} style={{ marginTop: 8, fontWeight: 700, borderRadius: 20, fontSize: 13 }}>
                  {bilanData.equilibre ? 'Bilan Équilibré ✓' : 'Écart Détecté ✗'}
                </Tag>
              </div>
            </Col>
          </Row>
          <Row gutter={[20, 20]}>
            <Col xs={24} lg={12}>
              <Card title={<span style={{ fontWeight: 800, color: '#051161' }}>ACTIF (Emplois)</span>}
                bordered={false} style={{ borderRadius: 16, border: '1px solid #e8edf5' }}>
                {[
                  { label: 'Immobilisations (Cl. 2)', data: bilanData.actif?.immobilisations },
                  { label: 'Stocks (Cl. 3)', data: bilanData.actif?.stocks },
                  { label: 'Créances Clients (Cl. 4)', data: bilanData.actif?.creances_tiers },
                  { label: 'Trésorerie Active (Cl. 5)', data: bilanData.actif?.tresorerie_active },
                ].map(({ label, data }) => (
                  <div key={label} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>
                    <Table columns={colsBilan} dataSource={data || []} rowKey="numero_compte" pagination={false} size="small" />
                  </div>
                ))}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title={<span style={{ fontWeight: 800, color: '#051161' }}>PASSIF (Ressources)</span>}
                bordered={false} style={{ borderRadius: 16, border: '1px solid #e8edf5' }}>
                {[
                  { label: 'Capitaux Propres (Cl. 1)', data: bilanData.passif?.capitaux_propres },
                  { label: 'Dettes Tiers (Cl. 4)', data: bilanData.passif?.dettes_tiers },
                  { label: 'Trésorerie Passive (Cl. 5)', data: bilanData.passif?.tresorerie_passive },
                ].map(({ label, data }) => (
                  <div key={label} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>
                    <Table columns={colsBilan} dataSource={data || []} rowKey="numero_compte" pagination={false} size="small" />
                  </div>
                ))}
              </Card>
            </Col>
          </Row>
        </div>
      ) : (
        <Empty description="Données du bilan indisponibles" style={{ padding: 48 }} />
      )}
    </div>
  );

  // ─── Tab: Compte de Résultat ───────────────────────────────────────────────
  const tabResultat = (
    <div style={{ paddingTop: 16 }}>
      {resultatData ? (
        <div>
          <div style={{
            padding: '28px 32px', borderRadius: 16, textAlign: 'center', marginBottom: 24,
            background: resultatData.resultat_net >= 0 ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : 'linear-gradient(135deg,#fff1f2,#ffe4e6)',
            border: `1px solid ${resultatData.resultat_net >= 0 ? '#bbf7d0' : '#fecdd3'}`
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Résultat Net de la Période</div>
            <div style={{ fontSize: 40, fontWeight: 900, color: resultatData.resultat_net >= 0 ? '#10b981' : '#ef4444', marginTop: 8 }}>
              {fmt(resultatData.resultat_net)}
            </div>
            <Tag color={resultatData.resultat_net >= 0 ? 'success' : 'error'}
              style={{ marginTop: 10, fontWeight: 800, borderRadius: 20, fontSize: 12, padding: '2px 16px' }}>
              {resultatData.type_resultat}
            </Tag>
          </div>
          <Row gutter={[20, 20]}>
            <Col xs={24} lg={12}>
              <Card title={<span style={{ fontWeight: 800, color: '#10b981' }}>PRODUITS (Classe 7)</span>}
                bordered={false} style={{ borderRadius: 16, border: '1px solid #e8edf5' }}>
                <Table columns={colsBilan} dataSource={resultatData.produits?.detail || []}
                  rowKey="numero_compte" pagination={false} size="middle"
                  footer={() => (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#10b981' }}>
                      <span>TOTAL PRODUITS</span><span>{fmt(resultatData.produits?.total)}</span>
                    </div>
                  )} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title={<span style={{ fontWeight: 800, color: '#ef4444' }}>CHARGES (Classe 6)</span>}
                bordered={false} style={{ borderRadius: 16, border: '1px solid #e8edf5' }}>
                <Table columns={colsBilan} dataSource={resultatData.charges?.detail || []}
                  rowKey="numero_compte" pagination={false} size="middle"
                  footer={() => (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#ef4444' }}>
                      <span>TOTAL CHARGES</span><span>{fmt(resultatData.charges?.total)}</span>
                    </div>
                  )} />
              </Card>
            </Col>
          </Row>
        </div>
      ) : (
        <Empty description="Données du compte de résultat indisponibles" style={{ padding: 48 }} />
      )}
    </div>
  );

  // ─── Tab: Flux de Trésorerie ───────────────────────────────────────────────
  const tabFlux = (
    <div style={{ paddingTop: 16 }}>
      {fluxData ? (
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Card bordered={false} style={{ borderRadius: 16, border: '1px solid #e8edf5' }}
            title={<span style={{ fontWeight: 800, color: '#051161' }}>Tableau des Flux de Trésorerie</span>}>
            {[
              { label: 'Flux d\'Activité (Opérationnels)', sub: 'Excédent généré par l\'exploitation courante', val: fluxData.flux_operationnels },
              { label: 'Flux d\'Investissement', sub: 'Acquisitions d\'immobilisations et équipements (Cl. 2)', val: fluxData.flux_investissement },
              { label: 'Flux de Financement', sub: 'Mouvements de capitaux propres et emprunts (Cl. 1)', val: fluxData.flux_financement },
            ].map(({ label, sub, val }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{label}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{sub}</div>
                </div>
                <span style={{ fontSize: 18, fontWeight: 800, color: val >= 0 ? '#10b981' : '#ef4444' }}>{fmt(val)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 16px', background: '#f8fafc', borderRadius: 12, marginTop: 16, border: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#051161', fontSize: 15 }}>VARIATION NETTE DE TRÉSORERIE</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Somme des trois flux</div>
              </div>
              <span style={{ fontSize: 26, fontWeight: 900, color: fluxData.variation_tresorerie >= 0 ? '#10b981' : '#ef4444' }}>
                {fmt(fluxData.variation_tresorerie)}
              </span>
            </div>
          </Card>
        </div>
      ) : (
        <Empty description="Données des flux indisponibles" style={{ padding: 48 }} />
      )}
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <AccountantLayout>
      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#051161' }}>
              États &amp; Rapports Financiers
            </h1>
            <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 13 }}>
              Rapports de synthèse, indicateurs financiers et analyses analytiques — conformes SYSCOHADA.
            </p>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<Printer size={15} />}
              onClick={handlePrint}
              style={{ background: '#051161', border: 'none', borderRadius: 10, height: 38, fontWeight: 700 }}
            >
              Imprimer
            </Button>
            <Button
              icon={<RefreshCw size={15} />}
              onClick={loadData}
              style={{ borderRadius: 10, height: 38, fontWeight: 600 }}
            >
              Actualiser
            </Button>
          </Space>
        </div>

        {/* Filters */}
        <Card bordered={false} style={{ borderRadius: 16, border: '1px solid #e8edf5', marginBottom: 20 }}>
          <Row gutter={[20, 12]} align="middle">
            <Col xs={24} md={12}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#051161', whiteSpace: 'nowrap' }}>Exercice :</span>
                <Select
                  value={selectedExercice}
                  onChange={v => { setSelectedExercice(v); setDateRange(null); }}
                  style={{ width: '100%' }}
                  placeholder="Sélectionner un exercice..."
                  allowClear
                >
                  {exercices.map(e => (
                    <Option key={e.id} value={e.id}>
                      {e.code} — {e.statut === 'ouvert' ? '🟢 Actif' : '🔒 Clôturé'}
                    </Option>
                  ))}
                </Select>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap' }}>Période :</span>
                <RangePicker
                  style={{ width: '100%', borderRadius: 10 }}
                  onChange={dates => { setDateRange(dates); if (dates) setSelectedExercice(undefined); }}
                  placeholder={['Date début', 'Date fin']}
                />
              </div>
            </Col>
          </Row>
        </Card>

        {/* Tabs */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e8edf5', padding: '0 24px 24px' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'evolution',
                label: <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}><TrendingUp size={14} />Évolution Mensuelle</span>,
                children: tabEvolution,
              },
              {
                key: 'indicateurs',
                label: <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}><BarChart2 size={14} />Indicateurs Financiers</span>,
                children: tabIndicateurs(),
              },
              {
                key: 'analytique',
                label: <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}><Activity size={14} />Analytique par Service</span>,
                children: tabAnalytique,
              },
              {
                key: 'bilan',
                label: <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}><FileText size={14} />Bilan Comptable</span>,
                children: tabBilan,
              },
              {
                key: 'resultat',
                label: <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}><ArrowRightLeft size={14} />Compte de Résultat</span>,
                children: tabResultat,
              },
              {
                key: 'flux',
                label: <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}><Wallet size={14} />Flux de Trésorerie</span>,
                children: tabFlux,
              },
            ]}
          />
        </div>
      </div>
    </AccountantLayout>
  );
}

export default RapportsPage;
