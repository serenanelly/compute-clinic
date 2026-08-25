import { AccountantDashBoard } from "./Components/AccountantDashboard";
import { AccountantNavLink } from "./AccountantNavLink";
import { AccountantNavBar } from "./Components/AccountantNavBar";
import { useState, useEffect } from "react";
import {
    FaSearch,
    FaEye,
    FaFilter,
    FaTruck,
    FaFilePdf,
    FaBuilding,
    FaCalendarAlt,
    FaBoxOpen,
    FaSpinner,
    FaSyncAlt,
    FaPhone,
    FaMoneyBillWave
} from "react-icons/fa";
import PropTypes from "prop-types";
import jsPDF from "jspdf";
import { livraisonApi, ligneLivraisonApi, getPersonnelId } from "../../services/comptabiliteMatiereApi";

export function DeliveryList() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterSupplier, setFilterSupplier] = useState("all");
    const [filterPeriod, setFilterPeriod] = useState("all");
    const [showOnlyMine, setShowOnlyMine] = useState(false);
    const [deliveries, setDeliveries] = useState([]);

    const currentUserId = getPersonnelId();

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            setError(null);

            const livraisonsData = await livraisonApi.getAll();
            const livraisons = Array.isArray(livraisonsData)
                ? livraisonsData
                : (livraisonsData?.results || []);

            const deliveriesWithLines = await Promise.all(
                livraisons.map(async (l) => {
                    try {
                        const lignesData = await ligneLivraisonApi.getByLivraison(l.idLivraison);
                        const lignesRaw = Array.isArray(lignesData)
                            ? lignesData
                            : (lignesData?.results || []);

                        const articles = lignesRaw.map((line) => ({
                            nomMateriel: line.nom_materiel || `Matériel #${line.materiel}`,
                            codeMateriel: line.code_materiel || "",
                            typeMateriel: line.type_materiel === "MEDICAL" ? "Matériel Médical" : "Matériel Durable",
                            quantiteConforme: line.quantite_conforme || 0,
                            quantiteNonConforme: line.quantite_non_conforme || 0,
                            prixUnitaire: line.prix_unitaire_achat || 0,
                            datePeremption: line.date_peremption || null,
                        }));

                        return {
                            id: l.bon_livraison_numero || `BL-${l.idLivraison}`,
                            idLivraison: l.idLivraison,
                            fournisseur: l.nom_fournisseur || "Non spécifié",
                            contact: l.contact_fournisseur || "-",
                            dateReception: l.date_reception?.split("T")[0] || "-",
                            dateCreation: l.date_creation?.split("T")[0] || "-",
                            montantTotal: parseFloat(l.montant_total) || 0,
                            receptionnaireId: l.id_personnel_receptionnaire || "",
                            articles,
                        };
                    } catch (e) {
                        console.warn("Erreur chargement lignes livraison " + l.idLivraison, e);
                        return {
                            id: l.bon_livraison_numero || `BL-${l.idLivraison}`,
                            idLivraison: l.idLivraison,
                            fournisseur: l.nom_fournisseur || "Non spécifié",
                            contact: l.contact_fournisseur || "-",
                            dateReception: l.date_reception?.split("T")[0] || "-",
                            dateCreation: l.date_creation?.split("T")[0] || "-",
                            montantTotal: parseFloat(l.montant_total) || 0,
                            receptionnaireId: l.id_personnel_receptionnaire || "",
                            articles: [],
                        };
                    }
                })
            );

            deliveriesWithLines.sort(
                (a, b) => new Date(b.dateReception) - new Date(a.dateReception)
            );
            setDeliveries(deliveriesWithLines);
        } catch (err) {
            console.error("Erreur chargement livraisons:", err);
            setError("Impossible de charger l'historique des livraisons.");
        } finally {
            setLoading(false);
        }
    }

    function getSupplierOptions() {
        const suppliers = [...new Set(deliveries.map((d) => d.fournisseur).filter(Boolean))];
        return suppliers.sort();
    }

    function getFilteredDeliveries() {
        return deliveries.filter((delivery) => {
            const matchesSearch =
                delivery.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                delivery.fournisseur.toLowerCase().includes(searchTerm.toLowerCase()) ||
                delivery.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (delivery.articles &&
                    delivery.articles.some(
                        (a) =>
                            a.nomMateriel.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            a.codeMateriel.toLowerCase().includes(searchTerm.toLowerCase())
                    ));

            const matchesSupplier =
                filterSupplier === "all" || delivery.fournisseur === filterSupplier;

            const matchesMine =
                !showOnlyMine ||
                !currentUserId ||
                delivery.receptionnaireId === currentUserId;

            let matchesPeriod = true;
            if (filterPeriod !== "all") {
                const deliveryDate = new Date(delivery.dateReception);
                const today = new Date();
                const diffDays = Math.floor((today - deliveryDate) / (1000 * 60 * 60 * 24));

                if (filterPeriod === "today") matchesPeriod = diffDays === 0;
                else if (filterPeriod === "week") matchesPeriod = diffDays <= 7;
                else if (filterPeriod === "month") matchesPeriod = diffDays <= 30;
            }

            return matchesSearch && matchesSupplier && matchesPeriod && matchesMine;
        });
    }

    function formatAmount(amount) {
        return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
    }

    function exportToPDF() {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const filtered = getFilteredDeliveries();

        doc.setFontSize(20);
        doc.setTextColor(26, 115, 163);
        doc.text("Historique des Livraisons", pageWidth / 2, 20, { align: "center" });

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(
            `Généré le: ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`,
            pageWidth / 2,
            28,
            { align: "center" }
        );

        doc.setDrawColor(80, 194, 185);
        doc.setLineWidth(0.5);
        doc.line(14, 32, pageWidth - 14, 32);

        let yPosition = 45;
        const margin = 14;

        filtered.forEach((delivery) => {
            if (yPosition > 250) {
                doc.addPage();
                yPosition = 20;
            }

            doc.setFillColor(26, 115, 163);
            doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 10, "F");

            doc.setFontSize(10);
            doc.setTextColor(255);
            doc.text(`${delivery.id} - ${delivery.fournisseur}`, margin + 3, yPosition + 2);
            yPosition += 12;

            doc.setTextColor(60);
            doc.text(`Date réception: ${delivery.dateReception}`, margin + 3, yPosition);
            doc.text(`Montant: ${formatAmount(delivery.montantTotal)}`, margin + 80, yPosition);
            yPosition += 6;

            if (delivery.articles.length > 0) {
                delivery.articles.forEach((article) => {
                    doc.text(
                        `• ${article.nomMateriel} (${article.codeMateriel}) - Conforme: ${article.quantiteConforme}`,
                        margin + 5,
                        yPosition
                    );
                    yPosition += 5;
                });
            }

            yPosition += 8;
        });

        doc.save(`livraisons_${new Date().toISOString().split("T")[0]}.pdf`);
    }

    const filteredDeliveries = getFilteredDeliveries();
    const myDeliveriesCount = deliveries.filter(
        (d) => d.receptionnaireId && d.receptionnaireId === currentUserId
    ).length;

    if (loading) {
        return (
            <AccountantDashBoard linkList={AccountantNavLink} requiredRole={"compta_matiere"}>
                <AccountantNavBar />
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <FaSpinner className="animate-spin text-4xl text-primary-start mx-auto mb-4" />
                        <p className="text-gray-600">Chargement des livraisons...</p>
                    </div>
                </div>
            </AccountantDashBoard>
        );
    }

    return (
        <AccountantDashBoard linkList={AccountantNavLink} requiredRole={"compta_matiere"}>
            <AccountantNavBar />
            <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <FaTruck className="text-4xl text-primary-start" />
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">Historique des Livraisons</h1>
                            <p className="text-gray-500">
                                {deliveries.length} livraison(s) enregistrée(s)
                                {currentUserId && myDeliveriesCount > 0
                                    ? ` — dont ${myDeliveriesCount} par vous`
                                    : ""}
                            </p>
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

                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                <FaSearch className="inline mr-2" />
                                Rechercher
                            </label>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end focus:border-transparent transition-all"
                                placeholder="N° BL, fournisseur, matériel..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                <FaFilter className="inline mr-2" />
                                Fournisseur
                            </label>
                            <select
                                value={filterSupplier}
                                onChange={(e) => setFilterSupplier(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end focus:border-transparent transition-all"
                            >
                                <option value="all">Tous les fournisseurs</option>
                                {getSupplierOptions().map((supplier) => (
                                    <option key={supplier} value={supplier}>
                                        {supplier}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Période
                            </label>
                            <select
                                value={filterPeriod}
                                onChange={(e) => setFilterPeriod(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end focus:border-transparent transition-all"
                            >
                                <option value="all">Toutes les périodes</option>
                                <option value="today">Aujourd&apos;hui</option>
                                <option value="week">Cette semaine</option>
                                <option value="month">Ce mois</option>
                            </select>
                        </div>

                        <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer p-3 border border-gray-300 rounded-lg w-full hover:bg-gray-50">
                                <input
                                    type="checkbox"
                                    checked={showOnlyMine}
                                    onChange={(e) => setShowOnlyMine(e.target.checked)}
                                    className="w-4 h-4 text-primary-start"
                                />
                                <span className="text-sm font-semibold text-gray-700">
                                    Mes livraisons uniquement
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {filteredDeliveries.length > 0 ? (
                        filteredDeliveries.map((delivery) => (
                            <DeliveryCard
                                key={delivery.idLivraison}
                                delivery={delivery}
                                formatAmount={formatAmount}
                                isMine={delivery.receptionnaireId === currentUserId}
                            />
                        ))
                    ) : (
                        <div className="bg-white rounded-lg shadow-lg p-12 text-center text-gray-500">
                            <FaTruck className="mx-auto text-5xl text-gray-300 mb-4" />
                            <p>Aucune livraison trouvée</p>
                        </div>
                    )}
                </div>

                <div className="text-sm text-gray-600 text-right">
                    Affichage de {filteredDeliveries.length} sur {deliveries.length} livraison(s)
                </div>
            </div>
        </AccountantDashBoard>
    );
}

function DeliveryCard({ delivery, formatAmount, isMine }) {
    DeliveryCard.propTypes = {
        delivery: PropTypes.object.isRequired,
        formatAmount: PropTypes.func.isRequired,
        isMine: PropTypes.bool,
    };

    const [showDetails, setShowDetails] = useState(false);

    const totalArticles = delivery.articles ? delivery.articles.length : 0;
    const totalConforme = delivery.articles
        ? delivery.articles.reduce((sum, a) => sum + a.quantiteConforme, 0)
        : 0;

    return (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2 font-mono">{delivery.id}</h3>
                        <div className="flex gap-2 mb-2 flex-wrap">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                {totalArticles} article(s)
                            </span>
                            {isMine && (
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                    Enregistrée par vous
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-600 flex items-center gap-1 justify-end">
                            <FaCalendarAlt className="text-gray-400" />
                            Date de réception
                        </p>
                        <p className="font-semibold text-gray-800">{delivery.dateReception}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                            <FaBuilding className="text-gray-400" />
                            Fournisseur
                        </p>
                        <p className="font-semibold text-gray-800">{delivery.fournisseur}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                            <FaPhone className="text-gray-400" />
                            Contact
                        </p>
                        <p className="font-semibold text-gray-800">{delivery.contact}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                            <FaMoneyBillWave className="text-gray-400" />
                            Montant total
                        </p>
                        <p className="font-semibold text-gray-800 text-lg">
                            {formatAmount(delivery.montantTotal)}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Quantité conforme</p>
                        <p className="font-semibold text-gray-800 text-lg">{totalConforme} unité(s)</p>
                    </div>
                </div>

                {showDetails && delivery.articles && delivery.articles.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <FaBoxOpen className="text-primary-start" />
                            Articles livrés :
                        </h4>
                        <div className="space-y-2">
                            {delivery.articles.map((article, index) => (
                                <div
                                    key={index}
                                    className="flex justify-between items-center bg-gray-50 p-3 rounded-lg"
                                >
                                    <div>
                                        <span className="font-semibold text-gray-800">
                                            {article.nomMateriel}
                                        </span>
                                        <span className="text-xs text-gray-500 font-mono ml-2">
                                            ({article.codeMateriel})
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 flex-wrap justify-end">
                                        <span
                                            className={`px-2 py-1 rounded text-xs ${
                                                article.typeMateriel === "Matériel Médical"
                                                    ? "bg-red-100 text-red-700"
                                                    : "bg-blue-100 text-blue-700"
                                            }`}
                                        >
                                            {article.typeMateriel}
                                        </span>
                                        <span className="text-sm text-gray-600">
                                            Conforme: <strong>{article.quantiteConforme}</strong>
                                        </span>
                                        {article.quantiteNonConforme > 0 && (
                                            <span className="text-sm text-orange-600">
                                                Non conforme: <strong>{article.quantiteNonConforme}</strong>
                                            </span>
                                        )}
                                        <span className="font-bold text-gray-800">
                                            {formatAmount(article.prixUnitaire)}/u
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="mt-4 flex items-center gap-2 text-primary-start hover:text-primary-end font-semibold transition-colors"
                >
                    <FaEye />
                    {showDetails ? "Masquer les détails" : "Voir les articles livrés"}
                </button>
            </div>
        </div>
    );
}
