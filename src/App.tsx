import React, { useEffect, useMemo, useState, useCallback } from "react";
import type {
  AppCategory,
  DownloadProgressPayload,
  GloriaAppEntry,
  InstalledAppRecord,
  ReleaseAssetInfo,
} from "./types/app";
import {
  fetchAppReleaseInfo,
  getCachedSyncedApps,
  pickPreferredReleaseAsset,
  syncCatalogWithGitHub,
} from "./services/githubService";
import {
  configureTray,
  getInstalledAppsMap,
  installDesktopAppRelease,
  isTauriDesktop,
  launchDesktopApp,
  openExternalUrl,
  uninstallDesktopApp,
} from "./services/platformService";
import { Titlebar, type ActivePageMode } from "./components/Titlebar";
import {
  Toolbar,
  type LauncherViewMode,
  type SortOption,
} from "./components/Toolbar";
import { AppGridView } from "./components/AppGridView";
import { AppTableView } from "./components/AppTableView";
import { ShowcaseView } from "./components/ShowcaseView";
import { AppDetailDrawer } from "./components/AppDetailDrawer";
import { FooterBar } from "./components/FooterBar";
import { SettingsModal } from "./components/SettingsModal";
import { UpdateBanner } from "./components/UpdateBanner";
import { ScanningSplash, type ScanPhase } from "./components/ScanningSplash";
import { useTranslation } from "react-i18next";
import { localizeApp } from "./i18n";
import { useIconPalettes } from "./services/iconColorService";

const GH_TOKEN_STORAGE_KEY = "gloria_launcher_gh_token";
const RUN_IN_TRAY_STORAGE_KEY = "gloria_launcher_run_in_tray";
const SPLASH_MIN_MS = 900;
const SPLASH_MAX_MS = 15000;

