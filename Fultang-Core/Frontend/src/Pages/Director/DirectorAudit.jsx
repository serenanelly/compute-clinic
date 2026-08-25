import { DirectorDashBoard } from "./Components/DirectorDashboard";
import { DirectorNavLink } from "./DirectorNavLink";
import { DirectorNavBar } from "./Components/DirectorNavBar";
import { AuditLogsContent } from "../Accountant/Audit/AuditLogs.jsx";

/**
 * Piste d'audit en lecture seule pour le Directeur
 * (réutilise le contenu comptable, sans layout accountant).
 */
export function DirectorAudit() {
    return (
        <DirectorDashBoard linkList={DirectorNavLink} requiredRole="directeur">
            <DirectorNavBar />
            <div className="p-6">
                <AuditLogsContent />
            </div>
        </DirectorDashBoard>
    );
}

export default DirectorAudit;
