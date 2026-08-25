import { AccountantDashBoard } from "./Components/AccountantDashboard";
import { AccountantNavLink } from "./AccountantNavLink";
import { AccountantNavBar } from "./Components/AccountantNavBar";
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
    FaSpinner,
    FaSyncAlt,
    FaCheckCircle
} from "react-icons/fa";
import PropTypes from "prop-types";
import jsPDF from "jspdf";
import { rapportApi, personnelApi } from "../../services/comptabiliteMatiereApi";
import { getLoggedPersonnelId, formatPersonnelOption, getPersonnelUuid } from "../../Utils/personnelUtils";

export function AccountantReports() {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState("");

    // État pour le formulaire de nouveau rapport
    const [reportForm, setReportForm] = useState({
        objet: "",
        destinataire: "",
        corps: ""
    });

    const currentUserId = getLoggedPersonnelId();
    const currentUserName = localStorage.getItem("user_name") || "Comptable Matière";

    // Rapports depuis l'API
    const [sentReports, setSentReports] = useState([]);
    const [receivedReports, setReceivedReports] = useState([]);

    // État pour le modal de détails
    const [selectedReport, setSelectedReport] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // Liste du personnel pour sélection destinataire
    const [personnelList, setPersonnelList] = useState([]);

    // Charger les données
    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            setError(null);

            const token = localStorage.getItem("token_key_fultang");
            if (!token) {
                setError("Vous n'êtes pas connecté. Veuillez vous reconnecter.");
                return;
            }

            const userId = getLoggedPersonnelId();
            if (!userId) {
                setError("Identifiant personnel introuvable. Veuillez vous reconnecter.");
                return;
            }

            const [rapportsByUser, personnelData] = await Promise.all([
                rapportApi.getByUser(userId),
                personnelApi.getAll()
            ]);

            const personnels = Array.isArray(personnelData)
                ? personnelData
                : (personnelData?.results || []);

            const sent = Array.isArray(rapportsByUser.sent) ? rapportsByUser.sent : [];
            const received = Array.isArray(rapportsByUser.received) ? rapportsByUser.received : [];

            setPersonnelList(personnels);
            setSentReports(sent.map(r => formatReport(r, personnels)));
            setReceivedReports(
                received.map(r => ({ ...formatReport(r, personnels), isRead: r.est_lu }))
            );

        } catch (err) {
            console.error("Erreur lors du chargement des rapports:", err);
            if (err.response?.status === 401) {
                setError("Session expirée. Veuillez vous reconnecter.");
            } else if (err.response?.status === 403) {
                setError("Vous n'avez pas la permission d'accéder aux rapports.");
            } else {
                setError("Impossible de charger les rapports. Vérifiez que le backend est en cours d'exécution.");
            }
        } finally {
            setLoading(false);
        }
    }

    function getPersonnelId(person) {
        return String(person?.id || person?.id_personnel || "");
    }

    function formatReport(r, personnels = []) {
        const expediteurId = String(r.expediteur || r.id_expediteur || "");
        const destinataireId = String(r.destinataire || r.id_destinataire || "");
        const expediteurInfo = personnels.find(p => getPersonnelId(p) === expediteurId);
        const destinataireInfo = personnels.find(p => getPersonnelId(p) === destinataireId);
        // Priorité au nom dénormalisé figé à l'envoi, puis résolution par id, puis fallback.
        const expediteurName = r.nom_expediteur
            || (expediteurInfo ? `${expediteurInfo.nom} ${expediteurInfo.prenom}` : `Personnel #${expediteurId}`);
        const destinataireName = r.nom_destinataire
            || (destinataireInfo ? `${destinataireInfo.nom} ${destinataireInfo.prenom}` : `Personnel #${destinataireId}`);

        return {
            id: r.code_rapport || `RPT-${r.id}`,
            idRapport: r.id,  // C'est 'id' retourné par le backend
            objet: r.objet,
            corps: r.corps,
            dateEnvoi: r.date_creation?.split('T')[0] || new Date().toISOString().split('T')[0],
            expediteur: expediteurId,
            expediteurName,
            destinataire: destinataireId,
            destinataireName,
            type: r.type_rapport,
            concerneName: destinataireName,
            concerne: destinataireId,
            isRead: r.est_lu === true
        };
    }

    async function handleSubmitReport(e) {
        e.preventDefault();

        if (!reportForm.destinataire) {
            setError("Veuillez saisir l'ID du destinataire.");
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
            const expediteurPers = personnelList.find(p => getPersonnelUuid(p) === String(userId));
            const destinatairePers = personnelList.find(p => getPersonnelUuid(p) === String(reportForm.destinataire));
            const nomExpediteur = expediteurPers
                ? `${expediteurPers.nom} ${expediteurPers.prenom || ''}`.trim()
                : currentUserName;
            const nomDestinataire = destinatairePers
                ? `${destinatairePers.nom} ${destinatairePers.prenom || ''}`.trim()
                : '';
            const newReportData = {
                code_rapport: codeRapport,
                objet: reportForm.objet,
                corps: reportForm.corps,
                type_rapport: "GENERAL",
                id_expediteur: String(userId),
                id_destinataire: String(reportForm.destinataire),
                expediteur: String(userId),
                destinataire: String(reportForm.destinataire),
                nom_expediteur: nomExpediteur,
                nom_destinataire: nomDestinataire,
            };

            console.log("📤 Envoi du rapport:", newReportData);

            await rapportApi.create(newReportData);

            setSuccessMessage("Rapport envoyé avec succès !");
            setTimeout(() => setSuccessMessage(""), 3000);
            setReportForm({ objet: "", destinataire: "", corps: "" });
            await loadData();

        } catch (err) {
            console.error("Erreur lors de l'envoi:", err);
            setError("Erreur lors de l'envoi du rapport. Veuillez réessayer.");
        } finally {
            setSubmitting(false);
        }
    }

    async function viewReportDetails(report, isReceived = false) {
        setSelectedReport({ ...report, isReceived });
        setShowDetailModal(true);

        // Si c'est un rapport reçu et non lu, le marquer comme lu
        if (isReceived && !report.isRead && report.idRapport) {
            try {
                await rapportApi.marquerLu(report.idRapport);
                setReceivedReports(prev => prev.map(r =>
                    r.id === report.id ? { ...r, isRead: true } : r
                ));
            } catch (err) {
                console.error("Erreur lors du marquage:", err);
            }
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
        doc.text("Rapport Officiel", pageWidth / 2, 28, { align: "center" });

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

        yPos += 12;
        doc.setFont(undefined, 'bold');
        doc.text("Expéditeur:", margin, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(isReceived ? report.expediteurName : currentUserName, margin + 40, yPos);

        yPos += 8;
        doc.setFont(undefined, 'bold');
        doc.text("Destinataire:", margin, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(report.concerneName || report.destinataireName, margin + 45, yPos);

        yPos += 10;
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
        doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, pageHeight - 18);
        doc.text("Fultang Clinic - Comptable Matière", pageWidth - margin, pageHeight - 18, { align: "right" });

        doc.save(`rapport_${report.id}.pdf`);
    }

    function exportAllSentToPDF() {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;

        doc.setFontSize(16);
        doc.setTextColor(26, 115, 163);
        doc.text("Liste des Rapports Envoyés", pageWidth / 2, 20, { align: "center" });

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Exporté le: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 28, { align: "center" });

        let yPos = 40;

        sentReports.forEach((report) => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFillColor(245, 245, 245);
            doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 25, 'F');

            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.setFont(undefined, 'bold');
            doc.text(`${report.id} - ${report.objet}`, margin + 5, yPos);

            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
            doc.text(`À: ${report.concerneName} | Date: ${report.dateEnvoi}`, margin + 5, yPos + 8);
            doc.text(report.corps.substring(0, 80) + "...", margin + 5, yPos + 16);

            yPos += 32;
        });

        doc.save(`rapports_envoyes_${new Date().toISOString().split('T')[0]}.pdf`);
    }

    function exportAllReceivedToPDF() {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;

        doc.setFontSize(16);
        doc.setTextColor(26, 115, 163);
        doc.text("Liste des Rapports Reçus", pageWidth / 2, 20, { align: "center" });

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Exporté le: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 28, { align: "center" });

        let yPos = 40;

        receivedReports.forEach((report) => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFillColor(245, 245, 245);
            doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 25, 'F');

            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.setFont(undefined, 'bold');
            doc.text(`${report.id} - ${report.objet}`, margin + 5, yPos);

            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
            doc.text(`De: ${report.expediteurName} | Date: ${report.dateEnvoi}`, margin + 5, yPos + 8);
            doc.text(report.corps.substring(0, 80) + "...", margin + 5, yPos + 16);

            yPos += 32;
        });

        doc.save(`rapports_recus_${new Date().toISOString().split('T')[0]}.pdf`);
    }

    if (loading) {
        return (
            <AccountantDashBoard linkList={AccountantNavLink} requiredRole={"compta_matiere"}>
                <AccountantNavBar />
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <FaSpinner className="animate-spin text-4xl text-primary-start mx-auto mb-4" />
                        <p className="text-gray-600">Chargement des rapports...</p>
                    </div>
                </div>
            </AccountantDashBoard>
        );
    }

    return (
        <AccountantDashBoard
            linkList={AccountantNavLink}
            requiredRole={"compta_matiere"}
        >
            <AccountantNavBar />
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
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
                        <FaCheckCircle /> {successMessage}
                    </div>
                )}

                {/* Formulaire de saisie d'un rapport */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <FaEnvelope className="text-primary-end" />
                        Rédiger un Nouveau Rapport
                    </h2>
                    <form onSubmit={handleSubmitReport} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Objet *
                                </label>
                                <input
                                    type="text"
                                    maxLength={10}
                                    value={reportForm.objet}
                                    onChange={(e) => setReportForm({ ...reportForm, objet: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end focus:border-transparent"
                                    placeholder="Objet du rapport (max 10 car.)"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">{reportForm.objet.length}/10 caractères</p>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Destinataire *
                                </label>
                                <select
                                    value={reportForm.destinataire}
                                    onChange={(e) => setReportForm({ ...reportForm, destinataire: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end focus:border-transparent"
                                    required
                                >
                                    <option value="">Sélectionner un destinataire</option>
                                    {personnelList.map(p => (
                                        <option key={getPersonnelUuid(p)} value={getPersonnelUuid(p)}>
                                            {formatPersonnelOption(p)}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Sélectionnez le personnel destinataire</p>
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
                                placeholder="Rédigez le contenu de votre rapport ici..."
                                rows="6"
                                required
                            />
                        </div>
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

                {/* Deux colonnes : Rapports envoyés et Rapports reçus */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Rapports envoyés */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <FaPaperPlane className="text-blue-500" />
                                Rapports Envoyés ({sentReports.length})
                            </h2>
                            <button
                                onClick={exportAllSentToPDF}
                                disabled={sentReports.length === 0}
                                className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all text-sm disabled:opacity-50"
                            >
                                <FaFilePdf /> Exporter PDF
                            </button>
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
                                Rapports Reçus ({receivedReports.length})
                                {receivedReports.filter(r => !r.isRead).length > 0 && (
                                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                        {receivedReports.filter(r => !r.isRead).length} nouveau(x)
                                    </span>
                                )}
                            </h2>
                            <button
                                onClick={exportAllReceivedToPDF}
                                disabled={receivedReports.length === 0}
                                className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all text-sm disabled:opacity-50"
                            >
                                <FaFilePdf /> Exporter PDF
                            </button>
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
                                className="text-gray-500 hover:text-gray-700 transition-colors"
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
                                    <p className="text-sm text-gray-600">Date d&apos;envoi</p>
                                    <p className="font-bold text-gray-800">{selectedReport.dateEnvoi}</p>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-sm text-gray-600">Objet</p>
                                <p className="font-bold text-gray-800">{selectedReport.objet}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 p-3 rounded-lg">
                                    <p className="text-sm text-blue-600 flex items-center gap-1">
                                        <FaUser /> Expéditeur
                                    </p>
                                    <p className="font-bold text-gray-800">
                                        {selectedReport.isReceived ? selectedReport.expediteurName : "Vous"}
                                    </p>
                                </div>
                                <div className="bg-green-50 p-3 rounded-lg">
                                    <p className="text-sm text-green-600 flex items-center gap-1">
                                        <FaUser /> Destinataire
                                    </p>
                                    <p className="font-bold text-gray-800">{selectedReport.concerneName}</p>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600 mb-2 font-semibold">Corps du rapport</p>
                                <p className="text-gray-800 whitespace-pre-wrap">{selectedReport.corps}</p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => {
                                        exportReportToPDF(selectedReport, selectedReport.isReceived);
                                        setShowDetailModal(false);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                                >
                                    <FaFilePdf /> Télécharger PDF
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
        </AccountantDashBoard>
    );
}

function ReportCard({ report, type, onView, onExport }) {
    ReportCard.propTypes = {
        report: PropTypes.object.isRequired,
        type: PropTypes.oneOf(['sent', 'received']).isRequired,
        onView: PropTypes.func.isRequired,
        onExport: PropTypes.func.isRequired
    };

    const isUnread = type === 'received' && !report.isRead;

    return (
        <div className={`p-4 rounded-lg border-2 transition-all ${isUnread
            ? 'border-green-400 bg-green-50'
            : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
            }`}>
            <div className="flex justify-between items-start mb-2">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800">{report.id}</span>
                        <span className="px-2 py-0.5 bg-primary-end/20 text-primary-start text-xs rounded-full font-semibold">
                            {report.objet}
                        </span>
                        {isUnread && (
                            <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                                Nouveau
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                        {type === 'sent' ? `À: ${report.concerneName}` : `De: ${report.expediteurName}`}
                    </p>
                </div>
                <span className="text-xs text-gray-500">{report.dateEnvoi}</span>
            </div>
            <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                {report.corps.substring(0, 100)}...
            </p>
            <div className="flex gap-2">
                <button
                    onClick={onView}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isUnread
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                        }`}
                >
                    <FaEye /> Voir
                </button>
                <button
                    onClick={onExport}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200 transition-all"
                >
                    <FaFilePdf /> PDF
                </button>
            </div>
        </div>
    );
}
