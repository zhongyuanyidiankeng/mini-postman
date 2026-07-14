import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import zh from "./zh.json";

const LANGUAGE_STORAGE_KEY = "mini-postman:language";
const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
const initialLanguage =
  storedLanguage === "zh" || storedLanguage === "en"
    ? storedLanguage
    : navigator.language.startsWith("zh")
      ? "zh"
      : "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (language) => {
  localStorage.setItem(
    LANGUAGE_STORAGE_KEY,
    language.startsWith("zh") ? "zh" : "en"
  );
});

export default i18n;
