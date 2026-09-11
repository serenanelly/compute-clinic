import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { LogOut, User, Globe } from 'lucide-react';
import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuthentication } from '../Utils/Provider.jsx';
import userIcon from '../assets/userIcon.png';
import { APP_NAME } from '../constants/branding.js';

/**
 * Header applicatif partagé (généralisé depuis la vue caissier).
 * Utilisé par toutes les vues pour un rendu homogène : sous-titre, titre de page,
 * horloge, sélecteur de langue, utilisateur connecté, profil et déconnexion.
 *
 * Props :
 * - subtitle : libellé court (ex. « Caisse », « Direction »…)
 * - title : titre de page explicite (prioritaire)
 * - titleResolver : fonction (pathname) => titre, utilisée si `title` absent
 * - rightSlot : contenu optionnel spécifique à la vue, affiché à droite (ex. badge caisse)
 */
export function AppHeader({ subtitle = APP_NAME, title, titleResolver, rightSlot = null }) {
    const { logout, userData } = useAuthentication();
    const { i18n } = useTranslation();
    const location = useLocation();
    const [now, setNow] = useState(() => new Date());
    const [langOpen, setLangOpen] = useState(false);
    const langRef = useRef(null);

    const pageTitle = title || (titleResolver ? titleResolver(location.pathname) : '') || subtitle;
    const userName = userData?.prenom
        ? `${userData.prenom} ${userData.nom || ''}`.trim()
        : (userData?.nom || userData?.username || 'Utilisateur');

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const onClick = (e) => {
            if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const languages = [
        { code: 'fr', flag: '🇫🇷', name: 'Français' },
        { code: 'en', flag: '🇬🇧', name: 'English' },
    ];
    const currentLang = languages.find((l) => l.code === i18n.language) || languages[0];

    const dateLabel = now.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const timeLabel = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return (
        <header className="sticky top-0 z-20 bg-primary-start shadow-md border-b-4 border-primary-end">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70 m-0">
                        {APP_NAME} · {subtitle}
                    </p>
                    <h2 className="text-base font-bold text-white m-0 truncate sm:text-lg">{pageTitle}</h2>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    {rightSlot}

                    {/* Sélecteur de langue (disponible sur toutes les vues) */}
                    <div className="relative" ref={langRef}>
                        <button
                            type="button"
                            onClick={() => setLangOpen((v) => !v)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/15 px-2.5 py-1.5 text-white hover:bg-white/25 transition-colors"
                            aria-label="Changer de langue"
                        >
                            <Globe size={14} />
                            <span className="text-base leading-none">{currentLang.flag}</span>
                            <span className="hidden sm:inline text-xs font-semibold uppercase">{currentLang.code}</span>
                        </button>
                        {langOpen && (
                            <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                {languages.map((language) => (
                                    <button
                                        key={language.code}
                                        type="button"
                                        onClick={() => { i18n.changeLanguage(language.code); setLangOpen(false); }}
                                        className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 transition-colors ${i18n.language === language.code ? 'bg-gray-50' : ''}`}
                                    >
                                        <span className="text-xl">{language.flag}</span>
                                        <span className="text-sm font-medium text-gray-700">{language.name}</span>
                                        {i18n.language === language.code && <span className="ml-auto text-primary-end">✓</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="hidden text-right sm:block" aria-live="polite">
                        <p className="text-xs text-white/70 m-0 capitalize">{dateLabel}</p>
                        <p className="text-sm font-semibold text-white m-0 tabular-nums">{timeLabel}</p>
                    </div>

                    <div className="flex items-center gap-2 border-l border-white/25 pl-3">
                        <div className="hidden md:block text-right">
                            <p className="text-xs text-white/70 m-0">Connecté</p>
                            <p className="text-sm font-semibold text-white m-0 max-w-[140px] truncate">{userName}</p>
                        </div>
                        <img
                            src={userIcon}
                            alt=""
                            className="h-9 w-9 rounded-full border-2 border-white/50 object-cover"
                        />
                        <Tooltip title="Mon profil">
                            <button
                                type="button"
                                className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg border border-white/30 bg-white/15 text-white hover:bg-white/25 transition-colors"
                                aria-label="Profil utilisateur"
                            >
                                <User size={16} />
                            </button>
                        </Tooltip>
                        <Tooltip title="Se déconnecter">
                            <button
                                type="button"
                                onClick={() => logout()}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/30 bg-white/15 text-white hover:bg-red-500/80 hover:border-red-300 transition-colors"
                                aria-label="Se déconnecter"
                            >
                                <LogOut size={16} />
                            </button>
                        </Tooltip>
                    </div>
                </div>
            </div>
        </header>
    );
}

export default AppHeader;
