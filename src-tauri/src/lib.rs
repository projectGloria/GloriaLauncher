use futures_util::stream::{self, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

const GLORIA_ICO_BYTES: &[u8] = include_bytes!("../../Gloria.ico");

#[cfg(target_os = "windows")]
mod win_shell {
    use std::ffi::OsStr;
    use std::fs;
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;

    const FILE_ATTRIBUTE_READONLY: u32 = 0x0000_0001;
    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x0000_0002;
    const FILE_ATTRIBUTE_SYSTEM: u32 = 0x0000_0004;
    const FILE_ATTRIBUTE_NORMAL: u32 = 0x0000_0080;
    const SHCNE_UPDATEDIR: i32 = 0x0000_1000;
    const SHCNF_PATHW: u32 = 0x0005;
    const SW_SHOWNORMAL: i32 = 1;

    #[link(name = "kernel32")]
    extern "system" {
        fn SetFileAttributesW(lpFileName: *const u16, dwFileAttributes: u32) -> i32;
    }

    #[link(name = "shell32")]
    extern "system" {
        fn ShellExecuteW(
            hwnd: isize,
            lpOperation: *const u16,
            lpFile: *const u16,
            lpParameters: *const u16,
            lpDirectory: *const u16,
            nShowCmd: i32,
        ) -> isize;
        fn SHChangeNotify(
            wEventId: i32,
            uFlags: u32,
            dwItem1: *const u16,
            dwItem2: *const u16,
        );
    }

    fn to_wide(s: &OsStr) -> Vec<u16> {
        s.encode_wide().chain(std::iter::once(0)).collect()
    }

    fn set_attrs(path: &Path, attrs: u32) {
        let wide = to_wide(path.as_os_str());
        unsafe {
            SetFileAttributesW(wide.as_ptr(), attrs);
        }
    }

    pub fn apply_folder_icon(folder: &Path, ico_bytes: &[u8]) -> Result<(), String> {
        let ico_path = folder.join("Gloria.ico");
        let needs_ico_write = match fs::metadata(&ico_path) {
            Ok(meta) => meta.len() != ico_bytes.len() as u64,
            Err(_) => true,
        };
        if needs_ico_write {
            if ico_path.exists() {
                set_attrs(&ico_path, FILE_ATTRIBUTE_NORMAL);
            }
            fs::write(&ico_path, ico_bytes)
                .map_err(|e| format!("Failed to write Gloria.ico: {e}"))?;
        }
        set_attrs(&ico_path, FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM);

        let ini_path = folder.join("desktop.ini");
        let ini_content = "[.ShellClassInfo]\r\nIconResource=Gloria.ico,0\r\nIconFile=Gloria.ico\r\nIconIndex=0\r\n";
        let needs_ini_write = match fs::read_to_string(&ini_path) {
            Ok(existing) => existing != ini_content,
            Err(_) => true,
        };
        if needs_ini_write {
            if ini_path.exists() {
                set_attrs(&ini_path, FILE_ATTRIBUTE_NORMAL);
            }
            fs::write(&ini_path, ini_content)
                .map_err(|e| format!("Failed to write desktop.ini: {e}"))?;
        }
        set_attrs(&ini_path, FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM);

        // Windows Explorer only reads desktop.ini when the folder has the Read-Only attribute set.
        set_attrs(folder, FILE_ATTRIBUTE_READONLY);

        let folder_wide = to_wide(folder.as_os_str());
        unsafe {
            SHChangeNotify(
                SHCNE_UPDATEDIR,
                SHCNF_PATHW,
                folder_wide.as_ptr(),
                std::ptr::null(),
            );
        }

        Ok(())
    }

    pub fn shell_open_path(path: &Path) -> Result<(), String> {
        let op = to_wide(OsStr::new("open"));
        let file = to_wide(path.as_os_str());
        let dir = path
            .parent()
            .map(|p| to_wide(p.as_os_str()))
            .unwrap_or_else(|| to_wide(OsStr::new(".")));

        let result = unsafe {
            ShellExecuteW(
                0,
                op.as_ptr(),
                file.as_ptr(),
                std::ptr::null(),
                dir.as_ptr(),
                SW_SHOWNORMAL,
            )
        };

        if result <= 32 {
            Err(format!(
                "Failed to launch installer (ShellExecuteW code {result})"
            ))
        } else {
            Ok(())
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledAppRecord {
    pub app_id: String,
    pub version: String,
    pub executable_path: String,
    pub install_dir: String,
    pub installed_at: String,
    pub source: String,
    /// Uninstall command from the Windows "installed programs" list, for apps
    /// detected there (source "system").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uninstall_command: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalCandidateInput {
    pub app_id: String,
    pub version: String,
    #[serde(default)]
    pub candidates: Vec<String>,
    /// Names the app may be listed under in Windows' installed programs.
    #[serde(default)]
    pub names: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressPayload {
    pub app_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percent: f64,
    pub status: String,
}

fn launcher_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Failed to resolve local app data dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create launcher root dir: {e}"))?;
    Ok(dir)
}

fn downloads_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base_downloads = app
        .path()
        .download_dir()
        .ok()
        .or_else(|| {
            std::env::var_os("USERPROFILE").map(|p| PathBuf::from(p).join("Downloads"))
        })
        .ok_or_else(|| "Failed to resolve system Downloads folder".to_string())?;

    let dir = base_downloads.join("GloriaLauncherDownloads");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create GloriaLauncherDownloads dir: {e}"))?;

    #[cfg(target_os = "windows")]
    {
        if let Err(err) = win_shell::apply_folder_icon(&dir, GLORIA_ICO_BYTES) {
            eprintln!("Warning: could not apply folder icon to {}: {err}", dir.display());
        }
    }

    Ok(dir)
}

fn launch_path_with_shell(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        win_shell::shell_open_path(path)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let working_dir = path.parent().unwrap_or_else(|| Path::new("."));
        Command::new(path)
            .current_dir(working_dir)
            .spawn()
            .map_err(|e| format!("Failed to spawn process: {e}"))?;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeReleaseAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
    pub content_type: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeRepoRelease {
    pub repo: String,
    pub tag: String,
    pub published_at: Option<String>,
    pub assets: Vec<NativeReleaseAsset>,
}

/// Extracts (tag, updated) pairs from a GitHub releases.atom feed, newest first.
/// Note: this feed also lists bare git tags that have no GitHub Release attached.
fn parse_atom_tags(body: &str) -> Vec<(String, Option<String>)> {
    let mut out = Vec::new();
    for entry in body.split("<entry>").skip(1) {
        let Some(idx) = entry.find("/releases/tag/") else {
            continue;
        };
        let rest = &entry[idx + "/releases/tag/".len()..];
        let Some(end) = rest.find('"') else { continue };
        let tag = rest[..end].to_string();
        let updated = entry
            .find("<updated>")
            .and_then(|s| {
                let r = &entry[s + "<updated>".len()..];
                r.find("</updated>").map(|e| r[..e].to_string())
            });
        out.push((tag, updated));
    }
    out
}

/// Parses the asset download links out of GitHub's `releases/expanded_assets/{tag}` HTML.
/// A bare tag (no Release) renders this page with no `/releases/download/` links.
fn parse_expanded_assets(body: &str, owner: &str, repo: &str, tag: &str) -> Vec<NativeReleaseAsset> {
    let prefix = format!("href=\"/{owner}/{repo}/releases/download/{tag}/");
    let mut seen = std::collections::HashSet::new();
    let mut assets = Vec::new();
    let mut cursor = body;
    while let Some(pos) = cursor.find(&prefix) {
        let rest = &cursor[pos + prefix.len()..];
        let Some(end) = rest.find('"') else { break };
        let encoded_name = &rest[..end];
        cursor = &rest[end..];
        if encoded_name.is_empty() || !seen.insert(encoded_name.to_string()) {
            continue;
        }
        let name = percent_decode(encoded_name);
        assets.push(NativeReleaseAsset {
            browser_download_url: format!(
                "https://github.com/{owner}/{repo}/releases/download/{tag}/{encoded_name}"
            ),
            name,
            size: 0,
            content_type: "application/octet-stream".to_string(),
        });
    }
    assets
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Some(v) = std::str::from_utf8(&bytes[i + 1..i + 3])
                .ok()
                .and_then(|h| u8::from_str_radix(h, 16).ok())
            {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

async fn find_latest_release(
    client: &reqwest::Client,
    owner: &str,
    repo: &str,
) -> Option<NativeRepoRelease> {
    let feed_url = format!("https://github.com/{owner}/{repo}/releases.atom");
    let resp = client.get(&feed_url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body = resp.text().await.ok()?;

    // Walk the newest few feed entries and keep the first one that is a real
    // Release (i.e. has downloadable assets), skipping bare git tags.
    for (tag, updated) in parse_atom_tags(&body).into_iter().take(5) {
        let url = format!("https://github.com/{owner}/{repo}/releases/expanded_assets/{tag}");
        let Ok(resp) = client.get(&url).send().await else {
            continue;
        };
        if !resp.status().is_success() {
            continue;
        }
        let Ok(html) = resp.text().await else { continue };
        let assets = parse_expanded_assets(&html, owner, repo, &tag);
        if !assets.is_empty() {
            return Some(NativeRepoRelease {
                repo: repo.to_string(),
                tag,
                published_at: updated,
                assets,
            });
        }
    }
    None
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeRepoSummary {
    pub name: String,
    pub description: Option<String>,
    pub language: Option<String>,
    pub updated_at: Option<String>,
}

fn decode_html_entities(s: &str) -> String {
    s.replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&#x27;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
}

fn text_between<'a>(haystack: &'a str, start: &str, end: &str) -> Option<&'a str> {
    let s = haystack.find(start)? + start.len();
    let rest = &haystack[s..];
    let e = rest.find(end)?;
    Some(&rest[..e])
}

/// Parses one page of `github.com/{owner}?tab=repositories`.
fn parse_profile_repos(body: &str, owner: &str) -> Vec<NativeRepoSummary> {
    let marker = "itemprop=\"name codeRepository\"";
    let href_prefix = format!("<a href=\"/{owner}/");
    let mut repos = Vec::new();
    let chunks: Vec<&str> = body.split(marker).collect();
    for i in 0..chunks.len().saturating_sub(1) {
        // The repo link opens at the end of chunk i; its details follow in chunk i + 1.
        let before = chunks[i];
        let Some(href_pos) = before.rfind(&href_prefix) else {
            continue;
        };
        let name = before[href_pos + href_prefix.len()..]
            .split('"')
            .next()
            .unwrap_or("")
            .trim()
            .to_string();
        if name.is_empty() || name.contains('/') {
            continue;
        }
        let details = chunks[i + 1];
        let description = text_between(details, "itemprop=\"description\">", "</p>")
            .map(|d| decode_html_entities(d.trim()))
            .filter(|d| !d.is_empty());
        let language = text_between(details, "itemprop=\"programmingLanguage\">", "<")
            .map(|l| decode_html_entities(l.trim()))
            .filter(|l| !l.is_empty());
        let updated_at = text_between(details, "<relative-time datetime=\"", "\"")
            .map(|d| d.to_string());
        repos.push(NativeRepoSummary {
            name,
            description,
            language,
            updated_at,
        });
    }
    repos
}

/// Lists an account's public repositories from its github.com profile pages.
/// Used as a fallback when the REST API is rate-limited (60 req/hr unauthenticated).
#[tauri::command]
async fn list_public_repos(owner: String) -> Result<Vec<NativeRepoSummary>, String> {
    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let mut all = Vec::new();
    for page in 1..=20 {
        let url = format!("https://github.com/{owner}?tab=repositories&page={page}");
        let resp = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to load repository list: {e}"))?;
        if !resp.status().is_success() {
            if all.is_empty() {
                return Err(format!("Repository list returned HTTP {}", resp.status()));
            }
            break;
        }
        let body = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read repository list: {e}"))?;
        let repos = parse_profile_repos(&body, &owner);
        if repos.is_empty() {
            break;
        }
        all.extend(repos);
        if !body.contains("rel=\"next\"") {
            break;
        }
    }
    Ok(all)
}

/// Returns only repositories that have at least one published GitHub Release
/// with downloadable assets, along with that latest release's assets.
/// Uses public github.com pages so it does not consume the REST API quota.
#[tauri::command]
async fn filter_repos_with_releases(
    owner: String,
    repo_names: Vec<String>,
) -> Result<Vec<NativeRepoRelease>, String> {
    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let results: Vec<Option<NativeRepoRelease>> =
        stream::iter(repo_names.into_iter().map(|repo| {
            let client = client.clone();
            let owner = owner.clone();
            async move { find_latest_release(&client, &owner, &repo).await }
        }))
        .buffer_unordered(12)
        .collect()
        .await;

    Ok(results.into_iter().flatten().collect())
}

fn registry_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(launcher_root_dir(app)?.join("installed_apps.json"))
}

fn load_registry(app: &AppHandle) -> HashMap<String, InstalledAppRecord> {
    let Ok(path) = registry_file_path(app) else {
        return HashMap::new();
    };
    let Ok(content) = fs::read_to_string(path) else {
        return HashMap::new();
    };
    serde_json::from_str::<HashMap<String, InstalledAppRecord>>(&content).unwrap_or_default()
}

fn save_registry(
    app: &AppHandle,
    map: &HashMap<String, InstalledAppRecord>,
) -> Result<(), String> {
    let path = registry_file_path(app)?;
    let json = serde_json::to_string_pretty(map)
        .map_err(|e| format!("Failed to serialize registry: {e}"))?;
    fs::write(path, json).map_err(|e| format!("Failed to write registry file: {e}"))
}

fn detect_workspace_parent() -> Option<PathBuf> {
    // Check if current exe or working directory is inside 'Gloria Repoz'
    if let Ok(cwd) = std::env::current_dir() {
        for ancestor in cwd.ancestors() {
            if ancestor
                .file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.eq_ignore_ascii_case("Gloria Repoz"))
                .unwrap_or(false)
            {
                return Some(ancestor.to_path_buf());
            }
        }
        if let Some(parent) = cwd.parent() {
            return Some(parent.to_path_buf());
        }
    }
    None
}

/// Reads the Windows "installed programs" (Uninstall) registry keys.
mod system_installed {
    use super::{InstalledAppRecord, LocalCandidateInput};
    use std::path::{Path, PathBuf};

    #[derive(Debug, Clone)]
    pub struct SystemApp {
        pub display_name: String,
        pub version: String,
        pub install_location: Option<PathBuf>,
        pub display_icon: Option<String>,
        pub uninstall_command: Option<String>,
    }

    /// Lowercase alphanumerics only: "Faceit-Autopilot" -> "faceitautopilot".
    pub fn normalize(s: &str) -> String {
        s.chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .map(|c| c.to_ascii_lowercase())
            .collect()
    }

    /// Drops a trailing version from a display name: "Keystroker 0.1.0" -> "Keystroker".
    pub fn strip_version(name: &str) -> &str {
        let trimmed = name.trim();
        if let Some((head, last)) = trimmed.rsplit_once(' ') {
            let v = last.trim_start_matches(['v', 'V']);
            if v.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
                return head.trim_end();
            }
        }
        trimmed
    }

    fn is_helper_exe(file_name: &str) -> bool {
        let n = file_name.to_ascii_lowercase();
        n.starts_with("unins")
            || n.starts_with("uninstall")
            || n == "update.exe"
            || n.contains("squirrel")
            || n.contains("crashpad")
            || n.contains("elevate")
    }

    /// "\"C:\\x\\app.exe\",0" -> C:\x\app.exe
    pub fn parse_icon_path(icon: &str) -> PathBuf {
        let s = icon.trim();
        let s = match s.rsplit_once(',') {
            Some((p, idx)) if idx.trim().trim_start_matches('-').parse::<i32>().is_ok() => p,
            _ => s,
        };
        PathBuf::from(s.trim().trim_matches('"'))
    }

    fn resolve_executable(app: &SystemApp, wanted: &[String]) -> Option<PathBuf> {
        if let Some(icon) = &app.display_icon {
            let p = parse_icon_path(icon);
            let ok_name = p
                .file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.to_ascii_lowercase().ends_with(".exe") && !is_helper_exe(n))
                .unwrap_or(false);
            if ok_name && p.is_file() {
                return Some(p);
            }
        }

        let dir = app.install_location.as_ref().filter(|d| d.is_dir())?;
        let exes: Vec<PathBuf> = std::fs::read_dir(dir)
            .ok()?
            .flatten()
            .map(|e| e.path())
            .filter(|p| {
                p.is_file()
                    && p.extension()
                        .and_then(|e| e.to_str())
                        .map(|e| e.eq_ignore_ascii_case("exe"))
                        .unwrap_or(false)
                    && !p
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(is_helper_exe)
                        .unwrap_or(true)
            })
            .collect();

        exes.iter()
            .find(|p| {
                let stem = p.file_stem().and_then(|s| s.to_str()).map(normalize);
                stem.map(|s| wanted.contains(&s)).unwrap_or(false)
            })
            .or_else(|| exes.first())
            .cloned()
    }

    pub fn find_match(apps: &[SystemApp], item: &LocalCandidateInput) -> Option<InstalledAppRecord> {
        let mut wanted: Vec<String> = std::iter::once(item.app_id.as_str())
            .chain(item.names.iter().map(String::as_str))
            .map(normalize)
            .filter(|s| s.len() >= 3)
            .collect();
        wanted.dedup();
        if wanted.is_empty() {
            return None;
        }

        apps.iter()
            .filter(|a| wanted.contains(&normalize(strip_version(&a.display_name))))
            .find_map(|a| {
                let exe = resolve_executable(a, &wanted)?;
                let install_dir = a
                    .install_location
                    .clone()
                    .filter(|d| d.is_dir())
                    .or_else(|| exe.parent().map(Path::to_path_buf))
                    .unwrap_or_default();
                Some(InstalledAppRecord {
                    app_id: item.app_id.clone(),
                    version: if a.version.is_empty() {
                        item.version.clone()
                    } else {
                        a.version.clone()
                    },
                    executable_path: exe.to_string_lossy().to_string(),
                    install_dir: install_dir.to_string_lossy().to_string(),
                    installed_at: "Detected in Windows installed programs".to_string(),
                    source: "system".to_string(),
                    uninstall_command: a.uninstall_command.clone(),
                })
            })
    }

    #[cfg(target_os = "windows")]
    pub fn scan() -> Vec<SystemApp> {
        use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_32KEY, KEY_WOW64_64KEY};
        use winreg::RegKey;

        const UNINSTALL: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall";
        let roots = [
            (HKEY_CURRENT_USER, KEY_READ),
            (HKEY_LOCAL_MACHINE, KEY_READ | KEY_WOW64_64KEY),
            (HKEY_LOCAL_MACHINE, KEY_READ | KEY_WOW64_32KEY),
        ];

        let mut out = Vec::new();
        for (hive, flags) in roots {
            let Ok(key) = RegKey::predef(hive).open_subkey_with_flags(UNINSTALL, flags) else {
                continue;
            };
            for sub in key.enum_keys().flatten() {
                let Ok(app) = key.open_subkey_with_flags(&sub, flags) else {
                    continue;
                };
                let get = |name: &str| -> Option<String> {
                    app.get_value::<String, _>(name)
                        .ok()
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                };
                let Some(display_name) = get("DisplayName") else {
                    continue;
                };
                out.push(SystemApp {
                    display_name,
                    version: get("DisplayVersion").unwrap_or_default(),
                    install_location: get("InstallLocation")
                        .map(|s| PathBuf::from(s.trim_matches('"'))),
                    display_icon: get("DisplayIcon"),
                    uninstall_command: get("UninstallString"),
                });
            }
        }
        out
    }

    #[cfg(not(target_os = "windows"))]
    pub fn scan() -> Vec<SystemApp> {
        Vec::new()
    }
}

#[tauri::command]
fn get_installed_apps(
    app: AppHandle,
    candidates: Vec<LocalCandidateInput>,
) -> Result<Vec<InstalledAppRecord>, String> {
    Ok(detect_installed_apps(&app, candidates))
}

fn is_installer_file(path: &Path) -> bool {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase());
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();
    matches!(ext.as_deref(), Some("msi" | "msix" | "msixbundle"))
        || (ext.as_deref() == Some("exe")
            && (name.contains("setup") || name.contains("install")))
}

