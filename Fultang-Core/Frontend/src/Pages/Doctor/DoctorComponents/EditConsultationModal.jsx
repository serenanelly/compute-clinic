"use client"

import { useState, useEffect } from "react"
import Modal from "./Modal"
import PropTypes from "prop-types";

const EditConsultationModal = ({ isOpen, onClose, consultation, onSave }) => {



    EditConsultationModal.propTypes = {
        isOpen: PropTypes.bool.isRequired,
        onClose: PropTypes.func.isRequired,
        consultation: PropTypes.object.isRequired,
        onSave: PropTypes.func.isRequired
    }


    const [editedConsultation, setEditedConsultation] = useState(consultation);

    console.log(consultation);

    useEffect(() => {
        setEditedConsultation(consultation)
    }, [consultation])

    const handleChange = (e, section, index = null) => {
        const { name, value } = e.target
        if (section) {
            if (index !== null) {
                setEditedConsultation((prev) => ({
                    ...prev,
                    [section]: prev[section].map((item, i) => (i === index ? { ...item, [name]: value } : item)),
                }))
            } else {
                setEditedConsultation((prev) => ({
                    ...prev,
                    [section]: { ...prev[section], [name]: value },
                }))
            }
        } else {
            setEditedConsultation((prev) => ({ ...prev, [name]: value }))
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave(editedConsultation)
        onClose()
    }

    const addItem = (section) => {
        setEditedConsultation((prev) => ({
            ...prev,
            [section]: [...prev[section], {}],
        }))
    }

    const removeItem = (section, index) => {
        setEditedConsultation((prev) => ({
            ...prev,
            [section]: prev[section].filter((_, i) => i !== index),
        }))
    }

    if (!consultation) return null

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Diagnostic et Notes */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Diagnostic et Notes</h3>
                    <div>
                        <label htmlFor="diagnostic" className="block text-sm font-medium text-gray-700 mb-2">
                            Diagnostic
                        </label>
                        <textarea
                            id="diagnostic"
                            name="diagnostic"
                            value={editedConsultation.diagnostic}
                            onChange={(e) => handleChange(e, "diagnosticAndNotes")}
                            rows={3}
                            className="w-full p-3 border-2 border-gray-300 bg-white rounded-lg focus:outline-none focus:border-primary-end focus:border-2 transition-all duration-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="doctorNotes" className="block text-sm font-medium text-gray-700 mb-2">
                            Notes du médecin
                        </label>
                        <textarea
                            id="doctorNotes"
                            name="doctorNotes"
                            value={editedConsultation.doctorNotes}
                            onChange={(e) => handleChange(e, "diagnosticAndNotes")}
                            rows={3}
                            className="w-full p-3 border-2 border-gray-300 bg-white rounded-lg focus:outline-none focus:border-primary-end focus:border-2 transition-all duration-500"
                        />
                    </div>
                </div>

                {/* Prescriptions de médicaments */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Prescriptions de médicaments</h3>
                    {editedConsultation?.idMedicalFolderPage?.prescriptions.map((prescription, index) => (
                        <div key={index} className="space-y-2 p-4 bg-gray-100 rounded-lg">
                            <input
                                type="text"
                                name="medicament"
                                value={prescription.medicament}
                                onChange={(e) => handleChange(e, "prescriptions", index)}
                                placeholder="Médicament"
                                className="w-full p-2 border-2 border-gray-300 rounded-lg"
                            />
                            <input
                                type="text"
                                name="dosage"
                                value={prescription.dosage}
                                onChange={(e) => handleChange(e, "prescriptions", index)}
                                placeholder="Dosage"
                                className="w-full p-2 border-2 border-gray-300 rounded-lg"
                            />
                            <button type="button" onClick={() => removeItem("prescriptions", index)} className="text-red-500">
                                Supprimer
                            </button>
                        </div>
                    ))}
                    <button type="button" onClick={() => addItem("prescriptions")} className="text-blue-500">
                        Ajouter une prescription
                    </button>
                </div>

                {/* Examens */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Examens</h3>
                    {editedConsultation?.idMedicalFolderPage?.examRequests.map((exam, index) => (
                        <div key={index} className="space-y-2 p-4 bg-gray-100 rounded-lg">
                            <input
                                type="text"
                                name="examName"
                                value={exam.examName}
                                onChange={(e) => handleChange(e, "exams", index)}
                                placeholder="Nom de l'examen"
                                className="w-full p-2 border-2 border-gray-300 rounded-lg"
                            />
                            <textarea
                                name="notes"
                                value={exam.notes}
                                onChange={(e) => handleChange(e, "exams", index)}
                                placeholder="Notes pour l'examen"
                                rows={2}
                                className="w-full p-2 border-2 border-gray-300 rounded-lg"
                            />
                            <button type="button" onClick={() => removeItem("exams", index)} className="text-red-500">
                                Supprimer
                            </button>
                        </div>
                    ))}
                    <button type="button" onClick={() => addItem("exams")} className="text-blue-500">
                        Ajouter un examen
                    </button>
                </div>

                {/* Rendez-vous */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Rendez-vous</h3>
                    <div>
                        <label htmlFor="appointmentDate" className="block text-sm font-medium text-gray-700 mb-2">
                            Date du prochain rendez-vous
                        </label>
                        <input
                            type="date"
                            id="appointmentDate"
                            name="appointmentDate"
                            value={editedConsultation?.appointment?.atDate}
                            onChange={(e) => handleChange(e, "appointment")}
                            className="w-full p-2 border-2 border-gray-300 rounded-lg"
                        />
                    </div>
                    <div>
                        <label htmlFor="appointmentTime" className="block text-sm font-medium text-gray-700 mb-2">
                            Heure du rendez-vous
                        </label>
                        <input
                            type="time"
                            id="appointmentTime"
                            name="appointmentTime"
                            value={editedConsultation?.appointment?.time}
                            onChange={(e) => handleChange(e, "appointment")}
                            className="w-full p-2 border-2 border-gray-300 rounded-lg"
                        />
                    </div>
                    <div>
                        <label htmlFor="appointmentReason" className="block text-sm font-medium text-gray-700 mb-2">
                            Raison du rendez-vous
                        </label>
                        <textarea
                            id="appointmentReason"
                            name="appointmentReason"
                            value={editedConsultation?.appointment?.reason}
                            onChange={(e) => handleChange(e, "appointment")}
                            rows={2}
                            className="w-full p-3 border-2 border-gray-300 bg-white rounded-lg focus:outline-none focus:border-primary-end focus:border-2 transition-all duration-500"
                        />
                    </div>
                </div>

                <div className="flex justify-end space-x-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-all duration-300"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-primary-end hover:bg-primary-start text-white rounded-lg transition-all duration-300"
                    >
                        Enregistrer
                    </button>
                </div>
            </form>
        </Modal>
    )
}

export default EditConsultationModal

