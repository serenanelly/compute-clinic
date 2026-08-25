import PropTypes from "prop-types";
import { AppHeader } from "../../GlobalComponents/AppHeader.jsx";

export function ReceptionistNavBar({ children }) {

    ReceptionistNavBar.propTypes = {
        children: PropTypes.node.isRequired,
    };

    return (
        <div>
            <AppHeader subtitle="Réception" title="Réceptionniste" />
            <div className="flex-1 min-h-screen mt-5">
                {children}
            </div>
        </div>
    );
}
