import { PharmacistDashBoard } from "./Components/PharmacistDashboard";
import { PharmacistNavLink } from "./PharmacistNavLink";
import { useState, useEffect } from "react";
import {
    FaFileAlt,
    FaPaperPlane,
    FaFilePdf,
    FaEye,
    FaTimes,
    FaInbox,
    FaEnvelope,
    FaUser,
    FaPaperclip,
    FaArchive,
    FaBoxes,
    FaSpinner,
    FaSyncAlt
} from "react-icons/fa";
import PropTypes from "prop-types";
import jsPDF from "jspdf";
import { personnelApi, rapportApi } from "../../services/comptabiliteMatiereApi";
import { getLoggedPersonnelId, formatPersonnelOption, getPersonnelUuid } from "../../Utils/personnelUtils";

export function PharmacistReports() {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState("");

    const [reportForm, setReportForm] = useState({
        objet: "",
        destinataire: "",
        corps: ""
    });

    // Données d'inventaire en attente (venant de la page inventaire)
    const [pendingInventoryData, setPendingInventoryData] = useState(null);

    // Rapports envoyés et reçus (depuis l'API)
    const [sentReports, setSentReports] = useState([]);
    const [receivedReports, setReceivedReports] = useState([]);

    const [selectedReport, setSelectedReport] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // Liste du personnel pour sélection destinataire
    const [personnelList, setPersonnelList] = useState([]);

    const currentUserId = getLoggedPersonnelId();
    const currentUserName = localStorage.getItem("user_name") || "Pharmacien";

    // Charger les données
    useEffect(() => {
        loadData();
        loadPendingInventory();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            setError(null);

            const userId = getLoggedPersonnelId();
            if (!userId) {
                setError("Identifiant personnel introuvable. Veuillez vous reconnecter.");
                return;
            }

            const [rapportsByUser, personnelData] = await Promise.all([
                rapportApi.getByUser(userId),
                personnelApi.getAll()
            ]);

            const personnels = Array.isArray(personnelData) ? personnelData : (personnelData.results || []);
            setPersonnelList(personnels);

            const sent = Array.isArray(rapportsByUser.sent) ? rapportsByUser.sent : [];
            const received = Array.isArray(rapportsByUser.received) ? rapportsByUser.received : [];

            setSentReports(sent.map(r => formatReport(r, personnels)));
            setReceivedReports(received.map(r => ({ ...formatReport(r, personnels), isRead: r.est_lu })));

        } catch (err) {
            console.error("Erreur lors du chargement des rapports:", err);
            setError(`Impossible de charger les rapports: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }

    function getPersonnelId(person) {
        return getPersonnelUuid(person);
    }

    function formatReport(r, personnels = []) {
        const expediteurId = String(r.expediteur || r.id_expediteur || "");
        const destinataireId = String(r.destinataire || r.id_destinataire || "");
        const expediteurInfo = personnels.find(p => getPersonnelId(p) === expediteurId);
        const destinataireInfo = personnels.find(p => getPersonnelId(p) === destinataireId);

        return {
            id: r.code_rapport || `RPT-${r.id}`,
            idRapport: r.id,  // C'est 'id' retourné par le backend, pas 'idRapport'
            objet: r.objet,
            corps: r.corps,
            dateEnvoi: r.date_creation?.split('T')[0] || new Date().toISOString().split('T')[0],
            expediteur: expediteurId,
            expediteurName: expediteurInfo ? `${expediteurInfo.nom} ${expediteurInfo.prenom}` : `Personnel #${expediteurId}`,
            destinataire: destinataireId,
            destinataireName: destinataireInfo ? `${destinataireInfo.nom} ${destinataireInfo.prenom}` : `Personnel #${destinataireId}`,
            type: r.type_rapport,
            archiveAssociee: r.archive_associee,
            isRead: r.est_lu === true  // Champ pour savoir si le rapport a été lu
        };
    }

    function loadPendingInventory() {
        const storedData = localStorage.getItem('pending_inventory_report');
        if (storedData) {
            const data = JSON.parse(storedData);
            setPendingInventoryData(data);

            // Pré-remplir le formulaire pour un rapport d'inventaire
            setReportForm({
                objet: "Inventaire",
                destinataire: "",
                corps: `Suite à l'inventaire effectué le ${new Date(data.dateInventaire).toLocaleDateString('fr-FR')}, veuillez trouver ci-joint:\n\n` +
                    `1. L'état actuel du stock après inventaire\n` +
                    `2. L'archive de l'inventaire (Réf: ${data.archiveId})\n\n` +
                    `Ces documents vous permettront de constater les différences entre l'ancien et le nouveau stock.\n\n` +
                    `Cordialement,\n${currentUserName}`
            });
        }
    }

    async function handleSubmitReport(e) {
        e.preventDefault();

        if (!reportForm.objet.trim() || !reportForm.corps.trim()) {
            alert("Veuillez remplir l'objet et le corps du rapport !");
            return;
        }

        try {
            setSubmitting(true);
            setError(null);

            // Générer un code unique qui respecte max_length=20 du backend
            const now = new Date();
            const timestamp = now.getTime().toString(36).toUpperCase();
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            const codeRapport = `RPT-${timestamp}-${random}`.substring(0, 20);

            const userId = getLoggedPersonnelId();
            const reportData = {
                code_rapport: codeRapport,
                objet: reportForm.objet,
                corps: reportForm.corps,
                id_expediteur: String(userId),
                id_destinataire: reportForm.destinataire ? String(reportForm.destinataire) : null,
                expediteur: String(userId),
                destinataire: reportForm.destinataire ? String(reportForm.destinataire) : null,
                type_rapport: pendingInventoryData ? "INVENTAIRE" : "GENERAL",
                archive_associee: pendingInventoryData?.archiveDbId || null
            };

            console.log("📤 Envoi du rapport:", reportData);

            await rapportApi.create(reportData);

            // Nettoyer les données d'inventaire en attente
            localStorage.removeItem('pending_inventory_report');
            setPendingInventoryData(null);

            setReportForm({ objet: "", destinataire: "", corps: "" });
            setSuccessMessage("Rapport envoyé avec succès !");
            setTimeout(() => setSuccessMessage(""), 5000);

            // Recharger les rapports
            await loadData();

        } catch (err) {
            console.error("Erreur lors de l'envoi du rapport:", err);
            setError("Impossible d'envoyer le rapport. Veuillez réessayer.");
        } finally {
            setSubmitting(false);
        }
    }

    async function viewReportDetails(report, isReceived = false) {
        console.log("📋 viewReportDetails appelé:", { report, isReceived, idRapport: report.idRapport, isRead: report.isRead });
        setSelectedReport({ ...report, isReceived });
        setShowDetailModal(true);

        // Marquer comme lu si c'est un rapport reçu et non encore lu
        if (isReceived && !report.isRead && report.idRapport) {
            console.log("📝 Tentative de marquer comme lu - idRapport:", report.idRapport);
            try {
                await rapportApi.marquerLu(report.idRapport);
                console.log("✅ Rapport marqué comme lu avec succès");
                setReceivedReports(receivedReports.map(r =>
                    r.id === report.id ? { ...r, isRead: true } : r
                ));
            } catch (err) {
                console.error("❌ Erreur lors du marquage comme lu:", err.response?.data || err.message);
            }
        } else {
            console.log("ℹ️ Pas de marquage:", { isReceived, isRead: report.isRead, hasId: !!report.idRapport });
        }
    }

    function exportReportToPDF(report, isReceived = false) {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        const maxWidth = pageWidth - 2 * margin;

        doc.setFontSize(18);
        doc.setTextColor(26, 115, 163);
        doc.text("FULTANG CLINIC", pageWidth / 2, 20, { align: "center" });

        doc.setFontSize(14);
        doc.setTextColor(80, 194, 185);
        doc.text("Rapport Pharmacie", pageWidth / 2, 28, { align: "center" });

        doc.setDrawColor(80, 194, 185);
        doc.setLineWidth(0.5);
        doc.line(margin, 35, pageWidth - margin, 35);

        doc.setFontSize(10);
        doc.setTextColor(0);

        let yPos = 50;

        doc.setFont(undefined, 'bold');
        doc.text("Référence:", margin, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(report.id, margin + 30, yPos);

        yPos += 8;
        doc.setFont(undefined, 'bold');
        doc.text("Date:", margin, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(report.dateEnvoi, margin + 30, yPos);

        yPos += 8;
        doc.setFont(undefined, 'bold');
        doc.text("Objet:", margin, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(report.objet, margin + 30, yPos);

        yPos += 15;
        doc.setDrawColor(200);
        doc.line(margin, yPos, pageWidth - margin, yPos);

        yPos += 15;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);
        doc.text("Corps du Rapport:", margin, yPos);

        yPos += 10;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(11);

        const lines = doc.splitTextToSize(report.corps, maxWidth);
        doc.text(lines, margin, yPos);

        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setDrawColor(80, 194, 185);
        doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, pageHeight - 18);
        doc.text("Fultang Clinic - Pharmacie", pageWidth - margin, pageHeight - 18, { align: "right" });

        doc.save(`rapport_${report.id}.pdf`);
    }

    function cancelPendingInventory() {
        localStorage.removeItem('pending_inventory_report');
        setPendingInventoryData(null);
        setReportForm({ objet: "", destinataire: "", corps: "" });
    }

    if (loading) {
        return (
            <PharmacistDashBoard linkList={PharmacistNavLink} requiredRole={"pharmacien"}>
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <FaSpinner className="animate-spin text-4xl text-primary-start mx-auto mb-4" />
                        <p className="text-gray-600">Chargement des rapports...</p>
                    </div>
                </div>
            </PharmacistDashBoard>
        );
    }

    return (
        <PharmacistDashBoard
            linkList={PharmacistNavLink}
            requiredRole={"pharmacien"}
        >
            <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <FaFileAlt className="text-4xl text-primary-start" />
                        <h1 className="text-3xl font-bold text-gray-800">Gestion des Rapports</h1>
                    </div>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
                    >
                        <FaSyncAlt className={loading ? "animate-spin" : ""} /> Actualiser
                    </button>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
                        {successMessage}
                    </div>
                )}

                {/* Alerte si un inventaire est en attente */}
                {pendingInventoryData && (
                    <div className="bg-blue-50 border-2 border-blue-400 p-4 rounded-lg">
                        <div className="flex items-center gap-3">
                            <FaPaperclip className="text-2xl text-blue-500" />
                            <div className="flex-1">
                                <p className="font-bold text-blue-800">Rapport d&apos;inventaire en attente</p>
                                <p className="text-sm text-blue-600">
                                    Archive: {pendingInventoryData.archiveId} •
                                    {pendingInventoryData.etatActuelStock?.length} produits en stock
                                </p>
                            </div>
                            <button
                                onClick={cancelPendingInventory}
                                className="px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                )}

                {/* Formulaire de saisie d'un rapport */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <FaEnvelope className="text-primary-end" />
                        {pendingInventoryData ? "Rédiger le Rapport d'Inventaire" : "Rédiger un Nouveau Rapport"}
                    </h2>
                    <form onSubmit={handleSubmitReport} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Objet *
                                </label>
                                <input
                                    type="text"
                                    maxLength={50}
                                    value={reportForm.objet}
                                    onChange={(e) => setReportForm({ ...reportForm, objet: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end focus:border-transparent"
                                    placeholder="Objet du rapport"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Destinataire
                                </label>
                                <select
                                    value={reportForm.destinataire}
                                    onChange={(e) => setReportForm({ ...reportForm, destinataire: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end focus:border-transparent"
                                >
                                    <option value="">Sélectionner un destinataire (optionnel)</option>
                                    {personnelList.map(p => (
                                        <option key={getPersonnelUuid(p)} value={getPersonnelUuid(p)}>
                                            {formatPersonnelOption(p)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Corps du rapport *
                            </label>
                            <textarea
                                value={reportForm.corps}
                                onChange={(e) => setReportForm({ ...reportForm, corps: e.target.value })}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end focus:border-transparent"
                                placeholder="Rédigez le contenu de votre rapport..."
                                rows="6"
                                required
                            />
                        </div>

                        {/* Pièces jointes si inventaire en attente */}
                        {pendingInventoryData && (
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <FaPaperclip /> Pièces jointes automatiques:
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="flex items-center gap-3 bg-white p-3 rounded-lg border">
                                        <FaBoxes className="text-2xl text-green-500" />
                                        <div>
                                            <p className="font-medium text-gray-800">État du Stock</p>
                                            <p className="text-xs text-gray-500">{pendingInventoryData.etatActuelStock?.length} produits</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-white p-3 rounded-lg border">
                                        <FaArchive className="text-2xl text-blue-500" />
                                        <div>
                                            <p className="font-medium text-gray-800">Archive d&apos;Inventaire</p>
                                            <p className="text-xs text-gray-500">{pendingInventoryData.archiveId}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
                            >
                                {submitting ? <FaSpinner className="animate-spin" /> : <FaPaperPlane />}
                                Envoyer
                            </button>
                        </div>
                    </form>
                </div>

                {/* Deux colonnes */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Rapports envoyés */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <FaPaperPlane className="text-blue-500" />
                                Rapports Envoyés ({sentReports.length})
                            </h2>
                        </div>
                        <div className="max-h-96 overflow-y-auto space-y-3">
                            {sentReports.length > 0 ? (
                                sentReports.map(report => (
                                    <ReportCard
                                        key={report.id}
                                        report={report}
                                        type="sent"
                                        onView={() => viewReportDetails(report, false)}
                                        onExport={() => exportReportToPDF(report, false)}
                                    />
                                ))
                            ) : (
                                <p className="text-gray-500 text-center py-4">Aucun rapport envoyé</p>
                            )}
                        </div>
                    </div>

                    {/* Rapports reçus */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <FaInbox className="text-green-500" />
                                Rapports Reçus
                                {receivedReports.filter(r => !r.isRead).length > 0 && (
                                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                        {receivedReports.filter(r => !r.isRead).length}
                                    </span>
                                )}
                            </h2>
                        </div>
                        <div className="max-h-96 overflow-y-auto space-y-3">
                            {receivedReports.length > 0 ? (
                                receivedReports.map(report => (
                                    <ReportCard
                                        key={report.id}
                                        report={report}
                                        type="received"
                                        onView={() => viewReportDetails(report, true)}
                                        onExport={() => exportReportToPDF(report, true)}
                                    />
                                ))
                            ) : (
                                <p className="text-gray-500 text-center py-4">Aucun rapport reçu</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de détails */}
            {showDetailModal && selectedReport && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="bg-primary-end/20 p-2 rounded-full">
                                    <FaFileAlt className="w-5 h-5 text-primary-start" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-800">Détails du Rapport</h2>
                            </div>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <FaTimes className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-sm text-gray-600">Référence</p>
                                    <p className="font-bold text-gray-800">{selectedReport.id}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-sm text-gray-600">Date</p>
                                    <p className="font-bold text-gray-800">{selectedReport.dateEnvoi}</p>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-sm text-gray-600">Objet</p>
                                <p className="font-bold text-gray-800">{selectedReport.objet}</p>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600 mb-2 font-semibold">Corps</p>
                                <p className="text-gray-800 whitespace-pre-wrap">{selectedReport.corps}</p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        exportReportToPDF(selectedReport, selectedReport.isReceived);
                                        setShowDetailModal(false);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                                >
                                    <FaFilePdf /> Exporter PDF
                                </button>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </PharmacistDashBoard>
    );
}

function ReportCard({ report, type, onView, onExport }) {
    ReportCard.propTypes = {
        report: PropTypes.object.isRequired,
        type: PropTypes.string.isRequired,
        onView: PropTypes.func.isRequired,
        onExport: PropTypes.func.isRequired
    };

    const isSent = type === "sent";
    const isUnread = type === "received" && !report.isRead;

    return (
        <div className={`p-4 rounded-lg border ${isUnread ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800">{report.id}</span>
                        {isUnread && (
                            <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">Nouveau</span>
                        )}
                    </div>
                    <p className="text-sm text-gray-600 font-medium mt-1">{report.objet}</p>
                    <p className="text-xs text-gray-500 mt-1">{report.dateEnvoi}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onView}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all"
                    >
                        <FaEye />
                    </button>
                    <button
                        onClick={onExport}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                    >
                        <FaFilePdf />
                    </button>
                </div>
            </div>
        </div>
    );
}