fn detect_installed_apps(
    app: &AppHandle,
    candidates: Vec<LocalCandidateInput>,
) -> Vec<InstalledAppRecord> {
    let mut reg = load_registry(app);

    // Prune entries whose executable no longer exists on disk, and legacy
    // "github-release" records that pointed at a downloaded installer rather
    // than an installed executable.
    reg.retain(|_, rec| {
        let p = Path::new(&rec.executable_path);
        p.exists() && !(rec.source == "github-release" && is_installer_file(p))
    });

    // Detect apps installed with their own installers (listed in Windows'
    // installed programs). This wins over a "github-release" record, and
    // removes stale "system" records when an app has been uninstalled.
    let system_apps = system_installed::scan();
    for item in &candidates {
        let existing_source = reg.get(&item.app_id).map(|rec| rec.source.as_str());
        if matches!(existing_source, Some(s) if s != "github-release" && s != "system") {
            continue;
        }
        if let Some(found) = system_installed::find_match(&system_apps, item) {
            reg.insert(item.app_id.clone(), found);
        } else if existing_source == Some("system") {
            reg.remove(&item.app_id);
        }
    }

    // Also auto-detect local sibling builds inside 'Gloria Repoz' if present
    if let Some(workspace_root) = detect_workspace_parent() {
        for item in candidates {
            if reg.contains_key(&item.app_id) {
                continue;
            }
            for rel in item.candidates {
                let candidate_path = workspace_root.join(&rel);
                if candidate_path.exists() && candidate_path.is_file() {
                    let install_dir = candidate_path
                        .parent()
                        .unwrap_or(&workspace_root)
                        .to_string_lossy()
                        .to_string();
                    reg.insert(
                        item.app_id.clone(),
                        InstalledAppRecord {
                            app_id: item.app_id.clone(),
                            version: item.version.clone(),
                            executable_path: candidate_path.to_string_lossy().to_string(),
                            install_dir,
                            installed_at: "Local Workspace Build".to_string(),
                            source: "local-workspace".to_string(),
                            uninstall_command: None,
                        },
                    );
                    break;
                }
            }
        }
    }

    let _ = save_registry(app, &reg);
    reg.into_values().collect()
}

