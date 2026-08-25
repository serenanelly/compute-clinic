import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Search, RefreshCw, CheckCircle, Pill, Syringe, Package, User, Calendar, Stethoscope } from 'lucide-react';
import { PharmacyNavBar } from './PharmacyNavBar';
import { CustomDashboard } from '../../GlobalComponents/CustomDashboard';
import { pharmacyNavLink } from './lib/pharmacyNavLink';
import { getPendingPrescriptions, markPrescriptionAsCompleted } from '../../services/prescriptionsApi';
import { useFeedback } from '../../contexts/FeedbackContext.jsx';
import { useAutoRefresh, deepEqual } from '../../hooks/usePolling';
import Loader from '../../GlobalComponents/Loader';

export function Pharmacy() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [filteredPrescriptions, setFilteredPrescriptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedPrescription, setExpandedPrescription] = useState(null);
  const { showSuccess, showError } = useFeedback();

  const fetchPendingPrescriptions = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      const response = await getPendingPrescriptions();
      if (response.success) {
        const newData = response.data || [];
        setPrescriptions(prev => deepEqual(prev, newData) ? prev : newData);
      }
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingPrescriptions();
  }, [fetchPendingPrescriptions]);

  // Auto-refresh toutes les 5 secondes
  useAutoRefresh(() => fetchPendingPrescriptions(true), 5000, false);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredPrescriptions(prescriptions);
    } else {
      const filtered = prescriptions.filter(prescription =>
        prescription.patient_nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prescription.patient_matricule?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prescription.medecin_nom?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPrescriptions(filtered);
    }
  }, [searchTerm, prescriptions]);

  const handleMarkAsCompleted = async (prescriptionId) => {
    try {
      await markPrescriptionAsCompleted(prescriptionId);
      showSuccess('La prescription a été marquée comme délivrée.', 'Prescription délivrée');
      fetchPendingPrescriptions();
    } catch (error) {
      console.error('Error marking prescription as completed:', error);
      showError('Erreur lors de la mise à jour de la prescription.', 'Échec');
    }
  };

  const handleRefresh = () => {
    fetchPendingPrescriptions();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Parse medication list into individual items
  const parseMedications = (medicationText) => {
    if (!medicationText) return [];
    // Split by common separators: newlines, semicolons, commas, or numbered lists
    const items = medicationText
      .split(/[\n;,]|(?:\d+\.\s*)/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
    return items;
  };

  // Get icon based on medication name
  const getMedicationIcon = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('seringue') || lowerName.includes('injection')) {
      return <Syringe className="w-4 h-4" />;
    }
    if (lowerName.includes('comprimé') || lowerName.includes('gélule') || lowerName.includes('capsule')) {
      return <Pill className="w-4 h-4" />;
    }
    return <Package className="w-4 h-4" />;
  };

  // Get color based on item type
  const getMedicationColor = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('seringue') || lowerName.includes('injection')) {
      return 'bg-red-100 text-red-700 border-red-200';
    }
    if (lowerName.includes('sirop') || lowerName.includes('solution')) {
      return 'bg-purple-100 text-purple-700 border-purple-200';
    }
    if (lowerName.includes('pommade') || lowerName.includes('crème')) {
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
    return 'bg-blue-100 text-blue-700 border-blue-200';
  };

  const toggleExpanded = (prescriptionId) => {
    setExpandedPrescription(expandedPrescription === prescriptionId ? null : prescriptionId);
  };

  return (
    <CustomDashboard linkList={pharmacyNavLink} requiredRole="Pharmacist">
      <PharmacyNavBar />
      <div className="p-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary-end to-primary-start text-white rounded-lg p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">Prescriptions en Attente</h1>
                <p className="text-sm opacity-90">Gérez les prescriptions de médicaments</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 bg-white text-primary-end px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              disabled={isLoading}
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher par patient, matricule ou médecin..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-primary-end"
            />
          </div>
        </div>

        {/* Prescriptions List */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader size="medium" color="primary-end" />
          </div>
        ) : filteredPrescriptions.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'Aucune prescription trouvée' : 'Aucune prescription en attente'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredPrescriptions.map((prescription) => {
              const medications = parseMedications(prescription.liste_medicaments);
              const isExpanded = expandedPrescription === prescription.id;
              const displayedMeds = isExpanded ? medications : medications.slice(0, 3);
              const hasMoreMeds = medications.length > 3;

              return (
                <div
                  key={prescription.id}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all duration-300"
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-gradient-to-br from-primary-end to-primary-start text-white rounded-full w-14 h-14 flex items-center justify-center font-bold text-lg shadow-md">
                        {prescription.patient_nom?.[0] || 'P'}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">
                          {prescription.patient_nom || 'Patient'}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {prescription.patient_matricule || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(prescription.date_heure)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleMarkAsCompleted(prescription.id)}
                      className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-5 py-2.5 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 font-medium"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Délivrer
                    </button>
                  </div>

                  {/* Doctor Info */}
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded-lg">
                    <Stethoscope className="w-4 h-4 text-primary-end" />
                    <span className="font-medium">Prescrit par:</span>
                    <span>Dr. {prescription.medecin_nom} {prescription.medecin_prenom}</span>
                  </div>

                  {/* Medications Grid */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Pill className="w-4 h-4 text-primary-end" />
                      <span>Médicaments prescrits ({medications.length})</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {displayedMeds.map((med, index) => (
                        <div
                          key={index}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getMedicationColor(med)} font-medium text-sm transition-all duration-200 hover:shadow-md`}
                        >
                          {getMedicationIcon(med)}
                          <span>{med}</span>
                        </div>
                      ))}
                    </div>

                    {hasMoreMeds && (
                      <button
                        onClick={() => toggleExpanded(prescription.id)}
                        className="text-primary-end text-sm font-medium hover:underline flex items-center gap-1"
                      >
                        {isExpanded
                          ? '▲ Voir moins'
                          : `▼ Voir ${medications.length - 3} élément(s) de plus`
                        }
                      </button>
                    )}

                    {/* Raw text fallback if parsing yields nothing */}
                    {medications.length === 0 && prescription.liste_medicaments && (
                      <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600 whitespace-pre-wrap">
                        {prescription.liste_medicaments}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Statistics */}
        {!isLoading && (
          <div className="mt-6 text-center text-gray-600">
            <p>
              {filteredPrescriptions.length} prescription{filteredPrescriptions.length !== 1 ? 's' : ''} en attente
              {searchTerm && ` sur ${prescriptions.length} total`}
            </p>
          </div>
        )}
      </div>
    </CustomDashboard>
  );
}