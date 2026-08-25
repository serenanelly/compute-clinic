import PropTypes from "prop-types";
import userIcon from "../../assets/userIcon.png";
import { Mail, MapPin, Calendar, CreditCard, User } from 'lucide-react';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import {FaUser} from "react-icons/fa";
import {BiHistory} from "react-icons/bi";


export function ViewMedicalStaffDetailsModal({isOpen, medicalStaff, onClose})
{
    ViewMedicalStaffDetailsModal.propTypes = {
        isOpen: PropTypes.bool.isRequired,
        medicalStaff: PropTypes.object.isRequired,
        onClose: PropTypes.func.isRequired
    };

    function formatDate (date) {
        return format(new Date(date), "EEEE, d MMMM yyyy 'at' h:mm a", { locale: enUS });
    }



    console.log(medicalStaff);

    if(!isOpen) return null;


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm transition-all duration-300">
            <div className="bg-white rounded-lg shadow-xl w-[700px] ">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="flex flex-row">
                        {/* Left Section - Avatar and Name */}
                        <div
                            className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 flex flex-col items-center text-center w-1/3">
                            <div className="w-40 h-40 rounded-full bg-sky-200 overflow-hidden mb-4">
                                <img
                                    src={userIcon}
                                    alt="Profile avatar"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <h1 className="text-2xl font-bold text-navy-900 mb-1">{medicalStaff?.last_name}</h1>
                            <h2 className="text-xl text-navy-700 mb-4">{medicalStaff?.first_name}</h2>
                            <div className="flex items-center text-gray-600">
                                <User className="w-8 h-8 mr-2"/>
                                <p className="text-xl font-bold">{medicalStaff?.gender}</p>
                            </div>
                        </div>

                        {/* Right Section - Personal Information */}
                        <div className="p-6 md:w-2/3">
                            <div className="space-y-4">

                                <div className="flex items-start">
                                    <FaUser className="w-7 h-7 text-primary-start mt-1 mr-3"/>
                                    <div>
                                        <p className="text-sm text-gray-500 font-medium">Username</p>
                                        <p className="text-gray-700 font-bold mt-1">{medicalStaff?.username}</p>
                                    </div>
                                </div>


                                <div className="flex items-start">
                                    <MapPin className="w-7 h-7 text-primary-start mt-1 mr-3"/>
                                    <div>
                                        <p className="text-md text-gray-500 font-medium">{medicalStaff?.role === "Admin" ? "Role" : "Profession"}</p>
                                        <p className="text-gray-700 font-bold mt-1">{medicalStaff.role === "Labtech" ? "Laboratory Assistant" : medicalStaff.role}</p>
                                    </div>
                                </div>

                                <div className="flex items-start">
                                    <Mail className="w-7 h-7 text-primary-start mt-1 mr-3"/>
                                    <div>
                                        <p className="text-sm text-gray-500 font-medium">Email</p>
                                        <p className="text-gray-700 font-bold mt-1">{medicalStaff?.email}</p>
                                    </div>
                                </div>

                                <div className="flex items-start">
                                    <CreditCard className="w-7 h-7 text-primary-start mt-1 mr-3"/>
                                    <div>
                                        <p className="text-sm text-gray-500 font-medium">CNI Number</p>
                                        <p className="text-gray-700 font-bold mt-1">{medicalStaff?.cniNumber}</p>
                                    </div>
                                </div>


                                <div className="flex items-start">
                                    <Calendar className="w-7 h-7 text-primary-start mt-1 mr-3"/>
                                    <div>
                                        <p className="text-sm text-gray-500 font-medium">Date joined</p>
                                        <p className="text-gray-700 font-bold mt-1">{formatDate(medicalStaff?.date_joined)}</p>
                                    </div>
                                </div>

                                <div className="flex items-start">
                                    <BiHistory className="w-8 h-8 text-primary-start mt-1 mr-3"/>
                                    <div>
                                        <p className="text-sm text-gray-500 font-medium">Last login</p>
                                        <p className="text-gray-700 font-bold mt-1 mb-5">{medicalStaff?.last_login ? formatDate(medicalStaff?.last_login) : "no connection to the application"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-1 bg-primary-end text-md hover:text-xl font-bold text-md text-white rounded-md transition-all duration-300"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}