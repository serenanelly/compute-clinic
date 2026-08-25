import {  Clock, Phone, Stethoscope, User, FileText } from "lucide-react"
import PropTypes from "prop-types";
import {formatDateToTime} from "../../../Utils/formatDateMethods.js";
import {useCalculateAge} from "../../../Utils/compute.js";
import {useNavigate} from "react-router-dom";




export default function ConsultationCard ({ consultation }) {

    ConsultationCard.propTypes = {
        consultation: PropTypes.array.isRequired,
    }


    const patientInfos = consultation.idPatient;
    const { calculateAge } = useCalculateAge();
    const { value: ageValue, unit: ageUnit } = calculateAge('2000-01-01');
    const navigate = useNavigate();

    function getStateStyles  (state)  {
        const styles = {
            Critical: {
                container: "border-l-red-600",
                badge: "bg-red-100 border-red-500 text-red-500"
            },
            Serious: {
                container: "border-l-orange-500",
                badge: "bg-orange-100 border-orange-500  text-orange-500"
            },
            "Not Critical": {
                container: "border-l-yellow-500",
                badge: "bg-yellow-50 border-yellow-500 text-yellow-500"
            },
            Stable: {
                container: "border-l-green-500",
                badge: "bg-green-100 border-green-600 text-green-600"
            },
            Improving: {
                container: "border-l-blue-500",
                badge: "bg-blue-100 border-blue-600 text-blue-600"
            }
        };

        return styles[state] || { container: "border-l-gray-300", badge: "bg-gray-100 border-gray-600 text-gray-600" };
    }

    if (!consultation || Object.keys(consultation).length === 0) {
        return (
            <div className="h-full bg-gray-100 border rounded-2xl p-4 hover:-translate-y-1.5 hover:shadow-lg transition-all duration-500 border-l-4 border-blue-500 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Stethoscope className="h-16 w-16 text-blue-500 mx-auto" />
                    <h3 className="font-semibold text-gray-800 text-xl">No Consultation Data</h3>
                    <p className="text-gray-600">There are currently no consultations available.</p>
                </div>
            </div>
        )
    }

    return (
        <div className={`h-full bg-gray-100 border rounded-2xl p-4 hover:-translate-y-1.5 hover:shadow-lg transition-all duration-500 border-l-4 ${getStateStyles(consultation.statePatient).container}`}>
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <User className="h-5 w-5 text-gray-500 mr-2"/>
                        <h3 className="font-semibold text-gray-800">
                            {patientInfos?.firstName + " " + patientInfos?.lastName}
                            <div className="flex gap-1">
                                <span className="ml-2 text-gray-500 text-sm">{ageValue}</span>
                                <span className="text-gray-500 text-sm">{ageUnit}</span>
                            </div>
                        </h3>
                    </div>
                    <span
                        className={`px-2 py-1 rounded-full border-2 text-sm font-medium ${getStateStyles(consultation?.statePatient).badge}`}>
                        {consultation?.statePatient || 'Not Critical'}
                  </span>
                </div>

                <div className="flex ml-7 gap-2 text-gray-600">
                    <FileText className="h-5 w-5 mr-1 mt-2"/>
                    <p className=" ">Consultation Reason:</p>
                    <p className="text-black font-semibold">{consultation.consultationNotes}</p>
                </div>


                <div className="flex flex-col gap-4 ml-7">
                    <div className="flex items-center text-gray-500">
                        <Clock className="h-4 w-4 mr-1"/>
                        <span className="text-gray-500 mr-2"> Arrival Time: </span>
                        <span className="font-semibold text-black"> {formatDateToTime(consultation?.consultationDate)}</span>
                    </div>
                    <div className="flex items-center text-gray-500">
                        <Phone className="h-4 w-4 mr-1"/>
                        <span className="font-semibold text-black">{patientInfos?.phoneNumber}</span>
                    </div>
                </div>

                <div className="justify-end flex">
                    <button onClick={() => {navigate(`/doctor/consultation-list/details/${consultation.id}`, {state: {consultation}})}}
                            className="px-4 py-2 bg-primary-end text-white rounded-lg  transition-colors flex items-center justify-center">
                        <Stethoscope className="h-5 w-5 mr-2"/>
                        Consult Now
                    </button>
                </div>
            </div>
        </div>
    )
}