const USER_AGENT: &str = concat!("GloriaLauncher/", env!("CARGO_PKG_VERSION"));
const GITHUB_OWNER: &str = "projectGloria";
const LAUNCHER_REPO: &str = "GloriaLauncher";
/// Progress events for the launcher's own update use this id.
const LAUNCHER_PROGRESS_ID: &str = "__launcher__";

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))
}

/// Downloads `url` into `target_file` (via a `.part` file), emitting
/// `download-progress` events tagged with `progress_id`.
async fn download_with_progress(
    app: &AppHandle,
    progress_id: &str,
    url: &str,
    target_file: &Path,
) -> Result<(), String> {
    let file_label = target_file
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();
    let partial_file = target_file.with_file_name(format!("{file_label}.part"));

    let response = http_client()?
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Download returned HTTP {}", response.status()));
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let mut downloaded_bytes: u64 = 0;
    let mut last_emitted_percent: f64 = -1.0;

    {
        let mut file =
            fs::File::create(&partial_file).map_err(|e| format!("Failed to create file: {e}"))?;
        let mut stream = response.bytes_stream();

        while let Some(chunk_res) = stream.next().await {
            let chunk = match chunk_res {
                Ok(c) => c,
                Err(e) => {
                    drop(file);
                    let _ = fs::remove_file(&partial_file);
                    return Err(format!("Download stream error: {e}"));
                }
            };
            if let Err(e) = file.write_all(&chunk) {
                drop(file);
                let _ = fs::remove_file(&partial_file);
                return Err(format!("Disk write error: {e}"));
            }
            downloaded_bytes += chunk.len() as u64;

            let percent = if total_bytes > 0 {
                ((downloaded_bytes as f64 / total_bytes as f64) * 100.0).min(99.0)
            } else {
                50.0
            };

            if percent - last_emitted_percent < 1.0 {
                continue;
            }
            last_emitted_percent = percent;

            let _ = app.emit(
                "download-progress",
                DownloadProgressPayload {
                    app_id: progress_id.to_string(),
                    downloaded_bytes,
                    total_bytes,
                    percent,
                    status: "Downloading...".to_string(),
                },
            );
        }
        file.flush().map_err(|e| format!("Flush error: {e}"))?;
    }

    if target_file.exists() {
        fs::remove_file(target_file).map_err(|e| {
            format!("Could not replace existing {file_label} (is it still running?): {e}")
        })?;
    }
    fs::rename(&partial_file, target_file)
        .map_err(|e| format!("Failed to finalize download: {e}"))?;

    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            app_id: progress_id.to_string(),
            downloaded_bytes,
            total_bytes: total_bytes.max(downloaded_bytes),
            percent: 100.0,
            status: "Starting installer...".to_string(),
        },
    );
    Ok(())
}

