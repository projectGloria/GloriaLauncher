import type { InstalledAppRecord, GloriaAppEntry } from "../types/app";

const WEB_PINNED_KEY = "gloria_launcher_web_pinned_v1";

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
        candidates: catalog
          .filter((a) => a.localExeCandidates && a.localExeCandidates.length > 0)
          .map((a) => ({
            appId: a.id,
            version: a.version,
            candidates: a.localExeCandidates || [],
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

  // In Web mode, we treat featured/pinned apps as the top "Pinned / Web Suite" row,
  // and allow the user to pin/unpin apps locally via localStorage.
  try {
    const raw = localStorage.getItem(WEB_PINNED_KEY);
    if (raw) {
      return JSON.parse(raw) as Record<string, InstalledAppRecord>;
    }
  } catch {
    // Ignore
  }

  const defaultMap: Record<string, InstalledAppRecord> = {};
  for (const app of catalog) {
    if (app.featured) {
      defaultMap[app.id] = {
        appId: app.id,
        version: app.version,
        executablePath: app.webUrl || app.repoUrl,
        installDir: "web",
        installedAt: app.updatedAt,
        source: "github-release",
      };
    }
  }
  return defaultMap;
}

export function saveWebPinnedApps(map: Record<string, InstalledAppRecord>): void {
  try {
    localStorage.setItem(WEB_PINNED_KEY, JSON.stringify(map));
  } catch {
    // Ignore
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
