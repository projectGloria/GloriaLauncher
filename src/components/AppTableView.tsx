import React from "react";
import { MoreHorizontal, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import type {
  GloriaAppEntry,
  InstalledAppRecord,
  DownloadProgressPayload,
} from "../types/app";
import { AppBadgeIcon } from "./AppBadgeIcon";
import { formatReadableDate } from "../services/githubService";
import { isTauriDesktop } from "../services/platformService";
import type { SortOption } from "./Toolbar";

interface AppTableViewProps {
  installedApps: GloriaAppEntry[];
  availableApps: GloriaAppEntry[];
  installedMap: Record<string, InstalledAppRecord>;
  activeAppId: string | null;
  downloadingMap: Record<string, DownloadProgressPayload>;
  sortBy: SortOption;
  onChangeSortBy: (sort: SortOption) => void;
  onSelectApp: (app: GloriaAppEntry) => void;
  onPrimaryAction: (app: GloriaAppEntry, isInstalled: boolean) => void;
  onOpenDetails: (app: GloriaAppEntry) => void;
}

export const AppTableView: React.FC<AppTableViewProps> = ({
  installedApps,
  availableApps,
  installedMap,
  activeAppId,
  downloadingMap,
  sortBy,
  onChangeSortBy,
  onSelectApp,
  onPrimaryAction,
  onOpenDetails,
}) => {
  const isDesktop = isTauriDesktop();
  const combinedApps = [
    ...installedApps.map((app) => ({ app, isInstalled: true })),
    ...availableApps.map((app) => ({ app, isInstalled: false })),
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#0b0b0c]">
      <div className="min-w-[780px] border-t border-[#1f1f24]">
        {/* Table Header Row */}
        <div className="grid grid-cols-12 items-center px-5 py-2.5 bg-[#0e0e11] border-b border-[#1f1f24] font-mono-code text-[10px] tracking-[0.16em] text-[#7c7c88] uppercase select-none">
          <button
            type="button"
            onClick={() => onChangeSortBy("name-asc")}
            className="col-span-5 flex items-center gap-1 text-left hover:text-white transition-colors cursor-pointer"
          >
            <span>APP</span>
            {sortBy === "name-asc" && (
              <ArrowUp size={10} className="text-[#38bdf8]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onChangeSortBy("status")}
            className="col-span-2 flex items-center gap-1 text-left hover:text-white transition-colors cursor-pointer"
          >
            <span>STATUS</span>
            {sortBy === "status" && (
              <ArrowUp size={10} className="text-[#38bdf8]" />
            )}
          </button>

          <div className="col-span-1">VERSION</div>

          <button
            type="button"
            onClick={() => onChangeSortBy("updated-desc")}
            className="col-span-1 flex items-center gap-1 text-left hover:text-white transition-colors cursor-pointer"
          >
            <span>RELEASED</span>
            {sortBy === "updated-desc" && (
              <ArrowDown size={10} className="text-[#38bdf8]" />
            )}
          </button>

          <div className="col-span-1">AUTHOR</div>

          <div className="col-span-2 text-right">ACTION</div>
        </div>

        {/* Table Body Rows */}
        {combinedApps.map(({ app, isInstalled }) => {
          const installedRecord = installedMap[app.id];
          const isSelected = activeAppId === app.id;
          const progress = downloadingMap[app.id];
          const displayVersion = (
            installedRecord?.version ||
            app.releaseTag ||
            app.version
          ).replace(/^v/i, "");

          let primaryLabel = "INSTALL";
          if (progress) {
            primaryLabel = `${Math.round(progress.percent)}%`;
          } else if (isInstalled) {
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
              }}
              className={`group grid grid-cols-12 items-center px-5 py-3 border-b border-[#1c1c21] transition-colors cursor-pointer ${
                isSelected ? "" : "bg-[#0b0b0c] hover:bg-[#121216]"
              }`}
            >
              {/* Col 1: App Icon + Two-Tone Title + Subtitle */}
              <div className="col-span-5 flex items-center gap-3.5 pr-4 min-w-0">
                <AppBadgeIcon
                  iconKey={app.iconKey}
                  accentColor={app.accentColor}
                  isInstalled={isInstalled}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="font-sans font-bold text-[14px] text-[#f4f4f6] truncate">
                    <span>{app.titlePrefix}</span>
                    <span
                      style={{
                        color: isInstalled ? app.accentColor : "#a1a1aa",
                      }}
                    >
                      {app.titleAccent}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-[#8a8a96] truncate">
                    {app.subtitle}
                  </div>
                </div>
              </div>

              {/* Col 2: Status Badge */}
              <div className="col-span-2 pr-2">
                {isInstalled ? (
                  <span className="inline-block px-2 py-0.5 bg-[#121215] border border-[#2a2a32] font-mono-code text-[9.5px] font-semibold tracking-[0.14em] text-[#b4b4c0] uppercase">
                    {isDesktop ? "INSTALLED" : "PINNED / READY"}
                  </span>
                ) : (
                  <span className="inline-block px-2 py-0.5 bg-[#111520] border border-[#222b40] font-mono-code text-[9.5px] font-semibold tracking-[0.14em] text-[#8ab4f8] uppercase">
                    {isDesktop
                      ? "AVAILABLE TO INSTALL"
                      : app.webUrl
                      ? "WEB READY"
                      : "AVAILABLE TO INSTALL"}
                  </span>
                )}
              </div>

              {/* Col 3: Version */}
              <div
                className={`col-span-1 font-mono-code text-[12px] ${
                  isInstalled
                    ? "text-[#f4f4f6] font-semibold"
                    : "text-[#7c7c88]"
                }`}
              >
                {displayVersion}
              </div>

              {/* Col 4: Released Date */}
              <div className="col-span-1 text-[12px] text-[#8a8a96]">
                {formatReadableDate(app.updatedAt)}
              </div>

              {/* Col 5: Author */}
              <div className="col-span-1 text-[12px] text-[#a1a1aa]">
                {app.author}
              </div>

              {/* Col 6: Action Buttons */}
              <div className="col-span-2 flex items-center justify-end gap-1.5">
                {isInstalled ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPrimaryAction(app, true);
                    }}
                    className="w-28 h-8 bg-[#121216] hover:bg-[#1e1e24] border border-[#2e2e38] hover:border-[#4b4b5a] text-[#f4f4f6] font-mono-code text-[10px] font-semibold tracking-[0.16em] uppercase transition-colors cursor-pointer flex items-center justify-center"
                  >
                    {primaryLabel}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(progress)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPrimaryAction(app, false);
                    }}
                    className="w-28 h-8 bg-[#f2f1ee] hover:bg-white text-[#0b0b0c] font-mono-code text-[10px] font-bold tracking-[0.16em] uppercase transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
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
                  title="Inspect App"
                  className="w-8 h-8 bg-[#121216] hover:bg-[#1e1e24] border border-[#2e2e38] hover:border-[#4b4b5a] text-[#a1a1aa] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
