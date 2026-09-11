import { PharmacistDashBoard } from "./Components/PharmacistDashboard";
import { PharmacistNavLink } from "./PharmacistNavLink";
import { useState, useEffect } from "react";
import { FaPlus, FaTrash, FaSave, FaSpinner, FaCheckCircle } from "react-icons/fa";
import PropTypes from "prop-types";
import { besoinApi, ligneBesoinApi, materielMedicalApi, materielDurableApi, getPersonnelId } from "../../services/comptabiliteMatiereApi";

export function PharmacistEmitNeed() {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [error, setError] = useState(null);
    const [materiels, setMateriels] = useState([]);

    // L'emetteur est automatiquement le personnel connecté
    const personnelId = getPersonnelId();
    const personnelName = localStorage.getItem("user_name") || "Pharmacien";

    const [needItems, setNeedItems] = useState([
        { id: 1, material: "", quantity: "", priority: "NORMAL", description: "" }
    ]);

    const [needInfo, setNeedInfo] = useState({
        motif: "",
        // Le département est le service du pharmacien connecté
        departement: "Pharmacie"
    });

    // Charger la liste des matériels pour les suggestions
    useEffect(() => {
        loadMateriels();
    }, []);

    async function loadMateriels() {
        try {
            setLoading(true);
            // Charger matériels médicaux et durables
            const [medicaux, durables] = await Promise.all([
                materielMedicalApi.getAll(),
                materielDurableApi.getAll()
            ]);
            const medData = medicaux.results || medicaux || [];
            const durData = durables.results || durables || [];
            setMateriels([...medData, ...durData]);
        } catch (err) {
            console.error("Erreur lors du chargement des matériels:", err);
        } finally {
            setLoading(false);
        }
    }

    function addNeedItem() {
        const newItem = {
            id: Date.now(),
            material: "",
            quantity: "",
            priority: "NORMAL",
            description: ""
        };
        setNeedItems([...needItems, newItem]);
    }

    function removeNeedItem(id) {
        if (needItems.length > 1) {
            setNeedItems(needItems.filter(item => item.id !== id));
        }
    }

    function updateNeedItem(id, field, value) {
        setNeedItems(needItems.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    }

    async function handleSubmit(e) {
        e.preventDefault();

        // Validation
        if (!needInfo.motif.trim()) {
            alert("Veuillez saisir un motif pour le besoin !");
            return;
        }

        const hasEmptyItem = needItems.some(item => !item.material || !item.quantity);
        if (hasEmptyItem) {
            alert("Veuillez remplir tous les articles (matériel et quantité) !");
            return;
        }

        try {
            setSubmitting(true);
            setError(null);

            // ============================================
            // CRÉATION DU BESOIN (TABLE: besoin)
            // Champs requis selon BD:
            // - idPersonnel_emetteur (FK vers Personnel)
            // - motif (TextField)
            // - statut (ENUM: NON_TRAITE par défaut)
            // - date_creation_besoin (DateTime, auto)
            // ============================================
            const besoinData = {
                motif: needInfo.motif,
                idPersonnel_emetteur: personnelId,
                statut: "NON_TRAITE"
            };

            const newBesoin = await besoinApi.create(besoinData);

            // ============================================
            // CRÉATION DES LIGNES DE BESOIN (TABLE: ligne_besoin)
            // Champs requis selon BD:
            // - id_besoin (FK vers Besoin)
            // - materiel_nom (CharField)
            // - quantite_demandee (PositiveInt)
            // - priorite (ENUM: LOW/NORMAL/HIGH)
            // - description_justification (TextField, nullable)
            // ============================================
            for (const item of needItems) {
                await ligneBesoinApi.create({
                    id_besoin: newBesoin.idBesoin,
                    materiel_nom: item.material,
                    quantite_demandee: parseInt(item.quantity),
                    priorite: item.priority,
                    description_justification: item.description || ""
                });
            }

            // Réinitialiser le formulaire
            setNeedItems([{ id: Date.now(), material: "", quantity: "", priority: "NORMAL", description: "" }]);
            setNeedInfo({ motif: "", departement: "Pharmacie" });

            setSuccessMessage("Besoin envoyé avec succès ! Le directeur sera notifié.");
            setTimeout(() => setSuccessMessage(""), 5000);

        } catch (err) {
            console.error("Erreur lors de l'envoi du besoin:", err);
            setError("Impossible d'envoyer le besoin. Veuillez réessayer.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <PharmacistDashBoard
            linkList={PharmacistNavLink}
            requiredRole={"pharmacien"} requiredFunctionalService="PHARMACIE"
        >
            <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-800">Émettre un Besoin</h1>
                </div>

                {successMessage && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
                        <FaCheckCircle />
                        {successMessage}
                    </div>
                )}

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Informations générales */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Informations Générales</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Émetteur (automatique) */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Émis par
                                </label>
                                <input
                                    type="text"
                                    value={personnelName}
                                    className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                    readOnly
                                />
                                <p className="text-xs text-gray-500 mt-1">ID Personnel: {personnelId}</p>
                            </div>

                            {/* Département (automatique) */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Département
                                </label>
                                <input
                                    type="text"
                                    value={needInfo.departement}
                                    className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                    readOnly
                                />
                                <p className="text-xs text-gray-500 mt-1">Rempli automatiquement</p>
                            </div>

                            {/* Motif du besoin */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Motif du besoin *
                                </label>
                                <textarea
                                    value={needInfo.motif}
                                    onChange={(e) => setNeedInfo({ ...needInfo, motif: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="Décrivez le motif de votre demande..."
                                    rows="3"
                                    required
                                />
                            </div>

                            {/* Date de demande (automatique) */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Date de demande
                                </label>
                                <input
                                    type="date"
                                    value={new Date().toISOString().split('T')[0]}
                                    className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100"
                                    readOnly
                                />
                            </div>
                        </div>
                    </div>

                    {/* Liste des matériels demandés */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Matériels Demandés</h2>
                            <button
                                type="button"
                                onClick={addNeedItem}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300"
                            >
                                <FaPlus /> Ajouter un article
                            </button>
                        </div>

                        <div className="space-y-4">
                            {needItems.map((item, index) => (
                                <NeedItemRow
                                    key={item.id}
                                    item={item}
                                    index={index}
                                    materiels={materiels}
                                    onUpdate={updateNeedItem}
                                    onRemove={removeNeedItem}
                                    canRemove={needItems.length > 1}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Bouton de soumission */}
                    <div className="flex justify-end gap-4">
                        <button
                            type="button"
                            onClick={() => {
                                setNeedItems([{ id: Date.now(), material: "", quantity: "", priority: "NORMAL", description: "" }]);
                                setNeedInfo({ motif: "", departement: "Pharmacie" });
                            }}
                            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all duration-300"
                        >
                            Réinitialiser
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-300 disabled:opacity-50"
                        >
                            {submitting ? <FaSpinner className="animate-spin" /> : <FaSave />}
                            Enregistrer le besoin
                        </button>
                    </div>
                </form>
            </div>
        </PharmacistDashBoard>
    );
}

function NeedItemRow({ item, index, materiels, onUpdate, onRemove, canRemove }) {
    NeedItemRow.propTypes = {
        item: PropTypes.object.isRequired,
        index: PropTypes.number.isRequired,
        materiels: PropTypes.array.isRequired,
        onUpdate: PropTypes.func.isRequired,
        onRemove: PropTypes.func.isRequired,
        canRemove: PropTypes.bool.isRequired
    };

    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    function handleMaterialChange(value) {
        onUpdate(item.id, 'material', value);

        if (value.length >= 2) {
            const filtered = materiels.filter(m =>
                m.nom_Materiel?.toLowerCase().includes(value.toLowerCase())
            ).slice(0, 5);
            setSuggestions(filtered);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    }

    function selectSuggestion(materiel) {
        onUpdate(item.id, 'material', materiel.nom_Materiel);
        setShowSuggestions(false);
    }

    return (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* materiel_nom - Nom du matériel demandé */}
                <div className="md:col-span-2 relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Matériel * <span className="text-xs text-gray-400">(materiel_nom)</span>
                    </label>
                    <input
                        type="text"
                        value={item.material}
                        onChange={(e) => handleMaterialChange(e.target.value)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nom du matériel"
                        required
                    />
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                            {suggestions.map(m => (
                                <div
                                    key={m.idMateriel || m.materiel_ptr_id}
                                    className="p-2 hover:bg-gray-100 cursor-pointer"
                                    onClick={() => selectSuggestion(m)}
                                >
                                    <p className="font-medium">{m.nom_Materiel}</p>
                                    <p className="text-xs text-gray-500">Stock: {m.quantite_stock}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* quantite_demandee */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Quantité * <span className="text-xs text-gray-400">(quantite_demandee)</span>
                    </label>
                    <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => onUpdate(item.id, 'quantity', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                        min="1"
                        required
                    />
                </div>

                {/* priorite - ENUM: LOW/NORMAL/HIGH */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Priorité <span className="text-xs text-gray-400">(priorite)</span>
                    </label>
                    <select
                        value={item.priority}
                        onChange={(e) => onUpdate(item.id, 'priority', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="LOW">Basse</option>
                        <option value="NORMAL">Normale</option>
                        <option value="HIGH">Haute</option>
                    </select>
                </div>

                <div className="flex items-end">
                    {canRemove && (
                        <button
                            type="button"
                            onClick={() => onRemove(item.id)}
                            className="w-full p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-300"
                        >
                            <FaTrash className="mx-auto" />
                        </button>
                    )}
                </div>
            </div>

            {/* description_justification */}
            <div className="mt-3">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description / Justification <span className="text-xs text-gray-400">(description_justification)</span>
                </label>
                <textarea
                    value={item.description}
                    onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Raison de la demande..."
                    rows="2"
                />
            </div>
        </div>
    );
}
