import { AccountantDashBoard } from "./Components/AccountantDashboard";
import { AccountantNavLink } from "./AccountantNavLink";
import { AccountantNavBar } from "./Components/AccountantNavBar";
import { useState, useEffect } from "react";
import { FaPlus, FaTrash, FaSave, FaTruck, FaExclamationTriangle, FaCheckCircle } from "react-icons/fa";
import PropTypes from "prop-types";
import {
    livraisonApi, ligneLivraisonApi, materielMedicalApi, materielDurableApi, getPersonnelId
} from "../../services/comptabiliteMatiereApi";
import { getFournisseurs } from "../../services/accountantApi";

export function RegisterDelivery() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Liste des matériels (chargée depuis l'API)
    const [materialsDatabase, setMaterialsDatabase] = useState([]);

    // Liste des fournisseurs enregistrés par la comptabilité financière
    const [fournisseurs, setFournisseurs] = useState([]);

    const [deliveryItems, setDeliveryItems] = useState([
        {
            id: 1,
            isNewMaterial: false,
            material: "",
            materialCode: "",
            type: "Matériel Médical",
            quantityConforme: "",
            quantityNonConforme: "0",
            unitPrice: "",
            justification: "",
            datePeremption: "",
            // Champs pour nouveau matériel médical
            prixVente: "",
            unite: "boîte",
            seuilAlerte: "10",
            // Champs pour nouveau matériel durable
            localisation: "",
            numeroSerie: "",
            dureeGarantie: "",
            // Champs communs
            description: "",
            emplacement: ""
        }
    ]);

    const [deliveryInfo, setDeliveryInfo] = useState({
        supplier: "",
        deliveryNoteNumber: "",
        deliveryDate: new Date().toISOString().split('T')[0],
        receptionDate: new Date().toISOString().split('T')[0],
        supplierContact: "",
        amount: ""
    });

    const [formError, setFormError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Charger les données au montage
    useEffect(() => {
        loadData();
    }, []);

    /**
     * 📡 CHARGEMENT DES DONNÉES
     */
    async function loadData() {
        setLoading(true);
        setError(null);

        try {
            console.log("Chargement des données RegisterDelivery...");
            // Charger les deux catalogues en parallèle via les services
            const [medicauxData, durablesData, fournisseursData] = await Promise.all([
                materielMedicalApi.getAll(),
                materielDurableApi.getAll(),
                getFournisseurs().catch(() => [])
            ]);

            const medicauxRaw = Array.isArray(medicauxData) ? medicauxData : (medicauxData.results || []);
            const durablesRaw = Array.isArray(durablesData) ? durablesData : (durablesData.results || []);
            const fournisseursRaw = Array.isArray(fournisseursData) ? fournisseursData : (fournisseursData.results || []);
            // On ne propose que les fournisseurs actifs
            setFournisseurs(fournisseursRaw.filter(f => f.actif !== false));

            // Normalisation
            const medicaux = medicauxRaw.map(m => ({
                id: m.idMateriel || m.materiel_ptr_id,
                code: m.code_materiel,
                name: m.nom_Materiel,
                category: "Matériel Médical",
                quantity: m.quantite_stock,
                prixAchat: parseFloat(m.prix_achat_unitaire) || 0
            }));

            const durables = durablesRaw.map(m => ({
                id: m.idMateriel || m.materiel_ptr_id,
                code: m.code_materiel,
                name: m.nom_Materiel,
                category: "Matériel Durable",
                quantity: m.quantite_stock,
                prixAchat: parseFloat(m.prix_achat_unitaire) || 0
            }));

            setMaterialsDatabase([...medicaux, ...durables]);
            console.log("Données chargées avec succès.");

        } catch (err) {
            console.error("Erreur chargement:", err);
            setError(`Impossible de charger le catalogue matériel: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }

    // Générer un code automatique pour nouveau matériel
    function generateMaterialCode(type) {
        const prefix = type === "Matériel Médical" ? "MED" : "DUR";
        const existingCodes = materialsDatabase
            .filter(m => m.code && m.code.startsWith(prefix))
            .map(m => parseInt(m.code.split('-')[1]) || 0);

        // Trouver le max
        const nextNumber = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;

        return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
    }

    function addDeliveryItem() {
        const newItem = {
            id: Date.now(),
            isNewMaterial: false,
            material: "",
            materialCode: "",
            type: "Matériel Médical",
            quantityConforme: "",
            quantityNonConforme: "0",
            unitPrice: "",
            justification: "",
            datePeremption: "",
            prixVente: "",
            unite: "boîte",
            seuilAlerte: "10",
            localisation: "",
            numeroSerie: "",
            dureeGarantie: "",
            description: "",
            emplacement: ""
        };
        setDeliveryItems([...deliveryItems, newItem]);
    }

    function removeDeliveryItem(id) {
        if (deliveryItems.length > 1) {
            setDeliveryItems(deliveryItems.filter(item => item.id !== id));
        }
    }

    function updateDeliveryItem(id, field, value) {
        setDeliveryItems(deliveryItems.map(item => {
            if (item.id !== id) return item;

            const updated = { ...item, [field]: value };

            // Si on change isNewMaterial, générer un code automatique
            if (field === 'isNewMaterial' && value === true) {
                updated.materialCode = generateMaterialCode(item.type);
            }

            // Si on change le type pour un nouveau matériel, régénérer le code
            if (field === 'type' && item.isNewMaterial) {
                updated.materialCode = generateMaterialCode(value);
            }

            // Si on sélectionne un matériel existant
            if (field === 'materialCode' && !item.isNewMaterial) {
                const existingMaterial = materialsDatabase.find(m => m.code === value);
                if (existingMaterial) {
                    updated.material = existingMaterial.name;
                    updated.type = existingMaterial.category;
                }
            }

            return updated;
        }));
    }

    function calculateTotal() {
        return deliveryItems.reduce((total, item) => {
            const quantityConforme = parseFloat(item.quantityConforme) || 0;
            const quantityNonConforme = parseFloat(item.quantityNonConforme) || 0;

            // Pour matériel existant, utiliser le prix de la base de données
            let price = 0;
            if (item.isNewMaterial) {
                price = parseFloat(item.unitPrice) || 0;
            } else {
                const existingMat = materialsDatabase.find(m => m.code === item.materialCode);
                price = existingMat?.prixAchat || 0;
            }

            // Le total est basé sur toutes les quantités reçues (conformes + non conformes)
            return total + ((quantityConforme + quantityNonConforme) * price);
        }, 0);
    }

    function validateForm() {
        for (const item of deliveryItems) {
            if (item.isNewMaterial) {
                // Validation pour nouveau matériel
                if (!item.material.trim()) {
                    return "Veuillez saisir le nom du nouveau matériel.";
                }
                if (item.type === "Matériel Médical") {
                    if (!item.prixVente || !item.unite) {
                        return "Pour un nouveau matériel médical, le prix de vente et l'unité sont obligatoires.";
                    }
                } else {
                    if (!item.localisation.trim()) {
                        return "Pour un nouveau matériel durable, la localisation est obligatoire.";
                    }
                }
            } else {
                // Validation pour matériel existant
                if (!item.materialCode) {
                    return "Veuillez sélectionner un matériel existant ou cocher 'Nouveau matériel'.";
                }
            }

            if (!item.quantityConforme || parseInt(item.quantityConforme) < 0) {
                return "La quantité conforme doit être un nombre positif ou nul.";
            }
            if (parseInt(item.quantityConforme) === 0 && parseInt(item.quantityNonConforme || 0) === 0) {
                return "Au moins une quantité (conforme ou non conforme) doit être supérieure à 0.";
            }

            // Vérifier le prix unitaire UNIQUEMENT pour les nouveaux matériels
            if (item.isNewMaterial && (!item.unitPrice || parseFloat(item.unitPrice) <= 0)) {
                return "Le prix unitaire doit être supérieur à 0 pour les nouveaux matériels.";
            }
        }
        return null;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setFormError("");

        const validationError = validateForm();
        if (validationError) {
            setFormError(validationError);
            return;
        }

        // Variable pour rollback si nécessaire
        let createdLivraisonId = null;

        try {
            setLoading(true);

            // Map pour tracker les IDs des matériaux traités (nouveaux ou existants)
            const materialIdsMap = {};
            const materialErrors = [];

            // ===========================================
            // ÉTAPE 1: Créer/Valider tous les matériels D'ABORD
            // (Avant de créer la livraison pour éviter de bloquer le numéro)
            // ===========================================

            // 2. Traiter chaque article
            for (const item of deliveryItems) {
                let materialId = null;

                if (item.isNewMaterial) {
                    // A. Créer le nouveau matériel
                    const isMedical = item.type === "Matériel Médical";

                    // Mapping des unités de mesure vers les valeurs backend
                    const uniteMapping = {
                        'boîte': 'BOITE', 'boite': 'BOITE', 'BOITE': 'BOITE',
                        'flacon': 'FLACON', 'FLACON': 'FLACON',
                        'unité': 'UNITE', 'unite': 'UNITE', 'UNITE': 'UNITE',
                        'plaquette': 'PLAQUETTE', 'PLAQUETTE': 'PLAQUETTE'
                    };
                    const uniteBackend = uniteMapping[item.unite] || 'UNITE';

                    // Ne garder que les champs acceptés par le serializer backend
                    // Le stock initial est 0 : la ligne de livraison (backend) ajoutera
                    // la quantité reçue. Éviter de pré-remplir ici sinon double comptage.
                    const newMatData = isMedical ? {
                        // Champs MaterielMedicalCreateSerializer
                        code_materiel: item.materialCode,
                        nom_Materiel: item.material,
                        quantite_stock: 0,
                        prix_achat_unitaire: parseFloat(item.unitPrice) || 0,
                        categorie: item.categorie || "MEDICAMENT",
                        unite_mesure: uniteBackend,
                        prix_vente_unitaire: parseFloat(item.prixVente) || parseFloat(item.unitPrice) + 100 // Par défaut: prix achat + 100
                    } : {
                        // Champs MaterielDurableCreateSerializer
                        code_materiel: item.materialCode,
                        nom_Materiel: item.material,
                        quantite_stock: 0,
                        prix_achat_unitaire: parseFloat(item.unitPrice) || 0,
                        Etat: 'EN_BON_ETAT', // Valeurs valides: EN_BON_ETAT, EN_REPARATION
                        localisation: item.localisation || "Non spécifié"
                    };

                    console.log("📦 Création nouveau matériel:", isMedical ? "MEDICAL" : "DURABLE", newMatData);

                    const api = isMedical ? materielMedicalApi : materielDurableApi;
                    try {
                        const createdMat = await api.create(newMatData);
                        materialId = createdMat.idMateriel || createdMat.materiel_ptr_id;
                    } catch (matErr) {
                        const errData = matErr.response?.data;
                        console.error(`❌ Erreur matériel ${item.material}:`, errData);

                        // Vérifier si c'est une erreur de doublon (code existe déjà)
                        if (errData?.code_materiel &&
                            (Array.isArray(errData.code_materiel) && errData.code_materiel.some(e =>
                                e.includes("existe déjà") || e.includes("already exists") || e.includes("unique")
                            ))) {
                            materialErrors.push(`⚠️ "${item.material}" existe déjà dans la base ! Décochez "Nouveau matériel" et sélectionnez-le dans la liste.`);
                        }
                        // Vérifier si c'est une erreur de prix de vente (plusieurs formats possibles)
                        else if (errData?.prix_vente_unitaire ||
                            errData?.non_field_errors?.some(e => e.includes("prix")) ||
                            (typeof errData === 'string' && errData.includes("prix"))) {
                            const prixVente = item.prixVente || (parseFloat(item.unitPrice) + 100);
                            materialErrors.push(`⚠️ "${item.material}": Le prix de vente (${prixVente} FCFA) doit être supérieur au prix d'achat (${item.unitPrice} FCFA).`);
                        }
                        // Erreur générique avec détails
                        else {
                            let errDetail = "";
                            if (errData) {
                                if (typeof errData === 'object') {
                                    // Formater l'objet d'erreur de manière lisible
                                    const errorParts = [];
                                    for (const [field, errors] of Object.entries(errData)) {
                                        const errorList = Array.isArray(errors) ? errors.join(", ") : String(errors);
                                        errorParts.push(`${field}: ${errorList}`);
                                    }
                                    errDetail = errorParts.join(" | ");
                                } else {
                                    errDetail = String(errData);
                                }
                            } else {
                                errDetail = matErr.message;
                            }
                            materialErrors.push(`❌ "${item.material}": ${errDetail}`);
                        }
                        continue;
                    }

                } else {
                    // B. Matériel existant : Récupérer son ID via le code
                    const existingMat = materialsDatabase.find(m => m.code === item.materialCode);
                    if (!existingMat) {
                        materialErrors.push(`Matériel introuvable: ${item.materialCode}`);
                        continue;
                    }
                    materialId = existingMat.id;
                    // Ne pas modifier le stock ici : la ligne de livraison (backend)
                    // ajoutera automatiquement la quantité reçue. Un PATCH ici
                    // provoquerait un double comptage du stock.
                }

                // Mémoriser l'ID pour usage ultérieur
                if (materialId) {
                    materialIdsMap[item.materialCode] = materialId;
                }
            }

            // Si AU MOINS UN matériel a échoué, afficher les erreurs et arrêter
            // La livraison ne sera pas créée tant que tous les matériels ne sont pas OK
            if (materialErrors.length > 0) {
                throw new Error("Impossible d'enregistrer la livraison. Corrigez les erreurs suivantes :\n\n" + materialErrors.join("\n"));
            }

            // Vérifier que TOUS les matériels ont été traités correctement
            const processedCount = Object.keys(materialIdsMap).length;
            const expectedCount = deliveryItems.length;
            if (processedCount !== expectedCount) {
                // Trouver les articles non traités pour un meilleur message d'erreur
                const untreatedItems = deliveryItems
                    .filter(item => !materialIdsMap[item.materialCode])
                    .map(item => item.material || item.materialCode);

                throw new Error(`Certains matériels n'ont pas pu être validés (${processedCount}/${expectedCount}):\n${untreatedItems.join(", ")}`);
            }

            // ===========================================
            // ÉTAPE 2: Créer la livraison (APRÈS les matériels)
            // ===========================================
            const deliveryData = {
                bon_livraison_numero: deliveryInfo.deliveryNoteNumber,
                nom_fournisseur: deliveryInfo.supplier,
                contact_fournisseur: deliveryInfo.supplierContact || "",
                date_reception: `${deliveryInfo.receptionDate}T00:00:00`,
                montant_total: calculateTotal(),
                id_personnel_receptionnaire: getPersonnelId(),
            };

            const createdDelivery = await livraisonApi.create(deliveryData);
            createdLivraisonId = createdDelivery.idLivraison;
            console.log("✅ Livraison créée:", createdLivraisonId);

            // ===========================================
            // ÉTAPE 3: Créer les lignes de livraison
            // ===========================================
            for (const item of deliveryItems) {
                const materialId = materialIdsMap[item.materialCode];

                if (materialId) {
                    const isMedical = item.type === "Matériel Médical";

                    // Pour matériel existant, récupérer le prix de la base de données
                    let prixUnitaire = parseFloat(item.unitPrice) || 0;
                    if (!item.isNewMaterial) {
                        const existingMat = materialsDatabase.find(m => m.code === item.materialCode);
                        prixUnitaire = existingMat?.prixAchat || 0;
                    }

                    const ligneData = {
                        id_livraison: createdLivraisonId,
                        type_materiel: isMedical ? "MEDICAL" : "DURABLE",
                        materiel: materialId,
                        code_materiel: item.materialCode,
                        nom_materiel: item.material,
                        quantite_conforme: parseInt(item.quantityConforme) || 0,
                        quantite_non_conforme: parseInt(item.quantityNonConforme) || 0,
                        prix_unitaire_achat: prixUnitaire,
                        date_peremption: item.datePeremption || null
                    };

                    console.log("📝 Création ligne livraison:", ligneData);
                    await ligneLivraisonApi.create(ligneData);
                }
            }

            // NOTE: Le matériel non conforme n'entre PAS en stock (seule la
            // quantité conforme est ajoutée par la ligne de livraison). La
            // quantité non conforme reste enregistrée sur la ligne de livraison
            // pour la traçabilité ; aucune sortie n'est nécessaire.

            // Succès
            let message = `✅ Livraison enregistrée avec succès ! (N° ${deliveryInfo.deliveryNoteNumber})`;

            // Avertir sur les matériels qui ont échoué
            if (materialErrors.length > 0) {
                message += ` ⚠️ ${materialErrors.length} matériel(s) non traités.`;
            }

            const totalNonConformes = deliveryItems.reduce(
                (acc, item) => acc + (parseInt(item.quantityNonConforme) || 0),
                0
            );
            const msgNonConf = totalNonConformes > 0
                ? ` (${totalNonConformes} article(s) non conforme(s) non ajouté(s) au stock).`
                : "";

            setSuccessMessage(message + msgNonConf);
            // Auto-fermeture après 8 secondes
            setTimeout(() => setSuccessMessage(""), 8000);

            // Recharger les données pour mettre à jour les stocks affichés
            await loadData();

            // Reset form
            setDeliveryInfo({
                supplier: "",
                deliveryNoteNumber: "",
                deliveryDate: new Date().toISOString().split('T')[0],
                receptionDate: new Date().toISOString().split('T')[0],
                supplierContact: "",
                amount: ""
            });
            setDeliveryItems([{
                id: Date.now(),
                isNewMaterial: false,
                material: "",
                materialCode: "",
                type: "Matériel Médical",
                quantityConforme: "",
                quantityNonConforme: "0",
                unitPrice: "",
                justification: "",
                datePeremption: "",
                prixVente: "",
                unite: "boîte",
                seuilAlerte: "10",
                localisation: "",
                numeroSerie: "",
                dureeGarantie: "",
                description: "",
                emplacement: ""
            }]);

        } catch (err) {
            console.error("Erreur enregistrement:", err);
            console.error("❌ Détails de l'erreur backend:", err.response?.data);

            // ROLLBACK: Supprimer la livraison si elle a été créée
            if (createdLivraisonId) {
                try {
                    await livraisonApi.delete(createdLivraisonId);
                    console.log("🔄 Rollback: Livraison supprimée, numéro à nouveau disponible");
                } catch (rollbackErr) {
                    console.error("Erreur rollback:", rollbackErr);
                }
            }

            // Formater le message d'erreur de manière lisible
            let errorMessage = "";
            if (err.response?.data) {
                // Si c'est un objet JSON, le formater proprement
                const data = err.response.data;
                if (typeof data === 'object') {
                    // Traiter les erreurs de validation Django
                    const lines = [];
                    for (const [field, errors] of Object.entries(data)) {
                        const errorList = Array.isArray(errors) ? errors.join(", ") : errors;
                        lines.push(`• ${field}: ${errorList}`);
                    }
                    errorMessage = lines.join("\n");
                } else {
                    errorMessage = String(data);
                }
            } else {
                errorMessage = err.message;
            }
            setFormError(errorMessage);
        } finally {
            setLoading(false);
        }
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
                        <FaTruck className="text-4xl text-blue-500" />
                        <h1 className="text-3xl font-bold text-gray-800">Enregistrer une Livraison</h1>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-100 border border-red-300 rounded-lg flex items-start gap-3 mb-4">
                        <FaExclamationTriangle className="text-red-600 mt-0.5" />
                        <div>
                            <p className="font-bold text-red-800">Erreur de chargement</p>
                            <p className="text-sm text-red-700">{error}</p>
                            <button
                                onClick={loadData}
                                className="mt-2 text-sm text-red-800 underline hover:text-red-900"
                            >
                                Réessayer
                            </button>
                        </div>
                    </div>
                )}

                {formError && (
                    <div className="p-4 bg-red-50 border border-red-300 rounded-lg flex items-start justify-between shadow-lg">
                        <div className="flex items-start gap-3">
                            <FaExclamationTriangle className="text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-red-800">Erreur</p>
                                <p className="text-sm text-red-700 mt-1 whitespace-pre-wrap">{formError}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setFormError("")}
                            className="text-red-500 hover:text-red-700 font-bold text-xl ml-4"
                        >
                            ×
                        </button>
                    </div>
                )}

                {successMessage && (
                    <div className="p-4 bg-green-50 border border-green-300 rounded-lg flex items-center justify-between shadow-lg animate-pulse">
                        <div className="flex items-center gap-3">
                            <FaCheckCircle className="text-green-600 text-xl" />
                            <p className="text-green-800 font-medium">{successMessage}</p>
                        </div>
                        <button
                            onClick={() => setSuccessMessage("")}
                            className="text-green-600 hover:text-green-800 font-bold text-xl"
                        >
                            ×
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Informations de livraison */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Informations de Livraison</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Fournisseur *
                                </label>
                                <select
                                    value={deliveryInfo.supplier}
                                    onChange={(e) => {
                                        const nom = e.target.value;
                                        const f = fournisseurs.find(x => x.raison_sociale === nom);
                                        setDeliveryInfo({
                                            ...deliveryInfo,
                                            supplier: nom,
                                            supplierContact: f ? (f.telephone || f.email || deliveryInfo.supplierContact) : deliveryInfo.supplierContact
                                        });
                                    }}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    required
                                >
                                    <option value="">Sélectionner un fournisseur</option>
                                    {[...fournisseurs]
                                        .sort((a, b) => (a.raison_sociale || '').localeCompare(b.raison_sociale || '', 'fr'))
                                        .map((f) => (
                                            <option key={f.id} value={f.raison_sociale}>{f.raison_sociale}</option>
                                        ))}
                                </select>
                                {fournisseurs.length === 0 && (
                                    <p className="text-xs text-amber-600 mt-1">
                                        Aucun fournisseur enregistré par la comptabilité financière.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    N° de bon de livraison *
                                </label>
                                <input
                                    type="text"
                                    value={deliveryInfo.deliveryNoteNumber}
                                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, deliveryNoteNumber: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="BL-2024-001"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Contact fournisseur
                                </label>
                                <input
                                    type="text"
                                    value={deliveryInfo.supplierContact}
                                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, supplierContact: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="Téléphone ou email"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Date de création *
                                </label>
                                <input
                                    type="date"
                                    value={deliveryInfo.deliveryDate}
                                    className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed text-gray-600"
                                    disabled
                                    title="Date de création automatique (non modifiable)"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Date de réception *
                                </label>
                                <input
                                    type="date"
                                    value={deliveryInfo.receptionDate}
                                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, receptionDate: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Montant Total
                                </label>
                                <div className="w-full p-3 border border-gray-300 rounded-lg bg-green-50">
                                    <span className="font-bold text-green-600 text-lg">
                                        {calculateTotal().toLocaleString('fr-FR')} FCFA
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Articles livrés */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Articles Livrés</h2>
                            <button
                                type="button"
                                onClick={addDeliveryItem}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300"
                            >
                                <FaPlus /> Ajouter un article
                            </button>
                        </div>

                        <div className="space-y-6">
                            {deliveryItems.map((item) => (
                                <DeliveryItemRow
                                    key={item.id}
                                    item={item}
                                    materialsDatabase={materialsDatabase}
                                    onUpdate={updateDeliveryItem}
                                    onRemove={removeDeliveryItem}
                                    canRemove={deliveryItems.length > 1}
                                />
                            ))}
                        </div>

                        {/* Résumé */}
                        <div className="mt-6 pt-4 border-t-2 border-gray-300">
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-gray-600">
                                    <span className="font-semibold">{deliveryItems.length}</span> article(s) |
                                    <span className="text-green-600 ml-2">{deliveryItems.filter(i => !i.isNewMaterial).length} existant(s)</span> |
                                    <span className="text-blue-600 ml-2">{deliveryItems.filter(i => i.isNewMaterial).length} nouveau(x)</span>
                                </div>
                                <div>
                                    <span className="text-xl font-bold text-gray-700 mr-4">Montant Total:</span>
                                    <span className="text-2xl font-bold text-green-600">
                                        {calculateTotal().toLocaleString('fr-FR')} FCFA
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Boutons d'action */}
                    <div className="flex justify-end gap-4">
                        <button
                            type="button"
                            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all duration-300"
                            disabled={loading}
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-lg transition-all duration-300 ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Enregistrement en cours...
                                </>
                            ) : (
                                <>
                                    <FaSave /> Enregistrer la livraison
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </AccountantDashBoard>
    );
}

function DeliveryItemRow({ item, materialsDatabase, onUpdate, onRemove, canRemove }) {
    DeliveryItemRow.propTypes = {
        item: PropTypes.object.isRequired,
        materialsDatabase: PropTypes.array.isRequired,
        onUpdate: PropTypes.func.isRequired,
        onRemove: PropTypes.func.isRequired,
        canRemove: PropTypes.bool.isRequired
    };

    return (
        <div className={`p-4 rounded-lg border-2 ${item.isNewMaterial ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
            {/* Checkbox nouveau matériel */}
            <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={item.isNewMaterial}
                        onChange={(e) => onUpdate(item.id, 'isNewMaterial', e.target.checked)}
                        className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500"
                    />
                    <span className="font-semibold text-gray-700">
                        {item.isNewMaterial ? '🆕 Nouveau matériel' : 'Matériel existant'}
                    </span>
                </label>
                {item.isNewMaterial && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        Code auto: {item.materialCode}
                    </span>
                )}
            </div>

            {/* Ligne principale */}
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-4">
                {/* Matériel */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {item.isNewMaterial ? 'Nom du nouveau matériel *' : 'Matériel existant *'}
                    </label>
                    {item.isNewMaterial ? (
                        <input
                            type="text"
                            value={item.material}
                            onChange={(e) => onUpdate(item.id, 'material', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Nom du matériel"
                            required
                        />
                    ) : (
                        <select
                            value={item.materialCode}
                            onChange={(e) => onUpdate(item.id, 'materialCode', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                        >
                            <option value="">Sélectionner un matériel</option>
                            {materialsDatabase.map(m => (
                                <option key={m.code} value={m.code}>
                                    {m.name} ({m.code}) - Stock: {m.quantity}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Type */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Type *</label>
                    <select
                        value={item.type}
                        onChange={(e) => onUpdate(item.id, 'type', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="Matériel Médical">Matériel Médical</option>
                        <option value="Matériel Durable">Matériel Durable</option>
                    </select>
                </div>

                {/* Qté Conforme */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Qté Conforme *</label>
                    <input
                        type="number"
                        value={item.quantityConforme}
                        onChange={(e) => onUpdate(item.id, 'quantityConforme', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="0"
                        min="0"
                        required
                    />
                </div>

                {/* Qté Non Conforme */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Qté Non Conf.</label>
                    <input
                        type="number"
                        value={item.quantityNonConforme}
                        onChange={(e) => onUpdate(item.id, 'quantityNonConforme', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        placeholder="0"
                        min="0"
                    />
                </div>

                {/* Prix Unitaire - seulement pour nouveaux matériels */}
                {item.isNewMaterial ? (
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Prix Unit. *</label>
                        <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => onUpdate(item.id, 'unitPrice', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="0"
                            min="0"
                            required
                        />
                    </div>
                ) : (
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Prix Unit.</label>
                        <div className="w-full p-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
                            {(() => {
                                const mat = materialsDatabase.find(m => m.code === item.materialCode);
                                return mat ? `${mat.prixAchat?.toLocaleString('fr-FR') || 'N/A'} FCFA` : 'Sélectionner un matériel';
                            })()}
                        </div>
                    </div>
                )}

                {/* Bouton supprimer */}
                <div className="flex items-end">
                    {canRemove && (
                        <button
                            type="button"
                            onClick={() => onRemove(item.id)}
                            className="w-full p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                        >
                            <FaTrash className="mx-auto" />
                        </button>
                    )}
                </div>
            </div>

            {/* Champs supplémentaires pour nouveau matériel */}
            {item.isNewMaterial && (
                <div className="border-t border-gray-300 pt-4 mt-4">
                    <h4 className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-2">
                        <FaCheckCircle />
                        Informations complémentaires pour le nouveau matériel
                    </h4>

                    {/* Champs communs (Description + Date péremption + Justification) */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                            <input
                                type="text"
                                value={item.description}
                                onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Description..."
                            />
                        </div>
                        {/* Emplacement uniquement pour Matériel Médical */}
                        {item.type === "Matériel Médical" && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Emplacement</label>
                                <input
                                    type="text"
                                    value={item.emplacement}
                                    onChange={(e) => onUpdate(item.id, 'emplacement', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="Stockage A, Pharmacie..."
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Date de péremption</label>
                            <input
                                type="date"
                                value={item.datePeremption}
                                onChange={(e) => onUpdate(item.id, 'datePeremption', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Justification</label>
                            <input
                                type="text"
                                value={item.justification}
                                onChange={(e) => onUpdate(item.id, 'justification', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Justification..."
                            />
                        </div>
                    </div>

                    {/* Champs spécifiques Matériel Médical */}
                    {item.type === "Matériel Médical" && (
                        <div className="bg-red-50 p-3 rounded-lg">
                            <h5 className="text-sm font-semibold text-red-700 mb-2">Attributs Matériel Médical</h5>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Prix Vente *</label>
                                    <input
                                        type="number"
                                        value={item.prixVente}
                                        onChange={(e) => onUpdate(item.id, 'prixVente', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="0"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Unité *</label>
                                    <select
                                        value={item.unite}
                                        onChange={(e) => onUpdate(item.id, 'unite', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                    >
                                        <option value="boîte">Boîte</option>
                                        <option value="flacon">Flacon</option>
                                        <option value="unité">Unité</option>
                                        <option value="sachet">Sachet</option>
                                        <option value="tube">Tube</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Seuil Alerte</label>
                                    <input
                                        type="number"
                                        value={item.seuilAlerte}
                                        onChange={(e) => onUpdate(item.id, 'seuilAlerte', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="10"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Champs spécifiques Matériel Durable */}
                    {item.type === "Matériel Durable" && (
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <h5 className="text-sm font-semibold text-blue-700 mb-2">Attributs Matériel Durable</h5>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Localisation *</label>
                                    <input
                                        type="text"
                                        value={item.localisation}
                                        onChange={(e) => onUpdate(item.id, 'localisation', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="Bureau, Salle..."
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">N° Série</label>
                                    <input
                                        type="text"
                                        value={item.numeroSerie}
                                        onChange={(e) => onUpdate(item.id, 'numeroSerie', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="SN-XXXXXX"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Garantie (mois)</label>
                                    <input
                                        type="number"
                                        value={item.dureeGarantie}
                                        onChange={(e) => onUpdate(item.id, 'dureeGarantie', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="12"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Justification pour matériel existant */}
            {!item.isNewMaterial && (
                <div className="mt-3">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Justification (si écart)</label>
                    <input
                        type="text"
                        value={item.justification}
                        onChange={(e) => onUpdate(item.id, 'justification', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Justification si quantité reçue différente de commandée..."
                    />
                </div>
            )}
        </div>
    );
}
