import PropTypes from "prop-types";
import { Check } from "lucide-react";

/**
 * Indicateur d'étapes de l'assistant de création de tenant.
 *
 * Purement présentatif : trois cercles numérotés reliés par une ligne,
 * chaque étape porte un libellé explicite pour rester compréhensible sans
 * explication complémentaire. Un clic sur une étape déjà complétée permet
 * d'y revenir ; il est impossible de sauter vers une étape non encore
 * visitée.
 */
export function ProgressSteps({ steps, currentStep, maxVisitedStep, onStepClick }) {
    return (
        <ol className="flex items-start w-full mb-2">
            {steps.map((step, index) => {
                const stepNumber = index + 1;
                const isCompleted = stepNumber < currentStep;
                const isCurrent = stepNumber === currentStep;
                const isClickable = stepNumber <= maxVisitedStep && stepNumber !== currentStep;

                return (
                    <li key={step.key} className="flex-1 flex flex-col items-center relative">
                        {index > 0 && (
                            <div
                                className={`absolute top-5 right-1/2 w-full h-0.5 -z-10 ${stepNumber <= maxVisitedStep ? "bg-primary-end" : "bg-gray-200"
                                    }`}
                                aria-hidden="true"
                            />
                        )}
                        <button
                            type="button"
                            disabled={!isClickable}
                            onClick={() => isClickable && onStepClick(stepNumber)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors
                                ${isCurrent
                                    ? "bg-primary-end border-primary-end text-white shadow-md"
                                    : isCompleted
                                        ? "bg-primary-start border-primary-start text-white cursor-pointer hover:opacity-90"
                                        : "bg-white border-gray-300 text-gray-400"
                                }
                                ${isClickable ? "cursor-pointer" : "cursor-default"}`}
                            aria-current={isCurrent ? "step" : undefined}
                        >
                            {isCompleted ? <Check className="w-5 h-5" /> : stepNumber}
                        </button>
                        <span
                            className={`mt-2 text-xs font-semibold text-center px-1 ${isCurrent ? "text-primary-start" : "text-gray-500"
                                }`}
                        >
                            {step.label}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

ProgressSteps.propTypes = {
    steps: PropTypes.arrayOf(
        PropTypes.shape({ key: PropTypes.string.isRequired, label: PropTypes.string.isRequired })
    ).isRequired,
    currentStep: PropTypes.number.isRequired,
    maxVisitedStep: PropTypes.number.isRequired,
    onStepClick: PropTypes.func.isRequired,
};

export default ProgressSteps;
