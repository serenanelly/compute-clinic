import PropTypes from 'prop-types';
import { Calendar, Clock, Phone, CheckCircle, Eye, ClipboardList, RefreshCw } from 'lucide-react';
import { useCalculateAge } from "../../../Utils/compute.js";
import { FaUser } from "react-icons/fa";
import { formatDateToTime } from "../../../Utils/formatDateMethods.js";
import { useNavigate } from 'react-router-dom';


export default function AppointmentCard({ appointment, onReschedule }) {


    AppointmentCard.propTypes = {
        appointment: PropTypes.object.isRequired,
        onReschedule: PropTypes.func
    }

    const navigate = useNavigate();
    const patientInfos = appointment?.id_patient;
    const { calculateAge } = useCalculateAge();
    const { value: ageValue, unit: ageUnit } = calculateAge(patientInfos?.date_naissance);

    const handleStartConsultation = () => {
        // Naviguer vers la page de consultation avec les données du patient
        navigate(`/doctor/consultation/${patientInfos?.id}`, {
            state: {
                patient: patientInfos,
                appointment: appointment
            }
        });
    };


    return (
        <div className="bg-gray-100 rounded-lg shadow-md p-4  hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div className="flex">
                    <FaUser className="w-7 h-7 text-primary-end mr-2" />
                    <h3 className="text-xl font-semibold  mt-0.5 text-gray-800">{patientInfos?.prenom + ' ' + patientInfos?.nom}</h3>
                    <div className="flex gap-1 mt-1 ">
                        <span className="ml-2 text-gray-700 font-semibold text-md">({ageValue}</span>
                        <span className="text-gray-700 font-semibold text-md">{ageUnit})</span>
                    </div>
                </div>
                <div className={`px-4 py-2 rounded-full text-sm font-semibold border-2  ${appointment.statut === "en_attente" ? "bg-blue-100 text-blue-800 border-blue-500" : appointment.statut === "effectue" ? "bg-green-100 text-green-800 border-green-500" : "bg-gray-100 text-gray-800 border-gray-500"}`}>
                    {appointment?.statut === "en_attente" ? "À venir" : appointment?.statut === "effectue" ? "Effectué" : "Annulé"}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4 ml-10">
                <div className="flex items-center text-gray-600">
                    <Calendar className="h-6 w-6 mr-2 text-primary-end" />
                    <span className="font-semibold">{new Date(appointment.date_heure).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center text-gray-600">
                    <Clock className="h-6 w-6 mr-2 text-primary-end" />
                    <span className="font-semibold">{formatDateToTime(appointment?.date_heure)}</span>
                </div>
                <div className="flex items-center text-gray-600">
                    <Phone className="h-6 w-6 mr-2 text-primary-end" />
                    <span className="font-semibold">{patientInfos?.contact || "N/A"}</span>
                </div>
                <div className="mt-1 flex flex-col">
                    <div className="flex ">
                        <ClipboardList className="h-6 w-6 mr-2 text-primary-end" />
                        <h4 className="text-md font-medium text-gray-700 mb-2">Reason for medical appointment</h4>
                    </div>
                    <p className="text-gray-600 font-semibold ml-7">{appointment.motif || "N/A"}</p>
                </div>
            </div>
            <div className="mt-2 flex justify-end gap-3">
                {appointment.statut === "en_attente" && onReschedule && (
                    <button
                        onClick={onReschedule}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 transition-colors flex items-center">
                        <RefreshCw className="h-5 w-5 mr-2" />
                        Reschedule
                    </button>
                )}
                {appointment.statut === "en_attente" ? (
                    <button
                        onClick={handleStartConsultation}
                        className="px-4 py-2 bg-primary-end text-white rounded-lg font-bold hover:bg-primary-start transition-colors flex items-center">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Start Consultation
                    </button>
                ) : (
                    <button
                        className="px-4 py-2 bg-primary-end text-white font-bold rounded-lg hover:bg-primary-start transition-colors flex items-center">
                        <Eye className="h-5 w-5 mr-2" />
                        View Details
                    </button>
                )}
            </div>
        </div>
    )
}