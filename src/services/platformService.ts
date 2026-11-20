import type {
  InstalledAppRecord,
  GloriaAppEntry,
  ReleaseAssetInfo,
} from "../types/app";

export function isTauriDesktop(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

export async function openExternalUrl(url: string): Promise<void> {
  if (isTauriDesktop()) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch {
      // Fallback to window.open
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function getInstalledAppsMap(
  catalog: GloriaAppEntry[]
): Promise<Record<string, InstalledAppRecord>> {
  if (isTauriDesktop()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const records = await invoke<InstalledAppRecord[]>("get_installed_apps", {
        // Every app is sent so the backend can also match it against Windows'
        // installed programs, not only against local workspace builds.
        candidates: catalog.map((a) => ({
          appId: a.id,
          version: a.version,
          candidates: a.localExeCandidates || [],
          names: [a.displayName, `${a.titlePrefix ?? ""}${a.titleAccent ?? ""}`].filter(
            (n): n is string => !!n && n.trim() !== ""
          ),
        })),
      });
      const map: Record<string, InstalledAppRecord> = {};
      for (const rec of records) {
        map[rec.appId] = rec;
      }
      return map;
    } catch (err) {
      console.warn("Failed to invoke get_installed_apps:", err);
    }
  }

  // Web: a browser can't see what's installed on this PC, so nothing is
  // reported as installed. Detection is a desktop launcher feature.
  return {};
}

export interface NativeRepoRelease {
  repo: string;
  tag: string;
  publishedAt?: string | null;
  assets: ReleaseAssetInfo[];
}

export interface NativeRepoSummary {
  name: string;
  description?: string | null;
  language?: string | null;
  updatedAt?: string | null;
}

/**
 * Desktop only: lists public repos from the github.com profile pages. Used when
 * the REST API refuses (e.g. the 60 req/hr anonymous limit is used up).
 */
export async function listPublicReposDesktop(
  owner: string
): Promise<NativeRepoSummary[] | null> {
  if (!isTauriDesktop()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<NativeRepoSummary[]>("list_public_repos", { owner });
  } catch (err) {
    console.warn("Failed to invoke list_public_repos:", err);
    return null;
  }
}

/**
 * Desktop only: returns the repos that have a real GitHub Release (bare git tags
 * are excluded) together with that release's assets, without using the REST API.
 * Returns null outside the desktop runtime or if the native call fails.
 */
export async function filterReposWithReleasesDesktop(
  owner: string,
  repoNames: string[]
): Promise<NativeRepoRelease[] | null> {
  if (!isTauriDesktop()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<NativeRepoRelease[]>("filter_repos_with_releases", {
      owner,
      repoNames,
    });
  } catch (err) {
    console.warn("Failed to invoke filter_repos_with_releases:", err);
    return null;
  }
}

export async function installDesktopAppRelease(params: {
  appId: string;
  version: string;
  downloadUrl: string;
  fileName: string;
}): Promise<InstalledAppRecord> {
  const { invoke } = await import("@tauri-apps/api/core");
  return await invoke<InstalledAppRecord>("install_app_release", params);
}

export async function bindCustomExecutable(
  appId: string,
  version: string
): Promise<InstalledAppRecord | null> {
  if (!isTauriDesktop()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: false,
    title: `Select executable for ${appId}`,
    filters: [{ name: "Executable", extensions: ["exe", "bat", "cmd"] }],
  });
  if (!selected || typeof selected !== "string") return null;

  const { invoke } = await import("@tauri-apps/api/core");
  return await invoke<InstalledAppRecord>("register_custom_executable", {
    appId,
    version,
    executablePath: selected,
  });
}

export async function launchDesktopApp(appId: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("launch_installed_app", { appId });
}

export async function uninstallDesktopApp(appId: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("uninstall_app", { appId });
}

/** Progress events for the launcher's own update carry this appId. */
export const LAUNCHER_UPDATE_PROGRESS_ID = "__launcher__";

export interface LauncherUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  publishedAt?: string | null;
  releaseUrl: string;
  downloadUrl: string;
  fileName: string;
}

/** Returns the newer GloriaLauncher release, or null when up to date (or on web). */
export async function checkLauncherUpdate(): Promise<LauncherUpdateInfo | null> {
  if (!isTauriDesktop()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<LauncherUpdateInfo | null>("check_launcher_update");
  } catch (err) {
    console.warn("Failed to check for launcher updates:", err);
    return null;
  }
}

/** Downloads and starts the new launcher installer; the app then closes itself. */
export async function installLauncherUpdate(update: LauncherUpdateInfo): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("install_launcher_update", {
    downloadUrl: update.downloadUrl,
    fileName: update.fileName,
  });
}

export async function openAppInstallFolder(appId: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("open_install_folder", { appId });
}

export async function minimizeWindow(): Promise<void> {
  if (!isTauriDesktop()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().minimize();
}

export async function toggleMaximizeWindow(): Promise<void> {
  if (!isTauriDesktop()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().toggleMaximize();
}

export async function closeWindow(): Promise<void> {
  if (!isTauriDesktop()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}