/// Parses "v1.2.3" / "1.2.3-beta" into comparable numeric parts.
fn parse_version(v: &str) -> Vec<u64> {
    v.trim()
        .trim_start_matches(['v', 'V'])
        .split(['-', '+'])
        .next()
        .unwrap_or("")
        .split('.')
        .map(|p| p.parse::<u64>().unwrap_or(0))
        .collect()
}

fn is_newer_version(latest: &str, current: &str) -> bool {
    let (mut a, mut b) = (parse_version(latest), parse_version(current));
    let len = a.len().max(b.len());
    a.resize(len, 0);
    b.resize(len, 0);
    a > b
}

/// Picks the installer to use for a launcher update: NSIS setup.exe first, then .msi.
fn pick_launcher_installer(assets: &[NativeReleaseAsset]) -> Option<&NativeReleaseAsset> {
    let lower = |a: &NativeReleaseAsset| a.name.to_ascii_lowercase();
    assets
        .iter()
        .find(|a| lower(a).ends_with("-setup.exe"))
        .or_else(|| assets.iter().find(|a| lower(a).ends_with(".exe")))
        .or_else(|| assets.iter().find(|a| lower(a).ends_with(".msi")))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherUpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub published_at: Option<String>,
    pub release_url: String,
    pub download_url: String,
    pub file_name: String,
}

