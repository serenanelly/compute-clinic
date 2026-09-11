/**
 * Page de consultation des inventaires terminés pour le Comptable Matière
 */
import { AccountantDashBoard } from "./Components/AccountantDashboard";
import { AccountantNavLink } from "./AccountantNavLink";
import { AccountantNavBar } from "./Components/AccountantNavBar";
import { useState, useEffect } from "react";
import {
    FaArchive,
    FaEye,
    FaSpinner,
    FaTimes,
    FaCheckCircle,
    FaExclamationTriangle,
    FaHistory,
    FaSyncAlt,
    FaFilePdf
} from "react-icons/fa";
import jsPDF from "jspdf";
import { archiveInventaireApi, ligneArchiveApi, personnelApi } from "../../services/comptabiliteMatiereApi";
import { APP_NAME, brandFooter } from '../../constants/branding.js';

export function AccountantInventoryArchives() {
    const [archives, setArchives] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedArchive, setSelectedArchive] = useState(null);
    const [archiveDetails, setArchiveDetails] = useState([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [personnels, setPersonnels] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            setError(null);

            // Charger les archives terminées
            const archivesData = await archiveInventaireApi.getAll();
            const allArchives = Array.isArray(archivesData) ? archivesData : (archivesData.results || []);

            // Filtrer uniquement les archives terminées
            const terminatedArchives = allArchives.filter(
                (a) => a.statut === "CLOTURE" || a.statut === "TERMINE"
            );

            // Trier par date (les plus récentes en premier)
            terminatedArchives.sort((a, b) => new Date(b.date_termine || b.date_creation) - new Date(a.date_termine || a.date_creation));

            setArchives(terminatedArchives);

            // Charger le personnel pour les noms
            const personnelData = await personnelApi.getAll();
            setPersonnels(Array.isArray(personnelData) ? personnelData : (personnelData.results || []));

        } catch (err) {
            console.error("Erreur lors du chargement des archives:", err);
            setError("Impossible de charger les archives d'inventaire.");
        } finally {
            setLoading(false);
        }
    }

    async function viewArchiveDetails(archive) {
        try {
            setLoadingDetails(true);
            setSelectedArchive(archive);
            setShowDetailModal(true);

            // Charger les lignes de l'archive
            const lignesData = await ligneArchiveApi.getByArchive(archive.id_archive);
            const lignes = Array.isArray(lignesData) ? lignesData : (lignesData.results || []);

            setArchiveDetails(lignes);
        } catch (err) {
            console.error("Erreur lors du chargement des détails:", err);
            setArchiveDetails([]);
        } finally {
            setLoadingDetails(false);
        }
    }

    function getResponsableName(responsableId) {
        if (!responsableId) return "";
        const id = String(responsableId);
        const personnel = personnels.find(
            (p) => String(p.id || p.id_personnel) === id
        );
        return personnel ? `${personnel.nom} ${personnel.prenom}` : "";
    }

    function getResponsableId(archive) {
        return archive.id_responsable || archive.responsable_id || archive.responsable || "";
    }

    // Export PDF de l'archive complète
    async function exportArchiveToPDF(archive) {
        try {
            // Charger les lignes si pas déjà chargées
            let lignes = archiveDetails;
            if (!selectedArchive || selectedArchive.id_archive !== archive.id_archive) {
                const lignesData = await ligneArchiveApi.getByArchive(archive.id_archive);
                lignes = Array.isArray(lignesData) ? lignesData : (lignesData.results || []);
            }

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 15;

            // En-tête
            doc.setFontSize(18);
            doc.setTextColor(26, 115, 163);
            doc.text(APP_NAME, pageWidth / 2, 20, { align: "center" });

            doc.setFontSize(14);
            doc.setTextColor(80, 194, 185);
            doc.text("Rapport d'Inventaire Complet", pageWidth / 2, 28, { align: "center" });

            doc.setDrawColor(80, 194, 185);
            doc.line(margin, 35, pageWidth - margin, 35);

            let yPos = 45;
            doc.setFontSize(10);
            doc.setTextColor(0);

            // Infos de l'archive
            doc.text(`Référence: ${archive.code_archive}`, margin, yPos);
            const responsable = getResponsableName(getResponsableId(archive));
            if (responsable) {
                doc.text(`Responsable: ${responsable}`, margin + 80, yPos);
            }
            doc.text(`Date: ${new Date(archive.date_termine).toLocaleDateString('fr-FR')}`, pageWidth - margin, yPos, { align: "right" });

            yPos += 12;

            // En-tête du tableau
            doc.setFillColor(26, 115, 163);
            doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 10, 'F');
            doc.setTextColor(255);
            doc.setFont(undefined, 'bold');
            doc.setFontSize(9);
            doc.text("Code", margin + 3, yPos);
            doc.text("Matériel", margin + 28, yPos);
            doc.text("Ancien Stock", margin + 90, yPos);
            doc.text("Nouveau Stock", margin + 120, yPos);
            doc.text("Différence", margin + 155, yPos);
            doc.text("Statut", pageWidth - margin - 20, yPos);

            yPos += 12;
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0);
            doc.setFontSize(9);

            // Lignes du tableau
            lignes.forEach((line, index) => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }

                if (index % 2 === 0) {
                    doc.setFillColor(245, 245, 245);
                    doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
                }

                doc.setTextColor(0);
                doc.text(line.code_materiel || "", margin + 3, yPos);
                doc.text((line.nom_materiel || "").substring(0, 25), margin + 28, yPos);
                doc.text(String(line.quantite_ancien_stock || 0), margin + 95, yPos);
                doc.text(line.quantite_nouveau_stock !== null ? String(line.quantite_nouveau_stock) : '-', margin + 130, yPos);

                const diff = line.difference;
                if (diff !== null && diff !== undefined) {
                    if (diff > 0) {
                        doc.setTextColor(39, 174, 96);
                        doc.text(`+${diff}`, margin + 160, yPos);
                        doc.text("Excédent", pageWidth - margin - 20, yPos);
                    } else if (diff < 0) {
                        doc.setTextColor(231, 76, 60);
                        doc.text(String(diff), margin + 160, yPos);
                        doc.text("Déficit", pageWidth - margin - 20, yPos);
                    } else {
                        doc.setTextColor(52, 152, 219);
                        doc.text("0", margin + 160, yPos);
                        doc.text("Conforme", pageWidth - margin - 20, yPos);
                    }
                } else {
                    doc.setTextColor(127, 140, 141);
                    doc.text("-", margin + 160, yPos);
                    doc.text("-", pageWidth - margin - 20, yPos);
                }

                yPos += 8;
            });

            // Pied de page
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, pageHeight - 10);
            doc.text(brandFooter('Comptabilité Matière'), pageWidth - margin, pageHeight - 10, { align: "right" });

            doc.save(`inventaire_${archive.code_archive}.pdf`);
        } catch (err) {
            console.error("Erreur lors de l'export PDF:", err);
            alert("Erreur lors de l'export PDF");
        }
    }

    return (
        <AccountantDashBoard
            linkList={AccountantNavLink}
            requiredRole={"compta_matiere"} requiredFunctionalService="COMPTA_MATIERE"
        >
            <AccountantNavBar />
            <div className="p-6 space-y-6">
                {/* En-tête */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <FaArchive className="text-4xl text-primary-start" />
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">Consulter les Inventaires</h1>
                            <p className="text-gray-500">Liste des inventaires terminés</p>
                        </div>
                    </div>
                    <button
                        onClick={loadData}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
                        disabled={loading}
                    >
                        <FaSyncAlt className={loading ? "animate-spin" : ""} /> Actualiser
                    </button>
                </div>

                {/* Message d'erreur */}
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                        <FaExclamationTriangle />
                        {error}
                    </div>
                )}

                {/* Chargement */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <FaSpinner className="animate-spin text-4xl text-primary-start mx-auto mb-4" />
                            <p className="text-gray-600">Chargement des archives...</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <FaHistory className="text-blue-500" />
                            Archives Terminées ({archives.length})
                        </h2>

                        {archives.length > 0 ? (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto">
                                {archives.map(archive => (
                                    <div
                                        key={archive.id_archive}
                                        className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-800">{archive.code_archive}</span>
                                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                                    <FaCheckCircle className="inline mr-1" />
                                                    Terminé
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">
                                                Terminé le: {new Date(archive.date_termine).toLocaleDateString('fr-FR', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                            {getResponsableId(archive) && (
                                                <p className="text-sm text-gray-500">
                                                    Responsable: {getResponsableName(getResponsableId(archive))}
                                                </p>
                                            )}
                                            {archive.observations && (
                                                <p className="text-sm text-gray-400 italic mt-1">{archive.observations}</p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => viewArchiveDetails(archive)}
                                                className="flex items-center gap-1 px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all"
                                                title="Voir les détails"
                                            >
                                                <FaEye /> Voir
                                            </button>
                                            <button
                                                onClick={() => exportArchiveToPDF(archive)}
                                                className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                                                title="Exporter en PDF"
                                            >
                                                <FaFilePdf /> PDF
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                <FaArchive className="mx-auto text-5xl text-gray-300 mb-4" />
                                <p>Aucune archive d&apos;inventaire terminée</p>
                                <p className="text-sm">Les inventaires terminés par le pharmacien apparaîtront ici</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Modal de détails */}
                {showDetailModal && selectedArchive && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
                            {/* Header du modal */}
                            <div className="bg-gradient-to-r from-primary-start to-primary-end text-white p-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-xl font-bold">{selectedArchive.code_archive}</h2>
                                        <p className="text-white/80 text-sm mt-1">
                                            Terminé le {new Date(selectedArchive.date_termine).toLocaleDateString('fr-FR')}
                                            {getResponsableId(selectedArchive) && ` • ${getResponsableName(getResponsableId(selectedArchive))}`}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => exportArchiveToPDF(selectedArchive)}
                                            className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg transition-all flex items-center gap-2"
                                        >
                                            <FaFilePdf /> Exporter PDF
                                        </button>
                                        <button
                                            onClick={() => setShowDetailModal(false)}
                                            className="text-white/80 hover:text-white p-2"
                                        >
                                            <FaTimes className="text-xl" />
                                        </button>
                                    </div>
                                </div>

                                {/* Statistiques */}
                                {!loadingDetails && archiveDetails.length > 0 && (
                                    <div className="grid grid-cols-4 gap-4 mt-4">
                                        <div className="bg-white/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold">{archiveDetails.length}</div>
                                            <div className="text-xs text-white/80">Total articles</div>
                                        </div>
                                        <div className="bg-green-400/30 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold">
                                                {archiveDetails.filter(l => l.statut_difference === 'EXCEDENT').length}
                                            </div>
                                            <div className="text-xs text-white/80">Excédents</div>
                                        </div>
                                        <div className="bg-red-400/30 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold">
                                                {archiveDetails.filter(l => l.statut_difference === 'DEFICIT').length}
                                            </div>
                                            <div className="text-xs text-white/80">Déficits</div>
                                        </div>
                                        <div className="bg-blue-400/30 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold">
                                                {archiveDetails.filter(l => l.statut_difference === 'CONFORME').length}
                                            </div>
                                            <div className="text-xs text-white/80">Conformes</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Contenu du modal */}
                            <div className="p-6 overflow-y-auto max-h-[50vh]">
                                {loadingDetails ? (
                                    <div className="flex justify-center items-center h-32">
                                        <FaSpinner className="animate-spin text-3xl text-primary-start" />
                                    </div>
                                ) : archiveDetails.length === 0 ? (
                                    <div className="text-center text-gray-500 py-8">
                                        <FaArchive className="text-4xl mx-auto mb-2 text-gray-300" />
                                        Aucun détail disponible pour cette archive.
                                    </div>
                                ) : (
                                    <table className="w-full">
                                        <thead className="bg-gray-100 sticky top-0">
                                            <tr>
                                                <th className="text-left p-3 font-semibold text-gray-700">Code</th>
                                                <th className="text-left p-3 font-semibold text-gray-700">Matériel</th>
                                                <th className="text-center p-3 font-semibold text-gray-700">Ancien Stock</th>
                                                <th className="text-center p-3 font-semibold text-gray-700">Nouveau Stock</th>
                                                <th className="text-center p-3 font-semibold text-gray-700">Différence</th>
                                                <th className="text-center p-3 font-semibold text-gray-700">Statut</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {archiveDetails.map((ligne, idx) => (
                                                <tr
                                                    key={ligne.id_ligne_archive || idx}
                                                    className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}
                                                >
                                                    <td className="p-3 font-mono text-sm text-gray-600">{ligne.code_materiel}</td>
                                                    <td className="p-3 font-medium text-gray-800">{ligne.nom_materiel}</td>
                                                    <td className="p-3 text-center">{ligne.quantite_ancien_stock}</td>
                                                    <td className="p-3 text-center font-semibold">{ligne.quantite_nouveau_stock ?? '-'}</td>
                                                    <td className="p-3 text-center">
                                                        <span className={`font-bold ${ligne.difference > 0 ? 'text-green-600' :
                                                                ligne.difference < 0 ? 'text-red-600' :
                                                                    'text-blue-600'
                                                            }`}>
                                                            {ligne.difference !== null ? (ligne.difference > 0 ? '+' : '') + ligne.difference : '-'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {ligne.statut_difference === 'EXCEDENT' && (
                                                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">Excédent</span>
                                                        )}
                                                        {ligne.statut_difference === 'DEFICIT' && (
                                                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">Déficit</span>
                                                        )}
                                                        {ligne.statut_difference === 'CONFORME' && (
                                                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">Conforme</span>
                                                        )}
                                                        {!ligne.statut_difference && (
                                                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Footer du modal */}
                            <div className="bg-gray-100 px-6 py-4 flex justify-end gap-3">
                                <button
                                    onClick={() => exportArchiveToPDF(selectedArchive)}
                                    className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-all"
                                >
                                    <FaFilePdf /> Télécharger PDF
                                </button>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-all"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AccountantDashBoard>
    );
}
