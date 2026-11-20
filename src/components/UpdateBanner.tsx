import React, { useEffect, useState } from "react";
import { ArrowUpRight, Download, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DownloadProgressPayload } from "../types/app";
import {
  LAUNCHER_UPDATE_PROGRESS_ID,
  checkLauncherUpdate,
  installLauncherUpdate,
  isTauriDesktop,
  openExternalUrl,
  type LauncherUpdateInfo,
} from "../services/platformService";

const RECHECK_INTERVAL_MS = 30 * 60 * 1000; // every 30 minutes while open
const FOCUS_RECHECK_MIN_MS = 5 * 60 * 1000; // at most every 5 minutes on focus
const DISMISSED_KEY = "gloria_launcher_update_dismissed";

function readDismissed(): string | null {
  try {
    return sessionStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

interface UpdateBannerProps {
  onError: (message: string) => void;
}

/** Desktop only: tells the user when a newer GloriaLauncher release exists and installs it. */
export const UpdateBanner: React.FC<UpdateBannerProps> = ({ onError }) => {
  const { t } = useTranslation();
  const [update, setUpdate] = useState<LauncherUpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(readDismissed);
  const [installing, setInstalling] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);

  useEffect(() => {
    if (!isTauriDesktop()) return;
    let cancelled = false;
    let lastCheck = 0;
    const check = () => {
      lastCheck = Date.now();
      checkLauncherUpdate().then((info) => {
        if (!cancelled) setUpdate(info);
      });
    };
    // Coming back to the window re-checks, so a release published while the
    // launcher sat open shows up without waiting for the next interval.
    const onFocus = () => {
      if (Date.now() - lastCheck >= FOCUS_RECHECK_MIN_MS) check();
    };
    check();
    const timer = window.setInterval(check, RECHECK_INTERVAL_MS);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!installing) return;
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<DownloadProgressPayload>("download-progress", (event) => {
          if (event.payload.appId === LAUNCHER_UPDATE_PROGRESS_ID) {
            setPercent(event.payload.percent);
          }
        })
      )
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});
    return () => unlisten?.();
  }, [installing]);

  if (!update || dismissed === update.latestVersion) return null;

  const handleInstall = async () => {
    setInstalling(true);
    setPercent(0);
    try {
      // On success the installer starts and the launcher closes itself.
      await installLauncherUpdate(update);
    } catch (err) {
      setInstalling(false);
      setPercent(null);
      onError(t("update.failed", { error: String(err) }));
    }
  };

  const handleDismiss = () => {
    setDismissed(update.latestVersion);
    try {
      sessionStorage.setItem(DISMISSED_KEY, update.latestVersion);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-[#0f1a12] border-b border-[#1f3a26] text-[12px]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] shrink-0" />
      <p className="flex-1 min-w-0 truncate text-[#d4f5dd]">
        {t("update.available", {
          latest: update.latestVersion,
          current: update.currentVersion,
        })}
      </p>

      <button
        type="button"
        onClick={() => openExternalUrl(update.releaseUrl)}
        className="flex items-center gap-1 font-mono-code text-[10px] tracking-[0.14em] uppercase text-[#86c49a] hover:text-white transition-colors cursor-pointer shrink-0"
      >
        {t("update.whatsNew")}
        <ArrowUpRight size={11} />
      </button>

      <button
        type="button"
        disabled={installing}
        onClick={handleInstall}
        className="h-7 px-3 flex items-center gap-1.5 bg-[#f2f1ee] hover:bg-white text-[#0b0b0c] font-mono-code text-[10px] font-bold tracking-[0.16em] uppercase transition-colors cursor-pointer disabled:opacity-70 shrink-0"
      >
        {installing ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            {percent !== null && percent >= 100
              ? t("update.starting")
              : `${Math.round(percent ?? 0)}%`}
          </>
        ) : (
          <>
            <Download size={12} />
            {t("update.install")}
          </>
        )}
      </button>

      {!installing && (
        <button
          type="button"
          onClick={handleDismiss}
          title={t("update.later")}
          aria-label={t("update.later")}
          className="w-7 h-7 flex items-center justify-center text-[#86c49a] hover:text-white transition-colors cursor-pointer shrink-0"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
