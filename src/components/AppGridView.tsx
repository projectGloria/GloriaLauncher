import React from "react";
import { ArrowUpCircle, ArrowUpRight, MoreHorizontal, Loader2, Trash2 } from "lucide-react";
import type {
  GloriaAppEntry,
  InstalledAppRecord,
  DownloadProgressPayload,
} from "../types/app";
import { AppBadgeIcon } from "./AppBadgeIcon";
import { formatReadableDate } from "../services/githubService";
import { isTauriDesktop, openExternalUrl } from "../services/platformService";
import { useTranslation } from "react-i18next";
import { activeLocale } from "../i18n";
import { getAvailableUpdate } from "../services/updateService";

interface AppGridViewProps {
  installedApps: GloriaAppEntry[];
  availableApps: GloriaAppEntry[];
  installedMap: Record<string, InstalledAppRecord>;
  activeAppId: string | null;
  downloadingMap: Record<string, DownloadProgressPayload>;
  isSyncing?: boolean;
  /** True when the catalog itself is empty (not just filtered out). */
  isCatalogEmpty?: boolean;
  onSelectApp: (app: GloriaAppEntry) => void;
  onPrimaryAction: (app: GloriaAppEntry, isInstalled: boolean) => void;
  /** Installs the latest release over an older installed copy. */
  onUpdate: (app: GloriaAppEntry) => void;
  onUninstall: (app: GloriaAppEntry) => void;
  onOpenDetails: (app: GloriaAppEntry) => void;
}

