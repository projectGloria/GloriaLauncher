import React, { useEffect, useMemo, useState, useCallback } from "react";
import type {
  AppCategory,
  DownloadProgressPayload,
  GloriaAppEntry,
  InstalledAppRecord,
  ReleaseAssetInfo,
} from "./types/app";
import { GLORIA_CATALOG } from "./data/gloriaCatalog";
import {
  fetchAppReleaseInfo,
  syncCatalogWithGitHub,
} from "./services/githubService";
import {
  getInstalledAppsMap,
  installDesktopAppRelease,
  isTauriDesktop,
  launchDesktopApp,
  openExternalUrl,
  saveWebPinnedApps,
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

const GH_TOKEN_STORAGE_KEY = "gloria_launcher_gh_token";

export const App: React.FC = () => {
  const [apps, setApps] = useState<GloriaAppEntry[]>(GLORIA_CATALOG);
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
  const [selectedAppId, setSelectedAppId] = useState<string | null>("OmniConvert");
  const [drawerApp, setDrawerApp] = useState<GloriaAppEntry | null>(null);
  const [downloadingMap, setDownloadingMap] = useState<
    Record<string, DownloadProgressPayload>
  >({});
  const [checkedAt, setCheckedAt] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [githubToken, setGithubToken] = useState<string>(() => {
    try {
      return localStorage.getItem(GH_TOKEN_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
        const [{ apps: syncedApps, checkedAt: syncedTime }, instMap] =
          await Promise.all([
            syncCatalogWithGitHub({ force, githubToken }),
            getInstalledAppsMap(GLORIA_CATALOG),
          ]);
        setApps(syncedApps);
        setCheckedAt(syncedTime);
        setInstalledMap(instMap);
      } finally {
        setIsSyncing(false);
      }
    },
    [githubToken]
  );

  useEffect(() => {
    loadData(false);
  }, [loadData]);

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
      showToast(`Installed ${app.displayName} v${version}`);
    } catch (err) {
      showToast(
        `Install failed for ${app.displayName}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setDownloadingMap((prev) => {
        const next = { ...prev };
        delete next[app.id];
        return next;
      });
    }
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
          showToast(`Launched ${app.displayName}`);
        } catch (err) {
          showToast(
            `Could not launch ${app.displayName}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
          setDrawerApp(app);
        }
        return;
      }

      // Check if there is a GitHub release binary to install automatically
      const rel = await fetchAppReleaseInfo(app.id, githubToken);
      const preferredAsset = rel?.assets.find((a) =>
        /\.(exe|msi|zip)$/i.test(a.name)
      );

      if (rel && preferredAsset) {
        await handleInstallSpecificAsset(
          app,
          preferredAsset,
          rel.version || app.version
        );
      } else {
        // Open the detail drawer so user can inspect README, locate local .exe, or open repo
        setDrawerApp(app);
      }
      return;
    }

    // WEB MODE (GitHub Pages)
    if (isInstalled) {
      if (app.webUrl) {
        await openExternalUrl(app.webUrl);
      } else {
        setDrawerApp(app);
      }
      return;
    }

    // Clicking "INSTALL" or "LAUNCH" on an unpinned card in Web Mode:
    // If it has a direct webUrl, open it; otherwise pin it to the user's top suite & open inspector drawer
    const newRecord: InstalledAppRecord = {
      appId: app.id,
      version: app.version,
      executablePath: app.webUrl || app.repoUrl,
      installDir: "web",
      installedAt: new Date().toISOString(),
      source: "github-release",
    };
    const updatedMap = { ...installedMap, [app.id]: newRecord };
    setInstalledMap(updatedMap);
    saveWebPinnedApps(updatedMap);
    setDrawerApp(app);
    showToast(`${app.displayName} added to your active suite`);
  };

  const handleUninstallOrUnpin = async (app: GloriaAppEntry) => {
    if (isDesktop) {
      if (!installedMap[app.id]) return;
      try {
        await uninstallDesktopApp(app.id);
        setInstalledMap((prev) => {
          const next = { ...prev };
          delete next[app.id];
          return next;
        });
        showToast(`Uninstalled ${app.displayName}`);
      } catch (err) {
        showToast(
          `Uninstall error: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      return;
    }

    // Web Mode: toggle pin
    setInstalledMap((prev) => {
      const next = { ...prev };
      if (next[app.id]) {
        delete next[app.id];
        showToast(`Removed ${app.displayName} from pinned suite`);
      } else {
        next[app.id] = {
          appId: app.id,
          version: app.version,
          executablePath: app.webUrl || app.repoUrl,
          installDir: "web",
          installedAt: new Date().toISOString(),
          source: "github-release",
        };
        showToast(`Pinned ${app.displayName} to top suite`);
      }
      saveWebPinnedApps(next);
      return next;
    });
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

  const handleResetPinned = async () => {
    try {
      localStorage.removeItem("gloria_launcher_web_pinned_v1");
    } catch {
      // Ignore
    }
    const freshMap = await getInstalledAppsMap(apps);
    setInstalledMap(freshMap);
    showToast(
      isDesktop
        ? "Rescanned local workspace executables"
        : "Reset default pinned apps"
    );
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

          {viewMode === "grid" ? (
            <AppGridView
              installedApps={installedApps}
              availableApps={availableApps}
              installedMap={installedMap}
              activeAppId={selectedAppId}
              downloadingMap={downloadingMap}
              onSelectApp={(app) => {
                setSelectedAppId(app.id);
                setDrawerApp(app);
              }}
              onPrimaryAction={handlePrimaryAction}
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
              sortBy={sortBy}
              onChangeSortBy={setSortBy}
              onSelectApp={(app) => {
                setSelectedAppId(app.id);
                setDrawerApp(app);
              }}
              onPrimaryAction={handlePrimaryAction}
              onOpenDetails={(app) => {
                setSelectedAppId(app.id);
                setDrawerApp(app);
              }}
            />
          )}
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
        app={drawerApp}
        installedRecord={drawerApp ? installedMap[drawerApp.id] : undefined}
        downloadProgress={drawerApp ? downloadingMap[drawerApp.id] : undefined}
        githubToken={githubToken}
        onClose={() => setDrawerApp(null)}
        onPrimaryAction={handlePrimaryAction}
        onInstallSpecificAsset={handleInstallSpecificAsset}
        onUninstallOrUnpin={handleUninstallOrUnpin}
        onCustomExeBound={(record) => {
          setInstalledMap((prev) => ({
            ...prev,
            [record.appId]: record,
          }));
          showToast(`Linked local executable for ${record.appId}`);
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        githubToken={githubToken}
        onSaveToken={handleSaveToken}
        onResetPinned={handleResetPinned}
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
    </div>
  );
};
export default App;
