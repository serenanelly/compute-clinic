import PropTypes from "prop-types";
import { AppHeader } from "../../GlobalComponents/AppHeader.jsx";

export function NurseNavBar({ children }) {

    NurseNavBar.propTypes = {
        children: PropTypes.node.isRequired,
    };

    return (
        <div>
            <AppHeader subtitle="Suivi médical" title="Infirmier(ère)" />
            <div className="flex-1 min-h-screen mt-5">
                {children}
            </div>
        </div>
    );
}
