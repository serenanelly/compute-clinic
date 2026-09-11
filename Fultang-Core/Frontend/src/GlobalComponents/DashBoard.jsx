import { Link, Navigate, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import { AccessDenied } from "./AccessDenied.jsx";
import { useAuthentication } from "../Utils/Provider.jsx";
import { useEffect, useState } from "react";
import { Loading } from "./Loading.jsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { APP_NAME } from "../constants/branding.js";

export function DashBoard({ children, linkList, requiredRole }) {
    DashBoard.propTypes = {
        children: PropTypes.node.isRequired,
        linkList: PropTypes.array.isRequired,
        requiredRole: PropTypes.string.isRequired
    }

    const location = useLocation();
    
    // Maintenir l'onglet précédent actif pendant la transition
    const [activeTabPath, setActiveTabPath] = useState(() => {
        return sessionStorage.getItem('dashboardActiveTab') || location.pathname;
    });

    const { isAuthenticated, hasRole } = useAuthentication();
    const [expandedLinks, setExpandedLinks] = useState({});
    const [isNavigating, setIsNavigating] = useState(true);

    useEffect(() => {
        setIsNavigating(true);
        const timer = setTimeout(() => {
            setActiveTabPath(location.pathname);
            sessionStorage.setItem('dashboardActiveTab', location.pathname);
            setIsNavigating(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [location.pathname]);

    function toggleSubMenu(linkName) {
        setExpandedLinks((prev) => ({
            ...prev,
            [linkName]: !prev[linkName],
        }));
    }

    function renderLink(item, index, isSubLink = false) {
        const IconComponent = item.icon;
        const isActive = activeTabPath.startsWith(item.link);
        const hasSubLinks = item.subLinks && item.subLinks.length > 0;

        return (
            <div key={index}>
                {!hasSubLinks ? (
                    <Link
                        className={`transition-all duration-400 flex p-3 items-center cursor-pointer ${isActive
                                ? "bg-white rounded-l-full mb-2 mt-2"
                                : "hover:bg-white/20 hover:rounded-l-full"
                            } ${isSubLink ? "ml-4" : "ml-5"}`}
                        to={item.link}
                    >
                        {IconComponent && (
                            <IconComponent
                                className={
                                    isActive
                                        ? "text-black text-xl mr-3"
                                        : "text-xl mr-3 text-white"
                                }
                            />
                        )}
                        <p
                            className={
                                isActive
                                    ? "text-black font-bold text-md"
                                    : "text-md font-bold text-white"
                            }
                        >
                            {item.name}
                        </p>
                    </Link>
                ) : (
                    <div
                        className="transition-all duration-400 flex p-3.5 items-center cursor-pointer ml-5 hover:bg-white/20 hover:rounded-l-full"
                        onClick={() => toggleSubMenu(item.name)}
                    >
                        {IconComponent && (
                            <IconComponent
                                className={
                                    isActive
                                        ? "text-black text-xl mr-3"
                                        : "text-xl mr-3 text-white"
                                }
                            />
                        )}
                        <p
                            className={
                                isActive
                                    ? "text-black font-bold text-md"
                                    : "text-md font-bold text-white"
                            }
                        >
                            {item.name}
                        </p>
                        {hasSubLinks &&
                            (expandedLinks[item.name] ? (
                                <ChevronUp
                                    className={`ml-auto ${isActive ? "text-black" : "text-white"
                                        }`}
                                />
                            ) : (
                                <ChevronDown
                                    className={`ml-auto ${isActive ? "text-black" : "text-white"
                                        }`}
                                />
                            ))}
                    </div>
                )}
                {hasSubLinks && !expandedLinks[item.name] && (
                    <div className="ml-8 mt-2">
                        {item.subLinks.map((subItem, subIndex) =>
                            renderLink(subItem, subIndex, true)
                        )}
                    </div>
                )}
            </div>
        );
    }

    if (!isAuthenticated()) {
        return <Navigate to="/login" />;
    }

    if (!hasRole(requiredRole)) {
        return <AccessDenied Role={requiredRole} />;
    }

    if (isNavigating) {
        return <Loading />;
    }

    return (
        <div className="flex h-screen">
            <div className="w-[19%] fixed h-screen bg-gradient-to-t from-primary-start to-primary-end flex flex-col overflow-y-auto scrollbar">
                <h1 className="text-3xl font-bold ml-6 mb-10 mt-7 text-white">
                    {APP_NAME}
                </h1>
                <nav className="flex flex-col space-y-1.5 mb-2 ">
                    {linkList.map((item, index) => renderLink(item, index))}
                </nav>
            </div>
            <div className="flex-1 min-h-screen overflow-x-hidden ml-[19%] flex flex-col">
                <div className="flex-1">
                    {children}
                </div>
            </div>
        </div>
    );
}