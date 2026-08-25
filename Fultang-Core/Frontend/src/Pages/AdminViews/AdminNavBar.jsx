import { useState } from "react";
import { FaKey } from "react-icons/fa";
import { Tooltip } from "antd";
import { AppHeader } from "../../GlobalComponents/AppHeader.jsx";
import { ChangePasswordModal } from "../../GlobalComponents/ChangePasswordModal.jsx";

export function AdminNavBar() {
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);

    const rightSlot = (
        <Tooltip title="Modifier le mot de passe">
            <button
                type="button"
                onClick={() => setPasswordModalOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/30 bg-white/15 text-white hover:bg-white/25 transition-colors"
                aria-label="Modifier le mot de passe"
            >
                <FaKey size={14} />
            </button>
        </Tooltip>
    );

    return (
        <>
            <AppHeader subtitle="Administration" title="Administrateur" rightSlot={rightSlot} />
            <ChangePasswordModal
                isOpen={passwordModalOpen}
                onClose={() => setPasswordModalOpen(false)}
            />
        </>
    );
}
