import PropTypes from "prop-types";

export default function AppointmentPrescriptionCard({applyInputStyle, onSubmit, endConsultation, appointmentDate, appointmentTime, setAppointmentDate, setAppointmentTime, requirements, setRequirements, appointmentReason, setAppointmentReason,isPrescribingAppointment}) {

    AppointmentPrescriptionCard.propTypes = {
        applyInputStyle: PropTypes.func.isRequired,
        onSubmit:PropTypes.func.isRequired,
        endConsultation: PropTypes.func.isRequired,
        appointmentDate: PropTypes.object.isRequired,
        appointmentTime: PropTypes.object.isRequired,
        appointmentReason: PropTypes.string.isRequired,
        setAppointmentReason: PropTypes.func.isRequired,
        setAppointmentDate: PropTypes.func.isRequired,
        setAppointmentTime: PropTypes.func.isRequired,
        requirements: PropTypes.string.isRequired,
        setRequirements: PropTypes.func.isRequired,
        isPrescribingAppointment: PropTypes.bool.isRequired,
    }

    return (
        <form className="space-y-6 bg-gray-100 rounded-lg p-6" onSubmit={onSubmit}>
            <div className="grid grid-cols-2 gap-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date of next
                        appointment</label>
                    <input
                        value={appointmentDate}
                        onChange={(e) => setAppointmentDate(e.target.value)}
                        required={true}
                        type="date"
                        className={applyInputStyle()}/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Appointment
                        time</label>
                    <input
                        type="time"
                        value={appointmentTime}
                        onChange={(e) => setAppointmentTime(e.target.value)}
                        required={true}
                        className={applyInputStyle()}
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reasons for the appointment</label>
                <textarea
                    value={appointmentReason}
                    onChange={(e) => setAppointmentReason(e.target.value)}
                    required={true}
                    className={applyInputStyle()}
                    rows={2}
                    placeholder="Causes for scheduling the appointment"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Instructions for
                    tracking</label>
                <textarea
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    required={true}
                    className={applyInputStyle()}
                    rows={2}
                    placeholder="Special instructions and necessary for the next appointment"
                />
            </div>

            <div className="flex justify-end gap-4">
                <button disabled={isPrescribingAppointment}
                        type="submit"
                        className="bg-primary-end hover:bg-primary-start font-semibold text-white py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">
                    {isPrescribingAppointment ? "Processing..." : "Submit"}
                </button>

                <button type={"button"}
                        onClick={endConsultation}
                        className="px-4 py-2 bg-primary-end hover:bg-primary-start transition-all duration-300 text-white font-bold rounded-lg"
                >
                    End consultation
                </button>
            </div>
        </form>
    )
}