/// Returns the newer GloriaLauncher release, or `None` when this build is up to date.
#[tauri::command]
async fn check_launcher_update(app: AppHandle) -> Result<Option<LauncherUpdateInfo>, String> {
    let current = app.package_info().version.to_string();
    let client = http_client()?;
    let Some(release) = find_latest_release(&client, GITHUB_OWNER, LAUNCHER_REPO).await else {
        return Ok(None);
    };
    if !is_newer_version(&release.tag, &current) {
        return Ok(None);
    }
    let Some(asset) = pick_launcher_installer(&release.assets) else {
        return Ok(None);
    };
    Ok(Some(LauncherUpdateInfo {
        current_version: current,
        latest_version: release.tag.trim_start_matches(['v', 'V']).to_string(),
        published_at: release.published_at.clone(),
        release_url: format!(
            "https://github.com/{GITHUB_OWNER}/{LAUNCHER_REPO}/releases/tag/{}",
            release.tag
        ),
        download_url: asset.browser_download_url.clone(),
        file_name: asset.name.clone(),
    }))
}

/// Downloads the launcher installer, starts it, then exits so the installer
/// can replace the running executable.
#[tauri::command]
async fn install_launcher_update(
    app: AppHandle,
    download_url: String,
    file_name: String,
) -> Result<(), String> {
    let prefix = format!("https://github.com/{GITHUB_OWNER}/{LAUNCHER_REPO}/releases/download/");
    if !download_url.starts_with(&prefix) {
        return Err("Refusing to download a launcher update from an unexpected URL.".to_string());
    }
    let safe_file_name = Path::new(&file_name)
        .file_name()
        .and_then(|n| n.to_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Invalid installer file name".to_string())?
        .to_string();

    let dir = std::env::temp_dir().join("GloriaLauncherUpdate");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create update dir: {e}"))?;
    let target_file = dir.join(&safe_file_name);

    download_with_progress(&app, LAUNCHER_PROGRESS_ID, &download_url, &target_file).await?;
    launch_path_with_shell(&target_file)?;

    // Give the installer a moment to start, then close so files aren't locked.
    tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
    app.exit(0);
    Ok(())
}

#[tauri::command]
async fn install_app_release(
    app: AppHandle,
    app_id: String,
    version: String,
    download_url: String,
    file_name: String,
) -> Result<Option<InstalledAppRecord>, String> {
    let downloads_dir = downloads_root_dir(&app)?;
    let safe_file_name = Path::new(&file_name)
        .file_name()
        .and_then(|n| n.to_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Invalid release file name".to_string())?
        .to_string();

    let target_file = downloads_dir.join(&safe_file_name);
    download_with_progress(&app, &app_id, &download_url, &target_file).await?;

    let lower_name = safe_file_name.to_ascii_lowercase();
    let (final_exe_path, install_dir) = if lower_name.ends_with(".zip") {
        let extract_dir = downloads_dir.join(&app_id);
        fs::create_dir_all(&extract_dir)
            .map_err(|e| format!("Failed to create extract dir: {e}"))?;
        if let Some(found_installer) = extract_zip_and_find_installer(&target_file, &extract_dir)? {
            launch_path_with_shell(&found_installer)?;
            (found_installer, extract_dir)
        } else {
            let _ = Command::new("explorer").arg(&extract_dir).spawn();
            (target_file.clone(), extract_dir)
        }
    } else if lower_name.ends_with(".exe") || lower_name.ends_with(".msi") {
        launch_path_with_shell(&target_file)?;
        (target_file.clone(), downloads_dir.clone())
    } else {
        #[cfg(target_os = "windows")]
        {
            let _ = Command::new("explorer")
                .arg(format!("/select,{}", target_file.display()))
                .spawn();
        }
        (target_file.clone(), downloads_dir.clone())
    };

    let mut reg = load_registry(&app);
    // Updating an app that Windows lists as installed: keep pointing at the
    // installed app, not the installer. The next scan picks up the new version.
    if let Some(existing) = reg.get(&app_id).filter(|r| r.source == "system") {
        return Ok(Some(existing.clone()));
    }

    // Installers finish asynchronously outside the launcher; don't record the
    // installer itself as "installed" (otherwise cancelling it leaves a bogus
    // entry). Live rescanning picks up the real app once installation completes.
    if is_installer_file(&final_exe_path) {
        return Ok(None);
    }

    let record = InstalledAppRecord {
        app_id: app_id.clone(),
        version,
        executable_path: final_exe_path.to_string_lossy().to_string(),
        install_dir: install_dir.to_string_lossy().to_string(),
        installed_at: "Installed via GloriaLauncher".to_string(),
        source: "github-release".to_string(),
        uninstall_command: None,
    };

    reg.insert(app_id, record.clone());
    save_registry(&app, &reg)?;

    Ok(Some(record))
}

fn extract_zip_and_find_installer(
    zip_path: &Path,
    dest_dir: &Path,
) -> Result<Option<PathBuf>, String> {
    let file = fs::File::open(zip_path).map_err(|e| format!("Failed to open zip: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Invalid zip archive: {e}"))?;

    let mut preferred_installer: Option<PathBuf> = None;
    let mut first_exe: Option<PathBuf> = None;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Zip entry error: {e}"))?;
        let Some(enclosed_name) = entry.enclosed_name().map(|p| p.to_path_buf()) else {
            continue;
        };
        let out_path = dest_dir.join(&enclosed_name);

        if entry.is_dir() {
            fs::create_dir_all(&out_path).ok();
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).ok();
            }
            let mut outfile = fs::File::create(&out_path)
                .map_err(|e| format!("Failed to extract file: {e}"))?;
            std::io::copy(&mut entry, &mut outfile)
                .map_err(|e| format!("Failed to write extracted file: {e}"))?;

            let ext = out_path
                .extension()
                .and_then(|e| e.to_str())
                .map(|s| s.to_ascii_lowercase());
            let name_lower = out_path
                .file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.to_ascii_lowercase())
                .unwrap_or_default();

            if matches!(ext.as_deref(), Some("exe" | "msi")) {
                if preferred_installer.is_none()
                    && (ext.as_deref() == Some("msi")
                        || name_lower.contains("setup")
                        || name_lower.contains("install"))
                {
                    preferred_installer = Some(out_path.clone());
                }
                if first_exe.is_none() {
                    first_exe = Some(out_path);
                }
            }
        }
    }

    Ok(preferred_installer.or(first_exe))
}

