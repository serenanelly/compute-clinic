import PropTypes from "prop-types";
import { AppHeader } from "../../../GlobalComponents/AppHeader.jsx";

export function DoctorNavBar({ children }) {

    DoctorNavBar.propTypes = {
        children: PropTypes.node.isRequired,
    };

    return (
        <div>
            <AppHeader subtitle="Consultation" title="Médecin" />
            <div className="flex-1 min-h-screen mt-5">
                {children}
            </div>
        </div>
    );
}
