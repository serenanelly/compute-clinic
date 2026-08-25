import { useState } from 'react';
import { Modal, message } from 'antd';
import { Eye, EyeOff, Lock, AlertCircle } from 'lucide-react';
import { changePassword } from '../services/personnelApi';

/**
 * Modal de changement de mot de passe.
 * Utilisé pour la première connexion et dans les paramètres.
 * 
 * @param {boolean} isOpen - État d'ouverture du modal
 * @param {function} onClose - Callback de fermeture
 * @param {boolean} isFirstLogin - Si true, affiche un message spécial première connexion
 * @param {function} onSuccess - Callback après changement réussi
 */
export function ChangePasswordModal({ isOpen, onClose, isFirstLogin = false, onSuccess }) {
    const [formData, setFormData] = useState({
        old_password: '',
        new_password: '',
        confirm_password: ''
    });
    const [showPasswords, setShowPasswords] = useState({
        old: false,
        new: false,
        confirm: false
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const validatePassword = (password) => {
        const errors = [];
        if (password.length < 8) errors.push('Au moins 8 caractères');
        if (!/[A-Z]/.test(password)) errors.push('Au moins une majuscule');
        if (!/[a-z]/.test(password)) errors.push('Au moins une minuscule');
        if (!/[0-9]/.test(password)) errors.push('Au moins un chiffre');
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Au moins un caractère spécial');
        return errors;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Validation en temps réel pour le nouveau mot de passe
        if (name === 'new_password') {
            const passwordErrors = validatePassword(value);
            setErrors(prev => ({ ...prev, new_password: passwordErrors.length > 0 ? passwordErrors : null }));
        }

        // Vérifier si les mots de passe correspondent
        if (name === 'confirm_password' || name === 'new_password') {
            const confirmValue = name === 'confirm_password' ? value : formData.confirm_password;
            const newValue = name === 'new_password' ? value : formData.new_password;
            if (confirmValue && newValue !== confirmValue) {
                setErrors(prev => ({ ...prev, confirm_password: 'Les mots de passe ne correspondent pas' }));
            } else {
                setErrors(prev => ({ ...prev, confirm_password: null }));
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation finale
        const passwordErrors = validatePassword(formData.new_password);
        if (passwordErrors.length > 0) {
            setErrors(prev => ({ ...prev, new_password: passwordErrors }));
            return;
        }

        if (formData.new_password !== formData.confirm_password) {
            setErrors(prev => ({ ...prev, confirm_password: 'Les mots de passe ne correspondent pas' }));
            return;
        }

        if (!formData.old_password) {
            setErrors(prev => ({ ...prev, old_password: 'Ancien mot de passe requis' }));
            return;
        }

        setLoading(true);
        try {
            // Inclure l'email de l'utilisateur connecté (requis par le backend)
            const savedUserData = localStorage.getItem("user_data_fultang");
            const userEmail = savedUserData ? JSON.parse(savedUserData).email : '';
            await changePassword({ ...formData, email: userEmail });
            message.success('Mot de passe modifié avec succès!');
            setFormData({ old_password: '', new_password: '', confirm_password: '' });
            setErrors({});
            if (onSuccess) onSuccess();
            if (!isFirstLogin) onClose();
        } catch (error) {
            console.log('Password change error response:', error.response?.data);

            // Récupérer toutes les erreurs possibles
            const responseData = error.response?.data || {};
            let errorMessage = responseData.detail || responseData.error || 'Erreur lors du changement de mot de passe';

            // Afficher les erreurs de validation spécifiques
            if (responseData.erreurs) {
                const erreurs = responseData.erreurs;
                if (erreurs.old_password) {
                    setErrors(prev => ({ ...prev, old_password: Array.isArray(erreurs.old_password) ? erreurs.old_password.join(', ') : erreurs.old_password }));
                }
                if (erreurs.new_password) {
                    const newPwdErrors = Array.isArray(erreurs.new_password) ? erreurs.new_password : [erreurs.new_password];
                    setErrors(prev => ({ ...prev, new_password: newPwdErrors }));
                    errorMessage = 'Le nouveau mot de passe ne respecte pas les critères de sécurité';
                }
                if (erreurs.confirm_password) {
                    setErrors(prev => ({ ...prev, confirm_password: Array.isArray(erreurs.confirm_password) ? erreurs.confirm_password.join(', ') : erreurs.confirm_password }));
                }
            }

            message.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const toggleShowPassword = (field) => {
        setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
    };

    return (
        <Modal
            open={isOpen}
            onCancel={isFirstLogin ? null : onClose}
            footer={null}
            closable={!isFirstLogin}
            maskClosable={!isFirstLogin}
            width={500}
            centered
        >
            <div className="p-2">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-r from-primary-start to-primary-end rounded-full flex items-center justify-center mb-4">
                        <Lock className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">
                        {isFirstLogin ? 'Première connexion' : 'Modifier le mot de passe'}
                    </h2>
                    {isFirstLogin && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center gap-2 text-yellow-700">
                                <AlertCircle className="w-5 h-5" />
                                <span className="text-sm font-medium">
                                    Vous devez choisir un nouveau mot de passe pour continuer.
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Ancien mot de passe */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Ancien mot de passe
                        </label>
                        <div className="relative">
                            <input
                                type={showPasswords.old ? 'text' : 'password'}
                                name="old_password"
                                value={formData.old_password}
                                onChange={handleChange}
                                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-end ${errors.old_password ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                placeholder="Entrez votre ancien mot de passe"
                            />
                            <button
                                type="button"
                                onClick={() => toggleShowPassword('old')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                                {showPasswords.old ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {errors.old_password && (
                            <p className="mt-1 text-sm text-red-500">{errors.old_password}</p>
                        )}
                    </div>

                    {/* Nouveau mot de passe */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nouveau mot de passe
                        </label>
                        <div className="relative">
                            <input
                                type={showPasswords.new ? 'text' : 'password'}
                                name="new_password"
                                value={formData.new_password}
                                onChange={handleChange}
                                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-end ${errors.new_password ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                placeholder="Choisissez un mot de passe robuste"
                            />
                            <button
                                type="button"
                                onClick={() => toggleShowPassword('new')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                                {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {errors.new_password && Array.isArray(errors.new_password) && (
                            <div className="mt-1 text-sm text-red-500">
                                {errors.new_password.map((err, i) => (
                                    <p key={i}>• {err}</p>
                                ))}
                            </div>
                        )}
                        {/* Indicateur de force */}
                        <div className="mt-2 text-xs text-gray-500">
                            <p>Le mot de passe doit contenir :</p>
                            <ul className="list-disc pl-5 mt-1 space-y-0.5">
                                <li className={formData.new_password.length >= 8 ? 'text-green-600' : ''}>
                                    Au moins 8 caractères
                                </li>
                                <li className={/[A-Z]/.test(formData.new_password) ? 'text-green-600' : ''}>
                                    Au moins une majuscule
                                </li>
                                <li className={/[a-z]/.test(formData.new_password) ? 'text-green-600' : ''}>
                                    Au moins une minuscule
                                </li>
                                <li className={/[0-9]/.test(formData.new_password) ? 'text-green-600' : ''}>
                                    Au moins un chiffre
                                </li>
                                <li className={/[!@#$%^&*(),.?":{}|<>]/.test(formData.new_password) ? 'text-green-600' : ''}>
                                    Au moins un caractère spécial
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Confirmer mot de passe */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Confirmer le mot de passe
                        </label>
                        <div className="relative">
                            <input
                                type={showPasswords.confirm ? 'text' : 'password'}
                                name="confirm_password"
                                value={formData.confirm_password}
                                onChange={handleChange}
                                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-end ${errors.confirm_password ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                placeholder="Confirmez votre nouveau mot de passe"
                            />
                            <button
                                type="button"
                                onClick={() => toggleShowPassword('confirm')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                                {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {errors.confirm_password && (
                            <p className="mt-1 text-sm text-red-500">{errors.confirm_password}</p>
                        )}
                    </div>

                    {/* Boutons */}
                    <div className="flex gap-3 pt-4">
                        {!isFirstLogin && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                            >
                                Annuler
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className={`${isFirstLogin ? 'w-full' : 'flex-1'} py-3 px-4 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50`}
                        >
                            {loading ? 'Modification...' : 'Confirmer'}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
}

export default ChangePasswordModal;
