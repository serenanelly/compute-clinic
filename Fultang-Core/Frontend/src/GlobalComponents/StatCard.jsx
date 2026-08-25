import PropTypes from "prop-types";

export default function StatCard({icon: Icon, title, value, description, color}) {

    StatCard.propTypes = {
        icon: PropTypes.element.isRequired,
        title: PropTypes.string.isRequired,
        value: PropTypes.number.isRequired,
        description: PropTypes.string.isRequired,
        color: PropTypes.string
    }

    return (
        <div className="bg-gray-100 rounded-lg hover:shadow-lg p-6 flex items-start transition-all duration-500 hover:-translate-y-2   gap-4">
            <div className={`${color} rounded-full p-3 text-white`}>
                <Icon className="w-6 h-6"/>
            </div>
            <div>
                <h3 className="font-semibold text-gray-800">{title}</h3>
                <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
                <p className="text-sm text-gray-500">{description}</p>
            </div>
        </div>
    );
}
