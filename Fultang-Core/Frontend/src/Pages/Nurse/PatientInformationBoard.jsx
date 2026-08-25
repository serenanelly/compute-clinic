import userIcon from "../../assets/userIcon.png";
import PropTypes from "prop-types";

export default function PatientInformationBoard({patient}) {

    PatientInformationBoard.propTypes = {
        patient: PropTypes.object.isRequired,
    };
    return (
        <div className="w-2/6 flex flex-col ml-5 border-2 shadow-xl mb-5 rounded-lg">
            <div className="w-full flex justify-center items-center flex-col mb-10">
                <div className="mt-5 mb-5 ml-5 w-36 h-36 border-4 border-gray-300 rounded-full">
                    <img src={userIcon} alt="user icon" className="h-[136px] w-[136px] mb-2"/>
                </div>
                <p className="font-bold text-3xl mt-2 mb-1">{patient.firstName}</p>
                <p className="font-bold text-3xl mt-1 mb-4">{patient.lastName}</p>
            </div>

            <div className="flex border-t-2 border-t-gray-200 p-6 mr-2 ml-2">
                <p className="mr-10 w-1/4">Gender</p>
                <p className="w-3/4 text-center">{patient?.gender}</p>
            </div>

            <div className="flex border-t-2 border-t-gray-200   p-6 ml-2 mr-2">
                <p className="mr-10 w-1/4">CNI</p>
                <p className="w-3/4 text-center">{patient.cniNumber}</p>
            </div>

            <div className="flex border-t-2 border-t-gray-200   p-6 ml-2 mr-2">
                <p className="mr-10 w-1/4">Address</p>
                <p className="w-3/4 text-center">{patient?.address}</p>
            </div>
            <div className="flex border-t-2 border-t-gray-200   p-6 ml-2 mr-2">
                <p className="mr-10 w-1/4">Email</p>
                <p className="w-3/4 text-center">{patient?.email}</p>
            </div>

            <div className="flex border-t-2 border-t-gray-200   p-6 ml-2 mr-2">
                <p className="mr-10 w-1/4">Birth Date</p>
                <p className="w-3/4 text-center">{patient?.birthDate}</p>
            </div>

            <div className="flex border-t-2 border-t-gray-200   p-6 ml-2 mr-2">
                <p className="mr-10 w-1/4">Contact</p>
                <p className="w-3/4 text-center">{patient?.phoneNumber}</p>
            </div>

            <div className="flex border-t-2 border-t-gray-200   p-6 ml-2 mr-2">
                <p className="mr-10 w-1/4">Emergency contact</p>
                <p className="w-3/4 text-center">{patient?.phoneNumber}</p>
            </div>

            <div
                className="flex border-t-2 border-t-gray-200 border-b-2 border-b-gray-200 p-6 ml-2 mr-2">
                <p className="mr-10 w-1/4">Added At</p>
                <p className="w-3/4 text-center">{patient.addDate}</p>
            </div>
        </div>
    )
}