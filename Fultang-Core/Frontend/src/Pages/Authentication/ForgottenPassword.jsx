"use client";
import { useState } from 'react';
import { ArrowLeft, Send, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import axiosInstance from "../../Utils/axiosInstance.js";
import loginBackground from "../../assets/logIn.png";
import axios from "axios";
import { getGatewayBaseUrl } from "../../Utils/gatewayUrls";

export function ForgottenPassword() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Les mots de passe ne correspondent pas.");
            return;
        }

        // Vérification si le mot de passe est trop commun
        const commonPasswords = [
            "password", "123456", "12345678", "qwerty", "abc123",
            "monkey", "letmein", "111111", "1234", "12345", "dragon"
        ];
        if (commonPasswords.includes(password.toLowerCase())) {
            setError("Ce mot de passe est trop commun, veuillez en choisir un autre.");
            return;
        }

        setLoading(true);
        setError("");
        try {
            // getGatewayBaseUrl() cible le hostname courant (résolution de
            // tenant par sous-domaine) — un env var statique enverrait cet
            // appel vers un hostname fixe au lieu du tenant réellement
            // ouvert dans le navigateur.
            const gatewayURL = getGatewayBaseUrl();
            const response = await axios.post(
                `${gatewayURL}/personnel/personnel/reset-password/`,
                {
                    email: email,
                    password: password,
                    password_confirmation: confirmPassword
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
            if (response.status === 200 || response.status === 201) {
                setIsSubmitted(true);
            }
        } catch (err) {
            console.error(err);
            setError("Erreur lors de la réinitialisation du mot de passe.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="flex flex-col min-h-screen bg-cover bg-center"
            style={{
                backgroundImage: `url(${loginBackground})`,
                height: "100vh",
                backgroundSize: "cover",
                backgroundRepeat: "no-repeat",
            }}
        >
            <Link to="/" className="text-3xl text-white font-bold mt-6 ml-8">
                FullTang
            </Link>
            <div className="flex-1 flex items-center justify-center px-4">
                <div className="bg-white bg-opacity-95 shadow-2xl border-2 w-full max-w-5xl rounded-lg overflow-hidden flex">
                    <div className="w-1/2 p-8 bg-gradient-to-br from-primary-start to-primary-end text-white">
                        <h2 className="text-4xl font-bold mb-6">Réinitialiser votre mot de passe</h2>
                        <p className="text-lg mb-6">
                            Remplissez les champs ci-contre pour mettre à jour votre mot de passe.
                        </p>
                        <div className="mb-8">
                            <Lock className="w-20 h-20 mx-auto mb-4" />
                            <p className="text-center">
                                Sécurisez votre compte en créant un nouveau mot de passe.
                            </p>
                        </div>
                        <div className="bg-white bg-opacity-20 p-4 rounded-lg">
                            <h3 className="font-bold mb-2">Conseils:</h3>
                            <ul className="list-disc list-inside">
                                <li>Utilisez une adresse email valide</li>
                                <li>Le mot de passe doit contenir au moins 8 caractères</li>
                                <li>Ne partagez jamais votre mot de passe</li>
                            </ul>
                        </div>
                    </div>
                    <div className="w-1/2 p-8">
                        <h3 className="text-2xl font-bold mb-6 text-gray-800">Réinitialiser le Mot de Passe</h3>
                        {!isSubmitted ? (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label htmlFor="email" className="text-md font-bold block mb-2 text-gray-700">
                                        Adresse Email
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        placeholder="Entrez votre email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full bg-gray-100 border border-gray-300 rounded-md py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-start focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="password" className="text-md font-bold block mb-2 text-gray-700">
                                        Nouveau Mot de Passe
                                    </label>
                                    <input
                                        id="password"
                                        type="password"
                                        placeholder="Entrez votre nouveau mot de passe"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full bg-gray-100 border border-gray-300 rounded-md py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-start focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="confirmPassword" className="text-md font-bold block mb-2 text-gray-700">
                                        Confirmer le Mot de Passe
                                    </label>
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        placeholder="Confirmez votre nouveau mot de passe"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className="w-full bg-gray-100 border border-gray-300 rounded-md py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-start focus:border-transparent"
                                    />
                                </div>
                                {error && <p className="text-red-500 text-sm">{error}</p>}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-primary-start to-primary-end hover:from-primary-end hover:to-primary-start text-white font-bold py-2 px-4 rounded-md transition-all duration-300 flex items-center justify-center"
                                >
                                    {loading ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                                    ) : (
                                        <Send className="mr-2 h-4 w-4" />
                                    )}
                                    Réinitialiser
                                </button>
                            </form>
                        ) : (
                            <div className="text-center p-6 bg-green-100 rounded-lg">
                                <p className="text-xl mb-4 text-green-800 font-bold">
                                    Mot de passe réinitialisé!
                                </p>
                                <p className="text-gray-600">
                                    Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter.
                                </p>
                            </div>
                        )}
                        <div className="mt-6">
                            <Link
                                to="/login"
                                className="text-primary-start hover:text-primary-end transition-colors duration-300 flex items-center"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Retour à la connexion
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
