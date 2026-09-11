import { PharmacistDashBoard } from "./Components/PharmacistDashboard";
import { PharmacistNavLink } from "./PharmacistNavLink";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaBoxes,
    FaSave,
    FaCheckCircle,
    FaFilePdf,
    FaArchive,
    FaEye,
    FaHistory,
    FaArrowRight,
    FaPrint,
    FaSpinner,
    FaExclamationTriangle,
    FaSyncAlt
} from "react-icons/fa";
import jsPDF from "jspdf";
import { materielMedicalApi, archiveInventaireApi, ligneArchiveApi, getPersonnelId } from "../../services/comptabiliteMatiereApi";
import { APP_NAME, brandFooter } from '../../constants/branding.js';

const isArchiveCloturee = (statut) => statut === "CLOTURE" || statut === "TERMINE";

export function PharmacistInventory() {
    const navigate = useNavigate();

    // États de chargement et erreur
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    // État actuel des médicaments (depuis l'API)
    const [medications, setMedications] = useState([]);

    // Liste des archives (depuis l'API)
    const [archives, setArchives] = useState([]);

    // Archive en cours
    const [currentArchive, setCurrentArchive] = useState(null);

    // Mode actuel
    const [mode, setMode] = useState("list"); // "list" | "inventory" | "report"

    // Archive sélectionnée pour consultation
    const [selectedArchive, setSelectedArchive] = useState(null);
    const [selectedArchiveLines, setSelectedArchiveLines] = useState([]);
    const [showArchiveModal, setShowArchiveModal] = useState(false);

    // Message de succès
    const [successMessage, setSuccessMessage] = useState("");

    // Charger les données depuis l'API
    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            setError(null);

            // Charger les matériels médicaux
            const materielsData = await materielMedicalApi.getAll();
            const materiels = Array.isArray(materielsData) ? materielsData : (materielsData.results || []);

            const medicationsFormatted = materiels.map(m => ({
                id: m.idMateriel || m.materiel_ptr_id,
                code: m.code_materiel,
                name: m.nom_Materiel,
                quantiteActuelle: m.quantite_stock,
                nouvelleQuantite: "",
                prixVente: parseFloat(m.prix_vente_unitaire) || 0,
                categorie: m.categorie,
                unite: m.unite_mesure
            }));
            setMedications(medicationsFormatted);

            // Charger les archives d'inventaire
            const archivesData = await archiveInventaireApi.getAll();
            const archivesList = Array.isArray(archivesData) ? archivesData : (archivesData.results || []);
            setArchives(archivesList);

            // Vérifier s'il y a un inventaire en cours
            const inProgress = archivesList.find(a => a.statut === "EN_COURS");
            if (inProgress) {
                setCurrentArchive(inProgress);
                // Charger les lignes de l'archive en cours
                await loadArchiveLines(inProgress);
                setMode("inventory");
            }

        } catch (err) {
            console.error("Erreur lors du chargement des données:", err);
            setError("Impossible de charger les données. Vérifiez que le backend est en cours d'exécution.");
        } finally {
            setLoading(false);
        }
    }

    async function loadArchiveLines(archive) {
        try {
            const linesData = await ligneArchiveApi.getByArchive(archive.id_archive);
            const lines = Array.isArray(linesData) ? linesData : (linesData.results || []);

            // Mettre à jour les médicaments avec les données de l'archive
            setMedications(prev => prev.map(med => {
                const line = lines.find(l => l.code_materiel === med.code);
                if (line) {
                    return {
                        ...med,
                        quantiteActuelle: line.quantite_ancien_stock,
                        nouvelleQuantite: line.quantite_nouveau_stock !== null ? String(line.quantite_nouveau_stock) : "",
                        lineId: line.id_ligne_archive
                    };
                }
                return med;
            }));
        } catch (err) {
            console.error("Erreur lors du chargement des lignes:", err);
        }
    }

    async function startInventory() {
        try {
            setSaving(true);
            setError(null);

            // Générer le code d'archive
            const now = new Date();
            const code = `ARC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;

            // Récupérer l'ID du personnel connecté (utiliser 1 par défaut pour le test)
            const personnelId = getPersonnelId();

            // Créer l'archive dans le backend
            const archiveData = {
                code_archive: code,
                id_responsable: personnelId ? String(personnelId) : "",
                observations: `Inventaire démarré le ${now.toLocaleDateString('fr-FR')}`
            };

            const newArchive = await archiveInventaireApi.create(archiveData);
            console.log("✅ Archive créée:", newArchive);
            setCurrentArchive(newArchive);

            // Créer les lignes d'archive pour chaque médicament
            let lignesCreees = 0;
            let lignesEchouees = 0;
            for (const med of medications) {
                try {
                    const ligneData = {
                        id_archive: newArchive.id_archive,
                        id_materiel: med.id,
                        code_materiel: med.code,
                        nom_materiel: med.name,
                        prix_vente: parseFloat(med.prixVente) || 0,
                        quantite_ancien_stock: parseInt(med.quantiteActuelle) || 0
                    };
                    console.log("📦 Création ligne archive:", ligneData);
                    await ligneArchiveApi.create(ligneData);
                    lignesCreees++;
                } catch (ligneErr) {
                    console.error(`❌ Erreur ligne ${med.code}:`, ligneErr.response?.data);
                    lignesEchouees++;
                }
            }

            console.log(`✅ ${lignesCreees} lignes créées, ${lignesEchouees} échecs`);

            // Recharger les archives
            const archivesData = await archiveInventaireApi.getAll();
            setArchives(Array.isArray(archivesData) ? archivesData : (archivesData.results || []));

            // Réinitialiser les nouvelles quantités
            setMedications(medications.map(m => ({ ...m, nouvelleQuantite: "" })));

            // Passer en mode inventaire
            setMode("inventory");
            setSuccessMessage(`Archive ${code} créée avec ${lignesCreees} articles. Veuillez maintenant saisir les nouvelles quantités.`);
            setTimeout(() => setSuccessMessage(""), 5000);

        } catch (err) {
            console.error("Erreur lors de la création de l'archive:", err);
            console.error("❌ Détails erreur backend:", err.response?.data);
            const backendError = err.response?.data
                ? JSON.stringify(err.response.data)
                : err.message;
            setError(`Impossible de démarrer l'inventaire: ${backendError}`);
        } finally {
            setSaving(false);
        }
    }

    function updateQuantity(code, value) {
        setMedications(medications.map(m =>
            m.code === code ? { ...m, nouvelleQuantite: value } : m
        ));
    }

    async function saveInventory() {
        // Vérifier que toutes les quantités sont remplies
        const hasEmpty = medications.some(m => m.nouvelleQuantite === "");
        if (hasEmpty) {
            alert("Veuillez remplir toutes les nouvelles quantités !");
            return;
        }

        try {
            setSaving(true);
            setError(null);

            // Récupérer les lignes de l'archive en cours
            console.log("📦 Récupération des lignes pour archive:", currentArchive.id_archive);
            const linesData = await ligneArchiveApi.getByArchive(currentArchive.id_archive);
            const lines = Array.isArray(linesData) ? linesData : (linesData.results || []);
            console.log(`📦 ${lines.length} lignes trouvées`);

            if (lines.length === 0) {
                // Les lignes n'ont pas été créées - les créer maintenant
                console.log("⚠️ Aucune ligne trouvée, création des lignes...");
                for (const med of medications) {
                    try {
                        await ligneArchiveApi.create({
                            id_archive: currentArchive.id_archive,
                            id_materiel: med.id,
                            code_materiel: med.code,
                            nom_materiel: med.name,
                            prix_vente: parseFloat(med.prixVente) || 0,
                            quantite_ancien_stock: parseInt(med.quantiteActuelle) || 0,
                            quantite_nouveau_stock: parseInt(med.nouvelleQuantite)
                        });
                    } catch (createErr) {
                        console.error(`❌ Erreur création ligne ${med.code}:`, createErr.response?.data);
                    }
                }
            } else {
                // Mettre à jour chaque ligne avec la nouvelle quantité
                for (const med of medications) {
                    const line = lines.find(l => l.code_materiel === med.code);
                    if (line) {
                        const nouveauStock = parseInt(med.nouvelleQuantite);
                        const difference = nouveauStock - line.quantite_ancien_stock;
                        let statutDiff = "CONFORME";
                        if (difference > 0) statutDiff = "EXCEDENT";
                        else if (difference < 0) statutDiff = "DEFICIT";

                        try {
                            await ligneArchiveApi.patch(line.id_ligne_archive, {
                                quantite_nouveau_stock: nouveauStock,
                                difference: difference,
                                statut_difference: statutDiff
                            });
                        } catch (patchErr) {
                            console.error(`❌ Erreur mise à jour ligne ${med.code}:`, patchErr.response?.data);
                        }

                        // Mettre à jour le stock du matériel
                        try {
                            await materielMedicalApi.patch(med.id, {
                                quantite_stock: nouveauStock
                            });
                        } catch (stockErr) {
                            console.error(`❌ Erreur mise à jour stock ${med.code}:`, stockErr.response?.data);
                        }
                    }
                }
            }

            // Terminer l'archive
            await archiveInventaireApi.terminer(currentArchive.id_archive);

            // Recharger les données
            await loadData();

            // Passer en mode rapport
            setMode("report");
            setCurrentArchive(null);
            setSuccessMessage("Inventaire enregistré ! Vous pouvez maintenant rédiger votre rapport.");
            setTimeout(() => setSuccessMessage(""), 5000);

        } catch (err) {
            console.error("Erreur lors de la sauvegarde:", err);
            console.error("❌ Détails:", err.response?.data);
            const errDetail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
            setError(`Impossible de sauvegarder l'inventaire: ${errDetail}`);
        } finally {
            setSaving(false);
        }
    }

    function goToReports() {
        // Préparer les données du rapport d'inventaire pour la page des rapports
        const latestArchive = archives.find((a) => isArchiveCloturee(a.statut));

        if (latestArchive) {
            const inventoryReportData = {
                archiveId: latestArchive.code_archive,
                dateInventaire: latestArchive.date_termine || new Date().toISOString(),
                etatActuelStock: medications.map(m => ({
                    code: m.code,
                    name: m.name,
                    quantite: m.quantiteActuelle,
                    prixVente: m.prixVente
                })),
                archiveDbId: latestArchive.id_archive
            };

            localStorage.setItem('pending_inventory_report', JSON.stringify(inventoryReportData));
        }

        navigate("/pharmacist/reports");
    }

    async function viewArchive(archive) {
        try {
            setLoading(true);
            const linesData = await ligneArchiveApi.getByArchive(archive.id_archive);
            const lines = Array.isArray(linesData) ? linesData : (linesData.results || []);

            console.log(`📦 Archive ${archive.code_archive}: ${lines.length} lignes chargées`);

            setSelectedArchiveLines(lines);
            setSelectedArchive(archive);
            setShowArchiveModal(true);
        } catch (err) {
            console.error("❌ Erreur lors du chargement de l'archive:", err);
            setError(`Impossible de charger les détails de l'archive: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }

    // Fonction pour exporter l'ancien stock en PDF
    function exportAncienStockToPDF(archive) {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;

        doc.setFontSize(18);
        doc.setTextColor(26, 115, 163);
        doc.text(brandFooter("PHARMACIE"), pageWidth / 2, 20, { align: "center" });

        doc.setFontSize(14);
        doc.setTextColor(80, 194, 185);
        doc.text("État Ancien du Stock", pageWidth / 2, 28, { align: "center" });

        doc.setDrawColor(80, 194, 185);
        doc.line(margin, 35, pageWidth - margin, 35);

        let yPos = 45;
        doc.setFontSize(10);
        doc.setTextColor(0);

        doc.text(`Archive: ${archive.code_archive}`, margin, yPos);
        doc.text(`Date: ${new Date(archive.date_creation).toLocaleDateString('fr-FR')}`, pageWidth - margin, yPos, { align: "right" });

        yPos += 15;

        doc.setFillColor(26, 115, 163);
        doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
        doc.setTextColor(255);
        doc.setFont(undefined, 'bold');
        doc.text("Code", margin + 5, yPos);
        doc.text("Médicament", margin + 35, yPos);
        doc.text("Quantité", margin + 120, yPos);
        doc.text("Prix Vente", margin + 150, yPos);

        yPos += 10;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0);

        selectedArchiveLines.forEach((line, index) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }

            if (index % 2 === 0) {
                doc.setFillColor(245, 245, 245);
                doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
            }

            doc.text(line.code_materiel || "", margin + 5, yPos);
            doc.text((line.nom_materiel || "").substring(0, 30), margin + 35, yPos);
            doc.text(String(line.quantite_ancien_stock || 0), margin + 120, yPos);
            doc.text(`${line.prix_vente || 0} F`, margin + 150, yPos);

            yPos += 8;
        });

        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, pageHeight - 15);
        doc.text(brandFooter('Pharmacie'), pageWidth - margin, pageHeight - 15, { align: "right" });

        doc.save(`ancien_stock_${archive.code_archive}.pdf`);
    }

    // Fonction pour exporter le nouveau stock en PDF
    function exportNouveauStockToPDF(archive) {
        if (!isArchiveCloturee(archive.statut)) {
            alert("Le nouveau stock n'est pas encore disponible pour cette archive.");
            return;
        }

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;

        doc.setFontSize(18);
        doc.setTextColor(26, 115, 163);
        doc.text(brandFooter("PHARMACIE"), pageWidth / 2, 20, { align: "center" });

        doc.setFontSize(14);
        doc.setTextColor(80, 194, 185);
        doc.text("État Nouveau du Stock (Après Inventaire)", pageWidth / 2, 28, { align: "center" });

        doc.setDrawColor(80, 194, 185);
        doc.line(margin, 35, pageWidth - margin, 35);

        let yPos = 45;
        doc.setFontSize(10);
        doc.setTextColor(0);

        doc.text(`Archive: ${archive.code_archive}`, margin, yPos);
        doc.text(`Date: ${new Date(archive.date_termine).toLocaleDateString('fr-FR')}`, pageWidth - margin, yPos, { align: "right" });

        yPos += 15;

        doc.setFillColor(39, 174, 96);
        doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
        doc.setTextColor(255);
        doc.setFont(undefined, 'bold');
        doc.text("Code", margin + 5, yPos);
        doc.text("Médicament", margin + 35, yPos);
        doc.text("Quantité", margin + 120, yPos);
        doc.text("Prix Vente", margin + 150, yPos);

        yPos += 10;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0);

        selectedArchiveLines.forEach((line, index) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }

            if (index % 2 === 0) {
                doc.setFillColor(245, 245, 245);
                doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
            }

            doc.text(line.code_materiel || "", margin + 5, yPos);
            doc.text((line.nom_materiel || "").substring(0, 30), margin + 35, yPos);
            doc.text(String(line.quantite_nouveau_stock || 0), margin + 120, yPos);
            doc.text(`${line.prix_vente || 0} F`, margin + 150, yPos);

            yPos += 8;
        });

        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, pageHeight - 15);
        doc.text(brandFooter('Pharmacie'), pageWidth - margin, pageHeight - 15, { align: "right" });

        doc.save(`nouveau_stock_${archive.code_archive}.pdf`);
    }

    // Fonction pour exporter les différences en PDF
    function exportDifferencesToPDF(archive) {
        if (!isArchiveCloturee(archive.statut)) {
            alert("Les différences ne sont pas encore disponibles pour cette archive.");
            return;
        }

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;

        doc.setFontSize(18);
        doc.setTextColor(26, 115, 163);
        doc.text(brandFooter("PHARMACIE"), pageWidth / 2, 20, { align: "center" });

        doc.setFontSize(14);
        doc.setTextColor(80, 194, 185);
        doc.text("Rapport des Différences d'Inventaire", pageWidth / 2, 28, { align: "center" });

        doc.setDrawColor(80, 194, 185);
        doc.line(margin, 35, pageWidth - margin, 35);

        let yPos = 45;
        doc.setFontSize(10);
        doc.setTextColor(0);

        doc.text(`Archive: ${archive.code_archive}`, margin, yPos);
        doc.text(`Date: ${new Date(archive.date_termine).toLocaleDateString('fr-FR')}`, pageWidth - margin, yPos, { align: "right" });

        yPos += 15;

        doc.setFillColor(230, 126, 34);
        doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
        doc.setTextColor(255);
        doc.setFont(undefined, 'bold');
        doc.text("Code", margin + 3, yPos);
        doc.text("Médicament", margin + 25, yPos);
        doc.text("Ancien", margin + 95, yPos);
        doc.text("Nouveau", margin + 120, yPos);
        doc.text("Diff.", margin + 150, yPos);
        doc.text("Statut", margin + 165, yPos);

        yPos += 10;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0);

        selectedArchiveLines.forEach((line, index) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }

            if (index % 2 === 0) {
                doc.setFillColor(245, 245, 245);
                doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
            }

            doc.text(line.code_materiel || "", margin + 3, yPos);
            doc.text((line.nom_materiel || "").substring(0, 25), margin + 25, yPos);
            doc.text(String(line.quantite_ancien_stock || 0), margin + 95, yPos);
            doc.text(String(line.quantite_nouveau_stock || 0), margin + 120, yPos);

            const diff = line.difference || 0;
            if (diff > 0) {
                doc.setTextColor(39, 174, 96);
                doc.text(`+${diff}`, margin + 150, yPos);
                doc.text("Excédent", margin + 165, yPos);
            } else if (diff < 0) {
                doc.setTextColor(231, 76, 60);
                doc.text(String(diff), margin + 150, yPos);
                doc.text("Déficit", margin + 165, yPos);
            } else {
                doc.setTextColor(127, 140, 141);
                doc.text("0", margin + 150, yPos);
                doc.text("OK", margin + 165, yPos);
            }

            doc.setTextColor(0);
            yPos += 8;
        });

        // Résumé
        yPos += 10;
        const excedents = selectedArchiveLines.filter(l => (l.difference || 0) > 0).length;
        const deficits = selectedArchiveLines.filter(l => (l.difference || 0) < 0).length;
        const conformes = selectedArchiveLines.filter(l => (l.difference || 0) === 0).length;

        doc.setFillColor(240, 240, 240);
        doc.rect(margin, yPos, pageWidth - 2 * margin, 25, 'F');
        yPos += 8;
        doc.setFont(undefined, 'bold');
        doc.text("RÉSUMÉ:", margin + 5, yPos);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(39, 174, 96);
        doc.text(`Excédents: ${excedents}`, margin + 40, yPos);
        doc.setTextColor(231, 76, 60);
        doc.text(`Déficits: ${deficits}`, margin + 80, yPos);
        doc.setTextColor(127, 140, 141);
        doc.text(`Conformes: ${conformes}`, margin + 115, yPos);

        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, pageHeight - 15);
        doc.text(brandFooter('Pharmacie'), pageWidth - margin, pageHeight - 15, { align: "right" });

        doc.save(`differences_${archive.code_archive}.pdf`);
    }

    // Fonction pour exporter l'archive complète
    function exportFullArchiveToPDF(archive) {
        const doc = new jsPDF('landscape');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;

        doc.setFontSize(18);
        doc.setTextColor(26, 115, 163);
        doc.text(brandFooter("PHARMACIE"), pageWidth / 2, 15, { align: "center" });

        doc.setFontSize(14);
        doc.setTextColor(80, 194, 185);
        doc.text("Rapport Complet d'Inventaire", pageWidth / 2, 23, { align: "center" });

        doc.setDrawColor(80, 194, 185);
        doc.line(margin, 28, pageWidth - margin, 28);

        let yPos = 35;
        doc.setFontSize(10);
        doc.setTextColor(0);

        doc.text(`Référence Archive: ${archive.code_archive}`, margin, yPos);
        doc.text(`Date début: ${new Date(archive.date_creation).toLocaleDateString('fr-FR')}`, margin + 80, yPos);
        if (archive.date_termine) {
            doc.text(`Date fin: ${new Date(archive.date_termine).toLocaleDateString('fr-FR')}`, margin + 160, yPos);
        }
        doc.text(`Statut: ${isArchiveCloturee(archive.statut) ? 'Terminé' : 'En cours'}`, pageWidth - margin, yPos, { align: "right" });

        yPos += 12;

        doc.setFillColor(26, 115, 163);
        doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 10, 'F');
        doc.setTextColor(255);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(9);
        doc.text("Code", margin + 3, yPos);
        doc.text("Médicament", margin + 28, yPos);
        doc.text("Ancien Stock", margin + 100, yPos);
        doc.text("Nouveau Stock", margin + 140, yPos);
        doc.text("Différence", margin + 185, yPos);
        doc.text("Statut", margin + 220, yPos);

        yPos += 12;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0);
        doc.setFontSize(9);

        selectedArchiveLines.forEach((line, index) => {
            if (yPos > 180) {
                doc.addPage();
                yPos = 20;
            }

            if (index % 2 === 0) {
                doc.setFillColor(245, 245, 245);
                doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
            }

            doc.setTextColor(0);
            doc.text(line.code_materiel || "", margin + 3, yPos);
            doc.text((line.nom_materiel || "").substring(0, 28), margin + 28, yPos);
            doc.text(String(line.quantite_ancien_stock || 0), margin + 105, yPos);
            doc.text(line.quantite_nouveau_stock !== null ? String(line.quantite_nouveau_stock) : '-', margin + 150, yPos);

            const diff = line.difference;
            if (diff !== null && diff !== undefined) {
                if (diff > 0) {
                    doc.setTextColor(39, 174, 96);
                    doc.text(`+${diff}`, margin + 190, yPos);
                    doc.text("Excédent", margin + 220, yPos);
                } else if (diff < 0) {
                    doc.setTextColor(231, 76, 60);
                    doc.text(String(diff), margin + 190, yPos);
                    doc.text("Déficit", margin + 220, yPos);
                } else {
                    doc.setTextColor(127, 140, 141);
                    doc.text("0", margin + 190, yPos);
                    doc.text("OK", margin + 220, yPos);
                }
            } else {
                doc.setTextColor(127, 140, 141);
                doc.text("-", margin + 190, yPos);
                doc.text("En attente", margin + 220, yPos);
            }

            yPos += 8;
        });

        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, pageHeight - 10);
        doc.text(brandFooter('Pharmacie'), pageWidth - margin, pageHeight - 10, { align: "right" });

        doc.save(`archive_complete_${archive.code_archive}.pdf`);
    }

    // Affichage du loader
    if (loading && mode === "list") {
        return (
            <PharmacistDashBoard linkList={PharmacistNavLink} requiredRole={"pharmacien"}>
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <FaSpinner className="animate-spin text-4xl text-primary-start mx-auto mb-4" />
                        <p className="text-gray-600">Chargement des données...</p>
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
                        <FaBoxes className="text-4xl text-primary-start" />
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">Inventaire</h1>
                            <p className="text-gray-500">
                                {mode === "list" && "Gestion des archives d'inventaire"}
                                {mode === "inventory" && "Saisie des nouvelles quantités"}
                                {mode === "report" && "Rapport d'inventaire"}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={loadData}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
                            disabled={loading}
                        >
                            <FaSyncAlt className={loading ? "animate-spin" : ""} /> Actualiser
                        </button>
                        {mode === "list" && (
                            <button
                                onClick={startInventory}
                                disabled={saving || archives.some(a => a.statut === "EN_COURS")}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-lg hover:opacity-90 transition-all font-semibold disabled:opacity-50"
                            >
                                {saving ? <FaSpinner className="animate-spin" /> : <FaArchive />}
                                Démarrer un inventaire
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                        <FaExclamationTriangle />
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
                        <FaCheckCircle />
                        {successMessage}
                    </div>
                )}

                {/* Mode Liste des archives */}
                {mode === "list" && (
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <FaHistory className="text-blue-500" />
                            Historique des Archives ({archives.length})
                        </h2>

                        {archives.length > 0 ? (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto">
                                {archives.map(archive => (
                                    <div key={archive.id_archive} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-800">{archive.code_archive}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isArchiveCloturee(archive.statut)
                                                    ? "bg-green-100 text-green-800"
                                                    : archive.statut === "ANNULE"
                                                        ? "bg-red-100 text-red-800"
                                                        : "bg-yellow-100 text-yellow-800"
                                                    }`}>
                                                    {isArchiveCloturee(archive.statut) ? "Terminé" : archive.statut === "ANNULE" ? "Annulé" : "En cours"}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                Créé le {new Date(archive.date_creation).toLocaleDateString('fr-FR')}
                                                {archive.date_termine && ` • Terminé le ${new Date(archive.date_termine).toLocaleDateString('fr-FR')}`}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => viewArchive(archive)}
                                                className="flex items-center gap-1 px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all"
                                            >
                                                <FaEye /> Voir
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                <FaArchive className="mx-auto text-5xl text-gray-300 mb-4" />
                                <p>Aucune archive d&apos;inventaire</p>
                                <p className="text-sm">Cliquez sur &quot;Démarrer un inventaire&quot; pour créer la première archive</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Mode Inventaire */}
                {mode === "inventory" && (
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-800">Saisie des Nouvelles Quantités</h2>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setMode("list");
                                        setCurrentArchive(null);
                                    }}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={saveInventory}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all disabled:opacity-50"
                                >
                                    {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                                    Valider l&apos;inventaire
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gradient-to-r from-primary-start to-primary-end text-white">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Code</th>
                                        <th className="px-4 py-3 text-left">Médicament</th>
                                        <th className="px-4 py-3 text-center">Qté en BD</th>
                                        <th className="px-4 py-3 text-center">Nouvelle Qté</th>
                                        <th className="px-4 py-3 text-center">Différence</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {medications.map((med, index) => {
                                        const diff = med.nouvelleQuantite !== ""
                                            ? parseInt(med.nouvelleQuantite) - med.quantiteActuelle
                                            : null;
                                        return (
                                            <tr key={med.code} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                                                <td className="px-4 py-3 font-mono text-sm">{med.code}</td>
                                                <td className="px-4 py-3 font-medium">{med.name}</td>
                                                <td className="px-4 py-3 text-center font-bold text-gray-600">
                                                    {med.quantiteActuelle}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="number"
                                                        value={med.nouvelleQuantite}
                                                        onChange={(e) => updateQuantity(med.code, e.target.value)}
                                                        className="w-24 p-2 border border-gray-300 rounded-lg text-center"
                                                        placeholder="0"
                                                        min="0"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {diff !== null && (
                                                        <span className={`font-bold ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-500'
                                                            }`}>
                                                            {diff > 0 ? '+' : ''}{diff}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Mode Rapport */}
                {mode === "report" && (
                    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <FaFilePdf className="text-red-500" />
                            Rapport d&apos;Inventaire
                        </h2>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-semibold text-gray-700 mb-3">État actuel du stock après inventaire:</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {medications.slice(0, 8).map(med => (
                                    <div key={med.code} className="bg-white p-3 rounded-lg border shadow-sm">
                                        <p className="font-medium truncate text-sm text-gray-700">{med.name}</p>
                                        <p className="text-2xl font-bold text-primary-start">{med.quantiteActuelle}</p>
                                        <p className="text-xs text-gray-500">unités</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-center pt-4">
                            <button
                                onClick={goToReports}
                                className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-xl hover:opacity-90 transition-all font-bold text-lg shadow-lg"
                            >
                                Rédiger Rapport <FaArrowRight />
                            </button>
                        </div>

                        <p className="text-center text-sm text-gray-500">
                            Le rapport sera accompagné de l&apos;état actuel du stock et de l&apos;archive créée lors de cet inventaire.
                        </p>

                        <div className="flex justify-center">
                            <button
                                onClick={() => setMode("list")}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                ← Retour à la liste
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de détails d'archive */}
            {showArchiveModal && selectedArchive && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Archive {selectedArchive.code_archive}</h2>
                                <p className="text-sm text-gray-500">
                                    Créée le {new Date(selectedArchive.date_creation).toLocaleDateString('fr-FR')}
                                    {selectedArchive.date_termine && ` • Terminée le ${new Date(selectedArchive.date_termine).toLocaleDateString('fr-FR')}`}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowArchiveModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gradient-to-r from-primary-start to-primary-end text-white">
                                    <tr>
                                        <th className="p-3 text-left">Code</th>
                                        <th className="p-3 text-left">Médicament</th>
                                        <th className="p-3 text-center bg-blue-600">Ancien Stock</th>
                                        <th className="p-3 text-center bg-green-600">Nouveau Stock</th>
                                        <th className="p-3 text-center bg-orange-500">Différence</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedArchiveLines.map((line, idx) => (
                                        <tr key={line.id_ligne_archive} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                                            <td className="p-3 font-mono">{line.code_materiel}</td>
                                            <td className="p-3">{line.nom_materiel}</td>
                                            <td className="p-3 text-center font-bold text-blue-600">{line.quantite_ancien_stock}</td>
                                            <td className="p-3 text-center font-bold text-green-600">
                                                {line.quantite_nouveau_stock !== null ? line.quantite_nouveau_stock : '-'}
                                            </td>
                                            <td className="p-3 text-center font-bold">
                                                {line.difference !== null ? (
                                                    <span className={
                                                        line.difference > 0 ? 'text-green-600' :
                                                            line.difference < 0 ? 'text-red-600' :
                                                                'text-gray-500'
                                                    }>
                                                        {line.difference > 0 ? '+' : ''}{line.difference}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Boutons d'impression */}
                        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <FaPrint /> Imprimer individuellement:
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <button
                                    onClick={() => exportAncienStockToPDF(selectedArchive)}
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
                                >
                                    <FaFilePdf /> Ancien Stock
                                </button>
                                <button
                                    onClick={() => exportNouveauStockToPDF(selectedArchive)}
                                    disabled={!isArchiveCloturee(selectedArchive.statut)}
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FaFilePdf /> Nouveau Stock
                                </button>
                                <button
                                    onClick={() => exportDifferencesToPDF(selectedArchive)}
                                    disabled={!isArchiveCloturee(selectedArchive.statut)}
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FaFilePdf /> Différences
                                </button>
                                <button
                                    onClick={() => exportFullArchiveToPDF(selectedArchive)}
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                                >
                                    <FaFilePdf /> Archive Complète
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end mt-6">
                            <button
                                onClick={() => setShowArchiveModal(false)}
                                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PharmacistDashBoard>
    );
}
