import { useEffect, useState } from 'react';
import { Table, Tag, Card, Row, Col, Input, DatePicker, Select, Button, Space, Tabs, Tooltip } from 'antd';
import { 
  Search, 
  FileSpreadsheet, 
  Printer, 
  Calendar, 
  CreditCard,
  RefreshCw,
  TrendingUp,
  SlidersHorizontal,
  FileText
} from 'lucide-react';
import AccountantLayout from '../AccountantLayout';
import { getQuittancesValidees, getJournalVentilation, downloadQuittancesCsv } from '../../../services/accountantApi';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { saveAs } from 'file-saver';

const { RangePicker } = DatePicker;
const { Option } = Select;

export function QuittancesValideesPage() {
  const [activeTab, setActiveTab] = useState('journal');
  const [quittances, setQuittances] = useState([]);
  const [ventilation, setVentilation] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [paymentMode, setPaymentMode] = useState('all');
  
  const { showSuccess, showError, showInfo } = useFeedback();

  useEffect(() => {
    if (activeTab === 'journal') {
      loadQuittances();
    } else {
      loadVentilation();
    }
  }, [activeTab]);

  const loadQuittances = async () => {
    setLoading(true);
    try {
      const data = await getQuittancesValidees();
      setQuittances(data || []);
    } catch (err) {
      console.error('Error fetching quittances:', err);
      showError('Impossible de charger les quittances validées.', 'Erreur API');
    } finally {
      setLoading(false);
    }
  };

  const loadVentilation = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (dateRange) {
        filters.date_debut = dateRange[0].format('YYYY-MM-DD');
        filters.date_fin = dateRange[1].format('YYYY-MM-DD');
      }
      const data = await getJournalVentilation(filters);
      setVentilation(data || []);
    } catch (err) {
      console.error('Error fetching ventilation:', err);
      showError('Impossible de charger le journal de ventilation.', 'Erreur API');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    showInfo('Préparation de l\'export CSV...', 'Exportation');
    try {
      const filters = {};
      if (dateRange) {
        filters.date_debut = dateRange[0].format('YYYY-MM-DD');
        filters.date_fin = dateRange[1].format('YYYY-MM-DD');
      }
      const blob = await downloadQuittancesCsv(filters);
      saveAs(blob, `quittances_validees_${new Date().toISOString().split('T')[0]}.csv`);
      showSuccess('Le fichier CSV a été téléchargé avec succès.', 'Export réussi');
    } catch (err) {
      console.error('Error exporting CSV:', err);
      showError('Erreur lors du téléchargement du fichier CSV.', 'Export échoué');
    }
  };

  // On-the-fly PDF creation & print
  const handlePrintQuittance = (quittance) => {
    const printContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
          <meta charset="UTF-8">
          <title>Quittance ${quittance.numero_quittance}</title>
          <style>
              body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; margin: 0; padding: 40px; line-height: 1.5; }
              .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 15px; margin-bottom: 30px; }
              .header h1 { font-size: 24px; color: #1e40af; margin: 0 0 5px 0; text-transform: uppercase; }
              .header p { font-size: 11px; color: #666; margin: 2px 0; }
              .title-box { text-align: center; border: 1.5px solid #1e40af; padding: 10px; margin-bottom: 30px; font-weight: bold; background-color: #eff6ff; }
              .meta-info { display: flex; justify-content: space-between; margin-bottom: 35px; font-size: 13px; }
              .meta-block { width: 48%; }
              .meta-block h3 { margin: 0 0 8px 0; color: #1e40af; border-bottom: 1px solid #ddd; padding-bottom: 4px; font-size: 14px; }
              .meta-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
              .label { color: #666; }
              .value { font-weight: bold; }
              .amount-section { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; text-align: center; margin: 30px 0; }
              .amount-title { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
              .amount-value { font-size: 28px; font-weight: 800; color: #10b981; }
              .footer { margin-top: 60px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
              .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
              .signature-box { text-align: center; width: 45%; }
              .signature-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 10px; font-size: 12px; font-weight: bold; }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>Polyclinique Fultang</h1>
              <p>Rue de l'Hôpital, Yaoundé, Cameroun | Tél: +237 6XX XXX XXX</p>
              <p>Service Comptabilité & Caisse</p>
          </div>
          <div class="title-box">
              QUITTANCE DE CAISSE N° ${quittance.numero_quittance}
          </div>
          <div class="meta-info">
              <div class="meta-block">
                  <h3>Informations du Patient</h3>
                  <div class="meta-row">
                      <span class="label">Patient:</span>
                      <span class="value">${quittance.patient_nom || 'N/A'}</span>
                  </div>
                  <div class="meta-row">
                      <span class="label">Session:</span>
                      <span class="value">${quittance.id_session || 'N/A'}</span>
                  </div>
              </div>
              <div class="meta-block">
                  <h3>Informations Paiement</h3>
                  <div class="meta-row">
                      <span class="label">Date:</span>
                      <span class="value">${new Date(quittance.date_paiement).toLocaleString('fr-FR')}</span>
                  </div>
                  <div class="meta-row">
                      <span class="label">Mode:</span>
                      <span class="value" style="text-transform: capitalize;">${quittance.mode_paiement?.replace('_', ' ') || 'Espèces'}</span>
                  </div>
                  <div class="meta-row">
                      <span class="label">Motif:</span>
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
                  <div class="signature-line">Le Comptable</div>
              </div>
          </div>
          <div class="footer">
              Ce reçu sert de preuve officielle de règlement pour les soins décrits.
              Généré le ${new Date().toLocaleString('fr-FR')} - Polyclinique Fultang
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

  const formatFCFA = (val) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(val || 0).replace('XAF', 'FCFA');
  };

  // Filtered data logic
  const filteredQuittances = quittances.filter(q => {
    const matchesSearch = 
      q.numero_quittance?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.Motif?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.patient_nom && q.patient_nom.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesMode = paymentMode === 'all' || q.mode_paiement === paymentMode;
    
    let matchesDate = true;
    if (dateRange) {
      const qDate = new Date(q.date_paiement);
      matchesDate = qDate >= dateRange[0].toDate() && qDate <= dateRange[1].toDate();
    }
    
    return matchesSearch && matchesMode && matchesDate;
  });

  const columnsJournal = [
    {
      title: 'N° Quittance',
      dataIndex: 'numero_quittance',
      key: 'numero_quittance',
      render: (text) => <span className="font-semibold text-primary-end">{text}</span>
    },
    {
      title: 'Patient',
      dataIndex: 'patient_nom',
      key: 'patient_nom',
      render: (text) => <span className="font-medium text-gray-700">{text || 'Client Externe'}</span>
    },
    {
      title: 'Date Paiement',
      dataIndex: 'date_paiement',
      key: 'date_paiement',
      render: (text) => new Date(text).toLocaleString('fr-FR')
    },
    {
      title: 'Motif',
      dataIndex: 'Motif',
      key: 'Motif',
      ellipsis: true
    },
    {
      title: 'Mode',
      dataIndex: 'mode_paiement',
      key: 'mode_paiement',
      render: (mode) => {
        let color = 'blue';
        if (mode === 'especes') color = 'green';
        if (mode === 'cheque') color = 'orange';
        if (mode === 'virement') color = 'purple';
        return <Tag color={color} className="font-semibold capitalize">{mode?.replace('_', ' ')}</Tag>;
      }
    },
    {
      title: 'Montant',
      dataIndex: 'Montant_paye',
      key: 'Montant_paye',
      align: 'right',
      render: (val) => <span className="font-extrabold text-emerald-600">{formatFCFA(val)}</span>
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      render: (_, record) => (
        <Tooltip title="Imprimer le reçu">
          <Button 
            type="text" 
            icon={<Printer className="w-4 h-4 text-gray-500 hover:text-blue-600" />} 
            onClick={() => handlePrintQuittance(record)}
          />
        </Tooltip>
      )
    }
  ];

  const columnsVentilation = [
    {
      title: 'N° Compte',
      dataIndex: 'compte_numero',
      key: 'compte_numero',
      render: (text) => <span className="font-bold text-gray-800">{text}</span>
    },
    {
      title: 'Intitulé du Compte',
      dataIndex: 'compte_libelle',
      key: 'compte_libelle',
    },
    {
      title: 'Type',
      dataIndex: 'type_flux',
      key: 'type_flux',
      render: (text) => (
        <Tag color={text === 'credit' ? 'green' : 'blue'}>
          {text === 'credit' ? 'CRÉDIT (Produit/Recette)' : 'DÉBIT (Encaissement)'}
        </Tag>
      )
    },
    {
      title: 'Montant Total',
      dataIndex: 'montant_total',
      key: 'montant_total',
      align: 'right',
      render: (val) => <span className="font-extrabold text-emerald-600">{formatFCFA(val)}</span>
    }
  ];

  return (
    <AccountantLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Quittances Validées</h2>
            <p className="text-gray-500 text-sm">Consultation, ventilation comptable et export des encaissements de caisse</p>
          </div>
          <Space>
            <Button 
              type="primary"
              className="bg-emerald-600 hover:bg-emerald-500 flex items-center gap-2 h-10 rounded-lg shadow-sm"
              icon={<FileSpreadsheet className="w-4 h-4" />}
              onClick={handleExportCsv}
            >
              Export CSV
            </Button>
            <Button 
              icon={<RefreshCw className="w-4 h-4" />} 
              onClick={activeTab === 'journal' ? loadQuittances : loadVentilation}
              className="h-10 flex items-center gap-2 rounded-lg"
            >
              Actualiser
            </Button>
          </Space>
        </div>

        {/* Tab Selector */}
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100"
          items={[
            {
              key: 'journal',
              label: (
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="w-4 h-4" />
                  Journal des Encaissements
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  {/* Filters bar */}
                  <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} sm={8}>
                      <Input
                        prefix={<Search className="w-4 h-4 text-gray-400 mr-1" />}
                        placeholder="Rechercher par N°, motif, patient..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-10 rounded-lg"
                        allowClear
                      />
                    </Col>
                    <Col xs={24} sm={8}>
                      <RangePicker 
                        className="w-full h-10 rounded-lg"
                        placeholder={['Date début', 'Date fin']}
                        onChange={setDateRange}
                      />
                    </Col>
                    <Col xs={24} sm={8}>
                      <Select 
                        value={paymentMode} 
                        onChange={setPaymentMode}
                        className="w-full h-10"
                        placeholder="Mode de paiement"
                      >
                        <Option value="all">Tous les modes de paiement</Option>
                        <Option value="especes">Espèces</Option>
                        <Option value="mobile_money">Mobile Money</Option>
                        <Option value="virement">Virement Bancaire</Option>
                        <Option value="cheque">Chèque</Option>
                        <Option value="carte">Carte Bancaire</Option>
                      </Select>
                    </Col>
                  </Row>

                  {/* Table */}
                  <Table
                    columns={columnsJournal}
                    dataSource={filteredQuittances}
                    rowKey="idQuittance"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    size="middle"
                    className="border border-gray-100 rounded-lg"
                    locale={{ emptyText: 'Aucune quittance correspondante' }}
                  />
                </div>
              )
            },
            {
              key: 'ventilation',
              label: (
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <SlidersHorizontal className="w-4 h-4" />
                  Journal de Ventilation (Vues SYSCOHADA)
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border">
                    <div>
                      <h4 className="font-semibold text-gray-800">Ventilation par imputation comptable</h4>
                      <p className="text-xs text-gray-500">Mappage automatique des encaissements sur les comptes de tiers (classe 4) et de trésorerie (classe 5)</p>
                    </div>
                    {dateRange && (
                      <Tag color="blue" className="text-xs font-semibold">
                        Période : {dateRange[0].format('DD/MM/YYYY')} - {dateRange[1].format('DD/MM/YYYY')}
                      </Tag>
                    )}
                  </div>

                  <Table
                    columns={columnsVentilation}
                    dataSource={ventilation}
                    rowKey={(record) => `${record.compte_numero}-${record.type_flux}`}
                    loading={loading}
                    pagination={false}
                    size="middle"
                    className="border border-gray-100 rounded-lg"
                    locale={{ emptyText: 'Aucune écriture de ventilation à afficher' }}
                  />
                </div>
              )
            }
          ]}
        />
      </div>
    </AccountantLayout>
  );
}

export default QuittancesValideesPage;
