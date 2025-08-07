"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  Language,
  detectLanguage,
  getTranslation,
  Translations,
} from "../lib/i18n";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [t, setTranslations] = useState<Translations>(getTranslation("en"));

  // 初始化语言
  useEffect(() => {
    const detectedLang = detectLanguage();
    setLanguageState(detectedLang);
    setTranslations(getTranslation(detectedLang));
  }, []);

  // 切换语言
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    setTranslations(getTranslation(lang));
    // 保存到localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("preferred-language", lang);
    }
  };

  // 切换中英文
  const toggleLanguage = () => {
    const newLang = language === "zh" ? "en" : "zh";
    setLanguage(newLang);
  };

  // 从localStorage恢复语言设置
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem("preferred-language") as Language;
      if (savedLang && (savedLang === "zh" || savedLang === "en")) {
        setLanguageState(savedLang);
        setTranslations(getTranslation(savedLang));
      }
    }
  }, []);

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, t, toggleLanguage }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
