import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import fr from "./locales/fr.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", locale: "en-US" },
  { code: "fr", label: "Français", locale: "fr-FR" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];
export type LanguagePreference = LanguageCode | "auto";

export const LANGUAGE_STORAGE_KEY = "gloria_launcher_lng";

const isSupported = (code: string | null | undefined): code is LanguageCode =>
  SUPPORTED_LANGUAGES.some((l) => l.code === code);

/** Best match for the OS / browser languages, falling back to English. */
export function detectSystemLanguage(): LanguageCode {
  const candidates =
    typeof navigator !== "undefined"
      ? [...(navigator.languages || []), navigator.language]
      : [];
  for (const tag of candidates) {
    const base = tag?.toLowerCase().split("-")[0];
    if (isSupported(base)) return base;
  }
  return "en";
}

/** The stored user choice; "auto" when the user follows the system language. */
export function getLanguagePreference(): LanguagePreference {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupported(stored)) return stored;
  } catch {
    // Storage unavailable
  }
  return "auto";
}

export function setLanguagePreference(pref: LanguagePreference): void {
  try {
    if (pref === "auto") localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    else localStorage.setItem(LANGUAGE_STORAGE_KEY, pref);
  } catch {
    // Storage unavailable: the change still applies for this session
  }
  void i18n.changeLanguage(pref === "auto" ? detectSystemLanguage() : pref);
}

/** BCP-47 locale for Intl date/number formatting of the active language. */
export function activeLocale(): string {
  return (
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.resolvedLanguage)?.locale ??
    "en-US"
  );
}

const initialPref = getLanguagePreference();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
  lng: initialPref === "auto" ? detectSystemLanguage() : initialPref,
  fallbackLng: "en",
  supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
  load: "languageOnly",
  interpolation: {
    escapeValue: false,
  },
});

const syncDocumentLang = (lng: string) => {
  if (typeof document !== "undefined") document.documentElement.lang = lng;
};
syncDocumentLang(i18n.resolvedLanguage || "en");
i18n.on("languageChanged", syncDocumentLang);

export default i18n;
