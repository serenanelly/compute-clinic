import { FiGrid, FiPlusCircle, FiList, FiFileText } from 'react-icons/fi';
import { NavLink } from 'react-router-dom';
import PropTypes from "prop-types";

export const PharmacyDashboard = ({ children }) => {
  const getLinkClass = ({ isActive }) => {
    return `flex items-center gap-2 p-2 rounded transition-colors ${
      isActive ? 'bg-white/20 font-medium' : 'hover:bg-white/10'
    }`;
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="h-screen w-64 bg-gradient-to-b from-[#1A73A3] to-[#50C2B9] text-white p-4 fixed">
        <div className="text-2xl font-bold mb-8">Fultang P</div>
        <nav className="space-y-4">
          <NavLink to="/dashboard" className={getLinkClass}>
            <FiGrid />
            <span>Dashboard</span>
          </NavLink>
          
          <NavLink to="/pharmacyList" className={getLinkClass}>
            <FiPlusCircle />
            <span>Add Medications</span>
          </NavLink>
          
          <NavLink to="/pharmacyMedication" className={getLinkClass}>
            <FiList />
            <span>List of Medications</span>
          </NavLink>
          
          <NavLink to="/prescriptions" className={getLinkClass}>
            <FiFileText />
            <span>Prescriptions</span>
          </NavLink>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-screen overflow-x-hidden ml-[256px]">
        {children}
      </div>
    </div>
  );
};

PharmacyDashboard.propTypes = {
  children: PropTypes.node.isRequired,
};

export default PharmacyDashboard;