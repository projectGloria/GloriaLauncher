import React, { useEffect, useState } from "react";
import {
  X,
  ArrowUpRight,
  Download,
  FolderOpen,
  Trash2,
  FileCode2,
  Loader2,
  Play,
  Globe,
  HardDrive,
  ArrowUpCircle,
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
  pickPreferredReleaseAsset,
  sortReleaseAssets,
} from "../services/githubService";
import { useTranslation } from "react-i18next";
import { activeLocale } from "../i18n";
import { getAvailableUpdate } from "../services/updateService";
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
  /** Installs the latest release over an older installed copy. */
  onUpdate: (app: GloriaAppEntry) => void;
  onInstallSpecificAsset: (
    app: GloriaAppEntry,
    asset: ReleaseAssetInfo,
    version: string
  ) => void;
  onUninstall: (app: GloriaAppEntry) => void;
  onCustomExeBound: (record: InstalledAppRecord) => void;
}

export const AppDetailDrawer: React.FC<AppDetailDrawerProps> = ({
  app,
  installedRecord,
  downloadProgress,
  githubToken,
  onClose,
  onPrimaryAction,
  onUpdate,
  onInstallSpecificAsset,
  onUninstall,
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

  const { t } = useTranslation();
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

    if (app.releaseAssets && app.releaseAssets.length > 0) {
      setReleaseData({
        version: app.releaseTag || app.version,
        publishedAt: app.releasePublishedAt || app.updatedAt,
        notes: app.releaseNotes,
        assets: app.releaseAssets,
      });
      setLoadingReleases(false);
    } else {
      fetchAppReleaseInfo(app.id, githubToken).then((rel) => {
        if (!cancelled) {
          setReleaseData(rel);
          setLoadingReleases(false);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [app, githubToken]);

  if (!app) return null;

  const updateVersion = isDesktop ? getAvailableUpdate(app, installedRecord) : null;

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

  const recommendedAssetName = releaseData
    ? pickPreferredReleaseAsset(releaseData.assets)?.name
    : undefined;

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
              repoId={app.id}
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
                  {t(`categories.${app.category}`, { defaultValue: app.category })}
                </span>
              </div>
              <p className="text-sm text-[#a1a1aa] mt-1">{app.subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("drawer.close")}
            title={t("drawer.close")}
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
                  <span>{t("drawer.installing", { percent: Math.round(downloadProgress.percent) })}</span>
                </>
              ) : isInstalled ? (
                <>
                  <Play size={13} fill="currentColor" />
                  <span>{isDesktop ? t("drawer.openApp") : t("drawer.launchOpen")}</span>
                </>
              ) : (
                <>
                  <Download size={13} />
                  <span>{t("app.install")}</span>
                </>
              )}
            </button>

            {updateVersion && !downloadProgress && (
              <button
                type="button"
                onClick={() => onUpdate(app)}
                title={t("app.updateTooltip", { current: installedRecord?.version, latest: updateVersion })}
                className="h-9 px-4 bg-[#1d1a0e] hover:bg-[#2a2512] border border-[#4a3f17] text-[#f5c542] font-mono-code text-[11px] font-bold tracking-[0.16em] uppercase flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowUpCircle size={13} />
                <span>{t("drawer.updateTo", { version: updateVersion })}</span>
              </button>
            )}

            {app.webUrl && (
              <button
                type="button"
                onClick={() => openExternalUrl(app.webUrl!)}
                className="h-9 px-3.5 bg-[#16161c] hover:bg-[#202028] border border-[#2c2c36] text-[#e4e4e7] font-mono-code text-[10.5px] tracking-[0.14em] uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Globe size={13} />
                <span>{t("drawer.openWebStore")}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => openExternalUrl(app.repoUrl)}
              className="h-9 px-3.5 bg-[#16161c] hover:bg-[#202028] border border-[#2c2c36] text-[#e4e4e7] font-mono-code text-[10.5px] tracking-[0.14em] uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>{t("drawer.githubRepo")}</span>
              <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {isDesktop && (
              <button
                type="button"
                onClick={handleBindLocalExe}
                title={t("drawer.locateExeTooltip")}
                className="h-9 px-3 bg-[#16161c] hover:bg-[#202028] border border-[#2c2c36] text-[#a1a1aa] hover:text-white font-mono-code text-[10px] tracking-[0.12em] uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <HardDrive size={12} />
                <span>{t("drawer.locateExe")}</span>
              </button>
            )}

            {isDesktop && isInstalled && (
              <button
                type="button"
                onClick={() => openAppInstallFolder(app.id)}
                title={t("drawer.openFolderTooltip")}
                className="h-9 w-9 bg-[#16161c] hover:bg-[#202028] border border-[#2c2c36] text-[#a1a1aa] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <FolderOpen size={14} />
              </button>
            )}

            {isDesktop && isInstalled && (
              <button
                type="button"
                onClick={() => onUninstall(app)}
                title={t("drawer.uninstallTooltip")}
                className="h-9 px-3 bg-[#16161c] hover:bg-[#241317] border border-[#2c2c36] hover:border-[#dc143c] text-[#a1a1aa] hover:text-white font-mono-code text-[10px] tracking-[0.12em] uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 size={12} />
                <span>{t("drawer.uninstall")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overview & Metadata Grid */}
          <div className="space-y-3">
            <h3 className="font-mono-code text-[10.5px] font-semibold tracking-[0.18em] text-[#7c7c88] uppercase">
              {t("drawer.overview")}
            </h3>
            <p className="text-sm text-[#d4d4dc] leading-relaxed">
              {app.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <div className="p-3 bg-[#121216] border border-[#1f1f26]">
                <div className="font-mono-code text-[9.5px] tracking-[0.14em] text-[#7c7c88] uppercase">
                  {t("drawer.updated")}
                </div>
                <div className="font-mono-code text-xs text-[#f4f4f6] mt-1">
                  {formatReadableDate(app.updatedAt, activeLocale())}
                </div>
              </div>
              <div className="p-3 bg-[#121216] border border-[#1f1f26]">
                <div className="font-mono-code text-[9.5px] tracking-[0.14em] text-[#7c7c88] uppercase">
                  {t("drawer.platforms")}
                </div>
                <div className="font-mono-code text-xs text-[#f4f4f6] mt-1 truncate">
                  {app.platforms.join(", ")}
                </div>
              </div>
              <div className="p-3 bg-[#121216] border border-[#1f1f26]">
                <div className="font-mono-code text-[9.5px] tracking-[0.14em] text-[#7c7c88] uppercase">
                  {t("drawer.techStack")}
                </div>
                <div className="font-mono-code text-xs text-[#f4f4f6] mt-1 truncate">
                  {app.techStack.slice(0, 2).join(" · ")}
                </div>
              </div>
              <div className="p-3 bg-[#121216] border border-[#1f1f26]">
                <div className="font-mono-code text-[9.5px] tracking-[0.14em] text-[#7c7c88] uppercase">
                  {t("drawer.status")}
                </div>
                <div
                  className="font-mono-code text-xs font-semibold mt-1"
                  style={{ color: isInstalled ? app.accentColor : "#93b4ff" }}
                >
                  {isInstalled ? t("app.status.installed") : t("app.status.available")}
                </div>
              </div>
            </div>

            {installedRecord && isDesktop && (
              <div className="p-3 bg-[#11151c] border border-[#1e293b] font-mono-code text-[11px] text-[#94a3b8] break-all">
                <span className="text-[#38bdf8] uppercase mr-2">
                  {t("drawer.localBinary")}
                </span>
                {installedRecord.executablePath}
              </div>
            )}
          </div>

          {/* GitHub Releases & Direct Binary Downloads */}
          <div className="space-y-3 pt-2 border-t border-[#1f1f25]">
            <div className="flex items-center justify-between">
              <h3 className="font-mono-code text-[10.5px] font-semibold tracking-[0.18em] text-[#7c7c88] uppercase">
                {t("drawer.releases")}
              </h3>
              <button
                type="button"
                onClick={() => openExternalUrl(`${app.repoUrl}/releases`)}
                className="font-mono-code text-[10px] tracking-[0.14em] text-[#38bdf8] hover:underline uppercase cursor-pointer"
              >
                {t("drawer.viewAllReleases")}
              </button>
            </div>

            {loadingReleases ? (
              <div className="p-4 bg-[#121216] border border-[#1f1f26] flex items-center gap-2 font-mono-code text-xs text-[#8a8a96]">
                <Loader2 size={14} className="animate-spin" />
                <span>{t("drawer.checkingReleases")}</span>
              </div>
            ) : releaseData && releaseData.assets.length > 0 ? (
              <div className="space-y-2">
                {sortReleaseAssets(releaseData.assets).map((asset) => {
                  const isRecommended = asset.name === recommendedAssetName;
                  return (
                  <div
                    key={asset.name}
                    className={`p-3 bg-[#121216] hover:bg-[#17171c] border flex items-center justify-between gap-3 ${
                      isRecommended ? "border-[#2c4a3a]" : "border-[#22222a]"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-mono-code text-xs text-[#f4f4f6] truncate">
                        {asset.name}
                      </div>
                      {isRecommended && (
                        <div className="inline-block mt-1 px-1.5 py-[1px] bg-[#0f1f17] border border-[#24503a] font-mono-code text-[9px] font-semibold tracking-[0.14em] text-[#4ade80] uppercase">
                          {t("drawer.recommended")}
                        </div>
                      )}
                      <div className="font-mono-code text-[10px] text-[#7c7c88] mt-0.5">
                        {asset.size > 0 ? `${formatByteSize(asset.size)} · ` : ""}v{releaseData.version}
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
                      <span>{isDesktop ? t("app.install") : t("app.download")}</span>
                    </button>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-[#121216] border border-[#1f1f26] flex items-center justify-between gap-3">
                <div className="text-xs text-[#8a8a96]">
                  {t("drawer.noAssets")}
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
                  {t("drawer.downloadZip")}
                </button>
              </div>
            )}
          </div>

          {/* Live Repository README Preview */}
          <div className="space-y-3 pt-2 border-t border-[#1f1f25]">
            <div className="flex items-center gap-2 font-mono-code text-[10.5px] font-semibold tracking-[0.18em] text-[#7c7c88] uppercase">
              <FileCode2 size={13} />
              <span>{t("drawer.readmePreview")}</span>
            </div>

            {loadingReadme ? (
              <div className="p-6 bg-[#111115] border border-[#1f1f25] flex items-center gap-2 font-mono-code text-xs text-[#8a8a96]">
                <Loader2 size={14} className="animate-spin" />
                <span>{t("drawer.loadingReadme")}</span>
              </div>
            ) : readme ? (
              <pre className="p-4 bg-[#09090b] border border-[#1f1f25] font-mono-code text-[11.5px] text-[#b4b4c0] whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-96">
                {cleanReadmeExcerpt(readme)}
              </pre>
            ) : (
              <div className="p-4 bg-[#111115] border border-[#1f1f25] text-xs text-[#7c7c88]">
                {t("drawer.noReadme")}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};
