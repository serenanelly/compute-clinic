import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import { AccessDenied } from "../../GlobalComponents/AccessDenied.jsx";
import { ServiceUnavailableScreen } from "../../GlobalComponents/ServiceUnavailableScreen.jsx";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { useAuthentication } from "../../Utils/Provider.jsx";
import { useFunctionalServiceGate } from "../../hooks/useFunctionalServiceGate.js";
import { ChevronDown, ChevronUp } from "lucide-react";
import { accountantNavLink } from "./NavLinks";
import { AccountantNavBar } from "./NavBar";
import { ACCOUNTANT_COLORS } from "./accountantTheme";

export function AccountantLayout({ children }) {
    AccountantLayout.propTypes = {
        children: PropTypes.node.isRequired,
    };

    const location = useLocation();
    const activeLink = location.pathname;
    const { isAuthenticated, hasRole } = useAuthentication();
    // Ce layout ne sert QUE le rôle Comptable Financier — un seul
    // FunctionalService concerné, câblé directement ici plutôt que via
    // un prop (contrairement à CustomDashboard.jsx, partagé par
    // plusieurs rôles avec des besoins différents).
    const { checking: checkingService, blocked: serviceBlocked } = useFunctionalServiceGate("COMPTA_FINANCIERE");
    const [expandedLinks, setExpandedLinks] = useState(() => {
        const initial = {};
        accountantNavLink.forEach((item) => {
            if (item.subLinks?.some((s) => activeLink === s.link || activeLink.startsWith(s.link))) {
                initial[item.name] = true;
            }
        });
        return initial;
    });

    function toggleSubMenu(linkName) {
        setExpandedLinks((prev) => ({
            ...prev,
            [linkName]: !prev[linkName],
        }));
    }

    function renderLink(item, index, isSubLink = false) {
        const IconComponent = item.icon;
        const isActive = activeLink === item.link || (item.link && item.link !== "/accountant/home" && activeLink.startsWith(item.link));
        const hasSubLinks = item.subLinks && item.subLinks.length > 0;
        const isParentActive = hasSubLinks && item.subLinks.some(
            (s) => activeLink === s.link || activeLink.startsWith(s.link)
        );

        return (
            <div key={index}>
                {!hasSubLinks ? (
                    <Link
                        className={`transition-all duration-300 flex p-3 items-center cursor-pointer ${isActive
                                ? "bg-white text-secondary rounded-l-full mb-2 mt-2 font-bold shadow-md"
                                : "text-white hover:bg-white/10 hover:rounded-l-full"
                            } ${isSubLink ? "ml-4" : "ml-5"}`}
                        to={item.link}
                    >
                        {IconComponent && (
                            <IconComponent
                                className={`text-xl mr-3 ${isActive ? "text-secondary" : "text-white"}`}
                            />
                        )}
                        <span className="text-sm font-medium">
                            {item.name}
                        </span>
                    </Link>
                ) : (
                    <div
                        className={`transition-all duration-300 flex p-3.5 items-center cursor-pointer ml-5 text-white hover:bg-white/10 hover:rounded-l-full ${isParentActive ? "bg-white/10 rounded-l-full" : ""}`}
                        onClick={() => toggleSubMenu(item.name)}
                    >
                        {IconComponent && (
                            <IconComponent
                                className="text-xl mr-3 text-white"
                            />
                        )}
                        <span className="text-sm font-medium">
                            {item.name}
                        </span>
                        {expandedLinks[item.name] ? (
                            <ChevronUp className="ml-auto text-white" />
                        ) : (
                            <ChevronDown className="ml-auto text-white" />
                        )}
                    </div>
                )}
                {hasSubLinks && expandedLinks[item.name] && (
                    <div className="ml-8 mt-1 space-y-1">
                        {item.subLinks.map((subItem, subIndex) =>
                            renderLink(subItem, subIndex, true)
                        )}
                    </div>
                )}
            </div>
        );
    }

    const hasAccess = hasRole("comptable_financier") || hasRole("comptable");

    if (!isAuthenticated()) {
        return <Navigate to="/login" />;
    }

    if (!hasAccess) {
        return <AccessDenied Role="Comptable Financier" />;
    }

    if (checkingService) {
        return <Loading />;
    }

    if (serviceBlocked) {
        return <ServiceUnavailableScreen />;
    }

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <div className="w-[19%] fixed h-screen bg-gradient-to-b from-primary-start to-primary-end flex flex-col justify-between shadow-2xl overflow-y-auto scrollbar z-30">
                <div>
                    <div className="p-6 border-b border-white/10">
                        <h1 className="text-2xl font-black text-white tracking-wider">
                            FULTANG CLINIC
                        </h1>
                        <p className="text-xs text-white/60 font-semibold uppercase mt-1 tracking-widest">
                            Finance & Comptabilité
                        </p>
                    </div>
                    <nav className="flex flex-col mt-6 space-y-1">
                        {accountantNavLink.map((item, index) => renderLink(item, index))}
                    </nav>
                </div>
                <div className="p-4 border-t border-white/10 text-center">
                    <p className="text-xs text-white/40">© 2026 Polyclinique Fultang</p>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-h-screen overflow-y-auto ml-[19%] flex flex-col" style={{ backgroundColor: ACCOUNTANT_COLORS.background }}>
                <AccountantNavBar />
                <div className="flex-grow p-6">
                    {children}
                </div>
            </div>
        </div>
    );
}

export default AccountantLayout;
