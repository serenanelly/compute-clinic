import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Button, Space, Tabs, DatePicker, Empty, Alert, Spin } from 'antd';
import {
    TrendingUp, TrendingDown, FileText, RefreshCw, Printer,
    Activity, Wallet, DollarSign, BarChart2, Info
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { CashierLayout } from './components/CashierLayout.jsx';
import { CashierPageHeader } from './components/CashierPageHeader.jsx';
import { CASHIER_COLORS } from './components/cashierTheme.js';
import { CaisseContextBanner } from './components/CaisseContextBanner.jsx';
import { getRapportCaisse, getHistoriqueFlux } from '../../services/caissierApi';
import { getEvolutionMensuelle } from '../../services/accountantApi';
import { useFeedback } from '../../contexts/FeedbackContext';
import { APP_NAME, brandFooter } from '../../constants/branding.js';

const { RangePicker } = DatePicker;

// Unified elegant corporate color palette
const COLORS = CASHIER_COLORS;

const KpiCard = ({ title, value, suffix, icon: Icon, color, subtitle }) => (
    <Card style={{
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        height: '100%',
        background: '#ffffff'
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                    {title}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: color || '#0f172a' }}>
                    {value}
                </div>
                {suffix && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{suffix}</div>}
                {subtitle && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color || COLORS.brandBlue }}></span>
                        {subtitle}
                    </div>
                )}
            </div>
            <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: '#f1f5f9',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <Icon size={18} style={{ color: color || COLORS.brandBlue }} />
            </div>
        </div>
    </Card>
);

