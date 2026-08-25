import PropTypes from "prop-types";

export default function SpecialistPrescriptionCard({availableSpecialists, applyInputStyle})
{
    SpecialistPrescriptionCard.propTypes = {
        availableSpecialists: PropTypes.array.isRequired,
        applyInputStyle: PropTypes.func.isRequired
    }


    return (
        <div className="space-y-6 bg-gray-100 p-4 rounded-lg">
            <div>
                <label
                    className="block text-sm font-medium text-gray-700 mb-2">Specialist</label>
                <select className={applyInputStyle()}>
                    <option value="">Select a specialist</option>
                    {availableSpecialists.map((specialist) => (
                        <option key={specialist.id} value={specialist.id}>
                            {specialist.name}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason for
                    prescription</label>
                <textarea
                    className={applyInputStyle()}
                    rows={2}
                    placeholder="Raison du transfert vers le spécialiste"
                />
            </div>
        </div>
    )
}