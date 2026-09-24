import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { zh } from '../i18n/zh';
import { en } from '../i18n/en';

export type SupportedLang = 'zh' | 'en';

interface I18nContextType {
  lang: SupportedLang;
  setLang: (lang: SupportedLang) => void;
  toggleLang: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const dictionaries: Record<SupportedLang, any> = {
  zh,
  en,
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<SupportedLang>(() => {
    const saved = localStorage.getItem('classqna_lang');
    if (saved === 'zh' || saved === 'en') {
      return saved;
    }
    // Auto-detect browser language
    return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  });

  useEffect(() => {
    localStorage.setItem('classqna_lang', lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-TW' : 'en';
  }, [lang]);

  const setLang = (l: SupportedLang) => {
    setLangState(l);
  };

  const toggleLang = () => {
    setLangState((prev) => (prev === 'zh' ? 'en' : 'zh'));
  };

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const keys = key.split('.');
      let result: any = dictionaries[lang];

      for (const k of keys) {
        if (result && typeof result === 'object' && k in result) {
          result = result[k];
        } else {
          // Fallback to Chinese dictionary if key is missing in English
          let fallback: any = dictionaries['zh'];
          for (const fk of keys) {
            if (fallback && typeof fallback === 'object' && fk in fallback) {
              fallback = fallback[fk];
            } else {
              fallback = null;
              break;
            }
          }
          result = fallback || key;
          break;
        }
      }

      if (typeof result !== 'string') {
        return key;
      }

      if (params) {
        return Object.entries(params).reduce((str, [pKey, pVal]) => {
          return str.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
        }, result);
      }

      return result;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
