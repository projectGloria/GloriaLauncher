import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import fr from "./locales/fr.json";
import tr from "./locales/tr.json";
import es from "./locales/es.json";
import appsEn from "./locales/apps/en.json";
import appsFr from "./locales/apps/fr.json";
import appsTr from "./locales/apps/tr.json";
import appsEs from "./locales/apps/es.json";
import type { GloriaAppEntry } from "./types/app";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", locale: "en-US" },
  { code: "fr", label: "Français", locale: "fr-FR" },
  { code: "es", label: "Español", locale: "es-ES" },
  { code: "tr", label: "Türkçe", locale: "tr-TR" },
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
    es: { translation: es },
    tr: { translation: tr },
  },
  lng: initialPref === "auto" ? detectSystemLanguage() : initialPref,
  fallbackLng: "en",
  supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
  load: "languageOnly",
  interpolation: {
    escapeValue: false,
  },
});

type AppTexts = Partial<
  Pick<GloriaAppEntry, "subtitle" | "tagline" | "description">
>;

const APP_TEXTS: Record<LanguageCode, Record<string, AppTexts>> = {
  en: appsEn,
  fr: appsFr,
  es: appsEs,
  tr: appsTr,
};

/**
 * Returns the app with subtitle / tagline / description in the given language.
 * Missing translations fall back to English overrides, then to the catalog text.
 * Repos without a curated tagline reuse their description as tagline, so the
 * translated description stands in for it as well.
 */
export function localizeApp(
  app: GloriaAppEntry,
  lng: string | undefined
): GloriaAppEntry {
  const code: LanguageCode = isSupported(lng) ? lng : "en";
  const texts = { ...APP_TEXTS.en[app.id], ...APP_TEXTS[code][app.id] };
  if (!texts.subtitle && !texts.tagline && !texts.description) return app;
  const taglineMirrorsDescription = app.tagline === app.description;
  return {
    ...app,
    subtitle: texts.subtitle ?? app.subtitle,
    description: texts.description ?? app.description,
    tagline:
      texts.tagline ??
      (taglineMirrorsDescription ? texts.description : undefined) ??
      app.tagline,
  };
}

const syncDocumentLang = (lng: string) => {
  if (typeof document !== "undefined") document.documentElement.lang = lng;
};
syncDocumentLang(i18n.resolvedLanguage || "en");
i18n.on("languageChanged", syncDocumentLang);

export default i18n;
