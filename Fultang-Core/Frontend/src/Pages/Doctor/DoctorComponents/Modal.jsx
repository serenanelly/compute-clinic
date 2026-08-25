import PropTypes from "prop-types";
import {FaEdit} from "react-icons/fa";
import {X} from "lucide-react";

const Modal = ({ isOpen, onClose, children }) => {


    Modal.propTypes = {
        isOpen: PropTypes.bool.isRequired,
        onClose: PropTypes.func.isRequired,
        children: PropTypes.node.isRequired
    }
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-5xl h-[600px] overflow-y-auto">
                <div className="flex justify-between gap-2 mb-5 mt-2">
                    <div className="flex gap-2">
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                            <FaEdit className="w-10 h-10 text-primary-start"/>
                        </button>
                        <p className="text-3xl font-bold mt-0.5 text-primary-start">Edit Consultation</p>
                    </div>

                    <button onClick={onClose}  className="transition-all duration-300 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center hover:bg-red-200 hover:text-red-700 text-red-500">
                        <X className="w-8 h-8 "/>

                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}

export default Modal

