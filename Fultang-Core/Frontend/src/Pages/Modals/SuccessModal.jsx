import { CheckCircle } from 'lucide-react';
import PropTypes from "prop-types";


export function SuccessModal ({ isOpen, canOpenSuccessModal, message, makeAction }) {

    SuccessModal.propTypes = {
        isOpen: PropTypes.bool.isRequired,
        canOpenSuccessModal: PropTypes.func.isRequired,
        message: PropTypes.string.isRequired,
        makeAction: PropTypes.func,
    }


    function onCloseModal()
    {
        canOpenSuccessModal(false);
        makeAction();
    }


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm transition-all duration-300">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <CheckCircle className="w-12 h-12 text-primary-end mr-2 animate-success-check" />
                        <h3 className="text-2xl font-bold text-gray-900">Success</h3>
                    </div>
                </div>
                <p className="mb-6 mt-3 text-md">{message}</p>
                <div className="flex justify-center">
                    <button
                        onClick={() => onCloseModal()}
                        className="px-4 py-1 bg-primary-end font-bold text-md text-white  rounded-md  transition-colors duration-300"
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
}

