import React, { useEffect, useState } from "react";
import {
  X,
  ArrowUpRight,
  Download,
  FolderOpen,
  Trash2,
  Pin,
  PinOff,
  FileCode2,
  Loader2,
  Play,
  Globe,
  HardDrive,
} from "lucide-react";
import type {
  GloriaAppEntry,
  InstalledAppRecord,
  ReleaseAssetInfo,
  DownloadProgressPayload,
} from "../types/app";
import { AppBadgeIcon } from "./AppBadgeIcon";
import {
  fetchAppReleaseInfo,
  fetchRepoReadme,
  formatByteSize,
  formatReadableDate,
} from "../services/githubService";
import {
  isTauriDesktop,
  openExternalUrl,
  openAppInstallFolder,
  bindCustomExecutable,
} from "../services/platformService";

interface AppDetailDrawerProps {
  app: GloriaAppEntry | null;
  installedRecord?: InstalledAppRecord;
  downloadProgress?: DownloadProgressPayload;
  githubToken?: string;
  onClose: () => void;
  onPrimaryAction: (app: GloriaAppEntry, isInstalled: boolean) => void;
  onInstallSpecificAsset: (
    app: GloriaAppEntry,
    asset: ReleaseAssetInfo,
    version: string
  ) => void;
  onUninstallOrUnpin: (app: GloriaAppEntry) => void;
  onCustomExeBound: (record: InstalledAppRecord) => void;
}

