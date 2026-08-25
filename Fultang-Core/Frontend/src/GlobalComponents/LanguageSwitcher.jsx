import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

/**
 * Composant de selection de langue.
 * Permet de basculer entre l'anglais et le francais.
 * La preference est sauvegardee automatiquement dans localStorage.
 */
export function LanguageSwitcher() {
    const { i18n, t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const languages = [
        { code: 'en', name: t('language.english'), flag: '🇬🇧' },
        { code: 'fr', name: t('language.french'), flag: '🇫🇷' }
    ];

    const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

    const changeLanguage = (langCode) => {
        i18n.changeLanguage(langCode);
        setIsOpen(false);
    };

    // Fermer le dropdown si on clique en dehors
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label={t('language.selectLanguage')}
            >
                <Globe className="w-5 h-5 text-gray-600" />
                <span className="text-2xl">{currentLanguage.flag}</span>
                <span className="text-sm font-medium text-gray-700 hidden md:inline">
                    {currentLanguage.name}
                </span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {languages.map((language) => (
                        <button
                            key={language.code}
                            onClick={() => changeLanguage(language.code)}
                            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 transition-colors ${i18n.language === language.code ? 'bg-gray-50' : ''
                                }`}
                        >
                            <span className="text-2xl">{language.flag}</span>
                            <span className="text-sm font-medium text-gray-700">
                                {language.name}
                            </span>
                            {i18n.language === language.code && (
                                <span className="ml-auto text-primary-end">✓</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
