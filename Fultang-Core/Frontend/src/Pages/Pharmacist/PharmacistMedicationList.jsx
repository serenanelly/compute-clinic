import { PharmacistDashBoard } from "./Components/PharmacistDashboard";
import { PharmacistNavLink } from "./PharmacistNavLink";
import { useState, useEffect } from "react";
import {
    FaSearch,
    FaPills,
    FaFilter,
    FaTimes,
    FaInfoCircle,
    FaCalendarAlt,
    FaMoneyBillWave,
    FaBarcode,
    FaFilePdf,
    FaSpinner,
    FaSyncAlt,
    FaExclamationTriangle,
    FaBoxes
} from "react-icons/fa";
import jsPDF from "jspdf";
import { materielMedicalApi } from "../../services/comptabiliteMatiereApi";
import { APP_NAME, brandFooter } from '../../constants/branding.js';

export function PharmacistMedicationList() {
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

    async function loadData() {
        try {
            setLoading(true);
            setError(null);

            const data = await materielMedicalApi.getAll();

            const materiels = (data.results || data || []).map(m => ({
                id: m.idMateriel || m.materiel_ptr_id,
                code: m.code_materiel,
                name: m.nom_Materiel,
                category: m.categorie_display || m.categorie,
                categoryCode: m.categorie,
                quantity: m.quantite_stock,
                unit: m.unite_mesure_display || m.unite_mesure,
                lastUpdate: m.date_derniere_modification?.split('T')[0] || '-',
                prixAchat: parseFloat(m.prix_achat_unitaire) || 0,
                prixVente: parseFloat(m.prix_vente_unitaire) || 0
            }));
            setMaterials(materiels);

        } catch (err) {
            console.error("Erreur chargement données:", err);
            setError("Impossible de charger les données.");
        } finally {
            setLoading(false);
        }
    }

    function getFilteredMaterials() {
        return materials.filter(material => {
            const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                material.code.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === "all" || material.categoryCode === filterCategory;

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

    function getStockStatus(quantity) {
        if (quantity === 0) return { label: "Rupture", color: "bg-red-100 text-red-800" };
        if (quantity < 20) return { label: "Faible", color: "bg-orange-100 text-orange-800" };
        return { label: "OK", color: "bg-green-100 text-green-800" };
    }

    function getCategoryLabel(category) {
        const labels = {
            'MEDICAMENT': 'Médicament',
            'CONSOMMABLE': 'Consommable',
            'REACTIF': 'Réactif'
        };
        return labels[category] || category;
    }

    function getCategoryColor(category) {
        const colors = {
            'MEDICAMENT': 'bg-blue-100 text-blue-800',
            'CONSOMMABLE': 'bg-purple-100 text-purple-800',
            'REACTIF': 'bg-teal-100 text-teal-800'
        };
        return colors[category] || 'bg-gray-100 text-gray-800';
    }

    function exportToPDF() {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;

        // Titre
        doc.setFontSize(18);
        doc.setTextColor(26, 115, 163);
        doc.text("Liste des Médicaments - Pharmacie", pageWidth / 2, 20, { align: "center" });

        // Sous-titre
        doc.setFontSize(10);
        doc.setTextColor(100);
        const categoryLabel = filterCategory === "all" ? "Toutes catégories" : getCategoryLabel(filterCategory);
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
        doc.text("Nom", margin + 30, yPos);
        doc.text("Catégorie", margin + 90, yPos);
        doc.text("Stock", margin + 125, yPos);
        doc.text("Prix Vente", margin + 150, yPos);

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
            doc.text(material.name.substring(0, 30), margin + 30, yPos);
            doc.text(getCategoryLabel(material.categoryCode), margin + 90, yPos);

            // Stock avec couleur
            if (material.quantity < 20) {
                doc.setTextColor(255, 0, 0);
            } else {
                doc.setTextColor(0, 128, 0);
            }
            doc.text(String(material.quantity), margin + 125, yPos);
            doc.setTextColor(0);

            doc.text(formatPrice(material.prixVente).replace(" FCFA", ""), margin + 150, yPos);

            yPos += 8;
        });

        // Statistiques
        yPos += 10;
        doc.setDrawColor(80, 194, 185);
        doc.line(margin, yPos, pageWidth - margin, yPos);

        const lowStock = materielsAffiches.filter(m => m.quantity < 20).length;
        const outOfStock = materielsAffiches.filter(m => m.quantity === 0).length;

        yPos += 8;
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Total: ${materielsAffiches.length} médicament(s) | Stock faible: ${lowStock} | Rupture: ${outOfStock}`, margin, yPos);
        doc.text(brandFooter('Pharmacie'), pageWidth - margin, yPos, { align: "right" });

        // Télécharger
        doc.save(`liste_medicaments_${new Date().toISOString().split('T')[0]}.pdf`);
    }

    const filteredMaterials = getFilteredMaterials();
    const lowStockCount = filteredMaterials.filter(m => m.quantity < 20 && m.quantity > 0).length;
    const outOfStockCount = filteredMaterials.filter(m => m.quantity === 0).length;

    if (loading) {
        return (
            <PharmacistDashBoard linkList={PharmacistNavLink} requiredRole={"pharmacien"} requiredFunctionalService="PHARMACIE">
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <FaSpinner className="animate-spin text-4xl text-primary-start mx-auto mb-4" />
                        <p className="text-gray-600">Chargement des médicaments...</p>
                    </div>
                </div>
            </PharmacistDashBoard>
        );
    }

    return (
        <PharmacistDashBoard
            linkList={PharmacistNavLink}
            requiredRole={"pharmacien"} requiredFunctionalService="PHARMACIE"
        >
            <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <FaPills className="text-4xl text-primary-start" />
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">Liste des Médicaments</h1>
                            <p className="text-gray-500">{materials.length} médicaments en stock</p>
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
                            className="flex items-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-300 shadow-lg"
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

                {/* Statistiques rapides */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
                        <div className="bg-blue-100 p-3 rounded-full">
                            <FaPills className="text-blue-600 text-xl" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total</p>
                            <p className="text-2xl font-bold text-gray-800">{materials.length}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
                        <div className="bg-green-100 p-3 rounded-full">
                            <FaBoxes className="text-green-600 text-xl" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Stock OK</p>
                            <p className="text-2xl font-bold text-green-600">{materials.length - lowStockCount - outOfStockCount}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
                        <div className="bg-orange-100 p-3 rounded-full">
                            <FaExclamationTriangle className="text-orange-600 text-xl" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Stock Faible</p>
                            <p className="text-2xl font-bold text-orange-600">{lowStockCount}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
                        <div className="bg-red-100 p-3 rounded-full">
                            <FaTimes className="text-red-600 text-xl" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Rupture</p>
                            <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
                        </div>
                    </div>
                </div>

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
                                <option value="MEDICAMENT">Médicaments</option>
                                <option value="CONSOMMABLE">Consommables</option>
                                <option value="REACTIF">Réactifs</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Tableau des médicaments */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gradient-to-r from-primary-start to-primary-end text-white">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Code</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Nom</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold">Catégorie</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold">Stock</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold">Statut</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold">Prix Vente</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold">Dernière MAJ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredMaterials.length > 0 ? (
                                    filteredMaterials.map((material, index) => {
                                        const stockStatus = getStockStatus(material.quantity);
                                        return (
                                            <tr
                                                key={material.id}
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
                                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(material.categoryCode)}`}>
                                                        {getCategoryLabel(material.categoryCode)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`font-bold text-lg ${material.quantity === 0 ? 'text-red-600' : material.quantity < 20 ? 'text-orange-600' : 'text-green-600'}`}>
                                                        {material.quantity}
                                                    </span>
                                                    <span className="text-xs text-gray-500 ml-1">{material.unit}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${stockStatus.color}`}>
                                                        {stockStatus.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800">
                                                    {formatPrice(material.prixVente)}
                                                </td>
                                                <td className="px-4 py-3 text-center text-xs text-gray-500">
                                                    {material.lastUpdate}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="px-4 py-12 text-center text-gray-500">
                                            <FaPills className="mx-auto text-5xl text-gray-300 mb-4" />
                                            <p>Aucun médicament trouvé</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="text-sm text-gray-600 text-right">
                    Affichage de {filteredMaterials.length} sur {materials.length} médicament(s)
                </div>
            </div>

            {/* Modal de détails */}
            {showDetailModal && selectedMaterial && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-100 p-3 rounded-full">
                                    <FaPills className="text-blue-600 text-xl" />
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
                                    <p className="font-bold text-gray-800">{getCategoryLabel(selectedMaterial.categoryCode)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500">Quantité en stock</p>
                                    <p className={`font-bold text-2xl ${selectedMaterial.quantity === 0 ? 'text-red-600' : selectedMaterial.quantity < 20 ? 'text-orange-600' : 'text-green-600'}`}>
                                        {selectedMaterial.quantity}
                                    </p>
                                    <p className="text-xs text-gray-500">{selectedMaterial.unit}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500">Statut</p>
                                    {(() => {
                                        const status = getStockStatus(selectedMaterial.quantity);
                                        return (
                                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${status.color}`}>
                                                {status.label}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <FaMoneyBillWave /> Prix d&apos;achat
                                    </p>
                                    <p className="font-bold text-gray-800">{formatPrice(selectedMaterial.prixAchat)}</p>
                                </div>
                                <div className="bg-green-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <FaMoneyBillWave /> Prix de vente
                                    </p>
                                    <p className="font-bold text-green-700">{formatPrice(selectedMaterial.prixVente)}</p>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <FaCalendarAlt /> Dernière mise à jour
                                </p>
                                <p className="font-bold text-gray-800">{selectedMaterial.lastUpdate}</p>
                            </div>
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
        </PharmacistDashBoard>
    );
}
