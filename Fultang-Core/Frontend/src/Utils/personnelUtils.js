const POSTE_LABELS = {
    directeur: "Directeur Général",
    comptable: "Comptable Matière",
    comptable_matiere: "Comptable Matière",
    compta_matiere: "Comptable Matière",
    pharmacien: "Pharmacien",
    caissier: "Comptable Financier / Caissier",
    comptable_financier: "Comptable Financier",
    medecin: "Médecin",
    medecin_generaliste: "Médecin Généraliste",
    infirmier: "Infirmier(ère)",
    infirmiere: "Infirmier(ère)",
    receptioniste: "Réceptionniste",
    receptionniste: "Réceptionniste",
    laborantin: "Laborantin",
    admin: "Administrateur",
};

export function getPersonnelUuid(person) {
    return String(person?.id || person?.id_personnel || person?.idpersonnel || "");
}

export function getPersonnelPosteLabel(poste) {
    if (!poste) return "Personnel";
    const key = String(poste).toLowerCase();
    return POSTE_LABELS[key] || poste;
}

export function formatPersonnelOption(person) {
    const role = getPersonnelPosteLabel(person.poste);
    const name = `${person.nom || ""} ${person.prenom || ""}`.trim();
    const matricule = person.matricule ? ` [${person.matricule}]` : "";
    return `${role} — ${name}${matricule}`;
}

export function findPersonnelById(personnels, id) {
    const wanted = String(id || "");
    return personnels.find((p) => getPersonnelUuid(p) === wanted);
}

/**
 * Décode le claim `sub` du JWT (identité autoritaire de la Gateway).
 */
function getUserIdFromToken() {
    const token = localStorage.getItem("token_key_fultang");
    if (!token) return "";
    try {
        const payload = token.split(".")[1];
        if (!payload) return "";
        const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
        const decoded = JSON.parse(
            decodeURIComponent(
                atob(base64)
                    .split("")
                    .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                    .join("")
            )
        );
        return String(decoded.sub || "");
    } catch (e) {
        console.error("Erreur décodage token JWT:", e);
        return "";
    }
}

/**
 * UUID personnel de la session active.
 * Priorité : JWT `sub` (toujours à jour) > user_data_fultang > personnel_id.
 */
export function getLoggedPersonnelId() {
    const fromToken = getUserIdFromToken();
    if (fromToken) {
        if (localStorage.getItem("personnel_id") !== fromToken) {
            localStorage.setItem("personnel_id", fromToken);
        }
        return fromToken;
    }

    const userDataRaw = localStorage.getItem("user_data_fultang");
    if (userDataRaw) {
        try {
            const parsed = JSON.parse(userDataRaw);
            const id = String(parsed.idpersonnel || parsed.id || "");
            if (id) {
                if (localStorage.getItem("personnel_id") !== id) {
                    localStorage.setItem("personnel_id", id);
                }
                return id;
            }
        } catch (e) {
            console.error("Erreur parsing user_data_fultang:", e);
        }
    }
    return localStorage.getItem("personnel_id") || "";
}
