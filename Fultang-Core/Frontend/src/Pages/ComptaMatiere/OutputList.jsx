import { AccountantDashBoard } from "./Components/AccountantDashboard";
import { AccountantNavLink } from "./AccountantNavLink";
import { AccountantNavBar } from "./Components/AccountantNavBar";
import { useState, useEffect } from "react";
import {
    FaSearch,
    FaEye,
    FaFilter,
    FaListAlt,
    FaFilePdf,
    FaBuilding,
    FaCalendarAlt,
    FaBoxOpen,
    FaSpinner,
    FaSyncAlt
} from "react-icons/fa";
import PropTypes from "prop-types";
import jsPDF from "jspdf";
import { sortieApi, ligneSortieApi } from "../../services/comptabiliteMatiereApi";
import { APP_NAME, brandFooter } from '../../constants/branding.js';

export function OutputList() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterMotif, setFilterMotif] = useState("all");
    const [filterPeriod, setFilterPeriod] = useState("all");

    // Données des sorties depuis l'API
    const [outputs, setOutputs] = useState([]);

    // Charger les sorties depuis l'API
    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            setError(null);

            // 1. Charger les sorties via le service API
            const sortiesData = await sortieApi.getAll();
            const sorties = Array.isArray(sortiesData) ? sortiesData : (sortiesData.results || []);

            // 2. Pour chaque sortie, charger ses lignes (N+1 optimisation possible backend, mais ici frontend-side via service)
            const outputsWithLines = await Promise.all(
                sorties.map(async (s) => {
                    try {
                        const lignesData = await ligneSortieApi.getBySortie(s.idSortie);
                        const lignesRaw = Array.isArray(lignesData) ? lignesData : (lignesData.results || []);

                        const lignes = lignesRaw.map(l => ({
                            nomMateriel: l.nom_materiel || `Matériel #${l.id_materiel}`,
                            codeMateriel: l.code_materiel || "",
                            typeMateriel: l.type_materiel === "MEDICAL" ? "Matériel Médical" : "Matériel Durable",
                            quantite: l.quantite
                        }));

                        return {
                            id: s.numero_sortie || `SOR-${s.idSortie}`,
                            idSortie: s.idSortie,
                            serviceMedical: s.service_responsable || "Non spécifié",
                            dateSortie: s.date_sortie?.split('T')[0] || '-',
                            dateEnregistrement: s.date_sortie?.split('T')[0] || '-',
                            motifSortie: mapMotif(s.motif_sortie),
                            articles: lignes
                        };
                    } catch (e) {
                        console.warn("Erreur chargement lignes sortie " + s.idSortie, e);
                        return {
                            id: s.numero_sortie || `SOR-${s.idSortie}`,
                            idSortie: s.idSortie,
                            serviceMedical: s.service_responsable || "Non spécifié",
                            dateSortie: s.date_sortie?.split('T')[0] || '-',
                            dateEnregistrement: s.date_sortie?.split('T')[0] || '-',
                            motifSortie: mapMotif(s.motif_sortie),
                            articles: []
                        };
                    }
                })
            );

            setOutputs(outputsWithLines);

        } catch (err) {
            console.error("Erreur chargement sorties:", err);
            setError("Impossible de charger les sorties.");
        } finally {
            setLoading(false);
        }
    }

    function mapMotif(motif) {
        const map = {
            'VENTE': 'vente',
            'UTILISATION_SERVICE': 'utilisation',
            'DEFECTUEUX': 'defectueux',
            'PERIME': 'perime',
            'PERTE': 'defectueux'
        };
        return map[motif] || 'defectueux';
    }

    function getFilteredOutputs() {
        return outputs.filter(output => {
            const matchesSearch = output.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                output.serviceMedical.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (output.articles && output.articles.some(a =>
                    a.nomMateriel.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    a.codeMateriel.toLowerCase().includes(searchTerm.toLowerCase())
                ));

            const matchesMotif = filterMotif === "all" || output.motifSortie === filterMotif;

            let matchesPeriod = true;
            if (filterPeriod !== "all") {
                const outputDate = new Date(output.dateSortie);
                const today = new Date();
                const diffDays = Math.floor((today - outputDate) / (1000 * 60 * 60 * 24));

                if (filterPeriod === "today") matchesPeriod = diffDays === 0;
                else if (filterPeriod === "week") matchesPeriod = diffDays <= 7;
                else if (filterPeriod === "month") matchesPeriod = diffDays <= 30;
            }

            return matchesSearch && matchesMotif && matchesPeriod;
        });
    }

    function getMotifBadge(motif) {
        const config = {
            defectueux: { bg: "bg-red-100", text: "text-red-800", label: "Défectueux" },
            perime: { bg: "bg-orange-100", text: "text-orange-800", label: "Périmé" },
            vente: { bg: "bg-green-100", text: "text-green-800", label: "Vente" },
            transfert: { bg: "bg-blue-100", text: "text-blue-800", label: "Transfert" },
            utilisation: { bg: "bg-purple-100", text: "text-purple-800", label: "Utilisation" }
        };

        const { bg, text, label } = config[motif] || config.defectueux;

        return (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
                {label}
            </span>
        );
    }

    function exportToPDF() {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        doc.setFontSize(20);
        doc.setTextColor(26, 115, 163);
        doc.text("Liste des Sorties de Matériel", pageWidth / 2, 20, { align: "center" });

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, pageWidth / 2, 28, { align: "center" });

        doc.setDrawColor(80, 194, 185);
        doc.setLineWidth(0.5);
        doc.line(14, 32, pageWidth - 14, 32);

        let yPosition = 45;
        const margin = 14;

        const sortiesActuelles = filteredOutputs;

        sortiesActuelles.forEach((output) => {
            if (yPosition > 250) {
                doc.addPage();
                yPosition = 20;
            }

            doc.setFillColor(26, 115, 163);
            doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 10, 'F');

            doc.setFontSize(10);
            doc.setTextColor(255);
            doc.setFont(undefined, 'bold');
            doc.text(`${output.id} - ${output.serviceMedical}`, margin + 3, yPosition + 2);
            doc.text(`${output.dateSortie}`, pageWidth - margin - 25, yPosition + 2);

            yPosition += 12;

            doc.setTextColor(0);
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');

            const motifLabels = {
                defectueux: "Défectueux",
                perime: "Périmé",
                vente: "Vente",
                transfert: "Transfert",
                utilisation: "Utilisation"
            };
            doc.text(`Motif: ${motifLabels[output.motifSortie] || output.motifSortie}`, margin + 3, yPosition);

            yPosition += 8;

            doc.setFont(undefined, 'bold');
            doc.text("Articles:", margin + 3, yPosition);
            yPosition += 6;

            doc.setFont(undefined, 'normal');
            if (output.articles && output.articles.length > 0) {
                output.articles.forEach((article) => {
                    doc.text(`• ${article.nomMateriel} (${article.codeMateriel}) - Qté: ${article.quantite}`, margin + 5, yPosition);
                    yPosition += 5;
                });
            } else {
                doc.text(`  Aucun article`, margin + 5, yPosition);
                yPosition += 5;
            }

            yPosition += 8;
        });

        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setDrawColor(80, 194, 185);
        doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Total: ${filteredOutputs.length} sortie(s)`, margin, pageHeight - 12);
        doc.text(brandFooter('Comptable Matière'), pageWidth - margin, pageHeight - 12, { align: "right" });

        doc.save(`sorties_materiel_${new Date().toISOString().split('T')[0]}.pdf`);
    }

    const filteredOutputs = getFilteredOutputs();

    if (loading) {
        return (
            <AccountantDashBoard linkList={AccountantNavLink} requiredRole={"compta_matiere"}>
                <AccountantNavBar />
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <FaSpinner className="animate-spin text-4xl text-primary-start mx-auto mb-4" />
                        <p className="text-gray-600">Chargement des sorties...</p>
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
                        <FaListAlt className="text-4xl text-primary-start" />
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">Liste des Sorties</h1>
                            <p className="text-gray-500">{outputs.length} sorties enregistrées</p>
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

                {/* Filtres */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                placeholder="N° sortie, service, matériel, code..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                <FaFilter className="inline mr-2" />
                                Motif
                            </label>
                            <select
                                value={filterMotif}
                                onChange={(e) => setFilterMotif(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end focus:border-transparent transition-all"
                            >
                                <option value="all">Tous les motifs</option>
                                <option value="defectueux">Défectueux</option>
                                <option value="perime">Périmé</option>
                                <option value="vente">Vente</option>
                                <option value="transfert">Transfert</option>
                                <option value="utilisation">Utilisation</option>
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
                    </div>
                </div>

                {/* Liste des sorties */}
                <div className="space-y-4">
                    {filteredOutputs.length > 0 ? (
                        filteredOutputs.map((output) => (
                            <OutputCard
                                key={output.id}
                                output={output}
                                getMotifBadge={getMotifBadge}
                            />
                        ))
                    ) : (
                        <div className="bg-white rounded-lg shadow-lg p-12 text-center text-gray-500">
                            <FaBoxOpen className="mx-auto text-5xl text-gray-300 mb-4" />
                            <p>Aucune sortie trouvée</p>
                        </div>
                    )}
                </div>

                <div className="text-sm text-gray-600 text-right">
                    Affichage de {filteredOutputs.length} sur {outputs.length} sorties
                </div>
            </div>
        </AccountantDashBoard>
    );
}

function OutputCard({ output, getMotifBadge }) {
    OutputCard.propTypes = {
        output: PropTypes.object.isRequired,
        getMotifBadge: PropTypes.func.isRequired
    };

    const [showDetails, setShowDetails] = useState(false);

    const totalArticles = output.articles ? output.articles.length : 0;
    const totalQuantite = output.articles ? output.articles.reduce((sum, a) => sum + a.quantite, 0) : 0;

    return (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2 font-mono">{output.id}</h3>
                        <div className="flex gap-2 mb-2 flex-wrap">
                            {getMotifBadge(output.motifSortie)}
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                                {totalArticles} article(s)
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-600 flex items-center gap-1 justify-end">
                            <FaCalendarAlt className="text-gray-400" />
                            Date de sortie
                        </p>
                        <p className="font-semibold text-gray-800">{output.dateSortie}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                            <FaBuilding className="text-gray-400" />
                            Service responsable
                        </p>
                        <p className="font-semibold text-gray-800">{output.serviceMedical}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Date d&apos;enregistrement</p>
                        <p className="font-semibold text-gray-800">{output.dateEnregistrement}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Quantité totale</p>
                        <p className="font-semibold text-gray-800 text-lg">{totalQuantite} unité(s)</p>
                    </div>
                </div>

                {showDetails && output.articles && output.articles.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <FaBoxOpen className="text-primary-start" />
                            Articles concernés par cette sortie:
                        </h4>
                        <div className="space-y-2">
                            {output.articles.map((article, index) => (
                                <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                                    <div>
                                        <span className="font-semibold text-gray-800">{article.nomMateriel}</span>
                                        <span className="text-xs text-gray-500 font-mono ml-2">({article.codeMateriel})</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-2 py-1 rounded text-xs ${article.typeMateriel === 'Matériel Médical'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {article.typeMateriel}
                                        </span>
                                        <span className="font-bold text-gray-800">Qté: {article.quantite}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all duration-300"
                >
                    <FaEye />
                    {showDetails ? "Masquer les articles" : `Voir les ${totalArticles} article(s)`}
                </button>
            </div>
        </div>
    );
}
