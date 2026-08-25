import PropTypes from "prop-types";

export default function QuickActionButton({ icon: Icon, label, onClick }) {

    QuickActionButton.propTypes = {
        icon: PropTypes.elementType.isRequired,
        label: PropTypes.string.isRequired,
        onClick: PropTypes.func.isRequired
    }
    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center gap-2 p-4  rounded-lg border border-gray-200 hover:border-2 hover:border-primary-end hover:bg-gray-100 transition-all duration-300"
        >
            <Icon className="w-6 h-6 text-primary-end" />
            <span className="text-md text-gray-600 font-bold text-center">{label}</span>
        </button>
    );
}