export const AppGridView: React.FC<AppGridViewProps> = ({
  installedApps,
  availableApps,
  installedMap,
  activeAppId,
  downloadingMap,
  isSyncing,
  isCatalogEmpty,
  onSelectApp,
  onPrimaryAction,
  onUpdate,
  onUninstall,
  onOpenDetails,
}) => {
  const { t } = useTranslation();
  const isDesktop = isTauriDesktop();

  const renderCard = (app: GloriaAppEntry, isInstalledSection: boolean) => {
    const installedRecord = installedMap[app.id];
    const isSelected = activeAppId === app.id;
    const progress = downloadingMap[app.id];
    const displayVersion =
      installedRecord?.version || app.releaseTag || app.version;

    const updateVersion = isDesktop ? getAvailableUpdate(app, installedRecord) : null;

    // Determine primary CTA label
    let primaryLabel = t("app.install");
    if (progress && !updateVersion) {
      primaryLabel = `${Math.round(progress.percent)}%`;
    } else if (isInstalledSection) {
      primaryLabel = t("app.open");
    }
    // Desktop greys out apps that aren't installed; the web edition can't
    // detect installs, so every app is shown in full color.
    const vivid = isInstalledSection || !isDesktop;

    return (
      <div
        key={app.id}
        data-app-card
        onClick={() => onSelectApp(app)}
        style={{
          backgroundColor: isSelected ? app.surfaceTint : undefined,
          borderTopColor: isSelected ? app.accentColor : undefined,
        }}
        className={`group relative flex flex-col justify-between border-r border-b border-[#1f1f24] p-4 min-h-[275px] transition-colors duration-150 cursor-pointer ${
          isSelected
            ? "border-t-2"
            : "bg-[#0d0d0f] hover:bg-[#131317] border-t border-t-transparent"
        }`}
      >
        {/* Top Accent Line on Hover */}
        {!isSelected && (
          <div
            className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ backgroundColor: app.accentColor }}
          />
        )}

        <div>
          {/* Row 1: Version Tag + Hover Uninstall (installed) + GITHUB ↗ Link */}
          <div className="flex items-center justify-between gap-2 pb-3 mb-3.5 border-b border-[#1c1c21]">
            <span
              className="font-mono-code text-[11px] font-semibold tracking-[0.12em] uppercase shrink-0"
              style={{
                color: vivid ? app.accentColor : "#8a8a96",
              }}
            >
              V{displayVersion.replace(/^v/i, "")}
            </span>

            <div className="flex items-center gap-2 min-w-0">
              {isDesktop && isInstalledSection && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUninstall(app);
                  }}
                  title={t("drawer.uninstallTooltip")}
                  className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto flex items-center gap-1 px-1.5 py-0.5 bg-[#1e1012] hover:bg-[#2f1519] border border-[#4a1d24] hover:border-[#7f2b36] font-mono-code text-[9.5px] font-semibold tracking-[0.12em] text-[#f87171] hover:text-[#fca5a5] uppercase transition-all duration-150 cursor-pointer shrink-0"
                >
                  <Trash2 size={10} />
                  <span>{t("drawer.uninstall")}</span>
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openExternalUrl(app.repoUrl);
                }}
                className="flex items-center gap-1 font-mono-code text-[10px] tracking-[0.14em] text-[#8a8a96] hover:text-white uppercase transition-colors cursor-pointer shrink-0"
              >
                <span lang="en">{t("app.github")}</span>
                <ArrowUpRight size={11} />
              </button>
            </div>
          </div>

          {/* Row 2: App Icon + Two-Tone Title + Subtitle */}
          <div className="flex items-start gap-3 mb-3.5">
            <AppBadgeIcon
              repoId={app.id}
              iconKey={app.iconKey}
              accentColor={app.accentColor}
              isInstalled={vivid}
              size="md"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                <h3 className="font-sans font-bold text-[16px] tracking-tight text-[#f4f4f6] truncate">
                  <span>{app.titlePrefix}</span>
                  <span
                    style={{
                      color: vivid ? app.accentColor : "#a1a1aa",
                    }}
                    className="group-hover:brightness-110 transition-all"
                  >
                    {app.titleAccent}
                  </span>
                </h3>
              </div>

              <p className="text-[11.5px] text-[#9ca3af] mt-0.5 line-clamp-1">
                {app.subtitle}
              </p>
            </div>
          </div>

          {/* Row 3: Status Pill (for Not Installed, or an installed app with an update) */}
          {isInstalledSection && updateVersion && (
            <div className="mb-2.5 flex items-center gap-1.5 flex-wrap">
              <span className="inline-block px-2 py-0.5 bg-[#1d1a0e] border border-[#4a3f17] font-mono-code text-[9px] font-semibold tracking-[0.14em] text-[#f5c542] uppercase">
                {t("app.status.updateAvailable", { version: updateVersion })}
              </span>
            </div>
          )}
          {!isInstalledSection && (
            <div className="mb-2.5 flex items-center gap-1.5 flex-wrap">
              <span className="inline-block px-2 py-0.5 bg-[#111520] border border-[#222b40] font-mono-code text-[9px] font-semibold tracking-[0.14em] text-[#8ab4f8] uppercase">
                {t("app.status.availableToInstall")}
              </span>
              <span
                lang={
                  app.language &&
                  !["VS Code & Editor", "Browser Extensions", "Android & Mobile"].includes(
                    app.category
                  )
                    ? "en"
                    : undefined
                }
                className="inline-block px-1.5 py-0.5 bg-[#151519] border border-[#25252c] font-mono-code text-[9px] tracking-[0.1em] text-[#7c7c88] uppercase"
              >
                {app.category === "VS Code & Editor"
                  ? t("app.tag.vscode")
                  : app.category === "Browser Extensions"
                  ? t("app.tag.extension")
                  : app.category === "Android & Mobile"
                  ? t("app.tag.android")
                  : app.language || t("app.tag.native")}
              </span>
            </div>
          )}

          {/* Row 4: Tagline + Last Updated */}
          <div className="space-y-1.5 mt-2">
            <p className="text-[12px] text-[#a1a1aa] leading-relaxed line-clamp-2">
              {app.tagline}
            </p>
            <p className="text-[11px] text-[#6b6b76]">
              {t("app.lastUpdated", { date: formatReadableDate(app.updatedAt, activeLocale()) })}
            </p>
          </div>
        </div>

        {/* Bottom Row: Action Button (OPEN / INSTALL) + '...' Overflow Button */}
        <div className="mt-4 pt-2 flex items-center gap-1.5">
          {isInstalledSection ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrimaryAction(app, true);
              }}
              className="flex-1 h-8 bg-[#121216] hover:bg-[#1e1e24] border border-[#2e2e38] hover:border-[#4b4b5a] text-[#f4f4f6] font-mono-code text-[10.5px] font-semibold tracking-[0.16em] uppercase transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>{primaryLabel}</span>
            </button>
          ) : null}
          {isInstalledSection && updateVersion && (
            <button
              type="button"
              disabled={Boolean(progress)}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(app);
              }}
              title={t("app.updateTooltip", { current: installedRecord?.version, latest: updateVersion })}
              className="flex-1 h-8 bg-[#f2f1ee] hover:bg-white text-[#0b0b0c] font-mono-code text-[10.5px] font-bold tracking-[0.16em] uppercase transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {progress ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpCircle size={12} />}
              <span>{progress ? `${Math.round(progress.percent)}%` : t("app.update")}</span>
            </button>
          )}
          {!isInstalledSection && (
            <button
              type="button"
              disabled={Boolean(progress)}
              onClick={(e) => {
                e.stopPropagation();
                onPrimaryAction(app, false);
              }}
              className="flex-1 h-8 bg-[#f2f1ee] hover:bg-white text-[#0b0b0c] font-mono-code text-[10.5px] font-bold tracking-[0.16em] uppercase transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {progress && <Loader2 size={12} className="animate-spin" />}
              <span>{primaryLabel}</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(app);
            }}
            title={t("grid.detailsTooltip")}
            className="w-8 h-8 shrink-0 bg-[#121216] hover:bg-[#1e1e24] border border-[#2e2e38] hover:border-[#4b4b5a] text-[#a1a1aa] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0b0b0c]">
      {/* Installed / Pinned Section */}
      {installedApps.length > 0 && (
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 border-l border-t border-[#1f1f24]">
            {installedApps.map((app) => renderCard(app, true))}
          </div>
        </section>
      )}

      {/* Not Installed / Available Section Header */}
      {availableApps.length > 0 && (
        <section>
          <div className="px-4 py-2.5 bg-[#0b0b0c] border-b border-[#1f1f24] flex items-center justify-between">
            <span className="font-mono-code text-[10px] font-semibold tracking-[0.18em] text-[#7c7c88] uppercase">
              {isDesktop
                ? t("grid.notInstalled", { count: availableApps.length })
                : t("grid.allSuiteApps", { count: availableApps.length })}
            </span>
            <span className="font-mono-code text-[10px] tracking-[0.14em] text-[#52525b] uppercase">
              {isDesktop ? t("grid.inspectHint") : t("grid.detectHint")}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 border-l border-[#1f1f24]">
            {availableApps.map((app) => renderCard(app, false))}
          </div>
        </section>
      )}

      {installedApps.length === 0 && availableApps.length === 0 && (
        <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
          {isSyncing ? (
            <>
              <Loader2 size={18} className="animate-spin text-[#00f0ff]" />
              <p className="font-mono-code text-xs tracking-[0.16em] text-[#7c7c88] uppercase">
                {t("app.fetching")}
              </p>
            </>
          ) : (
            <p className="font-mono-code text-xs tracking-[0.16em] text-[#7c7c88] uppercase">
              {isCatalogEmpty ? t("app.catalogUnavailable") : t("app.noMatch")}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
