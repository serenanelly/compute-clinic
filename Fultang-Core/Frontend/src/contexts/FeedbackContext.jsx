import { createContext, useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

// Context for global feedback notifications
const FeedbackContext = createContext(null);

/**
 * FeedbackModal - A reusable modal for displaying success, error, warning, and info messages.
 * This component renders the actual modal UI.
 */
function FeedbackModal({ isOpen, onClose, type, title, message }) {
    if (!isOpen) return null;

    const config = {
        success: {
            icon: CheckCircle,
            iconColor: 'text-green-500',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200',
            buttonColor: 'bg-green-500 hover:bg-green-600',
            defaultTitle: 'Success'
        },
        error: {
            icon: XCircle,
            iconColor: 'text-red-500',
            bgColor: 'bg-red-50',
            borderColor: 'border-red-200',
            buttonColor: 'bg-red-500 hover:bg-red-600',
            defaultTitle: 'Error'
        },
        warning: {
            icon: AlertCircle,
            iconColor: 'text-yellow-500',
            bgColor: 'bg-yellow-50',
            borderColor: 'border-yellow-200',
            buttonColor: 'bg-yellow-500 hover:bg-yellow-600',
            defaultTitle: 'Warning'
        },
        info: {
            icon: Info,
            iconColor: 'text-blue-500',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200',
            buttonColor: 'bg-blue-500 hover:bg-blue-600',
            defaultTitle: 'Information'
        }
    };

    const currentConfig = config[type] || config.info;
    const Icon = currentConfig.icon;
    const displayTitle = title || currentConfig.defaultTitle;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm transition-all duration-300">
            <div className={`bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 animate-fade-in-up border-l-4 ${currentConfig.borderColor}`}>
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${currentConfig.bgColor}`}>
                            <Icon className={`w-8 h-8 ${currentConfig.iconColor}`} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">{displayTitle}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Message */}
                <div className="mb-6">
                    <p className="text-gray-700 text-base leading-relaxed whitespace-pre-wrap">{message}</p>
                </div>

                {/* Action button */}
                <div className="flex justify-center">
                    <button
                        onClick={onClose}
                        className={`px-6 py-2 text-white font-semibold rounded-lg transition-all duration-300 ${currentConfig.buttonColor}`}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}

FeedbackModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    type: PropTypes.oneOf(['success', 'error', 'warning', 'info']).isRequired,
    title: PropTypes.string,
    message: PropTypes.string.isRequired
};

/**
 * FeedbackProvider - Wraps the application to provide global feedback functionality.
 * Use the useFeedback hook to show feedback modals from any component.
 */
export function FeedbackProvider({ children }) {
    const [feedback, setFeedback] = useState({
        isOpen: false,
        type: 'info',
        title: '',
        message: ''
    });

    const showFeedback = useCallback((type, message, title = '') => {
        setFeedback({
            isOpen: true,
            type,
            title,
            message
        });
    }, []);

    const showSuccess = useCallback((message, title = '') => {
        showFeedback('success', message, title);
    }, [showFeedback]);

    const showError = useCallback((message, title = '') => {
        showFeedback('error', message, title);
    }, [showFeedback]);

    const showWarning = useCallback((message, title = '') => {
        showFeedback('warning', message, title);
    }, [showFeedback]);

    const showInfo = useCallback((message, title = '') => {
        showFeedback('info', message, title);
    }, [showFeedback]);

    const closeFeedback = useCallback(() => {
        setFeedback(prev => ({ ...prev, isOpen: false }));
    }, []);

    const value = {
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showFeedback
    };

    return (
        <FeedbackContext.Provider value={value}>
            {children}
            <FeedbackModal
                isOpen={feedback.isOpen}
                onClose={closeFeedback}
                type={feedback.type}
                title={feedback.title}
                message={feedback.message}
            />
        </FeedbackContext.Provider>
    );
}

FeedbackProvider.propTypes = {
    children: PropTypes.node.isRequired
};

/**
 * useFeedback hook - Use this hook to show feedback modals from any component.
 * 
 * Example usage:
 * const { showSuccess, showError, showWarning, showInfo } = useFeedback();
 * 
 * showSuccess('Operation completed successfully!');
 * showError('An error occurred. Please try again.');
 * showWarning('Are you sure you want to proceed?', 'Warning');
 * showInfo('Here is some useful information.');
 */
export function useFeedback() {
    const context = useContext(FeedbackContext);
    if (!context) {
        throw new Error('useFeedback must be used within a FeedbackProvider');
    }
    return context;
}

// Export FeedbackModal for direct usage if needed
export { FeedbackModal };
