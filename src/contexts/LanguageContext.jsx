// Dil yönetimi için Context
import { createContext, useContext, useState, useEffect } from "react";
import trTranslations from "../locales/tr.json";
import enTranslations from "../locales/en.json";

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  // localStorage'dan dil tercihini al (varsayılan: Türkçe)
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem("language");
    return savedLanguage || "tr";
  });

  // Çeviri dosyaları
  const translations = {
    tr: trTranslations,
    en: enTranslations,
  };

  // Dil değiştirme fonksiyonu
  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem("language", lang);
  };

  // Çeviri fonksiyonu (nested key desteği: "common.loading")
  const t = (key) => {
    const keys = key.split(".");
    let value = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === "object") {
        value = value[k];
      } else {
        return key; // Key bulunamazsa key'i döndür
      }
    }
    
    return value || key;
  };

  // Dil değiştiğinde localStorage'a kaydet
  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
