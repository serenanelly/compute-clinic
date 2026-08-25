import PropTypes from "prop-types";

export default function DiagnosticCard({applyInputStyle, setDiagnostic, setDoctorNotes, diagnostic, doctorNotes, handleConsult, endConsultation, isUpdatingConsultation}) {

    DiagnosticCard.propTypes = {
        applyInputStyle: PropTypes.func.isRequired,
        setDiagnostic: PropTypes.func.isRequired,
        setDoctorNotes: PropTypes.func.isRequired,
        diagnostic: PropTypes.string.isRequired,
        doctorNotes: PropTypes.string.isRequired,
        handleConsult: PropTypes.func.isRequired,
        endConsultation: PropTypes.func.isRequired,
        isUpdatingConsultation: PropTypes.bool.isRequired
    }


    return (
        <form className="space-y-3 bg-gray-100 rounded-lg p-6" onSubmit={handleConsult}>
            <div>
                <label
                    className="block text-sm font-medium text-gray-700 mb-2">Diagnostic</label>
                <textarea
                    required
                    rows={3}
                    value={diagnostic}
                    onChange={(e) => setDiagnostic(e.target.value)}
                    className={applyInputStyle()}
                    placeholder="Enter your diagnosis here"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Doctor
                    Notes</label>
                <textarea
                    value={doctorNotes}
                    required
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    rows={3}
                    className={applyInputStyle()}
                    placeholder="Please add your observations, notes and recommendations here"
                />
            </div>
            <div className="flex justify-end gap-4">
                <button disabled={isUpdatingConsultation}
                        type="submit"
                        className="bg-primary-end hover:bg-primary-start font-semibold text-white py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">
                 {isUpdatingConsultation ? "Updating..." : "Submit"}
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