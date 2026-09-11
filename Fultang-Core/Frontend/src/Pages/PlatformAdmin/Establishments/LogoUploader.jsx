import { useRef, useState } from "react";
import PropTypes from "prop-types";
import { UploadCloud, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import { uploadTenantLogo, deleteTenantLogo } from "../../../services/platformAdminApi.js";
import { resolveTenantLogoUrl } from "../../../Utils/gatewayUrls.js";
import { useFeedback } from "../../../contexts/FeedbackContext.jsx";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 Mo — même limite que le backend

/**
 * Zone de dépôt (drag & drop) + sélection au clic pour le logo d'un
 * établissement. Remplace l'ancien champ texte « URL du logo » : le logo
 * est désormais un vrai fichier téléversé (voir POST/DELETE
 * /tenants/{id}/logo/), avec repli possible sur l'ancienne URL externe
 * côté backend si aucun fichier n'a jamais été envoyé.
 */
export function LogoUploader({ tenant, onUpdated }) {
    const { showSuccess, showError } = useFeedback();
    const [dragging, setDragging] = useState(false);
    const [busy, setBusy] = useState(false);
    const inputRef = useRef(null);

    const previewUrl = resolveTenantLogoUrl(tenant?.logo_display_url);

    const validateFile = (file) => {
        if (!file.type.startsWith("image/")) {
            showError("Le fichier sélectionné n'est pas une image.");
            return false;
        }
        if (file.size > MAX_SIZE_BYTES) {
            showError("L'image dépasse la taille maximale autorisée (2 Mo).");
            return false;
        }
        return true;
    };

    const handleFile = async (file) => {
        if (!file || !validateFile(file)) return;
        setBusy(true);
        try {
            const updated = await uploadTenantLogo(tenant.id, file);
            onUpdated(updated);
            showSuccess("Logo mis à jour");
        } catch (error) {
            console.error("Erreur lors du téléversement du logo:", error);
            showError("Impossible de mettre à jour le logo");
        } finally {
            setBusy(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        if (busy) return;
        const file = e.dataTransfer.files?.[0];
        handleFile(file);
    };

    const handleDelete = async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
            const updated = await deleteTenantLogo(tenant.id);
            onUpdated(updated);
            showSuccess("Logo supprimé");
        } catch (error) {
            console.error("Erreur lors de la suppression du logo:", error);
            showError("Impossible de mettre à jour le logo");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Logo</label>
            <div
                onClick={() => !busy && inputRef.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (!busy) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`relative flex items-center gap-4 rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors ${
                    dragging ? "border-primary-end bg-primary-end/5" : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                } ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={busy}
                    onChange={(e) => handleFile(e.target.files?.[0])}
                />

                <div className="w-16 h-16 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {previewUrl ? (
                        <img src={previewUrl} alt="Logo de l'établissement" className="w-full h-full object-contain" />
                    ) : (
                        <ImageIcon className="w-6 h-6 text-gray-300" />
                    )}
                </div>

                <div className="flex-1 min-w-0 text-sm">
                    {busy ? (
                        <span className="inline-flex items-center gap-2 text-gray-500 font-semibold">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Traitement en cours…
                        </span>
                    ) : (
                        <>
                            <span className="inline-flex items-center gap-2 font-semibold text-gray-700">
                                <UploadCloud className="w-4 h-4 text-gray-400" />
                                Glissez-déposez une image, ou cliquez pour parcourir
                            </span>
                            <p className="text-xs text-gray-400 mt-0.5">PNG, JPG… — 2 Mo maximum.</p>
                        </>
                    )}
                </div>

                {previewUrl && !busy && (
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-600 flex-shrink-0"
                    >
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                    </button>
                )}
            </div>
        </div>
    );
}

LogoUploader.propTypes = {
    tenant: PropTypes.shape({
        id: PropTypes.string.isRequired,
        logo_display_url: PropTypes.string,
    }).isRequired,
    onUpdated: PropTypes.func.isRequired,
};

export default LogoUploader;
