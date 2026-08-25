import { useEffect, useState } from 'react';
import { Table, Tag, Card, Row, Col, DatePicker, Select, Input, Button, Space, Alert, Empty } from 'antd';
import {
  Search,
  RefreshCw,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Scale
} from 'lucide-react';
import AccountantLayout from '../AccountantLayout';
import { getBalance } from '../../../services/accountantApi';
import { useFeedback } from '../../../contexts/FeedbackContext';
import * as XLSX from 'xlsx';

const { RangePicker } = DatePicker;
const { Option } = Select;

export function BalancePage() {
  const [loading, setLoading] = useState(true);
  const [balanceData, setBalanceData] = useState([]);
  const [totals, setTotals] = useState({
    mouvements_debit: 0,
    mouvements_credit: 0,
    solde_debit: 0,
    solde_credit: 0
  });

  // Filters
  const [dateRange, setDateRange] = useState(null);
  const [selectedClass, setSelectedClass] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { showError, showSuccess } = useFeedback();

  useEffect(() => {
    loadBalance();
  }, [dateRange, selectedClass]);

  const loadBalance = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (dateRange) {
        filters.date_debut = dateRange[0].format('YYYY-MM-DD');
        filters.date_fin = dateRange[1].format('YYYY-MM-DD');
      }
      if (selectedClass !== 'all') {
        filters.classe = selectedClass;
      }

      const response = await getBalance(filters);

      // The API returns either a list of accounts with details or { comptes, totaux }
      if (response) {
        const list = response.comptes || response;
        setBalanceData(Array.isArray(list) ? list : []);

        if (response.totaux) {
          setTotals(response.totaux);
        } else if (Array.isArray(list)) {
          // Calculate totaux client-side if not returned by backend
          const calculatedTotals = list.reduce((acc, curr) => {
            acc.mouvements_debit += Number(curr.mouvements_debit || 0);
            acc.mouvements_credit += Number(curr.mouvements_credit || 0);
            acc.solde_debit += Number(curr.solde_debit || 0);
            acc.solde_credit += Number(curr.solde_credit || 0);
            return acc;
          }, { mouvements_debit: 0, mouvements_credit: 0, solde_debit: 0, solde_credit: 0 });
          setTotals(calculatedTotals);
        }
      }
    } catch (err) {
      console.error('Error loading balance:', err);
      showError('Impossible de charger la balance des comptes.', 'Échec');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    try {
      const exportData = filteredData.map(item => ({
        'Numéro Compte': item.compte_numero || item.numero_compte,
        'Libellé du Compte': item.compte_libelle || item.libelle,
        'Mouvements Débit': item.mouvements_debit,
        'Mouvements Crédit': item.mouvements_credit,
        'Solde Débiteur': item.solde_debit,
        'Solde Créditeur': item.solde_credit
      }));

      // Add totals row
      exportData.push({
        'Numéro Compte': 'TOTAL GENERAL',
        'Libellé du Compte': '',
        'Mouvements Débit': totals.mouvements_debit,
        'Mouvements Crédit': totals.mouvements_credit,
        'Solde Débiteur': totals.solde_debit,
        'Solde Créditeur': totals.solde_credit
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Balance Générale');

      // Auto-fit columns
      const max_len = exportData.reduce((acc, row) => {
        return Math.max(acc, (row['Libellé du Compte'] || '').length);
      }, 20);
      worksheet['!cols'] = [{ wch: 15 }, { wch: max_len + 5 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];

      XLSX.writeFile(workbook, `balance_comptable_${new Date().toISOString().split('T')[0]}.xlsx`);
      showSuccess('Le fichier Excel de la Balance a été exporté.', 'Succès');
    } catch (err) {
      console.error('Excel export error:', err);
      showError('Échec de la génération du fichier Excel.', 'Erreur');
    }
  };

  const formatFCFA = (val) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(val || 0).replace('XAF', 'FCFA');
  };

  // Check equilibrium
  const isBalanced = Math.abs(totals.mouvements_debit - totals.mouvements_credit) < 1 &&
                      Math.abs(totals.solde_debit - totals.solde_credit) < 1;

  // Search filter
  const filteredData = balanceData.filter(item => {
    const num = item.compte_numero || item.numero_compte || '';
    const name = item.compte_libelle || item.libelle || '';
    return num.toLowerCase().includes(searchTerm.toLowerCase()) ||
           name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const columns = [
    {
      title: 'N° COMPTE',
      dataIndex: 'compte_numero',
      key: 'compte_numero',
      width: '15%',
      render: (text, record) => <span className="font-bold text-gray-800 tracking-wider">{text || record.numero_compte}</span>
    },
    {
      title: 'INTITULÉ',
      dataIndex: 'compte_libelle',
      key: 'compte_libelle',
      width: '35%',
      render: (text, record) => text || record.libelle
    },
    {
      title: 'MOUVEMENTS',
      align: 'center',
      children: [
        {
          title: 'Débit',
          dataIndex: 'mouvements_debit',
          key: 'mouvements_debit',
          align: 'right',
          width: '12.5%',
          render: (val) => val > 0 ? <span className="font-semibold text-gray-700">{formatFCFA(val)}</span> : '-'
        },
        {
          title: 'Crédit',
          dataIndex: 'mouvements_credit',
          key: 'mouvements_credit',
          align: 'right',
          width: '12.5%',
          render: (val) => val > 0 ? <span className="font-semibold text-gray-700">{formatFCFA(val)}</span> : '-'
        }
      ]
    },
    {
      title: 'SOLDE',
      align: 'center',
      children: [
        {
          title: 'Débiteur',
          dataIndex: 'solde_debit',
          key: 'solde_debit',
          align: 'right',
          width: '12.5%',
          render: (val) => val > 0 ? <span className="font-bold text-emerald-600">{formatFCFA(val)}</span> : '-'
        },
        {
          title: 'Créditeur',
          dataIndex: 'solde_credit',
          key: 'solde_credit',
          align: 'right',
          width: '12.5%',
          render: (val) => val > 0 ? <span className="font-bold text-rose-600">{formatFCFA(val)}</span> : '-'
        }
      ]
    }
  ];

  return (
    <AccountantLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Balance des Comptes</h2>
            <p className="text-gray-500 text-sm">Balance générale à 6 colonnes (Mouvements et Soldes cumulés)</p>
          </div>
          <Space>
            <Button
              type="primary"
              className="bg-emerald-600 hover:bg-emerald-500 flex items-center gap-2 h-10 rounded-lg shadow-sm"
              icon={<FileSpreadsheet className="w-4 h-4" />}
              onClick={handleExportExcel}
            >
              Export Excel
            </Button>
            <Button
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={loadBalance}
              className="h-10 flex items-center gap-2 rounded-lg"
            >
              Actualiser
            </Button>
          </Space>
        </div>

        {/* Balance Status Banner */}
        {!loading && (
          isBalanced ? (
            <Alert
              message={
                <span className="font-semibold flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  La Balance est parfaitement équilibrée. Mouvements et Soldes sont à l'équilibre.
                </span>
              }
              type="success"
              showIcon={false}
              className="rounded-xl border border-emerald-100 bg-emerald-50/50 shadow-sm"
            />
          ) : (
            <Alert
              message={
                <span className="font-semibold flex items-center gap-2 text-rose-800">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  Alerte : Déséquilibre détecté dans la balance ! Veuillez auditer les écritures.
                </span>
              }
              type="error"
              showIcon={false}
              className="rounded-xl border border-rose-100 bg-rose-50/50 shadow-sm"
            />
          )
        )}

        {/* Totals Summary Row */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title="Somme des Mouvements" className="shadow-sm" size="small">
              <Row gutter={16} className="text-center font-bold">
                <Col span={12} className="border-r">
                  <p className="text-xs text-gray-400 font-semibold uppercase">Total Débit</p>
                  <p className="text-lg text-gray-700 mt-1">{formatFCFA(totals.mouvements_debit)}</p>
                </Col>
                <Col span={12}>
                  <p className="text-xs text-gray-400 font-semibold uppercase">Total Crédit</p>
                  <p className="text-lg text-gray-700 mt-1">{formatFCFA(totals.mouvements_credit)}</p>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="Somme des Soldes" className="shadow-sm" size="small">
              <Row gutter={16} className="text-center font-bold">
                <Col span={12} className="border-r">
                  <p className="text-xs text-emerald-600 font-semibold uppercase">Total Débiteur</p>
                  <p className="text-lg text-emerald-700 mt-1">{formatFCFA(totals.solde_debit)}</p>
                </Col>
                <Col span={12}>
                  <p className="text-xs text-rose-600 font-semibold uppercase">Total Créditeur</p>
                  <p className="text-lg text-rose-700 mt-1">{formatFCFA(totals.solde_credit)}</p>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card className="shadow-sm" bordered={false}>
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} sm={8}>
              <Input
                prefix={<Search className="w-4 h-4 text-gray-400 mr-2" />}
                placeholder="Filtrer par N° ou libellé de compte..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 rounded-lg"
                allowClear
              />
            </Col>
            <Col xs={24} sm={8}>
              <RangePicker
                className="w-full h-10 rounded-lg"
                onChange={setDateRange}
                placeholder={['Date début', 'Date fin']}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Select
                value={selectedClass}
                onChange={setSelectedClass}
                className="w-full h-10"
              >
                <Option value="all">Toutes les classes</Option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                  <Option key={num} value={String(num)}>Classe {num}</Option>
                ))}
              </Select>
            </Col>
          </Row>
        </Card>

        {/* Balance Sheet Table */}
        <Card className="shadow-sm" bordered={false}>
          {filteredData.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Aucune donnée comptable disponible"
            />
          ) : (
            <Table
              columns={columns}
              dataSource={filteredData}
              rowKey={(record) => record.compte_numero || record.numero_compte}
              loading={loading}
              pagination={false}
              size="middle"
              className="border border-gray-100 rounded-lg overflow-hidden"
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row className="bg-gray-50 font-extrabold text-sm border-t border-gray-200">
                    <Table.Summary.Cell index={0} colSpan={2} className="pl-6">TOTAL GÉNÉRAL</Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right" className="text-gray-800 pr-4">{formatFCFA(totals.mouvements_debit)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right" className="text-gray-800 pr-4">{formatFCFA(totals.mouvements_credit)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right" className="text-emerald-700 pr-4">{formatFCFA(totals.solde_debit)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="right" className="text-rose-700 pr-6">{formatFCFA(totals.solde_credit)}</Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          )}
        </Card>
      </div>
    </AccountantLayout>
  );
}

export default BalancePage;