export function CashierFinancialReport() {
    const [activeTab, setActiveTab] = useState('kpi');
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState(null);
    const [kpiData, setKpiData] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [quittancesData, setQuittancesData] = useState([]);

    const { showError } = useFeedback();

    const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

    useEffect(() => { loadReportData(); }, [activeTab, dateRange]);

    const loadReportData = async () => {
        setLoading(true);
        try {
            const filters = {};
            if (dateRange) {
                filters.date_debut = dateRange[0].format('YYYY-MM-DD');
                filters.date_fin = dateRange[1].format('YYYY-MM-DD');
            }
            const [rapport, evolution, fluxRes] = await Promise.all([
                getRapportCaisse(filters),
                getEvolutionMensuelle(new Date().getFullYear()),
                getHistoriqueFlux(filters)
            ]);
            setKpiData({
                kpis: rapport?.kpis || {},
                quittances: rapport?.quittances || {},
                par_mode_paiement: rapport?.par_mode_paiement || {},
                caisse_ouverte: rapport?.caisse_ouverte,
                caisse: rapport?.caisse,
                periode: rapport?.periode,
            });
            if (evolution?.mois) {
                setChartData(evolution.mois.map(item => ({
                    name: MOIS[(item.mois - 1)] || `M${item.mois}`,
                    Recettes: item.recettes,
                    Dépenses: item.depenses,
                    Résultat: item.resultat
                })));
            }
            setQuittancesData(fluxRes?.flux || []);
        } catch (err) {
            showError('Erreur lors du chargement des données financières.', 'Échec');
        } finally {
            setLoading(false);
        }
    };

    const fmt = (val) => new Intl.NumberFormat('fr-FR').format(val || 0) + ' FCFA';

    const handlePrint = () => {
        const cashierName = localStorage.getItem("user_name") || "Caissier en Chef";
        const totalRecettes = kpiData?.kpis?.total_recettes || 0;
        const totalDepenses = kpiData?.kpis?.total_depenses || 0;
        const netResult = kpiData?.kpis?.resultat_net || 0;
        const soldeTresor = kpiData?.kpis?.solde_tresorerie || 0;
        const creances = kpiData?.kpis?.creances_clients || 0;
        const dettes = kpiData?.kpis?.dettes_fournisseurs || 0;

        // Calculate ratios for the visual breakdown bar
        const totalVolume = totalRecettes + totalDepenses;
        const recettesPercent = totalVolume > 0 ? Math.round((totalRecettes / totalVolume) * 100) : 0;
        const depensesPercent = totalVolume > 0 ? Math.round((totalDepenses / totalVolume) * 100) : 0;

        // Proportions of payment modes
        const modesCount = {};
        quittancesData.forEach(q => {
            const m = q.mode_paiement || 'especes';
            modesCount[m] = (modesCount[m] || 0) + parseFloat(q.Montant_paye || q.montant || 0);
        });

        const paymentBreakdownRows = Object.entries(modesCount).map(([mode, amt]) => {
            const percentage = totalRecettes > 0 ? Math.round((amt / totalRecettes) * 100) : 0;
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px;">
                    <span style="text-transform: uppercase; font-weight: 600; color: #475569;">
                        ● ${mode.replace('_', ' ')}
                    </span>
                    <span style="font-weight: bold; color: #1e3a8a;">
                        ${new Intl.NumberFormat('fr-FR').format(amt)} FCFA (${percentage}%)
                    </span>
                </div>
                <div style="width: 100%; background-color: #f1f5f9; height: 6px; border-radius: 3px; margin-bottom: 12px; overflow: hidden;">
                    <div style="width: ${percentage}%; background-color: #3b82f6; height: 100%;"></div>
                </div>
            `;
        }).join('');

        const quittancesRows = quittancesData.map(q => `
            <tr>
                <td style="font-weight: bold; color: #1e3a8a;">${q.numero_quittance}</td>
                <td>${q.patient_nom || 'Client Externe'}</td>
                <td>${new Date(q.date_paiement).toLocaleString('fr-FR')}</td>
                <td style="text-transform: uppercase; font-size: 10px; font-weight: bold; color: #475569;">${q.mode_paiement?.replace('_', ' ')}</td>
                <td style="text-align: right; font-weight: bold;">${fmt(q.Montant_paye)}</td>
            </tr>
        `).join('');

        const printContent = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Rapport d'Activité Financière de Caisse</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #334155; margin: 0; padding: 25px; line-height: 1.4; }
                    .header-container { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 25px; }
                    .logo-section h1 { font-size: 24px; color: #1e3a8a; margin: 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
                    .logo-section p { font-size: 11px; color: #64748b; margin: 4px 0 0 0; }
                    .meta-section { text-align: right; font-size: 11px; color: #475569; }
                    .meta-section strong { color: #0f172a; }
                    
                    .document-title { text-align: center; font-size: 18px; font-weight: 800; color: #0f172a; margin: 20px 0; letter-spacing: 0.5px; text-transform: uppercase; }
                    
                    .grid-kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
                    .kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background-color: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
                    .kpi-title { font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
                    .kpi-value { font-size: 16px; font-weight: 800; color: #1e3a8a; }
                    .kpi-value.green { color: #0f766e; }
                    .kpi-value.red { color: #be123c; }
                    
                    .section-title { font-size: 13px; font-weight: 800; color: #1e3a8a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px; margin: 30px 0 15px 0; text-transform: uppercase; }
                    
                    .chart-mock-container { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 30px; }
                    .chart-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; background-color: #f8fafc; }
                    .chart-title { font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 15px; text-transform: uppercase; border-left: 3px solid #1e3a8a; padding-left: 8px; }
                    
                    .ratio-bar-container { display: flex; height: 18px; border-radius: 9px; overflow: hidden; font-size: 10px; font-weight: bold; color: white; text-align: center; line-height: 18px; margin-bottom: 10px; }
                    
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
                    th { background-color: #f1f5f9; color: #1e3a8a; font-weight: 700; border: 1px solid #e2e8f0; padding: 8px; text-align: left; text-transform: uppercase; font-size: 9px; }
                    td { border: 1px solid #e2e8f0; padding: 8px; color: #334155; }
                    tr:nth-child(even) { background-color: #f8fafc; }
                    
                    .signatures { display: flex; justify-content: space-between; margin-top: 45px; page-break-inside: avoid; }
                    .signature-box { text-align: center; width: 45%; }
                    .signature-line { border-top: 1px solid #475569; margin-top: 60px; padding-top: 8px; font-size: 11px; font-weight: bold; color: #0f172a; }
                    
                    @media print {
                        body { padding: 10px; }
                        .kpi-card { border: 1px solid #94a3b8; }
                        .chart-box { border: 1px solid #94a3b8; background-color: #ffffff; }
                    }
                </style>
            </head>
            <body>
                <!-- Header clinic -->
                <div class="header-container">
                    <div class="logo-section">
                        <h1>${APP_NAME}</h1>
                        <p>Plateforme de Gestion Clinique et Financière Intégrée</p>
                        <p style="font-size: 9px; color: #94a3b8;">Service Financier et Encaissements</p>
                    </div>
                    <div class="meta-section">
                        <div>Date du rapport : <strong>${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</strong></div>
                        <div>Rédigé par (Caissier) : <strong>${cashierName}</strong></div>
                        <div>Statut du document : <strong>Rapport Officiel Certifié</strong></div>
                    </div>
                </div>

                <div class="document-title">
                    Bilan d'Activité et Rapport Financier de Caisse
                </div>

                <!-- KPI Grid -->
                <div class="grid-kpi">
                    <div class="kpi-card">
                        <div class="kpi-title">Recettes Totales</div>
                        <div class="kpi-value">${fmt(totalRecettes)}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Dépenses Totales</div>
                        <div class="kpi-value red">${fmt(totalDepenses)}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Résultat Net</div>
                        <div class="kpi-value green">${fmt(netResult)}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Trésorerie Disponible</div>
                        <div class="kpi-value">${fmt(soldeTresor)}</div>
                    </div>
                </div>

                <!-- Secondary details row -->
                <div class="grid-kpi" style="margin-top: -10px;">
                    <div class="kpi-card">
                        <div class="kpi-title">Créances Clients</div>
                        <div class="kpi-value" style="color: #64748b;">${fmt(creances)}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Dettes Fournisseurs</div>
                        <div class="kpi-value" style="color: #64748b;">${fmt(dettes)}</div>
                    </div>
                    <div class="kpi-card" style="grid-column: span 2;">
                        <div class="kpi-title">Volume d'Écritures Traitées</div>
                        <div class="kpi-value" style="font-size: 14px; color: #475569;">
                            ${quittancesData.length} quittances validées ce mois-ci
                        </div>
                    </div>
                </div>

                <!-- Charts & breakdown visual section -->
                <div class="section-title">Visualisation de l'Activité & Répartition</div>
                <div class="chart-mock-container">
                    <!-- Chart 1: Recettes vs Depenses -->
                    <div class="chart-box">
                        <div class="chart-title">Ratio Recettes vs Dépenses</div>
                        <div class="ratio-bar-container">
                            <div style="width: ${recettesPercent}%; background-color: #1e3a8a;">
                                ${recettesPercent > 15 ? recettesPercent + '%' : ''}
                            </div>
                            <div style="width: ${depensesPercent}%; background-color: #b91c1c;">
                                ${depensesPercent > 15 ? depensesPercent + '%' : ''}
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 10px;">
                            <span style="color: #1e3a8a; font-weight: bold;">● Recettes : ${fmt(totalRecettes)}</span>
                            <span style="color: #b91c1c; font-weight: bold;">● Dépenses : ${fmt(totalDepenses)}</span>
                        </div>
                    </div>

                    <!-- Chart 2: Camembert mode de paiement proportion list -->
                    <div class="chart-box">
                        <div class="chart-title">Répartition par Mode de Règlement</div>
                        ${paymentBreakdownRows || '<div style="font-size: 12px; color: #64748b; text-align: center; padding-top: 10px;">Aucun encaissement enregistré.</div>'}
                    </div>
                </div>

                <!-- Validated receipts table -->
                <div class="section-title">Journal des transactions de la période</div>
                <table>
                    <thead>
                        <tr>
                            <th>N° Quittance</th>
                            <th>Patient</th>
                            <th>Date / Heure de Paiement</th>
                            <th>Mode de Règlement</th>
                            <th style="text-align: right;">Montant Payé</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${quittancesRows || '<tr><td colspan="5" style="text-align: center;">Aucune transaction enregistrée.</td></tr>'}
                    </tbody>
                </table>

                <!-- Signatures -->
                <div class="signatures">
                    <div class="signature-box">
                        <div class="signature-line">Signature du Caissier (${cashierName})</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-line">Signature du Directeur Général</div>
                    </div>
                </div>
            </body>
            </html>
        `;
        const w = window.open('', '_blank');
        w.document.write(printContent);
        w.document.close();
        setTimeout(() => w.print(), 500);
    };

    const formatFluxDate = (t) => {
        if (!t) return '—';
        const d = new Date(t);
        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR');
    };

    const colonnesJournal = [
        {
            title: 'Type', dataIndex: 'type_flux', key: 'tf',
            render: (t, r) => (
                <Tag color={t === 'entree' ? 'green' : 'red'}>
                    {t === 'entree' ? 'Entrée' : 'Sortie'}
                    {r.categorie !== 'quittance' ? ` (${(r.categorie || '').replace('_', ' ')})` : ''}
                </Tag>
            ),
        },
        { title: 'N° / Réf.', dataIndex: 'numero_quittance', key: 'n', render: t => <strong style={{ color: COLORS.brandBlue }}>{t || '—'}</strong> },
        { title: 'Libellé', dataIndex: 'Motif', key: 'lib', render: (t, r) => t || r.libelle || '—' },
        { title: 'Date', dataIndex: 'date_paiement', key: 'd', render: formatFluxDate },
        {
            title: 'Mode', dataIndex: 'mode_paiement', key: 'm',
            render: mode => (
                <Tag color="default" style={{ textTransform: 'uppercase', fontSize: '10px', fontWeight: 'bold' }}>
                    {mode?.replace('_', ' ') || '—'}
                </Tag>
            )
        },
        {
            title: 'Montant', dataIndex: 'Montant_paye', key: 'amt', align: 'right',
            render: (v, r) => (
                <strong style={{ color: r.type_flux === 'sortie' ? COLORS.accentRed : COLORS.brandBlue }}>
                    {r.type_flux === 'sortie' ? '− ' : '+ '}{fmt(v || r.montant_flux)}
                </strong>
            )
        }
    ];

    const resultatNet = kpiData?.kpis?.resultat_net || 0;
    const isPositif = resultatNet >= 0;

    return (
        <CashierLayout>
                <CashierPageHeader
                    icon={BarChart2}
                    title="Rapport financier de la caisse"
                    subtitle="Analyse globale unifiée et évolution mensuelle des flux."
                    actions={(
                        <Space>
                            <RangePicker onChange={setDateRange} placeholder={['Début', 'Fin']} style={{ borderRadius: 8 }} />
                            <Button icon={<RefreshCw size={14} />} onClick={loadReportData} loading={loading} style={{ borderRadius: 8 }}>Actualiser</Button>
                            <Button type="primary" icon={<Printer size={14} />} onClick={handlePrint} style={{ backgroundColor: COLORS.brandBlue, borderRadius: 8 }}>Imprimer</Button>
                        </Space>
                    )}
                />

                <CaisseContextBanner caisse={kpiData?.caisse} />

                <Spin spinning={loading}>
                    <Tabs activeKey={activeTab} onChange={setActiveTab} size="large"
                        style={{ background: 'white', borderRadius: 12, padding: '16px', border: `1px solid ${COLORS.border}` }}>

                        {/* Tab 1 : Tableau de Bord (KPIs épurés) */}
                        <Tabs.TabPane tab={<span style={{ fontWeight: 600, color: COLORS.brandGray }}><BarChart2 size={15} style={{ marginRight: 6 }} />Tableau de Bord</span>} key="kpi">
                            <div style={{ paddingTop: '8px' }}>
                                {/* Elegant alert message with clean corporate style */}
                                <div style={{
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    backgroundColor: isPositif ? '#f0fdf4' : '#fff1f2',
                                    border: `1px solid ${isPositif ? '#bbf7d0' : '#fecdd3'}`,
                                    color: isPositif ? '#166534' : '#9f1239',
                                    fontWeight: 600,
                                    fontSize: '13px',
                                    marginBottom: 20,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}>
                                    <Activity size={16} />
                                    <span>
                                        Bilan actuel de la période : {fmt(resultatNet)} {isPositif ? '(Excédentaire)' : '(Déficitaire)'}
                                    </span>
                                </div>

                                {/* KPI Card Grid (Clean colors) */}
                                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                                    <Col span={6}>
                                        <KpiCard
                                            title="Recettes Totales"
                                            value={fmt(kpiData?.kpis?.total_recettes)}
                                            icon={TrendingUp}
                                            color={COLORS.brandBlue}
                                            subtitle="Flux entrants encaissés"
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <KpiCard
                                            title="Dépenses Totales"
                                            value={fmt(kpiData?.kpis?.total_depenses)}
                                            icon={TrendingDown}
                                            color={COLORS.brandGray}
                                            subtitle={`Menues : ${fmt(kpiData?.kpis?.depenses_menues || 0)} · OP caisse : ${fmt(kpiData?.kpis?.decaissements_op_caisse || 0)} · OP banque : ${fmt(kpiData?.kpis?.decaissements_op_banque || 0)}`}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <KpiCard
                                            title="Résultat Net"
                                            value={fmt(resultatNet)}
                                            icon={Activity}
                                            color={isPositif ? COLORS.accentGreen : COLORS.accentRed}
                                            subtitle="Différence nette"
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <KpiCard
                                            title="Solde Trésorerie"
                                            value={fmt(kpiData?.kpis?.solde_tresorerie)}
                                            icon={Wallet}
                                            color={COLORS.brandBlue}
                                            subtitle="Ouverture + encaissements − sorties caisse"
                                        />
                                    </Col>
                                </Row>

                                <Row gutter={[16, 16]}>
                                    <Col span={6}>
                                        <KpiCard
                                            title="Créances Clients"
                                            value={fmt(kpiData?.kpis?.creances_clients)}
                                            icon={DollarSign}
                                            color={COLORS.brandGray}
                                            subtitle="Montants non recouvrés"
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <KpiCard
                                            title="Dettes Fournisseurs"
                                            value={fmt(kpiData?.kpis?.dettes_fournisseurs)}
                                            icon={DollarSign}
                                            color={COLORS.brandGray}
                                            subtitle="Engagements de décaissement"
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Card style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, boxShadow: 'none' }}>
                                            <Statistic
                                                title="Quittances (période)"
                                                value={kpiData?.quittances?.nombre ?? quittancesData.length}
                                                valueStyle={{ color: COLORS.brandBlue, fontWeight: 700 }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={6}>
                                        <Card style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, boxShadow: 'none' }}>
                                            <Statistic
                                                title="Total encaissé"
                                                value={fmt(kpiData?.quittances?.total || 0)}
                                                valueStyle={{ color: COLORS.brandGray, fontWeight: 700 }}
                                            />
                                        </Card>
                                    </Col>
                                </Row>
                            </div>
                        </Tabs.TabPane>

                        {/* Tab 2 : Évolution Mensuelle (With clean detailed explanation) */}
                        <Tabs.TabPane tab={<span style={{ fontWeight: 600, color: COLORS.brandGray }}><TrendingUp size={15} style={{ marginRight: 6 }} />Évolution Mensuelle</span>} key="evolution">
                            <div style={{ paddingTop: '8px' }}>
                                {/* Purpose & Goal Explanation Card */}
                                <Card style={{
                                    borderRadius: 10,
                                    borderLeft: `4px solid ${COLORS.brandBlue}`,
                                    backgroundColor: COLORS.background,
                                    marginBottom: 20
                                }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                        <Info size={20} style={{ color: COLORS.brandBlue, marginTop: 2 }} />
                                        <div>
                                            <h4 style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
                                                Quel est le but de l'Évolution Mensuelle pour le Caissier ?
                                            </h4>
                                            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                                                Ce graphique d'évolution mensuelle vous permet de visualiser l'activité historique cumulée sur l'année. Pour un caissier, l'objectif est de :
                                                <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px' }}>
                                                    <li><strong>Suivre les pics saisonniers d'activité</strong> : Identifier les périodes de l'année à forte affluence de patients afin d'ajuster l'approvisionnement en reçus et fonds de caisse de départ.</li>
                                                    <li><strong>Maîtriser les dépenses menues</strong> : Surveiller si les sorties de petite caisse augmentent anormalement sur certains mois.</li>
                                                    <li><strong>Faciliter le contrôle & l'inventaire</strong> : Corréler le volume des écritures validées avec vos rapports de clôture mensuelle pour détecter tout écart récurrent.</li>
                                                </ul>
                                            </p>
                                        </div>
                                    </div>
                                </Card>

                                {chartData.length > 0 ? (
                                    <div style={{ marginTop: 24 }}>
                                        <h3 style={{ marginBottom: 16, color: '#334155', fontSize: '14px', fontWeight: 600 }}>
                                            Comparatif des Recettes vs Dépenses — {new Date().getFullYear()}
                                        </h3>
                                        <ResponsiveContainer width="100%" height={260}>
                                            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="name" />
                                                <YAxis tickFormatter={v => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(v)} />
                                                <Tooltip formatter={(v) => [fmt(v)]} />
                                                <Legend />
                                                <Bar dataKey="Recettes" fill={COLORS.brandBlue} radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="Dépenses" fill={COLORS.brandGray} radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>

                                        <h3 style={{ marginTop: 32, marginBottom: 16, color: '#334155', fontSize: '14px', fontWeight: 600 }}>
                                            Évolution du Résultat Net
                                        </h3>
                                        <ResponsiveContainer width="100%" height={180}>
                                            <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="name" />
                                                <YAxis tickFormatter={v => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(v)} />
                                                <Tooltip formatter={(v) => [fmt(v)]} />
                                                <Line type="monotone" dataKey="Résultat" stroke={COLORS.accentGreen} strokeWidth={2} dot={{ fill: COLORS.accentGreen }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <Empty description="Aucune donnée d'évolution disponible" />
                                )}
                            </div>
                        </Tabs.TabPane>

                        {/* Tab 3 : Journal des Encaissements */}
                        <Tabs.TabPane tab={<span style={{ fontWeight: 600, color: COLORS.brandGray }}><FileText size={15} style={{ marginRight: 6 }} />Journal des flux</span>} key="journal">
                            <div style={{ paddingTop: '8px' }}>
                                {quittancesData.length > 0 ? (
                                    <Table
                                        columns={colonnesJournal}
                                        dataSource={quittancesData}
                                        rowKey={(r) => r.id || r.numero_quittance}
                                        loading={loading}
                                        pagination={{ pageSize: 10 }}
                                        size="middle"
                                        style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8 }}
                                        summary={() => {
                                            const entrees = quittancesData.filter((x) => x.type_flux === 'entree');
                                            const sorties = quittancesData.filter((x) => x.type_flux === 'sortie');
                                            const totalE = entrees.reduce((s, q) => s + parseFloat(q.Montant_paye || q.montant_flux || 0), 0);
                                            const totalS = sorties.reduce((s, q) => s + parseFloat(q.Montant_paye || q.montant_flux || 0), 0);
                                            return (
                                            <Table.Summary.Row style={{ background: '#f8fafc' }}>
                                                <Table.Summary.Cell index={0} colSpan={4}>
                                                    <strong style={{ color: '#0f172a' }}>
                                                        TOTAUX — {entrees.length} entrée(s), {sorties.length} sortie(s)
                                                    </strong>
                                                </Table.Summary.Cell>
                                                <Table.Summary.Cell index={4} align="right">
                                                    <div style={{ color: COLORS.accentGreen, fontWeight: 700 }}>+ {fmt(totalE)}</div>
                                                    <div style={{ color: COLORS.accentRed, fontWeight: 700 }}>− {fmt(totalS)}</div>
                                                    <div style={{ color: COLORS.brandBlue, fontWeight: 800, marginTop: 4 }}>
                                                        = {fmt(totalE - totalS)}
                                                    </div>
                                                </Table.Summary.Cell>
                                            </Table.Summary.Row>
                                            );
                                        }}
                                    />
                                ) : (
                                    <Empty description="Aucune transaction pour la période sélectionnée" />
                                )}
                            </div>
                        </Tabs.TabPane>
                    </Tabs>
                </Spin>
        </CashierLayout>
    );
}

export default CashierFinancialReport;