#[tauri::command]
fn register_custom_executable(
    app: AppHandle,
    app_id: String,
    version: String,
    executable_path: String,
) -> Result<InstalledAppRecord, String> {
    let exe = PathBuf::from(&executable_path);
    if !exe.exists() {
        return Err("Selected executable does not exist.".to_string());
    }
    let install_dir = exe
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let record = InstalledAppRecord {
        app_id: app_id.clone(),
        version,
        executable_path,
        install_dir,
        installed_at: "Custom Local Executable".to_string(),
        source: "custom".to_string(),
        uninstall_command: None,
    };

    let mut reg = load_registry(&app);
    reg.insert(app_id, record.clone());
    save_registry(&app, &reg)?;
    Ok(record)
}

#[tauri::command]
fn launch_installed_app(app: AppHandle, app_id: String) -> Result<(), String> {
    let reg = load_registry(&app);
    let Some(record) = reg.get(&app_id) else {
        return Err(format!("{app_id} is not installed yet."));
    };

    let exe_path = Path::new(&record.executable_path);
    if !exe_path.exists() {
        return Err(format!(
            "Executable not found at {}",
            record.executable_path
        ));
    }

    launch_path_with_shell(exe_path)
}

#[tauri::command]
fn uninstall_app(app: AppHandle, app_id: String) -> Result<bool, String> {
    let mut reg = load_registry(&app);
    let Some(record) = reg.get(&app_id).cloned() else {
        return Ok(true);
    };

    if record.source == "system" {
        // Hand off to the app's own uninstaller. Keep the registry record until
        // the uninstaller actually removes the app from Windows so cancelling
        // doesn't hide an installed app; live rescanning clears it once done.
        let Some(cmd) = record.uninstall_command.as_deref() else {
            return Err("No uninstaller is registered for this app.".to_string());
        };
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            Command::new("cmd")
                .arg("/C")
                .raw_arg(cmd)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| format!("Failed to start uninstaller: {e}"))?;
        }
        #[cfg(not(target_os = "windows"))]
        let _ = cmd;
        return Ok(false);
    }

    reg.remove(&app_id);
    if record.source == "github-release" {
        let dir_path = Path::new(&record.install_dir);
        let is_shared_downloads = dir_path
            .file_name()
            .and_then(|n| n.to_str())
            .map(|s| s.eq_ignore_ascii_case("GloriaLauncherDownloads"))
            .unwrap_or(false);

        if is_shared_downloads {
            let exe_path = Path::new(&record.executable_path);
            if exe_path.is_file() {
                let _ = fs::remove_file(exe_path);
            }
        } else if dir_path.exists() {
            let _ = fs::remove_dir_all(dir_path);
        }
    }
    save_registry(&app, &reg)?;
    Ok(true)
}

