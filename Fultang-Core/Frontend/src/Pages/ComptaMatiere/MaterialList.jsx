import { AccountantDashBoard } from "./Components/AccountantDashboard";
import { AccountantNavLink } from "./AccountantNavLink";
import { AccountantNavBar } from "./Components/AccountantNavBar";
import { useState, useEffect } from "react";
import {
    FaSearch,
    FaBoxes,
    FaFilter,
    FaTimes,
    FaMedkit,
    FaTools,
    FaInfoCircle,
    FaCalendarAlt,
    FaMoneyBillWave,
    FaBarcode,
    FaFilePdf,
    FaSpinner,
    FaSyncAlt
} from "react-icons/fa";
import PropTypes from "prop-types";
import jsPDF from "jspdf";
import { materielMedicalApi, materielDurableApi } from "../../services/comptabiliteMatiereApi";

export function MaterialList() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");

    // État pour le modal de détails
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState(null);

    // Données depuis l'API
    const [materials, setMaterials] = useState([]);

    // Charger les données depuis l'API
    useEffect(() => {
        loadData();
    }, []);

    /**
     * 📡 CHARGEMENT DE LA LISTE DU MATÉRIEL
     * 
     * Sources de données:
     * 1. GET /api/materiels-medicaux/ -> Consommables (médicaments, seringues...)
     * 2. GET /api/materiels-durables/ -> Équipements (lits, microscopes...)
     * 
     * Opération:
     * Récupération parallèle puis fusion des deux listes pour un affichage unifié.
     */
    /**
     * 📡 CHARGEMENT DES DONNÉES (Mode "Toujours Frais")
     * Récupération parallèle avec désactivation explicite du cache.
     */
    const loadData = async () => {
        setLoading(true);
        setError(null);

        try {
            console.log("🚀 MaterialList - Chargement données via Service API...");

            // Récupérer les données en parallèle via le service
            const [medicauxData, durablesData] = await Promise.all([
                materielMedicalApi.getAll(),
                materielDurableApi.getAll()
            ]);

            // Note: materielMedicalApi.getAll() utilise fetchAllPages qui retourne un tableau aggrégé
            const medicauxResults = Array.isArray(medicauxData) ? medicauxData : (medicauxData.results || []);
            const durablesResults = Array.isArray(durablesData) ? durablesData : (durablesData.results || []);

            console.log(`📦 Reçu: ${medicauxResults.length} médicaux, ${durablesResults.length} durables`);

            // 🔄 NORMALISATION DES DONNÉES
            const medicaux = medicauxResults.map(m => ({
                id: m.idMateriel || m.materiel_ptr_id,
                code: m.code_materiel,
                name: m.nom_Materiel,
                category: "Matériel Médical",
                categoryType: "medical",
                quantity: m.quantite_stock,
                unit: m.unite_mesure_display || m.unite_mesure,
                lastUpdate: m.date_derniere_modification?.split('T')[0] || '-',
                location: "Stock Pharmacie",
                prixAchat: parseFloat(m.prix_achat_unitaire) || 0,
                prixVente: parseFloat(m.prix_vente_unitaire) || 0,
                dateEnregistrement: m.date_derniere_modification?.split('T')[0] || '-'
            }));

            const durables = durablesResults.map(m => ({
                id: m.idMateriel || m.materiel_ptr_id,
                code: m.code_materiel,
                name: m.nom_Materiel,
                category: "Matériel Durable",
                categoryType: "durable",
                quantity: m.quantite_stock,
                unit: "Pièce",
                lastUpdate: m.date_derniere_modification?.split('T')[0] || '-',
                location: m.localisation || "Stock Général",
                prixAchat: parseFloat(m.prix_achat_unitaire) || 0,
                prixVente: null,
                dateEnregistrement: m.date_Enregistrement?.split('T')[0] || '-',
                etat: m.Etat_display || m.Etat
            }));

            setMaterials([...medicaux, ...durables]);
        } catch (err) {
            console.error("❌ Erreur:", err);
            setError("Impossible de charger la liste du matériel.");
        } finally {
            setLoading(false);
        }
    };

    function getFilteredMaterials() {
        return materials.filter(material => {
            const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                material.code.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === "all" || material.category === filterCategory;

            return matchesSearch && matchesCategory;
        });
    }

    function handleMaterialClick(material) {
        setSelectedMaterial(material);
        setShowDetailModal(true);
    }

    function formatPrice(price) {
        if (price === null || price === undefined || price === 0) return "-";
        return new Intl.NumberFormat('fr-FR').format(price) + " FCFA";
    }

    function exportToPDF() {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;

        // Titre
        doc.setFontSize(18);
        doc.setTextColor(26, 115, 163);
        doc.text("Liste du Matériel", pageWidth / 2, 20, { align: "center" });

        // Sous-titre
        doc.setFontSize(10);
        doc.setTextColor(100);
        const categoryLabel = filterCategory === "all" ? "Toutes catégories" : filterCategory;
        doc.text(`Catégorie: ${categoryLabel} | Généré le: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 28, { align: "center" });

        // Ligne de séparation
        doc.setDrawColor(80, 194, 185);
        doc.setLineWidth(0.5);
        doc.line(margin, 32, pageWidth - margin, 32);

        // En-têtes du tableau
        let yPos = 42;
        doc.setFillColor(26, 115, 163);
        doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');

        doc.setFontSize(9);
        doc.setTextColor(255);
        doc.setFont(undefined, 'bold');
        doc.text("Code", margin + 2, yPos);
        doc.text("Nom", margin + 25, yPos);
        doc.text("Catégorie", margin + 75, yPos);
        doc.text("Qté", margin + 115, yPos);
        doc.text("Emplacement", margin + 130, yPos);
        doc.text("Prix Achat", margin + 165, yPos);

        yPos += 10;

        // Données
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0);

        const materielsAffiches = getFilteredMaterials();

        materielsAffiches.forEach((material, index) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }

            // Alternance de couleur
            if (index % 2 === 0) {
                doc.setFillColor(245, 245, 245);
                doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
            }

            doc.setFontSize(8);
            doc.text(material.code, margin + 2, yPos);
            doc.text(material.name.substring(0, 25), margin + 25, yPos);
            doc.text(material.category === "Matériel Médical" ? "Médical" : "Durable", margin + 75, yPos);
            doc.text(String(material.quantity), margin + 115, yPos);
            doc.text(material.location.substring(0, 15), margin + 130, yPos);
            doc.text(formatPrice(material.prixAchat).replace(" FCFA", ""), margin + 165, yPos);

            yPos += 8;
        });

        // Pied de page
        yPos += 10;
        doc.setDrawColor(80, 194, 185);
        doc.line(margin, yPos, pageWidth - margin, yPos);

        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Total: ${materielsAffiches.length} matériel(s)`, margin, yPos + 8);
        doc.text("Fultang Clinic - Comptable Matière", pageWidth - margin, yPos + 8, { align: "right" });

        // Télécharger
        doc.save(`liste_materiel_${new Date().toISOString().split('T')[0]}.pdf`);
    }

    const filteredMaterials = getFilteredMaterials();

    if (loading) {
        return (
            <AccountantDashBoard linkList={AccountantNavLink} requiredRole={"compta_matiere"} requiredFunctionalService="COMPTA_MATIERE">
                <AccountantNavBar />
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <FaSpinner className="animate-spin text-4xl text-primary-start mx-auto mb-4" />
                        <p className="text-gray-600">Chargement des matériels...</p>
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
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <FaBoxes className="text-4xl text-primary-start" />
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">Liste du Matériel</h1>
                            <p className="text-gray-500">{materials.length} matériels enregistrés</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={loadData}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
                        >
                            <FaSyncAlt className={loading ? "animate-spin" : ""} /> Actualiser
                        </button>
                        <button
                            onClick={exportToPDF}
                            className="flex items-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-300 shadow-lg"
                        >
                            <FaFilePdf /> Exporter PDF
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                        {error}
                    </div>
                )}

                {/* Filtres et recherche */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                <FaSearch className="inline mr-2" />
                                Rechercher
                            </label>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end focus:border-transparent transition-all"
                                placeholder="Rechercher par nom ou code..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                <FaFilter className="inline mr-2" />
                                Catégorie
                            </label>
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end focus:border-transparent transition-all"
                            >
                                <option value="all">Toutes les catégories</option>
                                <option value="Matériel Durable">Matériel Durable</option>
                                <option value="Matériel Médical">Matériel Médical</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Tableau du matériel */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-primary-start to-primary-end text-white">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Code</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Nom</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold">Catégorie</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold">Qté</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Emplacement</th>
                                <th className="px-4 py-3 text-right text-sm font-semibold">Prix Achat</th>
                                <th className="px-4 py-3 text-right text-sm font-semibold">Prix Vente</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold">Dernière MAJ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredMaterials.length > 0 ? (
                                filteredMaterials.map((material, index) => (
                                    <tr
                                        key={`${material.categoryType}-${material.id}`}
                                        className={`hover:bg-primary-end/10 cursor-pointer transition-all ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                                        onClick={() => handleMaterialClick(material)}
                                    >
                                        <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-800">
                                            {material.code}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-800">
                                            {material.name}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${material.category === "Matériel Médical"
                                                ? "bg-red-100 text-red-800"
                                                : "bg-blue-100 text-blue-800"
                                                }`}>
                                                {material.category === "Matériel Médical" ? (
                                                    <><FaMedkit className="inline mr-1" />Médical</>
                                                ) : (
                                                    <><FaTools className="inline mr-1" />Durable</>
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`font-bold ${material.quantity < 10 ? 'text-red-600' : 'text-green-600'}`}>
                                                {material.quantity}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 text-sm">
                                            {material.location}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-800">
                                            {formatPrice(material.prixAchat)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-800">
                                            {formatPrice(material.prixVente)}
                                        </td>
                                        <td className="px-4 py-3 text-center text-xs text-gray-500">
                                            {material.lastUpdate}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                                        <FaBoxes className="mx-auto text-5xl text-gray-300 mb-4" />
                                        <p>Aucun matériel trouvé</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="text-sm text-gray-600 text-right">
                    Affichage de {filteredMaterials.length} sur {materials.length} matériel(s)
                </div>
            </div>

            {/* Modal de détails */}
            {showDetailModal && selectedMaterial && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-full ${selectedMaterial.category === "Matériel Médical"
                                    ? "bg-red-100"
                                    : "bg-blue-100"
                                    }`}>
                                    {selectedMaterial.category === "Matériel Médical"
                                        ? <FaMedkit className="text-red-600 text-xl" />
                                        : <FaTools className="text-blue-600 text-xl" />
                                    }
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">{selectedMaterial.name}</h2>
                                    <p className="text-sm text-gray-500 font-mono">{selectedMaterial.code}</p>
                                </div>
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
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <FaBarcode /> Code
                                    </p>
                                    <p className="font-bold text-gray-800 font-mono">{selectedMaterial.code}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500">Catégorie</p>
                                    <p className="font-bold text-gray-800">{selectedMaterial.category}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500">Quantité en stock</p>
                                    <p className={`font-bold text-2xl ${selectedMaterial.quantity < 10 ? 'text-red-600' : 'text-green-600'}`}>
                                        {selectedMaterial.quantity}
                                    </p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500">Emplacement</p>
                                    <p className="font-bold text-gray-800">{selectedMaterial.location}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <FaMoneyBillWave /> Prix d&apos;achat
                                    </p>
                                    <p className="font-bold text-gray-800">{formatPrice(selectedMaterial.prixAchat)}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <FaMoneyBillWave /> Prix de vente
                                    </p>
                                    <p className="font-bold text-gray-800">{formatPrice(selectedMaterial.prixVente)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <FaCalendarAlt /> Date d&apos;enregistrement
                                    </p>
                                    <p className="font-bold text-gray-800">{selectedMaterial.dateEnregistrement}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <FaInfoCircle /> Dernière MAJ
                                    </p>
                                    <p className="font-bold text-gray-800">{selectedMaterial.lastUpdate}</p>
                                </div>
                            </div>

                            {selectedMaterial.etat && (
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500">État du matériel</p>
                                    <p className="font-bold text-gray-800">{selectedMaterial.etat}</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6">
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="w-full px-4 py-3 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-lg hover:opacity-90 transition-all"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AccountantDashBoard>
    );
}
