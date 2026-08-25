import { XCircle } from 'lucide-react';
import PropTypes from "prop-types";

ErrorModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onCloseErrorModal: PropTypes.func.isRequired,
    message: PropTypes.string.isRequired
};


export function ErrorModal({ isOpen, onCloseErrorModal, message }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm transition-all duration-300">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <XCircle className="w-14 h-14 text-red-500 mr-2" />
                        <h3 className="text-3xl font-bold text-red-500">Error</h3>
                    </div>
                </div>
                <p className="mb-6 mt-3 text-md">{message}</p>
                <div className="flex justify-center">
                    <button
                        onClick={() => onCloseErrorModal(false)}
                        className="px-4 py-1 bg-red-400 hover:bg-red-500  font-bold text-md text-white rounded-md transition-colors duration-300"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}