export const AppDetailDrawer: React.FC<AppDetailDrawerProps> = ({
  app,
  installedRecord,
  downloadProgress,
  githubToken,
  onClose,
  onPrimaryAction,
  onInstallSpecificAsset,
  onUninstallOrUnpin,
  onCustomExeBound,
}) => {
  const [readme, setReadme] = useState<string>("");
  const [loadingReadme, setLoadingReadme] = useState(false);
  const [releaseData, setReleaseData] = useState<{
    version?: string;
    publishedAt?: string;
    notes?: string;
    assets: ReleaseAssetInfo[];
  } | null>(null);
  const [loadingReleases, setLoadingReleases] = useState(false);

  const isDesktop = isTauriDesktop();
  const isInstalled = Boolean(installedRecord);

  useEffect(() => {
    if (!app) return;
    let cancelled = false;
    setLoadingReadme(true);
    setLoadingReleases(true);
    setReadme("");
    setReleaseData(null);

    fetchRepoReadme(app.id).then((text) => {
      if (!cancelled) {
        setReadme(text);
        setLoadingReadme(false);
      }
    });

    fetchAppReleaseInfo(app.id, githubToken).then((rel) => {
      if (!cancelled) {
        setReleaseData(rel);
        setLoadingReleases(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [app, githubToken]);

  if (!app) return null;

  const cleanReadmeExcerpt = (raw: string) => {
    if (!raw) return "";
    return raw
      .replace(/<[^>]+>/g, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 3200);
  };

  const handleBindLocalExe = async () => {
    const rec = await bindCustomExecutable(
      app.id,
      releaseData?.version || app.version
    );
    if (rec) {
      onCustomExeBound(rec);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-[2px]">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className="relative z-10 w-full max-w-2xl h-full bg-[#0d0d10] border-l border-[#24242c] flex flex-col overflow-hidden shadow-2xl">
        {/* Top Accent Strip */}
        <div
          className="h-1 w-full shrink-0"
          style={{ backgroundColor: app.accentColor }}
        />

        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-[#1f1f25] flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <AppBadgeIcon
              iconKey={app.iconKey}
              accentColor={app.accentColor}
              isInstalled={true}
              size="lg"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-extrabold text-2xl text-[#f4f4f6]">
                  <span>{app.titlePrefix}</span>
                  <span style={{ color: app.accentColor }}>
                    {app.titleAccent}
                  </span>
                </h2>
                <span className="px-2 py-0.5 bg-[#161926] border border-[#28314a] font-mono-code text-[10px] font-semibold tracking-[0.14em] text-[#93b4ff] uppercase">
                  V{releaseData?.version || installedRecord?.version || app.version}
                </span>
                <span className="px-2 py-0.5 bg-[#141418] border border-[#26262f] font-mono-code text-[10px] tracking-[0.14em] text-[#a1a1aa] uppercase">
                  {app.category}
                </span>
              </div>
              <p className="text-sm text-[#a1a1aa] mt-1">{app.subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-[#141418] hover:bg-[#22222a] border border-[#282832] text-[#a1a1aa] hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* Action Control Bar */}
        <div className="px-6 py-3.5 bg-[#111115] border-b border-[#1f1f25] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={Boolean(downloadProgress)}
              onClick={() => onPrimaryAction(app, isInstalled)}
              className="h-9 px-5 bg-[#f2f1ee] hover:bg-white text-[#0b0b0c] font-mono-code text-[11px] font-bold tracking-[0.16em] uppercase flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              {downloadProgress ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>INSTALLING ({Math.round(downloadProgress.percent)}%)</span>
                </>
              ) : isInstalled ? (
                <>
                  <Play size={13} fill="currentColor" />
                  <span>{isDesktop ? "OPEN APP" : "LAUNCH / OPEN"}</span>
                </>
              ) : (
                <>
                  <Download size={13} />
                  <span>{isDesktop ? "INSTALL" : app.webUrl ? "LAUNCH WEB" : "GET APP"}</span>
                </>
              )}
            </button>

            {app.webUrl && (
              <button
                type="button"
                onClick={() => openExternalUrl(app.webUrl!)}
                className="h-9 px-3.5 bg-[#16161c] hover:bg-[#202028] border border-[#2c2c36] text-[#e4e4e7] font-mono-code text-[10.5px] tracking-[0.14em] uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Globe size={13} />
                <span>Open Web / Store</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => openExternalUrl(app.repoUrl)}
              className="h-9 px-3.5 bg-[#16161c] hover:bg-[#202028] border border-[#2c2c36] text-[#e4e4e7] font-mono-code text-[10.5px] tracking-[0.14em] uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>GitHub Repo</span>
              <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {isDesktop && (
              <button
                type="button"
                onClick={handleBindLocalExe}
                title="Bind a local .exe binary from your disk"
                className="h-9 px-3 bg-[#16161c] hover:bg-[#202028] border border-[#2c2c36] text-[#a1a1aa] hover:text-white font-mono-code text-[10px] tracking-[0.12em] uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <HardDrive size={12} />
                <span>Locate .exe</span>
              </button>
            )}

            {isDesktop && isInstalled && (
              <button
                type="button"
                onClick={() => openAppInstallFolder(app.id)}
                title="Open Install Folder"
                className="h-9 w-9 bg-[#16161c] hover:bg-[#202028] border border-[#2c2c36] text-[#a1a1aa] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <FolderOpen size={14} />
              </button>
            )}

            <button
              type="button"
              onClick={() => onUninstallOrUnpin(app)}
              title={
                isDesktop
                  ? isInstalled
                    ? "Uninstall App"
                    : "Not Installed"
                  : isInstalled
                  ? "Unpin from Top Suite"
                  : "Pin to Top Suite"
              }
              className="h-9 px-3 bg-[#16161c] hover:bg-[#241317] border border-[#2c2c36] hover:border-[#dc143c] text-[#a1a1aa] hover:text-white font-mono-code text-[10px] tracking-[0.12em] uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isDesktop ? (
                isInstalled ? (
                  <>
                    <Trash2 size={12} />
                    <span>Uninstall</span>
                  </>
                ) : null
              ) : isInstalled ? (
                <>
                  <PinOff size={12} />
                  <span>Unpin</span>
                </>
              ) : (
                <>
                  <Pin size={12} />
                  <span>Pin to Top</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overview & Metadata Grid */}
          <div className="space-y-3">
            <h3 className="font-mono-code text-[10.5px] font-semibold tracking-[0.18em] text-[#7c7c88] uppercase">
              OVERVIEW
            </h3>
            <p className="text-sm text-[#d4d4dc] leading-relaxed">
              {app.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <div className="p-3 bg-[#121216] border border-[#1f1f26]">
                <div className="font-mono-code text-[9.5px] tracking-[0.14em] text-[#7c7c88] uppercase">
                  UPDATED
                </div>
                <div className="font-mono-code text-xs text-[#f4f4f6] mt-1">
                  {formatReadableDate(app.updatedAt)}
                </div>
              </div>
              <div className="p-3 bg-[#121216] border border-[#1f1f26]">
                <div className="font-mono-code text-[9.5px] tracking-[0.14em] text-[#7c7c88] uppercase">
                  PLATFORMS
                </div>
                <div className="font-mono-code text-xs text-[#f4f4f6] mt-1 truncate">
                  {app.platforms.join(", ")}
                </div>
              </div>
              <div className="p-3 bg-[#121216] border border-[#1f1f26]">
                <div className="font-mono-code text-[9.5px] tracking-[0.14em] text-[#7c7c88] uppercase">
                  TECH STACK
                </div>
                <div className="font-mono-code text-xs text-[#f4f4f6] mt-1 truncate">
                  {app.techStack.slice(0, 2).join(" · ")}
                </div>
              </div>
              <div className="p-3 bg-[#121216] border border-[#1f1f26]">
                <div className="font-mono-code text-[9.5px] tracking-[0.14em] text-[#7c7c88] uppercase">
                  STATUS
                </div>
                <div
                  className="font-mono-code text-xs font-semibold mt-1"
                  style={{ color: isInstalled ? app.accentColor : "#93b4ff" }}
                >
                  {isInstalled
                    ? isDesktop
                      ? "INSTALLED"
                      : "PINNED"
                    : "AVAILABLE"}
                </div>
              </div>
            </div>

            {installedRecord && isDesktop && (
              <div className="p-3 bg-[#11151c] border border-[#1e293b] font-mono-code text-[11px] text-[#94a3b8] break-all">
                <span className="text-[#38bdf8] uppercase mr-2">
                  LOCAL BINARY:
                </span>
                {installedRecord.executablePath}
              </div>
            )}
          </div>

          {/* GitHub Releases & Direct Binary Downloads */}
          <div className="space-y-3 pt-2 border-t border-[#1f1f25]">
            <div className="flex items-center justify-between">
              <h3 className="font-mono-code text-[10.5px] font-semibold tracking-[0.18em] text-[#7c7c88] uppercase">
                GITHUB RELEASES &amp; INSTALLERS
              </h3>
              <button
                type="button"
                onClick={() => openExternalUrl(`${app.repoUrl}/releases`)}
                className="font-mono-code text-[10px] tracking-[0.14em] text-[#38bdf8] hover:underline uppercase cursor-pointer"
              >
                View All Releases ↗
              </button>
            </div>

            {loadingReleases ? (
              <div className="p-4 bg-[#121216] border border-[#1f1f26] flex items-center gap-2 font-mono-code text-xs text-[#8a8a96]">
                <Loader2 size={14} className="animate-spin" />
                <span>Checking GitHub Releases...</span>
              </div>
            ) : releaseData && releaseData.assets.length > 0 ? (
              <div className="space-y-2">
                {releaseData.assets.map((asset) => (
                  <div
                    key={asset.name}
                    className="p-3 bg-[#121216] hover:bg-[#17171c] border border-[#22222a] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-mono-code text-xs text-[#f4f4f6] truncate">
                        {asset.name}
                      </div>
                      <div className="font-mono-code text-[10px] text-[#7c7c88] mt-0.5">
                        {formatByteSize(asset.size)} · v{releaseData.version}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        isDesktop
                          ? onInstallSpecificAsset(
                              app,
                              asset,
                              releaseData.version || app.version
                            )
                          : openExternalUrl(asset.browserDownloadUrl)
                      }
                      className="px-3 py-1.5 bg-[#f2f1ee] hover:bg-white text-[#0b0b0c] font-mono-code text-[10px] font-bold tracking-[0.14em] uppercase flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Download size={11} />
                      <span>{isDesktop ? "INSTALL" : "DOWNLOAD"}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-[#121216] border border-[#1f1f26] flex items-center justify-between gap-3">
                <div className="text-xs text-[#8a8a96]">
                  No pre-built binary release asset published yet, or built from
                  source. You can download the source archive or open the
                  repository directly.
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openExternalUrl(
                      `${app.repoUrl}/archive/refs/heads/main.zip`
                    )
                  }
                  className="px-3 py-1.5 bg-[#1b1b22] hover:bg-[#272732] border border-[#2e2e3a] text-[#e4e4e7] font-mono-code text-[10px] tracking-[0.14em] uppercase shrink-0 cursor-pointer"
                >
                  Download ZIP
                </button>
              </div>
            )}
          </div>

          {/* Live Repository README Preview */}
          <div className="space-y-3 pt-2 border-t border-[#1f1f25]">
            <div className="flex items-center gap-2 font-mono-code text-[10.5px] font-semibold tracking-[0.18em] text-[#7c7c88] uppercase">
              <FileCode2 size={13} />
              <span>README.MD PREVIEW</span>
            </div>

            {loadingReadme ? (
              <div className="p-6 bg-[#111115] border border-[#1f1f25] flex items-center gap-2 font-mono-code text-xs text-[#8a8a96]">
                <Loader2 size={14} className="animate-spin" />
                <span>Loading repository README from GitHub...</span>
              </div>
            ) : readme ? (
              <pre className="p-4 bg-[#09090b] border border-[#1f1f25] font-mono-code text-[11.5px] text-[#b4b4c0] whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-96">
                {cleanReadmeExcerpt(readme)}
              </pre>
            ) : (
              <div className="p-4 bg-[#111115] border border-[#1f1f25] text-xs text-[#7c7c88]">
                No README.md found on default branch.
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};
