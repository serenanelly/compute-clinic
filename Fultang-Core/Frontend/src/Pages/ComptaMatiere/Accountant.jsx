import { AccountantDashBoard } from "./Components/AccountantDashboard";
import { AccountantNavLink } from "./AccountantNavLink";
import { AccountantNavBar } from "./Components/AccountantNavBar";
import { useState, useEffect, useRef } from "react";
import {
  FaBoxes,
  FaTruck,
  FaClipboardList,
  FaChartLine,
  FaBoxOpen,
  FaMedkit,
  FaTools,
  FaClock,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSpinner,
  FaSyncAlt,
  FaEye,
  FaTimes,
  FaCheck
} from "react-icons/fa";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import {
  materielMedicalApi,
  materielDurableApi,
  sortieApi,
  livraisonApi,
  besoinApi,
  ligneBesoinApi
} from "../../services/comptabiliteMatiereApi";

export function Accountant() {
  const navigate = useNavigate();
  const besoinsRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Statistiques depuis l'API
  const [stats, setStats] = useState({
    totalMaterial: 0,
    totalMedical: 0,
    totalOutputs: 0,
    pendingNeeds: 0,
    totalDeliveries: 0,
    totalDurable: 0,
  });

  // Liste des besoins en cours depuis l'API
  const [besoinsEnCours, setBesoinsEnCours] = useState([]);

  // États pour la modal de détails du besoin
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedBesoin, setSelectedBesoin] = useState(null);
  const [lignesBesoin, setLignesBesoin] = useState([]);
  const [loadingLignes, setLoadingLignes] = useState(false);

  // Modal de confirmation pour traiter un besoin
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmBesoin, setConfirmBesoin] = useState(null);

  // Charger les données
  useEffect(() => {
    loadData();
  }, []);

  /**
   * 📡 CHARGEMENT DES DONNÉES (Mode "Toujours Frais")
   * Utilisation de fetch avec cache: "no-store" pour éviter le cache navigateur.
   */
  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log("🚀 Dashboard - Chargement des données fraîches...");

      const [medicauxData, durablesData, sortiesData, livraisonsData, besoinsData] = await Promise.all([
        materielMedicalApi.getAll(),
        materielDurableApi.getAll(),
        sortieApi.getAll(),
        livraisonApi.getAll(),
        besoinApi.getAll()
      ]);

      // Extraire les résultats (gestion format paginé Django Rest Framework)
      const medicaux = Array.isArray(medicauxData) ? medicauxData : (medicauxData.results || []);
      const durables = Array.isArray(durablesData) ? durablesData : (durablesData.results || []);
      const sorties = Array.isArray(sortiesData) ? sortiesData : (sortiesData.results || []);
      const livraisons = Array.isArray(livraisonsData) ? livraisonsData : (livraisonsData.results || []);
      const besoins = Array.isArray(besoinsData) ? besoinsData : (besoinsData.results || []);

      // 🔢 OPÉRATIONS STATISTIQUES
      // Compter les besoins APPROUVE (validés par le directeur, à exécuter par le comptable matière)
      const pendingCount = besoins.filter(b => b.statut === 'APPROUVE').length;

      setStats({
        totalMaterial: medicaux.length + durables.length,
        totalMedical: medicaux.length,
        totalOutputs: sorties.length,
        pendingNeeds: pendingCount,
        totalDeliveries: livraisons.length,
        totalDurable: durables.length,
      });

      // Récupérer UNIQUEMENT les besoins APPROUVE (validés par le directeur) à exécuter
      const besoinsEnCoursFiltered = besoins.filter(b =>
        b.statut === 'APPROUVE'
      ).slice(0, 20);

      const besoinsFormates = await Promise.all(
        besoinsEnCoursFiltered.map(async (b) => {
          // Récupérer les lignes de chaque besoin individuellement
          let description = b.motif;
          let quantiteTotal = 1;

          try {
            const lignesData = await ligneBesoinApi.getByBesoin(b.idBesoin);
            const lignes = Array.isArray(lignesData) ? lignesData : (lignesData.results || []);

            if (lignes.length > 0) {
              quantiteTotal = lignes.reduce((sum, l) => sum + (l.quantite_demandee || 0), 0);
              description = lignes.map(l => l.materiel_nom).join(', ');
            }
          } catch (err) {
            console.warn(`Erreur lignes pour besoin ${b.idBesoin}`, err);
          }

          return {
            id: b.idBesoin,
            code: b.code_besoin || `BES-${b.idBesoin}`,
            departement: `Personnel #${b.idPersonnel_emetteur}`,
            description: description || 'Non spécifié',
            quantite: quantiteTotal,
            priorite: mapPriorite(b.priorite),
            dateEmission: b.date_creation_besoin?.split('T')[0] || '-',
            statut: mapStatut(b.statut),
            rawStatut: b.statut, // Conserver le statut original pour les actions
          };
        })
      );

      setBesoinsEnCours(besoinsFormates);

    } catch (err) {
      console.error("❌ Erreur chargement:", err);
      setError("Impossible de charger les données fraîches.");
    } finally {
      setLoading(false);
    }
  };

  function mapPriorite(priorite) {
    const map = {
      'HIGH': 'haute',
      'NORMAL': 'moyenne',
      'LOW': 'basse'
    };
    return map[priorite] || 'moyenne';
  }

  function mapStatut(statut) {
    const map = {
      'NON_TRAITE': 'en_attente',
      'EN_COURS': 'en_cours',
      'APPROUVE': 'approuve',
      'TRAITE': 'traite',
      'REJETE': 'traite'
    };
    return map[statut] || 'en_attente';
  }

  function openTraiterModal(besoin) {
    setConfirmBesoin(besoin);
    setShowConfirmModal(true);
  }

  function closeConfirmModal() {
    setShowConfirmModal(false);
    setConfirmBesoin(null);
  }

  async function executeTraiterBesoin() {
    if (!confirmBesoin) return;

    try {
      setActionLoading(true);
      await besoinApi.traiter(confirmBesoin.id);
      setSuccessMessage(`Besoin ${confirmBesoin.code} marqué comme traité avec succès.`);
      setTimeout(() => setSuccessMessage(""), 4000);
      setShowDetailModal(false);
      closeConfirmModal();
      await loadData();
    } catch (err) {
      console.error("Erreur lors du traitement du besoin:", err);
      setError("Erreur lors du traitement du besoin. Veuillez réessayer.");
      setTimeout(() => setError(null), 4000);
    } finally {
      setActionLoading(false);
    }
  }

  const scrollToBesoins = () => {
    besoinsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Fonction pour voir les détails d'un besoin
  const viewBesoinDetails = async (besoin) => {
    setSelectedBesoin(besoin);
    setShowDetailModal(true);
    setLoadingLignes(true);
    setLignesBesoin([]);

    try {
      console.log("📦 Chargement des lignes pour besoin ID:", besoin.id);
      const lignes = await ligneBesoinApi.getByBesoin(besoin.id);
      console.log("📦 Réponse API lignes-besoin:", lignes);

      const lignesList = (Array.isArray(lignes) ? lignes : (lignes.results || [])).map(l => ({
        id: l.id_ligne_besoin || l.idLigneBesoin,
        materiel: l.materiel_nom,
        quantite: l.quantite_demandee,
        priorite: l.priorite,
        description: l.description_justification
      }));
      console.log("📦 Lignes mappées:", lignesList);
      setLignesBesoin(lignesList);
    } catch (err) {
      console.error("❌ Erreur lors du chargement des lignes:", err);
    } finally {
      setLoadingLignes(false);
    }
  };

  const quickActions = [
    {
      icon: FaClipboardList,
      label: "Émettre un besoin",
      description: "Créer une demande de matériel",
      color: "bg-blue-500",
      onClick: () => navigate("/compta-matiere/emit-need"),
    },
    {
      icon: FaTruck,
      label: "Enregistrer une livraison",
      description: "Saisir une réception",
      color: "bg-green-500",
      onClick: () => navigate("/compta-matiere/register-delivery"),
    },
    {
      icon: FaBoxOpen,
      label: "Enregistrer une sortie",
      description: "Enregistrer une sortie",
      color: "bg-orange-500",
      onClick: () => navigate("/compta-matiere/register-output"),
    },
    {
      icon: FaChartLine,
      label: "Voir les rapports",
      description: "Consulter les statistiques",
      color: "bg-purple-500",
      onClick: () => navigate("/compta-matiere/reports"),
    },
  ];

  if (loading) {
    return (
      <AccountantDashBoard linkList={AccountantNavLink} requiredRole={"compta_matiere"} requiredFunctionalService="COMPTA_MATIERE">
        <AccountantNavBar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <FaSpinner className="animate-spin text-4xl text-primary-start mx-auto mb-4" />
            <p className="text-gray-600">Chargement des données...</p>
          </div>
        </div>
      </AccountantDashBoard>
    );
  }

  return (
    <AccountantDashBoard
      linkList={AccountantNavLink}
      requiredRole={"compta_matiere"} requiredFunctionalService="COMPTA_MATIERE"
    >
      <AccountantNavBar />
      <div className="p-6 space-y-6">
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <FaCheckCircle />
            {successMessage}
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <FaExclamationTriangle />
            {error}
          </div>
        )}

        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">Tableau de Bord - Comptable Matière</h1>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
          >
            <FaSyncAlt className={loading ? "animate-spin" : ""} /> Actualiser
          </button>
        </div>

        {/* Statistiques principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Total Matériel"
            value={stats.totalMaterial}
            description="Articles en stock"
            color="bg-blue-500"
            icon={FaBoxes}
            clickable={false}
          />
          <StatCard
            title="Matériel Médical Total"
            value={stats.totalMedical}
            description="Équipements médicaux"
            color="bg-yellow-500"
            icon={FaMedkit}
            clickable={false}
          />
          <StatCard
            title="Sorties Totales"
            value={stats.totalOutputs}
            description="Toutes les sorties"
            color="bg-orange-500"
            icon={FaBoxOpen}
            clickable={false}
          />
          <StatCard
            title="Besoins en Attente"
            value={stats.pendingNeeds}
            description="Demandes à traiter"
            color="bg-red-500"
            icon={FaClipboardList}
            onClick={scrollToBesoins}
            clickable={true}
          />
          <StatCard
            title="Livraisons"
            value={stats.totalDeliveries}
            description="Réceptions enregistrées"
            color="bg-green-500"
            icon={FaTruck}
            clickable={false}
          />
          <StatCard
            title="Matériel Durable Total"
            value={stats.totalDurable}
            description="Équipements durables"
            color="bg-purple-500"
            icon={FaTools}
            clickable={false}
          />
        </div>

        {/* Actions Rapides */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Actions Rapides
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <QuickActionButton
                key={index}
                icon={action.icon}
                label={action.label}
                description={action.description}
                color={action.color}
                onClick={action.onClick}
              />
            ))}
          </div>
        </div>

        {/* Liste des besoins en cours */}
        <div ref={besoinsRef} className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              Liste des Besoins en Cours
            </h2>
            <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-sm font-semibold">
              {besoinsEnCours.length} besoins
            </span>
          </div>
          {besoinsEnCours.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Émetteur</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Description</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Quantité</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Priorité</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Date</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Statut</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {besoinsEnCours.map((besoin) => (
                    <tr key={besoin.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-800 font-medium font-mono">{besoin.code}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{besoin.departement}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{besoin.description}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-800 font-semibold">{besoin.quantite}</td>
                      <td className="px-4 py-3 text-center">
                        <PrioriteBadge priorite={besoin.priorite} />
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-500">{besoin.dateEmission}</td>
                      <td className="px-4 py-3 text-center">
                        <StatutBadge statut={besoin.statut} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => viewBesoinDetails(besoin)}
                            className="px-2 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition-all duration-300"
                            title="Voir les détails"
                          >
                            <FaEye />
                          </button>
                          <button
                            onClick={() => openTraiterModal(besoin)}
                            disabled={actionLoading}
                            className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                          >
                            {actionLoading ? "Traitement..." : "Valider"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FaClipboardList className="mx-auto text-4xl text-gray-300 mb-3" />
              <p>Aucun besoin en attente</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de détails du besoin */}
      {showDetailModal && selectedBesoin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-t-xl">
              <h3 className="text-xl font-bold">Détails du Besoin {selectedBesoin.code}</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-white hover:text-gray-200 text-2xl"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Émetteur</p>
                  <p className="font-semibold text-gray-800">{selectedBesoin.departement}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Date d'émission</p>
                  <p className="font-semibold text-gray-800">{selectedBesoin.dateEmission}</p>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-500">Motif / Description</p>
                <p className="font-semibold text-gray-800">{selectedBesoin.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Priorité</p>
                  <div className="mt-1"><PrioriteBadge priorite={selectedBesoin.priorite} /></div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Statut</p>
                  <div className="mt-1"><StatutBadge statut={selectedBesoin.statut} /></div>
                </div>
              </div>

              {/* Liste des articles demandés */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700 font-semibold mb-3 flex items-center gap-2">
                  <FaClipboardList /> Articles demandés
                </p>
                {loadingLignes ? (
                  <div className="flex items-center justify-center py-4">
                    <FaSpinner className="animate-spin text-blue-500 text-2xl" />
                    <span className="ml-2 text-gray-600">Chargement...</span>
                  </div>
                ) : lignesBesoin.length > 0 ? (
                  <div className="space-y-2">
                    {lignesBesoin.map((ligne, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-800">{ligne.materiel}</p>
                          {ligne.description && (
                            <p className="text-xs text-gray-500">{ligne.description}</p>
                          )}
                        </div>
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                          x{ligne.quantite}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">Aucun article trouvé pour ce besoin</p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation — traiter un besoin */}
      {showConfirmModal && confirmBesoin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FaCheck className="text-green-500" />
                Confirmer le traitement
              </h3>
              <button
                onClick={closeConfirmModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={actionLoading}
              >
                <FaTimes className="text-xl" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Besoin concerné</p>
                <p className="font-mono font-bold text-gray-800 text-lg">{confirmBesoin.code}</p>
                <p className="text-sm text-gray-600 mt-2">{confirmBesoin.description}</p>
                <div className="flex gap-3 mt-3 text-sm text-gray-500">
                  <span>Émetteur : <strong className="text-gray-700">{confirmBesoin.departement}</strong></span>
                  <span>Qté : <strong className="text-gray-700">{confirmBesoin.quantite}</strong></span>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 text-sm leading-relaxed">
                  Voulez-vous marquer ce besoin comme <strong>traité</strong> ?
                  Cette action confirme que la demande a été prise en charge par le service comptabilité matière.
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={closeConfirmModal}
                disabled={actionLoading}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-all font-medium disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={executeTraiterBesoin}
                disabled={actionLoading}
                className="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Traitement...
                  </>
                ) : (
                  <>
                    <FaCheck />
                    Confirmer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AccountantDashBoard>
  );
}

function StatCard({ title, value, description, color, icon: Icon, onClick, clickable }) {
  StatCard.propTypes = {
    title: PropTypes.string.isRequired,
    value: PropTypes.number.isRequired,
    description: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
    icon: PropTypes.elementType.isRequired,
    onClick: PropTypes.func,
    clickable: PropTypes.bool,
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-all duration-300 ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-blue-400' : ''}`}
      onClick={clickable ? onClick : undefined}
    >
      <div className="flex items-center gap-4">
        <div className={`${color} rounded-full p-4 text-white`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm text-gray-600 font-semibold">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
          {clickable && (
            <p className="text-xs text-blue-500 mt-1 font-medium">Cliquez pour voir →</p>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({ icon: Icon, label, description, color, onClick }) {
  QuickActionButton.propTypes = {
    icon: PropTypes.elementType.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
  };

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-gray-200 hover:border-primary-end hover:bg-gradient-to-br hover:from-gray-50 hover:to-blue-50 transition-all duration-300 group"
    >
      <div className={`${color} rounded-full p-4 text-white group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-8 h-8" />
      </div>
      <div className="text-center">
        <p className="text-md font-bold text-gray-800">{label}</p>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </div>
    </button>
  );
}

function PrioriteBadge({ priorite }) {
  PrioriteBadge.propTypes = {
    priorite: PropTypes.string.isRequired,
  };

  const config = {
    haute: { bg: "bg-red-100", text: "text-red-700", icon: FaExclamationTriangle, label: "Haute" },
    moyenne: { bg: "bg-yellow-100", text: "text-yellow-700", icon: FaClock, label: "Moyenne" },
    basse: { bg: "bg-green-100", text: "text-green-700", icon: FaCheckCircle, label: "Basse" },
  };

  const { bg, text, icon: PrioriteIcon, label } = config[priorite] || config.moyenne;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <PrioriteIcon className="w-3 h-3" />
      {label}
    </span>
  );
}

function StatutBadge({ statut }) {
  StatutBadge.propTypes = {
    statut: PropTypes.string.isRequired,
  };

  const config = {
    en_attente: { bg: "bg-orange-100", text: "text-orange-700", label: "En attente" },
    en_cours: { bg: "bg-blue-100", text: "text-blue-700", label: "En cours" },
    approuve: { bg: "bg-teal-100", text: "text-teal-700", label: "Approuvé — à exécuter" },
    traite: { bg: "bg-green-100", text: "text-green-700", label: "Traité" },
  };

  const { bg, text, label } = config[statut] || config.en_attente;

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}
