import PropTypes from "prop-types";

export default function MedicalParametersCard ({ icon : Icon, label, value, unit = '' }) {

    MedicalParametersCard.propTypes = {
        icon: PropTypes.element.isRequired,
        label: PropTypes.string.isRequired,
        value: PropTypes.number.isRequired,
        unit: PropTypes.string
    }

    return (
        <div className="bg-white p-3 rounded-lg">
            <div className="flex items-center text-gray-600">
                <Icon className="h-5 w-5 mr-2 text-blue-500"/>
                <span className="text-sm">{label}</span>
            </div>
            <p className="text-lg font-semibold mt-1 ml-8">{value}{unit}</p>
        </div>
    )
}