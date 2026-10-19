import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupportedLanguage, TranslationDictionary } from '../i18n/types';
import { en } from '../i18n/translations/en';
import { fr } from '../i18n/translations/fr';

interface I18nContextType {
  lang: SupportedLanguage;
  setLang: (lang: SupportedLanguage) => void;
  toggleLang: () => void;
  t: TranslationDictionary;
  isFrench: boolean;
}

const dictionaries: Record<SupportedLanguage, TranslationDictionary> = {
  en,
  fr
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = 'dispatch_language';

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'fr') return saved;
      if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr')) {
        return 'fr';
      }
    } catch {
      // fallback
    }
    return 'en';
  });

  const setLang = (newLang: SupportedLanguage) => {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    } catch {
      // ignore
    }
  };

  const toggleLang = () => {
    setLang(lang === 'en' ? 'fr' : 'en');
  };

  useEffect(() => {
    try {
      document.documentElement.lang = lang;
    } catch {
      // ignore
    }
  }, [lang]);

  const value: I18nContextType = {
    lang,
    setLang,
    toggleLang,
    t: dictionaries[lang] || en,
    isFrench: lang === 'fr'
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
