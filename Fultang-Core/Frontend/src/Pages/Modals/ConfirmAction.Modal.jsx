import { AlertCircle, X } from 'lucide-react';
import PropTypes from "prop-types";

export function ConfirmationModal ({ isOpen, onClose, onConfirm, title, message }) {


    ConfirmationModal.propTypes = {
        isOpen: PropTypes.bool.isRequired,
        onClose: PropTypes.func.isRequired,
        onConfirm: PropTypes.func.isRequired,
        title: PropTypes.string.isRequired,
        message: PropTypes.string.isRequired
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm transition-all duration-300">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4 animate-fade-in-up">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <AlertCircle className="w-12 h-12 text-yellow-500 mr-2" />
                        <h3 className="text-2xl font-bold mt-1 text-gray-900">{title}</h3>
                    </div>
                </div>
                <p className="text-gray-700 mb-6 font-semibold">{message}</p>
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className="px-4 py-2 bg-primary-end text-white rounded-lg text-md hover:text-xl font-bold transition-all duration-300"
                    >
                        Confirm
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-red-400 text-white  rounded-lg font-bold hover:bg-red-500 transition-all duration-300"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

