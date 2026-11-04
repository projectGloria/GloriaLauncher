import React from "react";
import { ArrowUpRight, MoreHorizontal, Loader2 } from "lucide-react";
import type {
  GloriaAppEntry,
  InstalledAppRecord,
  DownloadProgressPayload,
} from "../types/app";
import { AppBadgeIcon } from "./AppBadgeIcon";
import { formatReadableDate } from "../services/githubService";
import { isTauriDesktop, openExternalUrl } from "../services/platformService";

interface AppGridViewProps {
  installedApps: GloriaAppEntry[];
  availableApps: GloriaAppEntry[];
  installedMap: Record<string, InstalledAppRecord>;
  activeAppId: string | null;
  downloadingMap: Record<string, DownloadProgressPayload>;
  onSelectApp: (app: GloriaAppEntry) => void;
  onPrimaryAction: (app: GloriaAppEntry, isInstalled: boolean) => void;
  onOpenDetails: (app: GloriaAppEntry) => void;
}

export const AppGridView: React.FC<AppGridViewProps> = ({
  installedApps,
  availableApps,
  installedMap,
  activeAppId,
  downloadingMap,
  onSelectApp,
  onPrimaryAction,
  onOpenDetails,
}) => {
  const isDesktop = isTauriDesktop();

  const renderCard = (app: GloriaAppEntry, isInstalledSection: boolean) => {
    const installedRecord = installedMap[app.id];
    const isSelected = activeAppId === app.id;
    const progress = downloadingMap[app.id];
    const displayVersion =
      installedRecord?.version || app.releaseTag || app.version;

    // Determine primary CTA label
    let primaryLabel = "INSTALL";
    if (progress) {
      primaryLabel = `${Math.round(progress.percent)}%`;
    } else if (isInstalledSection) {
      primaryLabel = "OPEN";
    } else if (!isDesktop) {
      primaryLabel = app.webUrl ? "LAUNCH" : "INSTALL";
    }

    return (
      <div
        key={app.id}
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
          {/* Row 1: Version Tag + GITHUB ↗ Link */}
          <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-[#1c1c21]">
            <span
              className="font-mono-code text-[11px] font-semibold tracking-[0.12em] uppercase"
              style={{
                color: isInstalledSection ? app.accentColor : "#8a8a96",
              }}
            >
              V{displayVersion.replace(/^v/i, "")}
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openExternalUrl(app.repoUrl);
              }}
              className="flex items-center gap-1 font-mono-code text-[10px] tracking-[0.14em] text-[#8a8a96] hover:text-white uppercase transition-colors cursor-pointer"
            >
              <span>GITHUB</span>
              <ArrowUpRight size={11} />
            </button>
          </div>

          {/* Row 2: App Icon + Two-Tone Title + BY GLORIA Badge + Subtitle */}
          <div className="flex items-start gap-3 mb-3.5">
            <AppBadgeIcon
              iconKey={app.iconKey}
              accentColor={app.accentColor}
              isInstalled={isInstalledSection}
              size="md"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                <h3 className="font-sans font-bold text-[16px] tracking-tight text-[#f4f4f6] truncate">
                  <span>{app.titlePrefix}</span>
                  <span
                    style={{
                      color: isInstalledSection ? app.accentColor : "#a1a1aa",
                    }}
                    className="group-hover:brightness-110 transition-all"
                  >
                    {app.titleAccent}
                  </span>
                </h3>
                <span className="px-1.5 py-[1px] bg-[#141824] border border-[#252d44] font-mono-code text-[8.5px] font-semibold tracking-[0.14em] text-[#93b4ff] uppercase shrink-0">
                  {app.authorBadge}
                </span>
              </div>

              <p className="text-[11.5px] text-[#9ca3af] mt-0.5 line-clamp-1">
                {app.subtitle}
              </p>
            </div>
          </div>

          {/* Row 3: Status Pill (for Not Installed or special category) */}
          {!isInstalledSection && (
            <div className="mb-2.5 flex items-center gap-1.5 flex-wrap">
              <span className="inline-block px-2 py-0.5 bg-[#111520] border border-[#222b40] font-mono-code text-[9px] font-semibold tracking-[0.14em] text-[#8ab4f8] uppercase">
                {isDesktop
                  ? "AVAILABLE TO INSTALL"
                  : app.webUrl
                  ? "AVAILABLE ON WEB"
                  : "AVAILABLE TO INSTALL"}
              </span>
              <span className="inline-block px-1.5 py-0.5 bg-[#151519] border border-[#25252c] font-mono-code text-[9px] tracking-[0.1em] text-[#7c7c88] uppercase">
                {app.category === "VS Code & Editor"
                  ? "VSCODE"
                  : app.category === "Browser Extensions"
                  ? "EXTENSION"
                  : app.category === "Android & Mobile"
                  ? "ANDROID"
                  : app.language || "NATIVE"}
              </span>
            </div>
          )}

          {/* Row 4: Tagline + Last Updated */}
          <div className="space-y-1.5 mt-2">
            <p className="text-[12px] text-[#a1a1aa] leading-relaxed line-clamp-2">
              {app.tagline}
            </p>
            <p className="text-[11px] text-[#6b6b76]">
              Last updated: {formatReadableDate(app.updatedAt)}
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
          ) : (
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
            title="App Details, README & Releases"
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
                ? `NOT INSTALLED (${availableApps.length})`
                : `ALL SUITE APPS (${availableApps.length})`}
            </span>
            <span className="font-mono-code text-[10px] tracking-[0.14em] text-[#52525b] uppercase">
              CLICK ANY CARD TO INSPECT README &amp; RELEASES
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 border-l border-[#1f1f24]">
            {availableApps.map((app) => renderCard(app, false))}
          </div>
        </section>
      )}

      {installedApps.length === 0 && availableApps.length === 0 && (
        <div className="py-24 text-center">
          <p className="font-mono-code text-xs tracking-[0.16em] text-[#7c7c88] uppercase">
            NO GLORIA APPS MATCH YOUR FILTER CRITERIA.
          </p>
        </div>
      )}
    </div>
  );
};
