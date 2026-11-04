use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledAppRecord {
    pub app_id: String,
    pub version: String,
    pub executable_path: String,
    pub install_dir: String,
    pub installed_at: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalCandidateInput {
    pub app_id: String,
    pub version: String,
    pub candidates: Vec<String>,
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

#[tauri::command]
fn get_installed_apps(
    app: AppHandle,
    candidates: Vec<LocalCandidateInput>,
) -> Result<Vec<InstalledAppRecord>, String> {
    let mut reg = load_registry(&app);

    // Prune entries whose executable no longer exists on disk
    reg.retain(|_, rec| Path::new(&rec.executable_path).exists());

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
                        },
                    );
                    break;
                }
            }
        }
    }

    let _ = save_registry(&app, &reg);
    Ok(reg.into_values().collect())
}

#[tauri::command]
async fn install_app_release(
    app: AppHandle,
    app_id: String,
    version: String,
    download_url: String,
    file_name: String,
) -> Result<InstalledAppRecord, String> {
    let root = launcher_root_dir(&app)?;
    let app_dir = root.join("apps").join(&app_id);
    fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create app dir: {e}"))?;

    let target_file = app_dir.join(&file_name);

    let client = reqwest::Client::builder()
        .user_agent("GloriaLauncher/0.1.0")
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Download returned HTTP {}", response.status()));
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let mut downloaded_bytes: u64 = 0;

    let mut file =
        fs::File::create(&target_file).map_err(|e| format!("Failed to create file: {e}"))?;
    let mut stream = response.bytes_stream();

    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.map_err(|e| format!("Download stream error: {e}"))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Disk write error: {e}"))?;
        downloaded_bytes += chunk.len() as u64;

        let percent = if total_bytes > 0 {
            ((downloaded_bytes as f64 / total_bytes as f64) * 100.0).min(99.0)
        } else {
            50.0
        };

        let _ = app.emit(
            "download-progress",
            DownloadProgressPayload {
                app_id: app_id.clone(),
                downloaded_bytes,
                total_bytes,
                percent,
                status: "Downloading...".to_string(),
            },
        );
    }
    file.flush().map_err(|e| format!("Flush error: {e}"))?;

    // If the downloaded file is a .zip archive, extract it and find the primary .exe
    let final_exe_path = if file_name.to_ascii_lowercase().ends_with(".zip") {
        extract_zip_and_find_exe(&target_file, &app_dir)?
    } else {
        target_file.clone()
    };

    let record = InstalledAppRecord {
        app_id: app_id.clone(),
        version,
        executable_path: final_exe_path.to_string_lossy().to_string(),
        install_dir: app_dir.to_string_lossy().to_string(),
        installed_at: "Installed via GloriaLauncher".to_string(),
        source: "github-release".to_string(),
    };

    let mut reg = load_registry(&app);
    reg.insert(app_id, record.clone());
    save_registry(&app, &reg)?;

    Ok(record)
}

fn extract_zip_and_find_exe(zip_path: &Path, dest_dir: &Path) -> Result<PathBuf, String> {
    let file = fs::File::open(zip_path).map_err(|e| format!("Failed to open zip: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Invalid zip archive: {e}"))?;

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

            if out_path
                .extension()
                .and_then(|e| e.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("exe"))
                .unwrap_or(false)
                && first_exe.is_none()
            {
                first_exe = Some(out_path);
            }
        }
    }

    Ok(first_exe.unwrap_or_else(|| zip_path.to_path_buf()))
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

    let working_dir = exe_path.parent().unwrap_or_else(|| Path::new("."));
    Command::new(exe_path)
        .current_dir(working_dir)
        .spawn()
        .map_err(|e| format!("Failed to spawn process: {e}"))?;

    Ok(())
}

#[tauri::command]
fn uninstall_app(app: AppHandle, app_id: String) -> Result<(), String> {
    let mut reg = load_registry(&app);
    if let Some(record) = reg.remove(&app_id) {
        if record.source == "github-release" {
            let dir_path = Path::new(&record.install_dir);
            if dir_path.exists() {
                let _ = fs::remove_dir_all(dir_path);
            }
        }
        save_registry(&app, &reg)?;
    }
    Ok(())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_installed_apps,
            install_app_release,
            register_custom_executable,
            launch_installed_app,
            uninstall_app,
            open_install_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running GloriaLauncher");
}
