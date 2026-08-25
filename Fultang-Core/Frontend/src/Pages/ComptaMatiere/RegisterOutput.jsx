import { AccountantDashBoard } from "./Components/AccountantDashboard";
import { AccountantNavLink } from "./AccountantNavLink";
import { AccountantNavBar } from "./Components/AccountantNavBar";
import { useState, useEffect } from "react";
import { FaPlus, FaTrash, FaSave, FaBoxOpen, FaCheckCircle, FaSpinner, FaSyncAlt } from "react-icons/fa";
import PropTypes from "prop-types";
import { materielMedicalApi, materielDurableApi, sortieApi, ligneSortieApi, getPersonnelId } from "../../services/comptabiliteMatiereApi";
import { getAllServices } from "../../services/servicesApi";

export function RegisterOutput() {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState("");

    // Liste des matériels depuis l'API
    const [materialsDatabase, setMaterialsDatabase] = useState([]);

    // Liste des services (pour le service responsable)
    const [services, setServices] = useState([]);

    // Articles en sortie
    const [outputItems, setOutputItems] = useState([
        { id: 1, nomMateriel: "", codeMateriel: "", typeMateriel: "", materialId: null, quantite: "", stockDisponible: 0 }
    ]);

    // Informations de sortie
    const [outputInfo, setOutputInfo] = useState({
        numeroSortie: "",
        serviceMedical: "", // Service responsable de la sortie (sélectionné)
        dateSortie: new Date().toISOString().split('T')[0],
        dateEnregistrement: new Date().toISOString().split('T')[0],
        motifSortie: "DEFECTUEUX"
    });

    // États
    const [formError, setFormError] = useState("");

    // Charger les données au montage
    useEffect(() => {
        loadData();
    }, []);

    /**
     * 📡 CHARGEMENT DES DONNÉES INITIALES
     * 
     * Objectifs:
     * 1. Charger tout le catalogue (Médical + Durable) pour l'autocomplétion sans latence.
     * 2. Générer automatiquement le prochain numéro de sortie (SOR-YYYY-NNN).
     * 
     * URLs Appeleés:
     * - GET /api/materiels-medicaux/
     * - GET /api/materiels-durables/
     * - GET /api/sorties/ (pour calculer le dernier ID)
     */
    async function loadData() {
        try {
            setLoading(true);
            setError(null);

            // Charger les matériels médicaux et durables en parallèle
            const [medicauxData, durablesData, servicesData] = await Promise.all([
                materielMedicalApi.getAll(),
                materielDurableApi.getAll(),
                getAllServices().catch(() => [])
            ]);

            const servicesList = servicesData.results || servicesData.data || servicesData || [];
            setServices(Array.isArray(servicesList) ? servicesList : []);

            const medicaux = (medicauxData.results || medicauxData || []).map(m => ({
                id: m.idMateriel || m.materiel_ptr_id,
                code: m.code_materiel,
                name: m.nom_Materiel,
                category: "MEDICAL",
                categoryDisplay: "Matériel Médical",
                quantity: m.quantite_stock,
                prixVente: parseFloat(m.prix_vente_unitaire) || 0
            }));

            const durables = (durablesData.results || durablesData || []).map(m => ({
                id: m.idMateriel || m.materiel_ptr_id,
                code: m.code_materiel,
                name: m.nom_Materiel,
                category: "DURABLE",
                categoryDisplay: "Matériel Durable",
                quantity: m.quantite_stock,
                prixVente: null
            }));

            setMaterialsDatabase([...medicaux, ...durables]);

            // Générer le numéro de sortie
            // Récupérer toutes les sorties pour trouver le dernier numéro
            const sortiesData = await sortieApi.getAll();
            const sorties = Array.isArray(sortiesData) ? sortiesData : (sortiesData.results || []);

            const year = new Date().getFullYear();
            const count = sorties.filter(s => s.numero_sortie?.includes(`SOR-${year}`)).length + 1;
            const newNumber = `SOR-${year}-${String(count).padStart(3, '0')}`;

            setOutputInfo(prev => ({ ...prev, numeroSortie: newNumber }));

        } catch (err) {
            console.error("Erreur chargement:", err);
            setError("Impossible de charger les données.");
        } finally {
            setLoading(false);
        }
    }

    function addOutputItem() {
        const newItem = {
            id: Date.now(),
            nomMateriel: "",
            codeMateriel: "",
            typeMateriel: "",
            materialId: null,
            quantite: "",
            stockDisponible: 0
        };
        setOutputItems([...outputItems, newItem]);
    }

    function removeOutputItem(id) {
        if (outputItems.length > 1) {
            setOutputItems(outputItems.filter(item => item.id !== id));
        }
    }

    function updateOutputItem(id, field, value) {
        setOutputItems(outputItems.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    }

    function selectMaterial(itemId, material) {
        setOutputItems(outputItems.map(item =>
            item.id === itemId ? {
                ...item,
                nomMateriel: material.name,
                codeMateriel: material.code,
                typeMateriel: material.category,
                materialId: material.id,
                stockDisponible: material.quantity
            } : item
        ));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setFormError("");

        // Validation
        if (!outputInfo.serviceMedical) {
            setFormError("Veuillez sélectionner le service responsable.");
            return;
        }

        for (const item of outputItems) {
            if (!item.nomMateriel || !item.codeMateriel || !item.quantite || !item.materialId) {
                setFormError("Veuillez remplir tous les champs pour chaque article.");
                return;
            }

            if (parseInt(item.quantite) > item.stockDisponible) {
                setFormError(`Quantité insuffisante pour "${item.nomMateriel}". Stock: ${item.stockDisponible}, Demandé: ${item.quantite}`);
                return;
            }
        }

        try {
            setSubmitting(true);

            // 💾 TRANSACTION DE SAUVEGARDE
            // Étape 1: Créer l'entête de la sortie
            // POST /api/sorties/
            const personnelId = getPersonnelId();
            const sortieData = {
                numero_sortie: outputInfo.numeroSortie,
                date_sortie: outputInfo.dateSortie,
                motif_sortie: outputInfo.motifSortie,
                service_responsable: outputInfo.serviceMedical,
                idPersonnel: personnelId
            };

            const createdSortie = await sortieApi.create(sortieData);

            // Étape 2: Créer les lignes de sortie et décrémenter le stock
            // - POST /api/lignes-sortie/ (pour chaque article)
            // - PATCH /api/materiels-.../ (mise à jour quantite_stock)
            for (const item of outputItems) {
                const ligneData = {
                    id_sortie: createdSortie.idSortie,
                    id_materiel: item.materialId,
                    code_materiel: item.codeMateriel,
                    nom_materiel: item.nomMateriel,
                    type_materiel: item.typeMateriel,
                    quantite: parseInt(item.quantite),
                    prix_unitaire: item.typeMateriel === "MEDICAL" ?
                        materialsDatabase.find(m => m.id === item.materialId)?.prixVente : null
                };

                console.log("📝 Création ligne sortie:", ligneData);
                await ligneSortieApi.create(ligneData);

                // Mettre à jour le stock
                const material = materialsDatabase.find(m => m.id === item.materialId);
                if (material) {
                    const newStock = material.quantity - parseInt(item.quantite);
                    if (item.typeMateriel === "MEDICAL") {
                        await materielMedicalApi.patch(item.materialId, { quantite_stock: newStock });
                    } else {
                        await materielDurableApi.patch(item.materialId, { quantite_stock: newStock });
                    }
                }
            }

            setSuccessMessage(`Sortie enregistrée avec succès ! N° ${outputInfo.numeroSortie}`);
            setTimeout(() => setSuccessMessage(""), 5000);

            // Réinitialiser le formulaire
            await loadData();
            setOutputItems([
                { id: Date.now(), nomMateriel: "", codeMateriel: "", typeMateriel: "", materialId: null, quantite: "", stockDisponible: 0 }
            ]);
            setOutputInfo(prev => ({
                ...prev,
                serviceMedical: "",
                dateSortie: new Date().toISOString().split('T')[0],
                dateEnregistrement: new Date().toISOString().split('T')[0],
                motifSortie: "DEFECTUEUX"
            }));

        } catch (err) {
            console.error("Erreur lors de l'enregistrement:", err);
            console.error("❌ Détails erreur backend:", err.response?.data);
            const backendError = err.response?.data
                ? JSON.stringify(err.response.data, null, 2)
                : err.message;
            setFormError("Erreur: " + backendError);
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <AccountantDashBoard linkList={AccountantNavLink} requiredRole={"compta_matiere"}>
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
            requiredRole={"compta_matiere"}
        >
            <AccountantNavBar />
            <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <FaBoxOpen className="text-4xl text-primary-start" />
                        <h1 className="text-3xl font-bold text-gray-800">Enregistrer une Sortie</h1>
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

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Informations de sortie */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Informations de Sortie</h2>

                        {formError && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                                {formError}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Numéro de sortie
                                </label>
                                <input
                                    type="text"
                                    value={outputInfo.numeroSortie}
                                    className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 font-mono font-bold"
                                    readOnly
                                />
                                <p className="text-xs text-gray-500 mt-1">Généré automatiquement</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Service responsable *
                                </label>
                                <select
                                    value={outputInfo.serviceMedical}
                                    onChange={(e) => setOutputInfo({ ...outputInfo, serviceMedical: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end focus:border-transparent transition-all"
                                    required
                                >
                                    <option value="">Sélectionner un service</option>
                                    {[...services]
                                        .sort((a, b) => (a.nom_service || '').localeCompare(b.nom_service || '', 'fr'))
                                        .map((s) => (
                                            <option key={s.id} value={s.nom_service}>
                                                {s.nom_service}
                                            </option>
                                        ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Service à l&apos;origine de la sortie</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Date de sortie *
                                </label>
                                <input
                                    type="date"
                                    value={outputInfo.dateSortie}
                                    onChange={(e) => setOutputInfo({ ...outputInfo, dateSortie: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end focus:border-transparent transition-all"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Date d&apos;enregistrement
                                </label>
                                <input
                                    type="date"
                                    value={outputInfo.dateEnregistrement}
                                    className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                    readOnly
                                />
                                <p className="text-xs text-gray-500 mt-1">Date du jour (automatique)</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Motif de la sortie *
                                </label>
                                <select
                                    value={outputInfo.motifSortie}
                                    onChange={(e) => setOutputInfo({ ...outputInfo, motifSortie: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end focus:border-transparent transition-all"
                                    required
                                >
                                    <option value="DEFECTUEUX">Défectueux</option>
                                    <option value="PERIME">Périmé</option>
                                    <option value="VENTE">Vente</option>
                                    <option value="UTILISATION_SERVICE">Utilisation interne</option>
                                    <option value="PERTE">Perte</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Articles en sortie */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Articles en Sortie</h2>
                            <button
                                type="button"
                                onClick={addOutputItem}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-start text-white rounded-lg hover:opacity-90 transition-all duration-300"
                            >
                                <FaPlus /> Ajouter un article
                            </button>
                        </div>

                        <div className="space-y-4">
                            {outputItems.map((item) => (
                                <OutputItemRow
                                    key={item.id}
                                    item={item}
                                    materialsDatabase={materialsDatabase}
                                    onSelectMaterial={selectMaterial}
                                    onUpdate={updateOutputItem}
                                    onRemove={removeOutputItem}
                                    canRemove={outputItems.length > 1}
                                />
                            ))}
                        </div>

                        <div className="mt-4 p-3 bg-primary-end/10 rounded-lg">
                            <p className="text-sm text-primary-start flex items-center gap-2">
                                <FaCheckCircle />
                                Total: {outputItems.length} article(s) en sortie
                            </p>
                        </div>
                    </div>

                    {/* Boutons d'action */}
                    <div className="flex justify-end gap-4">
                        <button
                            type="button"
                            onClick={() => {
                                setOutputItems([
                                    { id: Date.now(), nomMateriel: "", codeMateriel: "", typeMateriel: "", materialId: null, quantite: "", stockDisponible: 0 }
                                ]);
                                setFormError("");
                            }}
                            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all duration-300"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-lg hover:opacity-90 transition-all duration-300 disabled:opacity-50"
                        >
                            {submitting ? <FaSpinner className="animate-spin" /> : <FaSave />}
                            Enregistrer la sortie
                        </button>
                    </div>
                </form>
            </div>
        </AccountantDashBoard>
    );
}

function OutputItemRow({ item, materialsDatabase, onSelectMaterial, onUpdate, onRemove, canRemove }) {
    OutputItemRow.propTypes = {
        item: PropTypes.object.isRequired,
        materialsDatabase: PropTypes.array.isRequired,
        onSelectMaterial: PropTypes.func.isRequired,
        onUpdate: PropTypes.func.isRequired,
        onRemove: PropTypes.func.isRequired,
        canRemove: PropTypes.bool.isRequired
    };

    // Gérer la sélection d'un matériel via le select
    function handleMaterialSelect(e) {
        const materialId = parseInt(e.target.value);
        if (materialId) {
            const material = materialsDatabase.find(m => m.id === materialId);
            if (material) {
                onSelectMaterial(item.id, material);
            }
        }
    }

    return (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nom Matériel *
                    </label>
                    <select
                        value={item.materialId || ""}
                        onChange={handleMaterialSelect}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end"
                        required
                    >
                        <option value="">Sélectionner un matériel</option>
                        {[...materialsDatabase]
                            .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                            .map((material) => (
                                <option key={material.id} value={material.id}>
                                    {material.name} ({material.code}) - Stock: {material.quantity}
                                </option>
                            ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Code Matériel
                    </label>
                    <input
                        type="text"
                        value={item.codeMateriel}
                        className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 font-mono"
                        placeholder="Auto"
                        readOnly
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Type Matériel
                    </label>
                    <input
                        type="text"
                        value={item.typeMateriel === "MEDICAL" ? "Matériel Médical" : item.typeMateriel === "DURABLE" ? "Matériel Durable" : ""}
                        className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100"
                        placeholder="Auto"
                        readOnly
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Quantité * {item.stockDisponible > 0 && <span className="text-xs text-gray-500">(Stock: {item.stockDisponible})</span>}
                    </label>
                    <input
                        type="number"
                        value={item.quantite}
                        onChange={(e) => onUpdate(item.id, 'quantite', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end"
                        placeholder="0"
                        min="1"
                        max={item.stockDisponible || undefined}
                        required
                    />
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
        </div>
    );
}
