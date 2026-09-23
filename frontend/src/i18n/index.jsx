import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { STRINGS, LANGUAGES } from './strings.js';

const STORAGE_KEY = 'celverkenner:taal';
const DEFAULT = 'nl';
const isLang = (code) => LANGUAGES.some((language) => language.code === code);

/** ?lang=en in the address wins, then the remembered choice, then Dutch. */
function initialLanguage() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (isLang(fromUrl)) return fromUrl;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // Private mode without storage: fall through.
  }
  return DEFAULT;
}

// Read by api.js, which lives outside React.
let currentLanguage = initialLanguage();
export const getLanguage = () => currentLanguage;

const LanguageContext = createContext({ lang: DEFAULT, setLang: () => {}, t: (key) => key });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(currentLanguage);

  const setLang = useCallback((code) => {
    if (!isLang(code)) return;
    currentLanguage = code;
    setLangState(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key, vars) => {
      let text = STRINGS[lang][key] ?? STRINGS[DEFAULT][key] ?? key;
      if (vars) for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
      return text;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLang = () => useContext(LanguageContext);
export const LanguageContextConsumer = LanguageContext.Consumer;
export { LANGUAGES };
