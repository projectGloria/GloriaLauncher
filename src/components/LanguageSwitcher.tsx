import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  SUPPORTED_LANGUAGES,
  detectSystemLanguage,
  getLanguagePreference,
  setLanguagePreference,
  type LanguageCode,
  type LanguagePreference,
} from "../i18n";

/** Inline SVG flags (emoji flags don't render on Windows). */
export const LanguageFlag: React.FC<{ code: LanguageCode; className?: string }> = ({
  code,
  className = "w-[18px] h-3",
}) => {
  if (code === "es") {
    return (
      <svg viewBox="0 0 3 2" className={className} aria-hidden="true">
        <rect width="3" height="2" fill="#AA151B" />
        <rect y="0.5" width="3" height="1" fill="#F1BF00" />
      </svg>
    );
  }
  if (code === "tr") {
    return (
      <svg viewBox="0 0 1200 800" className={className} aria-hidden="true">
        <rect width="1200" height="800" fill="#E30A17" />
        <circle cx="425" cy="400" r="200" fill="#fff" />
        <circle cx="475" cy="400" r="160" fill="#E30A17" />
        <polygon
          fill="#fff"
          points="583.334,400 764.235,458.779 652.431,304.894 652.431,495.106 764.235,341.221"
        />
      </svg>
    );
  }
  if (code === "fr") {
    return (
      <svg viewBox="0 0 3 2" className={className} aria-hidden="true">
        <rect width="1" height="2" x="0" fill="#0055A4" />
        <rect width="1" height="2" x="1" fill="#FFFFFF" />
        <rect width="1" height="2" x="2" fill="#EF4135" />
      </svg>
    );
  }
  // English: United Kingdom
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden="true">
      <clipPath id="gl-uk-s">
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id="gl-uk-t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath="url(#gl-uk-s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path
          d="M0,0 L60,30 M60,0 L0,30"
          clipPath="url(#gl-uk-t)"
          stroke="#C8102E"
          strokeWidth="4"
        />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
};

export const LanguageSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pref, setPref] = useState<LanguagePreference>(getLanguagePreference);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = (SUPPORTED_LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ??
    SUPPORTED_LANGUAGES[0]) as (typeof SUPPORTED_LANGUAGES)[number];
  const systemLang = SUPPORTED_LANGUAGES.find((l) => l.code === detectSystemLanguage());

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Keep in sync when the language is changed from the Settings modal.
  useEffect(() => {
    const sync = () => setPref(getLanguagePreference());
    i18n.on("languageChanged", sync);
    return () => i18n.off("languageChanged", sync);
  }, [i18n]);

  const choose = (next: LanguagePreference) => {
    setLanguagePreference(next);
    setPref(next);
    setOpen(false);
  };

  const itemClass =
    "w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs text-[#d4d4dc] hover:bg-[#1c1c22] hover:text-white cursor-pointer";

  return (
    <div ref={rootRef} className="relative h-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t("titlebar.language")}: ${active.label}`}
        title={t("titlebar.language")}
        className="h-full flex items-center gap-1.5 px-3 border-l border-[#1f1f24] text-[#8a8a96] hover:text-white hover:bg-[#141418] transition-colors cursor-pointer"
      >
        <LanguageFlag code={active.code} className="w-[18px] h-3 ring-1 ring-white/10" />
        <span className="font-mono-code text-[10px] tracking-[0.14em] uppercase">
          {active.code}
        </span>
        <ChevronDown size={10} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("titlebar.language")}
          className="absolute right-0 top-full mt-px z-50 w-52 bg-[#101014] border border-[#2a2a33] shadow-2xl py-1"
        >
          <button
            type="button"
            role="option"
            aria-selected={pref === "auto"}
            onClick={() => choose("auto")}
            className={itemClass}
          >
            <Monitor size={12} className="w-[18px] text-[#8a8a96]" />
            <span className="flex-1 truncate">
              {t("settings.languageAuto", { language: systemLang?.label ?? "English" })}
            </span>
            {pref === "auto" && <Check size={12} className="text-[#00f0ff]" />}
          </button>
          <div className="my-1 border-t border-[#1f1f26]" />
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="option"
              aria-selected={pref === lang.code}
              onClick={() => choose(lang.code)}
              className={itemClass}
            >
              <LanguageFlag code={lang.code} className="w-[18px] h-3 ring-1 ring-white/10" />
              <span className="flex-1">{lang.label}</span>
              {pref === lang.code && <Check size={12} className="text-[#00f0ff]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
