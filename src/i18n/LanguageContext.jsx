import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import dictionary from "./dictionary";
import { startAutoTranslator, stopAutoTranslator } from "./autoTranslate";

const LanguageContext = createContext({
  lang: "en",
  setLang: () => {},
  toggleLang: () => {},
  t: (s) => s,
  dir: "ltr",
});

const STORAGE_KEY = "rabta.lang";

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "en";
    } catch {
      return "en";
    }
  });

  // Apply <html dir> + <html lang> globally
  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    if (typeof document !== "undefined") {
      document.documentElement.dir = dir;
      document.documentElement.lang = lang;
      document.body && document.body.setAttribute("data-lang", lang);
    }
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  }, [lang]);

  // Drive the runtime DOM auto-translator.
  // It walks text nodes and translates anything not handled by t().
  useEffect(() => {
    if (lang === "ar") {
      startAutoTranslator(dictionary);
    } else {
      stopAutoTranslator();
    }
    return () => stopAutoTranslator();
  }, [lang]);

  const setLang = useCallback((next) => {
    setLangState(next === "ar" ? "ar" : "en");
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === "ar" ? "en" : "ar"));
  }, []);

  // Static translation lookup. If we're in Arabic and the key exists
  // in the dictionary, return it. Otherwise return the source string
  // (the auto-translator will pick it up at the DOM level later).
  const t = useCallback(
    (key) => {
      if (key == null) return key;
      if (typeof key !== "string") return key;
      if (lang === "ar") {
        if (Object.prototype.hasOwnProperty.call(dictionary, key)) {
          return dictionary[key];
        }
        const trimmed = key.trim();
        if (trimmed && Object.prototype.hasOwnProperty.call(dictionary, trimmed)) {
          return dictionary[trimmed];
        }
      }
      return key;
    },
    [lang]
  );

  const value = useMemo(
    () => ({
      lang,
      setLang,
      toggleLang,
      t,
      dir: lang === "ar" ? "rtl" : "ltr",
    }),
    [lang, setLang, toggleLang, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

// Convenience hook
export function useT() {
  return useContext(LanguageContext).t;
}

export default LanguageContext;
