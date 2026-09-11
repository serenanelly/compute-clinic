import React from 'react';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';

export const ConfirmSaveParameters = ({ isOpen, onClose, onConfirm, parameters, patientName, isSaving = false }) => {
    if (!isOpen) return null;

    const formatValue = (key, value) => {
        if (!value) return "Non renseigné";
        switch (key) {
            case 'poids': return `${value} kg`;
            case 'taille': return `${value} cm`;
            case 'pouls': return `${value} bpm`;
            case 'taux_oxygene': return `${value} %`;
            case 'temperature': return `${value} °C`;
            case 'tension_arterielle': return `${value} mmHg`;
            default: return value;
        }
    };

    const labels = {
        groupe_sanguin: "Groupe Sanguin",
        facteur_rhesus: "Facteur Rhésus",
        electrophorese_hb: "Électrophorèse Hb",
        poids: "Poids",
        taille: "Taille",
        pouls: "Pouls",
        taux_oxygene: "Taux d'Oxygène (SpO2)",
        temperature: "Température",
        tension_arterielle: "Tension Artérielle",
        allergies: "Allergies"
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-primary-start to-primary-end px-6 py-4 flex justify-between items-center text-white">
                    <div className="flex items-center space-x-2">
                        <CheckCircle className="w-6 h-6" />
                        <h2 className="text-xl font-bold">Confirmer les données</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <div className="flex items-start p-4 mb-6 text-orange-800 bg-orange-50 rounded-lg border border-orange-200">
                        <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                        <p className="text-sm">
                            Veuillez vérifier les informations cliniques pour le patient <strong>{patientName}</strong> avant de les valider.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-semibold text-gray-700 border-b pb-2 mb-3 text-sm uppercase tracking-wider">Récapitulatif</h3>
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            {Object.entries(parameters).map(([key, value]) => {
                                if (!labels[key]) return null;
                                return (
                                    <div key={key} className={key === 'allergies' ? "col-span-2" : "col-span-1"}>
                                        <div className="text-[10px] text-gray-500 uppercase tracking-widest">{labels[key]}</div>
                                        <div className="font-medium text-gray-900 bg-gray-50 p-2 rounded border border-gray-100 mt-0.5 text-sm">
                                            {formatValue(key, value)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
                    >
                        Corriger
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isSaving}
                        className="px-6 py-2 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-lg font-bold hover:opacity-90 shadow-sm hover:shadow-md transition-all duration-300 disabled:opacity-60"
                    >
                        {isSaving ? 'Enregistrement…' : 'Confirmer'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmSaveParameters;