export const App: React.FC = () => {
  const [catalogApps, setApps] = useState<GloriaAppEntry[]>(() => {
    return getCachedSyncedApps()?.apps || [];
  });
  const [installedMap, setInstalledMap] = useState<
    Record<string, InstalledAppRecord>
  >({});
  const [activeMode, setActiveMode] = useState<ActivePageMode>("launcher");
  const [viewMode, setViewMode] = useState<LauncherViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<AppCategory | "ALL">(
    "ALL"
  );
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [drawerApp, setDrawerApp] = useState<GloriaAppEntry | null>(null);
  const [downloadingMap, setDownloadingMap] = useState<
    Record<string, DownloadProgressPayload>
  >({});
  const [checkedAt, setCheckedAt] = useState<Date>(() => {
    return getCachedSyncedApps()?.checkedAt || new Date();
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [scanPhase, setScanPhase] = useState<ScanPhase>("catalog");
  const [splashMounted, setSplashMounted] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [githubToken, setGithubToken] = useState<string>(() => {
    try {
      return localStorage.getItem(GH_TOKEN_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [runInTray, setRunInTray] = useState<boolean>(() => {
    try {
      return localStorage.getItem(RUN_IN_TRAY_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const appIds = useMemo(() => catalogApps.map((app) => app.id), [catalogApps]);
  const iconPalettes = useIconPalettes(appIds);
  const apps = useMemo(
    () =>
      catalogApps.map((app) => {
        const localized = localizeApp(app, language);
        // Match the accent to the app's real icon (e.g. gold for Lyra).
        const palette = iconPalettes[app.id];
        return palette
          ? { ...localized, accentColor: palette.accent, surfaceTint: palette.tint }
          : localized;
      }),
    [catalogApps, language, iconPalettes]
  );
  const drawerAppView = useMemo(
    () =>
      drawerApp
        ? apps.find((app) => app.id === drawerApp.id) ?? drawerApp
        : null,
    [apps, drawerApp]
  );
  const isDesktop = isTauriDesktop();

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const loadData = useCallback(
    async (force = false) => {
      setIsSyncing(true);
      try {
        const { apps: syncedApps, checkedAt: syncedTime } =
          await syncCatalogWithGitHub({ force, githubToken });
        setScanPhase((p) => (p === "catalog" ? "installed" : p));
        const instMap = await getInstalledAppsMap(syncedApps);
        setApps(syncedApps);
        setCheckedAt(syncedTime);
        setInstalledMap(instMap);
      } finally {
        setIsSyncing(false);
      }
    },
    [githubToken]
  );

  // The cached catalog is already on screen from the initial state; always
  // re-check on launch so newly published apps show up right away.
  // The first scan runs behind the "Scanning" splash. It stays up for at least
  // a moment so it doesn't flash, and never longer than SPLASH_MAX_MS.
  useEffect(() => {
    const started = Date.now();
    let hideTimer: number | undefined;
    const finish = () => {
      const wait = Math.max(0, SPLASH_MIN_MS - (Date.now() - started));
      hideTimer = window.setTimeout(() => setScanPhase("done"), wait);
    };
    const cap = window.setTimeout(() => setScanPhase("done"), SPLASH_MAX_MS);
    loadData(true).finally(finish);
    return () => {
      window.clearTimeout(cap);
      window.clearTimeout(hideTimer);
    };
  }, [loadData]);

  // Keep the splash mounted while it fades out.
  useEffect(() => {
    if (scanPhase !== "done") return;
    const t = window.setTimeout(() => setSplashMounted(false), 320);
    return () => window.clearTimeout(t);
  }, [scanPhase]);

  // Apply the tray setting on launch, and again when it or the language changes
  // so the tray menu stays translated.
  useEffect(() => {
    if (!isDesktop) return;
    configureTray(runInTray, { show: t("tray.show"), quit: t("tray.quit") });
  }, [isDesktop, runInTray, t, language]);

  const handleRunInTrayChange = (enabled: boolean) => {
    setRunInTray(enabled);
    try {
      localStorage.setItem(RUN_IN_TRAY_STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // Ignore
    }
  };

  // Installers (new installs and updates) finish outside the launcher, so
  // re-check what's installed whenever the window comes back into focus.
  useEffect(() => {
    if (!isDesktop || catalogApps.length === 0) return;
    let last = 0;
    const onFocus = () => {
      const now = Date.now();
      if (now - last < 5000) return;
      last = now;
      getInstalledAppsMap(catalogApps).then(setInstalledMap);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isDesktop, catalogApps]);

  // Listen to Tauri download progress events when running in Desktop runtime
  useEffect(() => {
    if (!isDesktop) return;
    let unlistenFn: (() => void) | undefined;

    import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<DownloadProgressPayload>("download-progress", (event) => {
          const payload = event.payload;
          setDownloadingMap((prev) => ({
            ...prev,
            [payload.appId]: payload,
          }));
        })
      )
      .then((unlisten) => {
        unlistenFn = unlisten;
      })
      .catch(() => {
        // Ignore if not in Tauri context
      });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [isDesktop]);

  const handleInstallSpecificAsset = async (
    app: GloriaAppEntry,
    asset: ReleaseAssetInfo,
    version: string
  ) => {
    if (!isDesktop) {
      await openExternalUrl(asset.browserDownloadUrl);
      return;
    }

    setDownloadingMap((prev) => ({
      ...prev,
      [app.id]: {
        appId: app.id,
        downloadedBytes: 0,
        totalBytes: asset.size || 100,
        percent: 5,
        status: "Downloading...",
      },
    }));

    try {
      const record = await installDesktopAppRelease({
        appId: app.id,
        version,
        downloadUrl: asset.browserDownloadUrl,
        fileName: asset.name,
      });
      setInstalledMap((prev) => ({
        ...prev,
        [app.id]: record,
      }));
      showToast(t("toast.installStarted", { name: app.displayName, version }));
    } catch (err) {
      showToast(
        t("toast.installFailed", { name: app.displayName, error: err instanceof Error ? err.message : String(err) })
      );
    } finally {
      setDownloadingMap((prev) => {
        const next = { ...prev };
        delete next[app.id];
        return next;
      });
    }
  };

  /** Downloads the latest release installer and runs it (install or update). */
  const installLatestRelease = async (app: GloriaAppEntry) => {
    // Use already-synced release assets if present, otherwise fetch latest release
    let assets = app.releaseAssets;
    let releaseVersion = app.releaseTag || app.version;

    if (!assets || assets.length === 0) {
      const rel = await fetchAppReleaseInfo(app.id, githubToken);
      assets = rel?.assets;
      releaseVersion = rel?.version || releaseVersion;
    }

    const preferredAsset = pickPreferredReleaseAsset(assets || []);

    if (preferredAsset) {
      await handleInstallSpecificAsset(app, preferredAsset, releaseVersion);
    } else {
      // Open the detail drawer so user can inspect README, locate local .exe, or open repo
      setDrawerApp(app);
    }
  };

  const handleUpdate = async (app: GloriaAppEntry) => {
    if (!isDesktop) return;
    setSelectedAppId(app.id);
    await installLatestRelease(app);
  };

  const handlePrimaryAction = async (
    app: GloriaAppEntry,
    isInstalled: boolean
  ) => {
    setSelectedAppId(app.id);

    if (isDesktop) {
      if (isInstalled) {
        try {
          await launchDesktopApp(app.id);
          showToast(t("toast.launched", { name: app.displayName }));
        } catch (err) {
          showToast(
            t("toast.launchFailed", { name: app.displayName, error: err instanceof Error ? err.message : String(err) })
          );
          setDrawerApp(app);
        }
        return;
      }

      await installLatestRelease(app);
      return;
    }

    // WEB MODE (GitHub Pages): nothing is ever "installed" here, so Install
    // downloads the Windows installer, or opens the app's own page (store,
    // marketplace, site) when there is no installer.
    const asset = pickPreferredReleaseAsset(app.releaseAssets || []);
    if (asset) {
      await openExternalUrl(asset.browserDownloadUrl);
    } else if (app.webUrl) {
      await openExternalUrl(app.webUrl);
    } else {
      setDrawerApp(app);
    }
  };

  const handleUninstall = async (app: GloriaAppEntry) => {
    if (!isDesktop || !installedMap[app.id]) return;
    try {
      await uninstallDesktopApp(app.id);
      setInstalledMap((prev) => {
        const next = { ...prev };
        delete next[app.id];
        return next;
      });
      showToast(t("toast.uninstalled", { name: app.displayName }));
    } catch (err) {
      showToast(t("toast.uninstallError", { error: err instanceof Error ? err.message : String(err) }));
    }
  };

  const handleSaveToken = (token: string) => {
    setGithubToken(token);
    try {
      localStorage.setItem(GH_TOKEN_STORAGE_KEY, token);
    } catch {
      // Ignore
    }
    loadData(true);
  };

  const handleRescan = async () => {
    const freshMap = await getInstalledAppsMap(apps);
    setInstalledMap(freshMap);
    showToast(t("toast.rescanned"));
  };

  // Filter & Sort logic
  const { installedApps, availableApps } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = apps.filter((app) => {
      if (selectedCategory !== "ALL" && app.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        app.displayName.toLowerCase().includes(q) ||
        app.subtitle.toLowerCase().includes(q) ||
        app.tagline.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q) ||
        app.techStack.some((t) => t.toLowerCase().includes(q))
      );
    });

    const sorter = (a: GloriaAppEntry, b: GloriaAppEntry) => {
      if (sortBy === "name-asc") {
        return a.displayName.localeCompare(b.displayName);
      }
      if (sortBy === "updated-desc") {
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      }
      if (sortBy === "category") {
        return (
          a.category.localeCompare(b.category) ||
          a.displayName.localeCompare(b.displayName)
        );
      }
      return a.displayName.localeCompare(b.displayName);
    };

    const inst: GloriaAppEntry[] = [];
    const avail: GloriaAppEntry[] = [];

    for (const app of filtered) {
      if (installedMap[app.id]) {
        inst.push(app);
      } else {
        avail.push(app);
      }
    }

    inst.sort(sorter);
    avail.sort(sorter);

    return { installedApps: inst, availableApps: avail };
  }, [apps, installedMap, searchQuery, selectedCategory, sortBy]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b0b0c] text-[#f2f1ee] overflow-hidden select-none">
      {/* Top Bar */}
      <Titlebar
        activeMode={activeMode}
        onChangeMode={setActiveMode}
        onOpenSettings={() => setSettingsOpen(true)}
        totalAppsCount={apps.length}
        installedCount={Object.keys(installedMap).length}
      />
      <UpdateBanner onError={showToast} />

      {/* Main Content Area */}
      {activeMode === "launcher" ? (
        <>
          <Toolbar
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            sortBy={sortBy}
            onChangeSortBy={setSortBy}
            searchQuery={searchQuery}
            onChangeSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            onChangeCategory={setSelectedCategory}
            isSyncing={isSyncing}
            onRefresh={() => loadData(true)}
          />

          {/* Clicking anywhere that isn't an app card clears the selection */}
          <div
            className="flex-1 min-h-0 flex flex-col"
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest("[data-app-card]")) {
                setSelectedAppId(null);
              }
            }}
          >
          {viewMode === "grid" ? (
            <AppGridView
              installedApps={installedApps}
              availableApps={availableApps}
              installedMap={installedMap}
              activeAppId={selectedAppId}
              downloadingMap={downloadingMap}
              isSyncing={isSyncing}
              isCatalogEmpty={apps.length === 0}
              onSelectApp={(app) => {
                setSelectedAppId(app.id);
                setDrawerApp(app);
              }}
              onPrimaryAction={handlePrimaryAction}
              onUpdate={handleUpdate}
              onOpenDetails={(app) => {
                setSelectedAppId(app.id);
                setDrawerApp(app);
              }}
            />
          ) : (
            <AppTableView
              installedApps={installedApps}
              availableApps={availableApps}
              installedMap={installedMap}
              activeAppId={selectedAppId}
              downloadingMap={downloadingMap}
              isSyncing={isSyncing}
              isCatalogEmpty={apps.length === 0}
              sortBy={sortBy}
              onChangeSortBy={setSortBy}
              onSelectApp={(app) => {
                setSelectedAppId(app.id);
                setDrawerApp(app);
              }}
              onPrimaryAction={handlePrimaryAction}
              onUpdate={handleUpdate}
              onOpenDetails={(app) => {
                setSelectedAppId(app.id);
                setDrawerApp(app);
              }}
            />
          )}
          </div>
        </>
      ) : (
        <ShowcaseView
          apps={apps}
          installedMap={installedMap}
          onSwitchToLauncher={() => setActiveMode("launcher")}
          onInspectApp={(app) => {
            setSelectedAppId(app.id);
            setDrawerApp(app);
          }}
          onPrimaryAction={handlePrimaryAction}
        />
      )}

      {/* Bottom Status Bar */}
      <FooterBar
        checkedAt={checkedAt}
        isSyncing={isSyncing}
        totalApps={apps.length}
        installedCount={Object.keys(installedMap).length}
      />

      {/* Slide-over App Inspector Drawer */}
      <AppDetailDrawer
        app={drawerAppView}
        installedRecord={drawerApp ? installedMap[drawerApp.id] : undefined}
        downloadProgress={drawerApp ? downloadingMap[drawerApp.id] : undefined}
        githubToken={githubToken}
        onClose={() => {
          setDrawerApp(null);
          setSelectedAppId(null);
        }}
        onPrimaryAction={handlePrimaryAction}
        onUpdate={handleUpdate}
        onInstallSpecificAsset={handleInstallSpecificAsset}
        onUninstall={handleUninstall}
        onCustomExeBound={(record) => {
          setInstalledMap((prev) => ({
            ...prev,
            [record.appId]: record,
          }));
          showToast(
            t("toast.exeLinked", {
              name:
                apps.find((a) => a.id === record.appId)?.displayName ??
                record.appId,
            })
          );
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        githubToken={githubToken}
        onSaveToken={handleSaveToken}
        onRescan={handleRescan}
        runInTray={runInTray}
        onRunInTrayChange={handleRunInTrayChange}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-11 right-5 z-50 px-4 py-2.5 bg-[#141418] border border-[#32323e] shadow-xl flex items-center gap-2.5">
          <span className="w-2 h-2 bg-[#00f0ff] rounded-full" />
          <span className="font-mono-code text-[11px] tracking-[0.12em] text-[#f2f1ee] uppercase">
            {toastMessage}
          </span>
        </div>
      )}

      {splashMounted && (
        <ScanningSplash phase={scanPhase} leaving={scanPhase === "done"} />
      )}
    </div>
  );
};
export default App;