#[tauri::command]
fn open_install_folder(app: AppHandle, app_id: String) -> Result<(), String> {
    let reg = load_registry(&app);
    let Some(record) = reg.get(&app_id) else {
        return Err("App is not installed.".to_string());
    };

    let folder = Path::new(&record.install_dir);
    if folder.exists() {
        Command::new("explorer")
            .arg(folder)
            .spawn()
            .map_err(|e| format!("Failed to open Explorer: {e}"))?;
    }
    Ok(())
}

const TRAY_ID: &str = "gloria-tray";

/// "Run in tray": when on, closing the window hides it to the tray instead of quitting.
#[derive(Default)]
struct TrayState {
    enabled: AtomicBool,
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = app.emit("launcher-shown", ());
    }
}

/// Turns the tray icon on or off. The frontend calls it on startup and again when
/// the setting or the UI language changes, so the menu labels stay localized.
#[tauri::command]
fn configure_tray(
    app: AppHandle,
    state: tauri::State<'_, TrayState>,
    enabled: bool,
    show_label: String,
    quit_label: String,
) -> Result<(), String> {
    state.enabled.store(enabled, Ordering::SeqCst);
    if let Some(old) = app.remove_tray_by_id(TRAY_ID) {
        let _ = old.set_visible(false);
    }
    if !enabled {
        return Ok(());
    }

    let show = MenuItem::with_id(&app, "tray-show", show_label, true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let quit = MenuItem::with_id(&app, "tray-quit", quit_label, true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let menu = Menu::with_items(&app, &[&show, &quit]).map_err(|e| e.to_string())?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("GLORIA Launcher")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray-show" => show_main_window(app),
            "tray-quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(&app).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        show_main_window(app);
    }));

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(TrayState::default())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let to_tray = window.label() == "main"
                    && window.app_handle().state::<TrayState>().enabled.load(Ordering::SeqCst);
                if to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_installed_apps,
            filter_repos_with_releases,
            list_public_repos,
            install_app_release,
            register_custom_executable,
            launch_installed_app,
            uninstall_app,
            open_install_folder,
            check_launcher_update,
            install_launcher_update,
            configure_tray
        ])
        .run(tauri::generate_context!())
        .expect("error while running GloriaLauncher");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_system_app_names() {
        use system_installed::{normalize, parse_icon_path, strip_version};
        assert_eq!(strip_version("Keystroker 0.1.0"), "Keystroker");
        assert_eq!(strip_version("Draco v1.0.0"), "Draco");
        assert_eq!(strip_version("Winget Baby"), "Winget Baby");
        assert_eq!(normalize("Faceit-Autopilot"), "faceitautopilot");
        assert_eq!(
            parse_icon_path(r#""C:\Apps\Draco\Draco.exe",0"#),
            PathBuf::from(r"C:\Apps\Draco\Draco.exe")
        );
    }

    /// Run with `cargo test live_scan -- --ignored --nocapture` on a machine with Gloria apps.
    #[test]
    #[ignore]
    fn live_scan_detects_installed_apps() {
        let apps = system_installed::scan();
        for id in ["Keystroker", "Carmen", "Draco", "Lumina", "Kintsugi", "Inscriptio", "DefaultFast", "Ada"] {
            let item = LocalCandidateInput {
                app_id: id.to_string(),
                version: "0".to_string(),
                candidates: vec![],
                names: vec![id.to_string()],
            };
            println!("{id}: {:?}", system_installed::find_match(&apps, &item).map(|r| (r.version, r.executable_path)));
        }
    }

    #[test]
    fn compares_versions() {
        assert!(is_newer_version("v1.0.1", "1.0.0"));
        assert!(is_newer_version("1.10.0", "1.9.9"));
        assert!(is_newer_version("v2", "1.9.9"));
        assert!(!is_newer_version("v1.0.0", "1.0.0"));
        assert!(!is_newer_version("v0.2.0", "1.0.0"));
        assert!(!is_newer_version("1.0.0-beta", "1.0.0"));
    }

    #[test]
    fn picks_setup_exe_over_msi() {
        let asset = |name: &str| NativeReleaseAsset {
            name: name.to_string(),
            browser_download_url: String::new(),
            size: 0,
            content_type: String::new(),
        };
        let assets = vec![
            asset("GloriaLauncher_1.0.0_x64_en-US.msi"),
            asset("GloriaLauncher_1.0.0_x64-setup.exe"),
        ];
        assert_eq!(
            pick_launcher_installer(&assets).unwrap().name,
            "GloriaLauncher_1.0.0_x64-setup.exe"
        );
    }

    #[test]
    fn parses_atom_tags() {
        let body = r#"<feed><entry><id>x</id><updated>2026-01-02T00:00:00Z</updated>
<link rel="alternate" type="text/html" href="https://github.com/o/r/releases/tag/v1.2.0"/></entry>
<entry><link rel="alternate" href="https://github.com/o/r/releases/tag/v1.1.0"/></entry></feed>"#;
        let tags = parse_atom_tags(body);
        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0].0, "v1.2.0");
        assert_eq!(tags[0].1.as_deref(), Some("2026-01-02T00:00:00Z"));
        assert_eq!(tags[1].0, "v1.1.0");
    }

    #[test]
    fn parses_expanded_assets_and_dedupes() {
        let html = r#"<a href="/o/r/releases/download/v1/My%20App-Setup.exe">x</a>
<a href="/o/r/releases/download/v1/My%20App-Setup.exe">dup</a>
<a href="/o/r/archive/refs/tags/v1.zip">source</a>"#;
        let assets = parse_expanded_assets(html, "o", "r", "v1");
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].name, "My App-Setup.exe");
        assert!(assets[0].browser_download_url.ends_with("/v1/My%20App-Setup.exe"));
        assert!(parse_expanded_assets("<div></div>", "o", "r", "v1").is_empty());
    }

    #[tokio::test]
    #[ignore = "hits github.com"]
    async fn live_finds_launcher_release() {
        let client = http_client().unwrap();
        let release = find_latest_release(&client, GITHUB_OWNER, LAUNCHER_REPO)
            .await
            .expect("GloriaLauncher should have a release");
        let installer = pick_launcher_installer(&release.assets).expect("installer asset");
        println!("latest {} -> {}", release.tag, installer.browser_download_url);
        assert!(is_newer_version(&release.tag, "0.2.0"));
    }

    #[tokio::test]
    #[ignore = "hits github.com"]
    async fn live_list_public_repos() {
        let repos = list_public_repos("projectGloria".into()).await.unwrap();
        println!("{} repos; first: {:?}", repos.len(), repos.first());
        assert!(repos.len() > 30, "expected multiple pages, got {}", repos.len());
        assert!(repos.iter().any(|r| r.name == "Mutatio"));
        assert!(repos.iter().all(|r| !r.name.is_empty() && !r.name.contains('/')));

        let names = repos.into_iter().map(|r| r.name).collect();
        let mut found: Vec<String> = filter_repos_with_releases("projectGloria".into(), names)
            .await
            .unwrap()
            .into_iter()
            .map(|r| r.repo)
            .collect();
        found.sort();
        println!("with releases: {found:?}");
        for must in ["Bonjorno", "CS2Prac", "Mutatio", "Orca", "Wallupus", "devCleanup"] {
            assert!(found.iter().any(|n| n == must), "{must} missing from {found:?}");
        }
        assert!(!found.iter().any(|n| n == "Emissa" || n == "Simulacrum" || n == "React"));
    }

    #[tokio::test]
    #[ignore = "hits github.com"]
    async fn live_filter_projectgloria() {
        let repos = ["Draco", "Simulacrum", "Emissa", "devCleanup", "Mutatio", "CS2Prac", "React"]
            .iter()
            .map(|s| s.to_string())
            .collect();
        let mut found = filter_repos_with_releases("projectGloria".into(), repos).await.unwrap();
        found.sort_by(|a, b| a.repo.cmp(&b.repo));
        for f in &found {
            println!("{} {} {:?}", f.repo, f.tag, f.assets.iter().map(|a| &a.name).collect::<Vec<_>>());
        }
        let names: Vec<_> = found.iter().map(|f| f.repo.as_str()).collect();
        for must in ["CS2Prac", "Mutatio", "devCleanup"] {
            assert!(names.contains(&must), "{must} missing from {names:?}");
        }
        for never in ["Simulacrum", "Emissa", "React"] {
            assert!(!names.contains(&never), "{never} has no release but was returned");
        }
    }

    #[test]
    fn identifies_installer_files() {
        assert!(is_installer_file(Path::new(r"C:\Downloads\Draco_1.0.0_x64-setup.exe")));
        assert!(is_installer_file(Path::new(r"C:\Downloads\KeystrokerInstaller.exe")));
        assert!(is_installer_file(Path::new(r"C:\Downloads\App_1.0.0.msi")));
        assert!(is_installer_file(Path::new(r"C:\Downloads\App.msixbundle")));
        assert!(!is_installer_file(Path::new(r"C:\Apps\Draco\Draco.exe")));
        assert!(!is_installer_file(Path::new(r"C:\Downloads\portable-tool.exe")));
    }
}
