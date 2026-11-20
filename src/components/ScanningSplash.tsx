import React from "react";
import { useTranslation } from "react-i18next";

export type ScanPhase = "catalog" | "installed" | "done";

interface ScanningSplashProps {
  phase: ScanPhase;
  /** True while the splash fades out after scanning has finished. */
  leaving: boolean;
}

/** Full-screen "Scanning" screen shown on launch until the first scan is done. */
export const ScanningSplash: React.FC<ScanningSplashProps> = ({ phase, leaving }) => {
  const { t } = useTranslation();
  const status =
    phase === "catalog" ? t("splash.catalog") : t("splash.installed");

  return (
    <div
      data-tauri-drag-region
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-[#0b0b0c] select-none transition-opacity duration-300 ${
        leaving ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="relative w-40 h-40 pointer-events-none" aria-hidden="true">
        {/* Static track */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="74" fill="none" stroke="#1f1f24" strokeWidth="4" />
        </svg>
        {/* Spinning arcs framing the icon */}
        <svg
          className="absolute inset-0 w-full h-full animate-[gloria-spin_1.2s_linear_infinite]"
          viewBox="0 0 160 160"
        >
          <circle
            cx="80"
            cy="80"
            r="74"
            fill="none"
            stroke="#dc143c"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="120 345"
          />
        </svg>
        <svg
          className="absolute inset-0 w-full h-full animate-[gloria-spin-rev_2.4s_linear_infinite]"
          viewBox="0 0 160 160"
        >
          <circle
            cx="80"
            cy="80"
            r="66"
            fill="none"
            stroke="#f2f1ee"
            strokeOpacity="0.35"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="40 375"
          />
        </svg>
        <img
          src="./gloria-red.png"
          alt=""
          draggable={false}
          className="absolute inset-[22px] w-[116px] h-[116px] rounded-full object-cover"
        />
      </div>

      <div className="flex flex-col items-center gap-2 pointer-events-none">
        <span className="font-display font-extrabold tracking-[0.3em] text-[13px] text-[#f4f4f6]">
          {t("splash.title")}
          <span className="inline-block w-[1.5em] text-left animate-pulse">…</span>
        </span>
        <span className="font-mono-code text-[10px] tracking-[0.16em] uppercase text-[#71717a]">
          {status}
        </span>
      </div>
    </div>
  );
};
