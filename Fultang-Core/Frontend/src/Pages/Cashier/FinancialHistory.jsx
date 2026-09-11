import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Button, Space, Tabs, DatePicker, Empty, Spin, Select, Input, Tooltip, Modal, Descriptions, Divider } from 'antd';
import {
  FileText,
  RefreshCw,
  Printer,
  Search,
  Calendar,
  Wallet,
  CreditCard,
  Eye,
  FileSpreadsheet,
  TrendingUp,
  Info
} from 'lucide-react';
import { CashierLayout } from './components/CashierLayout.jsx';
import { CashierPageHeader } from './components/CashierPageHeader.jsx';
import { CASHIER_COLORS, cardStyle, formatFcfa } from './components/cashierTheme.js';
import { CaisseContextBanner } from './components/CaisseContextBanner.jsx';
import { getHistoriqueFlux, getCaisseOuverte } from '../../services/caissierApi';
import { downloadQuittancesCsv } from '../../services/accountantApi';
import { useFeedback } from '../../contexts/FeedbackContext';
import { APP_NAME, brandFooter } from '../../constants/branding.js';

const { RangePicker } = DatePicker;
const { Option } = Select;

const COLORS = CASHIER_COLORS;

export function CashierFinancialHistory() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(null);
  const [paymentMode, setPaymentMode] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // States
  const [quittancesData, setQuittancesData] = useState([]);
  const [stats, setStats] = useState({ total_entrees: 0, total_sorties: 0, solde_net: 0, nb_transactions: 0, nb_entrees: 0, nb_sorties: 0 });
  const [typeFluxFilter, setTypeFluxFilter] = useState('all');

  // Detail Modal State
  const [selectedQuittance, setSelectedQuittance] = useState(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

  const { showError, showInfo, showSuccess } = useFeedback();

  const [caisseInfo, setCaisseInfo] = useState(null);

  useEffect(() => {
    loadHistoryData();
  }, [dateRange, paymentMode, typeFluxFilter]);

  useEffect(() => {
    getCaisseOuverte().then((res) => {
      if (res?.ouverte && res.caisse) {
        setCaisseInfo(res.caisse);
      }
    }).catch(() => {});
  }, []);

  const formatDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR');
  };

  const loadHistoryData = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (dateRange) {
        filters.date_debut = dateRange[0].format('YYYY-MM-DD');
        filters.date_fin = dateRange[1].format('YYYY-MM-DD');
      }
      if (paymentMode && paymentMode !== 'all' && typeFluxFilter === 'entree') {
        filters.mode_paiement = paymentMode;
      }
      if (typeFluxFilter && typeFluxFilter !== 'all') {
        filters.type_flux = typeFluxFilter;
      }

      const data = await getHistoriqueFlux(filters);
      const flux = data?.flux || [];
      setQuittancesData(flux);
      setStats(data?.stats || {
        total_entrees: 0, total_sorties: 0, solde_net: 0,
        nb_transactions: 0, nb_entrees: 0, nb_sorties: 0,
      });
      if (data?.caisse_ouverte) {
        setCaisseInfo(data.caisse_ouverte);
      }
    } catch (err) {
      console.error('Error loading financial history data:', err);
      showError('Impossible de charger l\'historique financier.', 'Échec');
    } finally {
      setLoading(false);
    }
  };

  const formatFCFA = (val) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 })
      .format(val || 0)
      .replace('XAF', 'FCFA');
  };

  const getMontant = (record) =>
    parseFloat(record.Montant_paye || record.montant_flux || record.montant || 0);

  const getFluxTitle = (record) => {
    if (record?.categorie === 'ordre_paiement') return "Détails de l'ordre de paiement";
    if (record?.categorie === 'depense_menue') return 'Détails de la dépense menue';
    return 'Détails de la quittance';
  };

  const handlePrintFlux = (record) => {
    if (record?.type_flux === 'sortie') {
      handlePrintSortie(record);
    } else {
      handlePrintQuittance(record);
    }
  };

  const handlePrintSortie = (record) => {
    const isOp = record.categorie === 'ordre_paiement';
    const ref = record.numero_quittance || record.numero || '—';
    const montant = getMontant(record);
    const dateStr = formatDate(record.date_paiement || record.date_creation);
    const typeSortie = (record.type_sortie || '').replace('_', ' ');
    const docTitle = isOp ? `Ordre de paiement ${ref}` : `Dépense menue ${ref}`;
    const docHeading = isOp
      ? `ORDRE DE PAIEMENT — SORTIE CAISSE N° ${ref}`
      : `BON DE DÉPENSE MENUE N° ${ref}`;

    const printContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
          <meta charset="UTF-8">
          <title>${docTitle}</title>
          <style>
              body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #334155; margin: 0; padding: 30px; line-height: 1.5; }
              .header { text-align: center; border-bottom: 2px solid #b91c1c; padding-bottom: 15px; margin-bottom: 25px; }
              .header h1 { font-size: 22px; color: #1e3a8a; margin: 0 0 5px 0; text-transform: uppercase; }
              .header p { font-size: 11px; color: #64748b; margin: 2px 0; }
              .title-box { text-align: center; border: 1.5px solid #b91c1c; padding: 8px; margin-bottom: 25px; font-weight: bold; background-color: #fef2f2; font-size: 14px; color: #991b1b; }
              .meta-info { display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 12px; }
              .meta-block { width: 48%; }
              .meta-block h3 { margin: 0 0 8px 0; color: #b91c1c; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 13px; }
              .meta-row { display: flex; justify-content: space-between; margin-bottom: 5px; gap: 8px; }
              .label { color: #64748b; flex-shrink: 0; }
              .value { font-weight: bold; text-align: right; }
              .amount-section { background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; text-align: center; margin: 25px 0; }
              .amount-title { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 3px; }
              .amount-value { font-size: 24px; font-weight: 800; color: #b91c1c; }
              .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
              .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
              .signature-box { text-align: center; width: 45%; }
              .signature-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 10px; font-size: 11px; font-weight: bold; }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>${APP_NAME}</h1>
              <p>Rue de l'Hôpital, Yaoundé, Cameroun | Tél: +237 6XX XXX XXX</p>
              <p>Service Comptabilité & Caisse — Sortie de caisse</p>
          </div>
          <div class="title-box">${docHeading}</div>
          <div class="meta-info">
              <div class="meta-block">
                  <h3>${isOp ? 'Bénéficiaire' : 'Nature de la sortie'}</h3>
                  <div class="meta-row">
                      <span class="label">${isOp ? 'Bénéficiaire :' : 'Motif :'}</span>
                      <span class="value">${record.Motif || record.libelle || '—'}</span>
                  </div>
                  ${isOp && typeSortie ? `
                  <div class="meta-row">
                      <span class="label">Type :</span>
                      <span class="value" style="text-transform: uppercase;">${typeSortie}</span>
                  </div>` : ''}
                  ${record.caisse_periode ? `
                  <div class="meta-row">
                      <span class="label">Période caisse :</span>
                      <span class="value">${record.caisse_periode}</span>
                  </div>` : ''}
              </div>
              <div class="meta-block">
                  <h3>Détails</h3>
                  <div class="meta-row">
                      <span class="label">Date :</span>
                      <span class="value">${dateStr}</span>
                  </div>
                  <div class="meta-row">
                      <span class="label">Mode :</span>
                      <span class="value" style="text-transform: uppercase;">${(record.mode_paiement || 'especes').replace('_', ' ')}</span>
                  </div>
                  <div class="meta-row">
                      <span class="label">Catégorie :</span>
                      <span class="value" style="text-transform: uppercase;">${(record.categorie || 'sortie').replace('_', ' ')}</span>
                  </div>
              </div>
          </div>
          <div class="amount-section">
              <div class="amount-title">Montant sorti de caisse</div>
              <div class="amount-value">− ${new Intl.NumberFormat('fr-FR').format(montant)} FCFA</div>
          </div>
          <div class="signatures">
              <div class="signature-box">
                  <div class="signature-line">Le Caissier</div>
              </div>
              <div class="signature-box">
                  <div class="signature-line">Le Responsable</div>
              </div>
          </div>
          <div class="footer">
              Ce document atteste d'une sortie de fonds enregistrée en caisse.
              Généré le ${new Date().toLocaleString('fr-FR')} — ${APP_NAME}
          </div>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // Modern print format using a clean pop-up window
  const handlePrintQuittance = (quittance) => {
    const printContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
          <meta charset="UTF-8">
          <title>Quittance ${quittance.numero_quittance}</title>
          <style>
              body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #334155; margin: 0; padding: 30px; line-height: 1.5; }
              .header { text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 25px; }
              .header h1 { font-size: 22px; color: #1e3a8a; margin: 0 0 5px 0; text-transform: uppercase; }
              .header p { font-size: 11px; color: #64748b; margin: 2px 0; }
              .title-box { text-align: center; border: 1.5px solid #1e3a8a; padding: 8px; margin-bottom: 25px; font-weight: bold; background-color: #f8fafc; font-size: 14px; }
              .meta-info { display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 12px; }
              .meta-block { width: 48%; }
              .meta-block h3 { margin: 0 0 8px 0; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 13px; }
              .meta-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
              .label { color: #64748b; }
              .value { font-weight: bold; }
              .amount-section { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; text-align: center; margin: 25px 0; }
              .amount-title { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 3px; }
              .amount-value { font-size: 24px; font-weight: 800; color: #0f766e; }
              .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
              .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
              .signature-box { text-align: center; width: 45%; }
              .signature-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 10px; font-size: 11px; font-weight: bold; }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>${APP_NAME}</h1>
              <p>Rue de l'Hôpital, Yaoundé, Cameroun | Tél: +237 6XX XXX XXX</p>
              <p>Service Comptabilité & Caisse</p>
          </div>
          <div class="title-box">
              QUITTANCE DE CAISSE N° ${quittance.numero_quittance}
          </div>
          <div class="meta-info">
              <div class="meta-block">
                  <h3>Patient / Client</h3>
                  <div class="meta-row">
                      <span class="label">Nom complet:</span>
                      <span class="value">${quittance.patient_nom || 'Client Externe'}</span>
                  </div>
                  <div class="meta-row">
                      <span class="label">Session ID:</span>
                      <span class="value">${quittance.id_session || 'N/A'}</span>
                  </div>
              </div>
              <div class="meta-block">
                  <h3>Détails du Paiement</h3>
                  <div class="meta-row">
                      <span class="label">Date:</span>
                      <span class="value">${new Date(quittance.date_paiement).toLocaleString('fr-FR')}</span>
                  </div>
                  <div class="meta-row">
                      <span class="label">Mode:</span>
                      <span class="value" style="text-transform: uppercase;">${quittance.mode_paiement?.replace('_', ' ') || 'ESPECES'}</span>
                  </div>
                  <div class="meta-row">
                      <span class="label">Objet / Motif:</span>
                      <span class="value">${quittance.Motif}</span>
                  </div>
              </div>
          </div>
          <div class="amount-section">
              <div class="amount-title">Montant perçu</div>
              <div class="amount-value">${new Intl.NumberFormat('fr-FR').format(quittance.Montant_paye)} FCFA</div>
          </div>
          <div class="signatures">
              <div class="signature-box">
                  <div class="signature-line">Le Caissier</div>
              </div>
              <div class="signature-box">
                  <div class="signature-line">Le Client (Accompagnant)</div>
              </div>
          </div>
          <div class="footer">
              Ce reçu sert de preuve officielle de règlement pour les soins décrits.
              Généré le ${new Date().toLocaleString('fr-FR')} - ${APP_NAME}
          </div>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleExportCsv = async () => {
    try {
      showInfo('Préparation du fichier CSV...', 'Exportation');
      const filters = {};
      if (dateRange) {
        filters.date_debut = dateRange[0].format('YYYY-MM-DD');
        filters.date_fin = dateRange[1].format('YYYY-MM-DD');
      }
      if (paymentMode && paymentMode !== 'all' && typeFluxFilter === 'entree') {
        filters.mode_paiement = paymentMode;
      }
      if (typeFluxFilter && typeFluxFilter !== 'all') {
        filters.type_flux = typeFluxFilter;
      }

      const blob = await downloadQuittancesCsv(filters);
      
      // Create temporary URL and trigger browser file download
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `quittances_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSuccess('Le fichier CSV a été téléchargé avec succès.', 'Exportation');
    } catch (err) {
      console.error('Error exporting CSV:', err);
      showError('Erreur lors du téléchargement du fichier CSV.', 'Export échoué');
    }
  };

  const handleViewDetails = (quittance) => {
    setSelectedQuittance(quittance);
    setIsDetailModalVisible(true);
  };

  // Real-time client-side search filtering
  const filteredQuittances = quittancesData.filter(q => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      q.numero_quittance?.toLowerCase().includes(term) ||
      q.Motif?.toLowerCase().includes(term) ||
      q.libelle?.toLowerCase().includes(term) ||
      (q.patient_nom && q.patient_nom.toLowerCase().includes(term));

    return matchesSearch;
  });

  const colonnesHistory = [
    {
      title: 'Type',
      dataIndex: 'type_flux',
      key: 'type_flux',
      render: (t, record) => (
        <Tag color={t === 'entree' ? 'green' : 'red'}>
          {t === 'entree' ? 'Entrée' : 'Sortie'}
          {record.categorie !== 'quittance' && record.categorie ? ` (${record.categorie.replace('_', ' ')})` : ''}
          {record.sortie_hors_caisse && (
            <span className="text-[10px] opacity-80"> · banque</span>
          )}
        </Tag>
      ),
    },
    {
      title: 'N° / Réf.',
      dataIndex: 'numero_quittance',
      key: 'numero_quittance',
      render: (text) => <span className="font-semibold text-gray-800">{text || '—'}</span>
    },
    {
      title: 'Patient',
      dataIndex: 'patient_nom',
      key: 'patient_nom',
      render: (text) => <span className="font-medium text-gray-700">{text || 'Client Externe'}</span>
    },
    {
      title: 'Date & Heure',
      dataIndex: 'date_paiement',
      key: 'date_paiement',
      render: (text) => formatDate(text)
    },
    {
      title: 'Mode',
      dataIndex: 'mode_paiement',
      key: 'mode_paiement',
      render: (mode) => {
        let labelColor = 'default';
        if (mode === 'especes') labelColor = 'success';
        if (mode === 'cheque') labelColor = 'warning';
        if (mode === 'virement') labelColor = 'processing';
        return (
          <Tag color={labelColor} className="font-semibold uppercase text-xs">
            {mode?.replace('_', ' ')}
          </Tag>
        );
      }
    },
    {
      title: 'Montant',
      dataIndex: 'Montant_paye',
      key: 'Montant_paye',
      align: 'right',
      render: (val, record) => (
        <span className={`font-bold ${record.type_flux === 'sortie' ? 'text-red-600' : 'text-gray-900'}`}>
          {record.type_flux === 'sortie' ? '− ' : '+ '}{formatFCFA(val || record.montant_flux)}
        </span>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      render: (_, record) => {
        const isQuittance = record.type_flux === 'entree' && record.categorie === 'quittance';
        const isSortie = record.type_flux === 'sortie';
        if (!isQuittance && !isSortie) {
          return <span className="text-gray-400 text-xs">—</span>;
        }
        return (
        <Space size="middle">
          <Tooltip title={isSortie ? 'Consulter le bon de sortie' : 'Consulter la fiche détaillée'}>
            <Button
              type="text"
              icon={<Eye size={15} className="text-gray-500 hover:text-blue-600" />}
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          <Tooltip title={isSortie ? 'Imprimer le bon de sortie' : 'Imprimer le ticket'}>
            <Button
              type="text"
              icon={<Printer size={15} className="text-gray-500 hover:text-teal-600" />}
              onClick={() => handlePrintFlux(record)}
            />
          </Tooltip>
        </Space>
        );
      }
    }
  ];

  return (
    <CashierLayout>
        <CashierPageHeader
          icon={Calendar}
          title="Historique financier de la caisse"
          subtitle="Entrées (quittances), sorties (dépenses menues, ordres de paiement caisse ou banque)."
          actions={(
            <Space>
              <Button icon={<RefreshCw size={14} />} onClick={loadHistoryData}>
                Actualiser
              </Button>
              <Button
                type="primary"
                icon={<FileSpreadsheet size={14} />}
                onClick={handleExportCsv}
                style={{ backgroundColor: COLORS.brandBlue, borderRadius: 8 }}
              >
                Exporter en CSV
              </Button>
            </Space>
          )}
        />

        <CaisseContextBanner caisse={caisseInfo} />

        {/* Unified Search and Filter Panel */}
        <Card style={cardStyle}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={10}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>
                Recherche rapide
              </div>
              <Input
                prefix={<Search size={14} className="text-gray-400 mr-1" />}
                placeholder="N° Quittance, nom du patient..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ borderRadius: 6, height: 40 }}
                allowClear
              />
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>
                Filtrer par date
              </div>
              <RangePicker
                style={{ width: '100%', borderRadius: 6, height: 40 }}
                onChange={setDateRange}
                placeholder={['Date début', 'Date fin']}
              />
            </Col>
            <Col xs={24} sm={6}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>
                Type de flux
              </div>
              <Select
                value={typeFluxFilter}
                onChange={setTypeFluxFilter}
                style={{ width: '100%', height: 40 }}
              >
                <Option value="all">Entrées et sorties</Option>
                <Option value="entree">Entrées uniquement</Option>
                <Option value="sortie">Sorties uniquement</Option>
              </Select>
            </Col>
            <Col xs={24} sm={6}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>
                Mode de règlement
              </div>
              <Select
                value={paymentMode}
                onChange={setPaymentMode}
                style={{ width: '100%', height: 40 }}
                placeholder="Tous les modes"
              >
                <Option value="all">Tous les modes</Option>
                <Option value="especes">Espèces</Option>
                <Option value="cheque">Chèque</Option>
                <Option value="virement">Virement Bancaire</Option>
                <Option value="mobile_money">Mobile Money</Option>
                <Option value="carte">Carte Bancaire</Option>
                <Option value="assurance">Assurance</Option>
              </Select>
            </Col>
          </Row>
        </Card>

        {/* Stats Cards (Premium layout) */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, boxShadow: 'none' }}>
              <Statistic
                title={<span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>ENTRÉES</span>}
                value={stats.nb_entrees}
                prefix={<TrendingUp size={16} style={{ color: COLORS.accentGreen, marginRight: 8 }} />}
                valueStyle={{ color: COLORS.accentGreen, fontWeight: 'bold' }}
              />
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: 4 }}>{formatFCFA(stats.total_entrees)}</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, boxShadow: 'none' }}>
              <Statistic
                title={<span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>SORTIES</span>}
                value={stats.nb_sorties}
                valueStyle={{ color: '#be123c', fontWeight: 'bold' }}
              />
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: 4 }}>{formatFCFA(stats.total_sorties)}</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, boxShadow: 'none', background: '#f8fafc' }}>
              <Statistic
                title={<span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>SOLDE NET</span>}
                value={stats.solde_net}
                suffix="FCFA"
                prefix={<Wallet size={16} style={{ color: COLORS.brandBlue, marginRight: 8 }} />}
                valueStyle={{ color: COLORS.brandBlue, fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, boxShadow: 'none' }}>
              <Statistic
                title={<span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>TRANSACTIONS</span>}
                value={stats.nb_transactions}
                prefix={<Calendar size={16} style={{ color: COLORS.brandBlue, marginRight: 8 }} />}
                valueStyle={{ color: '#0f172a', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Data Table */}
        <Card style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, boxShadow: 'none' }}>
          {filteredQuittances.length > 0 ? (
            <Table
              columns={colonnesHistory}
              dataSource={filteredQuittances}
              rowKey={(r) => r.id || r.numero_quittance}
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="middle"
              className="border border-gray-100 rounded-lg"
            />
          ) : (
            <Empty description="Aucune transaction enregistrée avec ces critères de recherche" />
          )}
        </Card>

        {/* MODAL: Détail entrée ou sortie */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: COLORS.brandBlue }}>
              <FileText size={18} />
              <span>{getFluxTitle(selectedQuittance)}</span>
            </div>
          }
          open={isDetailModalVisible}
          onCancel={() => setIsDetailModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setIsDetailModalVisible(false)}>
              Fermer
            </Button>,
            <Button
              key="print"
              type="primary"
              icon={<Printer size={14} />}
              style={{ backgroundColor: COLORS.brandBlue }}
              onClick={() => handlePrintFlux(selectedQuittance)}
            >
              {selectedQuittance?.type_flux === 'sortie' ? 'Imprimer le bon' : 'Imprimer le ticket'}
            </Button>
          ]}
          width={500}
        >
          {selectedQuittance && (
            <div style={{ padding: '8px 0' }}>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="N° / Référence">
                  <strong>{selectedQuittance.numero_quittance || selectedQuittance.numero}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Type">
                  <Tag color={selectedQuittance.type_flux === 'entree' ? 'green' : 'red'}>
                    {selectedQuittance.type_flux === 'entree' ? 'Entrée' : 'Sortie'}
                    {selectedQuittance.categorie !== 'quittance' && selectedQuittance.categorie
                      ? ` (${selectedQuittance.categorie.replace('_', ' ')})`
                      : ''}
                  </Tag>
                </Descriptions.Item>
                {selectedQuittance.type_flux === 'entree' ? (
                  <Descriptions.Item label="Patient">
                    {selectedQuittance.patient_nom || 'Client Externe'}
                  </Descriptions.Item>
                ) : (
                  <Descriptions.Item label={selectedQuittance.categorie === 'ordre_paiement' ? 'Bénéficiaire' : 'Motif'}>
                    {selectedQuittance.Motif || selectedQuittance.libelle || selectedQuittance.patient_nom}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Date">
                  {formatDate(selectedQuittance.date_paiement || selectedQuittance.date_creation)}
                </Descriptions.Item>
                <Descriptions.Item label="Mode de règlement">
                  <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>
                    {(selectedQuittance.mode_paiement || 'especes').replace('_', ' ')}
                  </span>
                </Descriptions.Item>
                {selectedQuittance.type_flux === 'entree' && (
                  <>
                    <Descriptions.Item label="Motif / Objet">
                      {selectedQuittance.Motif}
                    </Descriptions.Item>
                    <Descriptions.Item label="Session ID">
                      {selectedQuittance.id_session || 'N/A'}
                    </Descriptions.Item>
                  </>
                )}
                {selectedQuittance.categorie === 'ordre_paiement' && selectedQuittance.type_sortie && (
                  <Descriptions.Item label="Type de sortie">
                    <span style={{ textTransform: 'uppercase' }}>
                      {selectedQuittance.type_sortie.replace('_', ' ')}
                    </span>
                  </Descriptions.Item>
                )}
                {selectedQuittance.caisse_periode && (
                  <Descriptions.Item label="Période caisse">
                    {selectedQuittance.caisse_periode}
                  </Descriptions.Item>
                )}
              </Descriptions>

              <Divider style={{ margin: '16px 0' }} />

              <div style={{
                textAlign: 'center',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: selectedQuittance.type_flux === 'sortie' ? '#fef2f2' : COLORS.background,
                border: `1px solid ${selectedQuittance.type_flux === 'sortie' ? '#fecaca' : COLORS.border}`
              }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  {selectedQuittance.type_flux === 'sortie' ? 'Montant sorti' : 'Montant net reçu'}
                </div>
                <div style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  color: selectedQuittance.type_flux === 'sortie' ? '#b91c1c' : COLORS.accentGreen,
                  marginTop: 4
                }}>
                  {selectedQuittance.type_flux === 'sortie' ? '− ' : ''}
                  {formatFCFA(getMontant(selectedQuittance))}
                </div>
              </div>
            </div>
          )}
        </Modal>
    </CashierLayout>
  );
}

export default CashierFinancialHistory;