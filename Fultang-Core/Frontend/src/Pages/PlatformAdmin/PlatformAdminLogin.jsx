import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";
import { AppRoutesPaths as appRouterPaths } from "../../Router/appRouterPaths.js";
import { useAuthentication } from "../../Utils/Provider.jsx";

/**
 * Connexion Platform Admin — back-office de la plateforme FullTang.
 *
 * Distincte de la page de connexion du personnel hospitalier
 * (Pages/Authentication/Login.jsx) : pas de tenant, pas de contenu
 * clinique. Réutilise les mêmes tokens visuels (couleurs, boutons,
 * champs, rayons) que le reste de FullTang, dans une mise en page plus
 * sobre, cohérente avec une interface d'administration.
 *
 * Le rôle PLATFORM_ADMIN est vérifié exclusivement côté backend
 * (tenant-service) — voir useAuthentication().loginPlatformAdmin().
 */
export function PlatformAdminLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const { isLoading, setIsLoading, loginPlatformAdmin } = useAuthentication();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");
        setIsLoading(true);

        const response = await loginPlatformAdmin({ email, password });

        if (response && response.success) {
            navigate(appRouterPaths.platformAdminDashboardPage);
        } else {
            setErrorMessage(
                response?.detail || response?.error || "Une erreur inconnue s'est produite"
            );
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-gradient-to-r from-primary-start to-primary-end rounded-2xl p-4 shadow-lg mb-4">
                        <ShieldCheck className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-secondary">ComputeClinic</h1>
                    <p className="text-sm font-semibold uppercase tracking-widest text-gray-400 mt-1">
                        Platform Admin
                    </p>
                </div>

                <div className="bg-white shadow-2xl border-2 rounded-lg p-8">
                    <h2 className="text-xl font-bold text-gray-800 mb-1">Connexion</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Accès réservé à l&apos;administration de la plateforme.
                    </p>

                    {errorMessage && (
                        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600">
                            {errorMessage}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col">
                        <label className="text-sm font-bold text-gray-700 mb-2">Email</label>
                        <div className="bg-gray-100 border border-gray-200 h-12 rounded-lg mb-4">
                            <input
                                type="email"
                                name="email"
                                autoComplete="username"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-12 px-3 rounded-lg bg-gray-100 border-none outline-none focus:outline-none focus:ring-0"
                                placeholder="admin@computeclinic.local"
                            />
                        </div>

                        <label className="text-sm font-bold text-gray-700 mb-2">Mot de passe</label>
                        <div className="bg-gray-100 border border-gray-200 h-12 rounded-lg mb-2 flex items-center relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-12 px-3 pr-10 rounded-lg bg-gray-100 border-none outline-none focus:outline-none focus:ring-0"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-2 p-2 hover:bg-gray-200 rounded-full transition-all duration-300"
                                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                            >
                                {showPassword ? (
                                    <EyeOff className="w-5 h-5 text-gray-500" />
                                ) : (
                                    <Eye className="w-5 h-5 text-gray-500" />
                                )}
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="text-white text-lg bg-gradient-to-r from-primary-start to-primary-end w-full h-12 rounded-lg mt-6 font-bold disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
                        >
                            {isLoading ? "Connexion…" : "Se connecter"}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-gray-400 mt-6">
                    Cette interface est réservée à l&apos;administration de la plateforme ComputeClinic —
                    pas au personnel hospitalier d&apos;un établissement.
                </p>
            </div>
        </div>
    );
}

export default PlatformAdminLogin;
