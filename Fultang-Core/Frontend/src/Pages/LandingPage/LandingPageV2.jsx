import { useNavigate } from 'react-router-dom';
import {
    Building2, ShieldCheck, Users, Stethoscope, FlaskConical, Pill,
    Wallet, Boxes, ArrowRight, CheckCircle2, Server, Lock, Globe2,
} from 'lucide-react';
import { APP_NAME_DISPLAY } from '../../constants/branding.js';
import { AppRoutesPaths } from '../../Router/appRouterPaths.js';

/**
 * Nouvelle proposition de landing page — indépendante de la landing
 * actuelle (LandingPage.jsx, conservée telle quelle sur `/`). Simple
 * page de présentation/branding : ne détecte aucun tenant, ne modifie
 * rien à l'architecture multi-tenant. Le bouton principal redirige vers
 * la connexion Platform Admin déjà existante — aucun nouveau système
 * d'authentification.
 */
export function LandingPageV2() {
    const navigate = useNavigate();
    const goToLogin = () => navigate(AppRoutesPaths.platformAdminLoginPage);

    const services = [
        { icon: Stethoscope, title: 'Consultations & Rendez-vous', desc: "Parcours patient complet, de l'accueil à la consultation médicale." },
        { icon: Users, title: 'Gestion du personnel', desc: 'Rôles, plannings et accès pour chaque métier de l\'hôpital.' },
        { icon: FlaskConical, title: 'Laboratoire', desc: 'Prescriptions, prélèvements et résultats centralisés.' },
        { icon: Pill, title: 'Pharmacie', desc: 'Stocks, délivrance et suivi des prescriptions médicamenteuses.' },
        { icon: Wallet, title: 'Caisse & Comptabilité', desc: 'Encaissements, comptabilité financière et comptabilité matière.' },
        { icon: Boxes, title: 'Infrastructures', desc: 'Bâtiments, chambres et capacité d\'accueil de l\'établissement.' },
    ];

    const benefits = [
        { icon: Building2, title: 'Multi-établissements', desc: 'Chaque hôpital dispose de son propre espace, isolé et sécurisé.' },
        { icon: ShieldCheck, title: 'Sécurité & isolation', desc: 'Données cloisonnées par établissement, de bout en bout.' },
        { icon: Server, title: 'Services modulables', desc: 'Chaque établissement active uniquement les services dont il a besoin.' },
        { icon: Globe2, title: 'Accessible partout', desc: 'Une interface web moderne, accessible depuis n\'importe quel poste.' },
    ];

    const stats = [
        { number: '9+', label: 'Établissements' },
        { number: '10+', label: 'Rôles métier gérés' },
        { number: '100%', label: 'Données isolées par hôpital' },
    ];

    return (
        <div className="min-h-screen bg-white">
            {/* Nav */}
            <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-br from-primary-start to-primary-end rounded-xl p-2">
                            <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-black text-secondary tracking-tight">{APP_NAME_DISPLAY}</span>
                    </div>
                    <button
                        onClick={goToLogin}
                        className="px-5 py-2.5 rounded-full bg-secondary text-white text-sm font-semibold hover:opacity-90 transition-all flex items-center gap-2"
                    >
                        Se connecter <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Hero */}
            <section className="relative overflow-hidden bg-gradient-to-br from-primary-start to-primary-end">
                <div className="absolute inset-0 opacity-10" aria-hidden="true">
                    <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white" />
                    <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full bg-white" />
                </div>
                <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-white/15 text-white text-xs font-bold uppercase tracking-widest mb-6">
                        Plateforme de gestion hospitalière
                    </span>
                    <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6">
                        {APP_NAME_DISPLAY}
                    </h1>
                    <p className="text-white/90 text-lg md:text-xl max-w-2xl mx-auto mb-10">
                        Une seule plateforme pour piloter l&apos;accueil, les soins, la pharmacie,
                        le laboratoire et la comptabilité de votre établissement — avec un espace
                        indépendant et sécurisé pour chaque hôpital.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={goToLogin}
                            className="px-8 py-3.5 rounded-full bg-white text-secondary font-bold hover:scale-105 transition-all shadow-xl flex items-center justify-center gap-2"
                        >
                            Se connecter <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="max-w-6xl mx-auto px-6 -mt-10 relative z-10">
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                    {stats.map((s) => (
                        <div key={s.label} className="flex flex-col items-center justify-center py-8 px-4">
                            <span className="text-3xl md:text-4xl font-black text-secondary">{s.number}</span>
                            <span className="text-sm text-gray-500 mt-1 text-center">{s.label}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Services */}
            <section className="max-w-6xl mx-auto px-6 py-20">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-black text-secondary mb-3">Tout l&apos;hôpital, une seule plateforme</h2>
                    <p className="text-gray-500 max-w-xl mx-auto">
                        Chaque service métier de l&apos;établissement, connecté et accessible selon le rôle de chacun.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {services.map((s) => (
                        <div key={s.title} className="p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-all bg-white">
                            <div className="w-11 h-11 rounded-xl bg-primary-start/10 flex items-center justify-center mb-4">
                                <s.icon className="w-5 h-5 text-primary-start" />
                            </div>
                            <h3 className="font-bold text-gray-800 mb-1">{s.title}</h3>
                            <p className="text-sm text-gray-500">{s.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Benefits */}
            <section className="bg-gray-50 py-20">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-black text-secondary mb-3">Pensé pour les établissements hospitaliers</h2>
                        <p className="text-gray-500 max-w-xl mx-auto">
                            Une architecture pensée dès le départ pour accueillir plusieurs hôpitaux, en toute sécurité.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {benefits.map((b) => (
                            <div key={b.title} className="text-center">
                                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary-start to-primary-end flex items-center justify-center mb-4 shadow-md">
                                    <b.icon className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="font-bold text-gray-800 mb-1">{b.title}</h3>
                                <p className="text-sm text-gray-500">{b.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Trust / security strip */}
            <section className="max-w-6xl mx-auto px-6 py-16">
                <div className="rounded-3xl bg-secondary px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/10 rounded-2xl p-3">
                            <Lock className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg">Vos données, isolées et protégées</h3>
                            <p className="text-white/70 text-sm">Chaque établissement dispose de son propre espace, jamais partagé avec un autre.</p>
                        </div>
                    </div>
                    <button
                        onClick={goToLogin}
                        className="px-6 py-3 rounded-full bg-white text-secondary font-bold hover:scale-105 transition-all flex items-center gap-2 whitespace-nowrap"
                    >
                        <CheckCircle2 className="w-4 h-4" /> Accéder à la plateforme
                    </button>
                </div>
            </section>

            <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
                © {new Date().getFullYear()} {APP_NAME_DISPLAY} — Plateforme de gestion hospitalière
            </footer>
        </div>
    );
}

export default LandingPageV2;
