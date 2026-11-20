import React, { useState } from "react";
import { X, KeyRound, RotateCcw, Check, Globe, PanelBottomClose } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isTauriDesktop } from "../services/platformService";
import {
  SUPPORTED_LANGUAGES,
  detectSystemLanguage,
  getLanguagePreference,
  setLanguagePreference,
  type LanguagePreference,
} from "../i18n";

interface SettingsModalProps {
  isOpen: boolean;
  githubToken: string;
  onSaveToken: (token: string) => void;
  onRescan: () => void;
  runInTray: boolean;
  onRunInTrayChange: (enabled: boolean) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  githubToken,
  onSaveToken,
  onRescan,
  runInTray,
  onRunInTrayChange,
  onClose,
}) => {
  const { t } = useTranslation();
  const [tokenInput, setTokenInput] = useState(githubToken);
  const [saved, setSaved] = useState(false);
  const [selectedLanguage, setSelectedLanguage] =
    useState<LanguagePreference>(getLanguagePreference);
  const isDesktop = isTauriDesktop();

  if (!isOpen) return null;

  const handleLanguageChange = (lng: LanguagePreference) => {
    setSelectedLanguage(lng);
    setLanguagePreference(lng);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveToken(tokenInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-lg bg-[#0e0e12] border border-[#282832] shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1f1f26] flex items-center justify-between">
          <div className="font-mono-code text-xs font-bold tracking-[0.18em] text-[#f4f4f6] uppercase">
            {t("settings.title")}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("settings.close")}
            className="w-7 h-7 flex items-center justify-center bg-[#15151b] hover:bg-[#23232c] border border-[#2a2a35] text-[#a1a1aa] hover:text-white cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-5">
          {/* Language Selection */}
          <div>
            <label className="flex items-center gap-1.5 font-mono-code text-[10.5px] font-semibold tracking-[0.14em] text-[#d4d4dc] uppercase mb-2">
              <Globe size={12} className="text-[#00f0ff]" />
              <span>{t("settings.language")}</span>
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => handleLanguageChange(e.target.value as LanguagePreference)}
              className="w-full h-9 bg-[#141419] border border-[#2b2b36] px-3 text-xs text-[#f2f1ee] font-sans focus:outline-none focus:border-[#00f0ff] cursor-pointer"
            >
              <option value="auto">
                {t("settings.languageAuto", {
                  language:
                    SUPPORTED_LANGUAGES.find((l) => l.code === detectSystemLanguage())
                      ?.label ?? "English",
                })}
              </option>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-[#7c7c88] leading-relaxed">
              {t("settings.languageDesc")}
            </p>
          </div>

          {/* Run in tray (desktop only) */}
          {isDesktop && (
            <div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={runInTray}
                  onChange={(e) => onRunInTrayChange(e.target.checked)}
                  className="mt-0.5 w-3.5 h-3.5 accent-[#00f0ff] cursor-pointer"
                />
                <span>
                  <span className="flex items-center gap-1.5 font-mono-code text-[10.5px] font-semibold tracking-[0.14em] text-[#d4d4dc] uppercase">
                    <PanelBottomClose size={12} className="text-[#00f0ff]" />
                    <span>{t("settings.runInTray")}</span>
                  </span>
                  <span className="block mt-1.5 text-[11px] text-[#7c7c88] leading-relaxed">
                    {t("settings.runInTrayDesc")}
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* GitHub Token */}
          <div>
            <label className="flex items-center gap-1.5 font-mono-code text-[10.5px] font-semibold tracking-[0.14em] text-[#d4d4dc] uppercase mb-2">
              <KeyRound size={12} className="text-[#00f0ff]" />
              <span>{t("settings.githubToken")}</span>
            </label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={t("settings.githubTokenPlaceholder")}
              className="w-full h-9 bg-[#141419] border border-[#2b2b36] px-3 text-xs text-[#f2f1ee] placeholder-[#6b6b76] font-mono-code focus:outline-none focus:border-[#00f0ff]"
            />
            <p className="mt-1.5 text-[11px] text-[#7c7c88] leading-relaxed">
              {t("settings.githubTokenHelp")}
            </p>
          </div>

          <div className="pt-3 border-t border-[#1f1f26] flex items-center justify-between">
            {isDesktop ? (
            <button
              type="button"
              onClick={onRescan}
              className="h-8 px-3 bg-[#15151a] hover:bg-[#22222b] border border-[#2b2b36] text-[#a1a1aa] hover:text-white font-mono-code text-[10px] tracking-[0.14em] uppercase flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>{t("settings.rescanWorkspace")}</span>
            </button>
            ) : (
              <span />
            )}

            <button
              type="submit"
              className="h-8 px-4 bg-[#f2f1ee] hover:bg-white text-[#0b0b0c] font-mono-code text-[10.5px] font-bold tracking-[0.16em] uppercase flex items-center gap-1.5 cursor-pointer"
            >
              {saved && <Check size={12} />}
              <span>{saved ? t("settings.saved") : t("settings.save")}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
