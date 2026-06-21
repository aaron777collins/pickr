use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

// ---------------------------------------------------------------------------
// Data types (DTOs)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestItem {
    pub path: String,
    pub filename: String,
    pub kind: String,
    pub w: u32,
    pub h: u32,
    pub duration_sec: Option<f64>,
    pub sharpness: u32,
    pub face_count: u32,
    pub phash: Option<String>,
    pub thumb_path: Option<String>,
    pub dup_group: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaceBox {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    pub embedding_b64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportItem {
    pub src_path: String,
    pub order_index: u32,
    pub include: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportSummary {
    pub exported_count: u32,
    pub skipped_count: u32,
    pub dest_folder: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Identity {
    pub name: String,
    pub embedding_b64: String,
    pub color: String,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectJson {
    pub folder: String,
    pub items: Vec<ManifestItem>,
    pub order: Vec<String>,
    pub included: HashMap<String, bool>,
    pub identities: Vec<Identity>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub done: u32,
    pub total: u32,
    pub current: String,
}

// ---------------------------------------------------------------------------
// Sidecar discovery
// ---------------------------------------------------------------------------

/// Locate the `pickr-sidecar` binary. Checks, in order:
/// 1. `$PICKR_SIDECAR_PATH`
/// 2. a `pickr-sidecar` on `$PATH`
/// 3. `./sidecar/.venv/bin/pickr-sidecar` relative to CWD
/// 4. `sidecar/.venv/bin/pickr-sidecar` walking up from CWD toward the repo root
fn find_sidecar() -> Result<PathBuf, String> {
    if let Ok(p) = std::env::var("PICKR_SIDECAR_PATH") {
        let path = PathBuf::from(&p);
        if path.is_file() {
            return Ok(path);
        }
    }

    if let Some(p) = which_on_path("pickr-sidecar") {
        return Ok(p);
    }

    let rel = Path::new("sidecar/.venv/bin/pickr-sidecar");

    if let Ok(cwd) = std::env::current_dir() {
        let direct = cwd.join(rel);
        if direct.is_file() {
            return Ok(direct);
        }
        // Walk up from CWD looking for sidecar/.venv/bin/pickr-sidecar.
        let mut dir: Option<&Path> = Some(cwd.as_path());
        while let Some(d) = dir {
            let candidate = d.join(rel);
            if candidate.is_file() {
                return Ok(candidate);
            }
            dir = d.parent();
        }
    }

    Err(
        "Could not locate the pickr-sidecar binary. Set PICKR_SIDECAR_PATH, put it on PATH, \
         or build it at sidecar/.venv/bin/pickr-sidecar."
            .to_string(),
    )
}

fn which_on_path(name: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        let candidate = dir.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

/// Spawn the sidecar with the given args and return its full stdout. Used for
/// commands that do not stream progress.
async fn run_sidecar(args: &[&str]) -> Result<String, String> {
    let bin = find_sidecar()?;
    let output = Command::new(&bin)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("failed to spawn sidecar: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("sidecar exited with {}: {stderr}", output.status));
    }

    String::from_utf8(output.stdout).map_err(|e| format!("sidecar produced invalid UTF-8: {e}"))
}

/// Parse a single `{"type": "...", ...}` line. The sidecar emits one JSON
/// object per line. For non-streaming commands we look for a `result` line.
fn parse_result_line<T: for<'de> Deserialize<'de>>(stdout: &str) -> Result<T, String> {
    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let msg: serde_json::Value =
            serde_json::from_str(line).map_err(|e| format!("invalid JSON from sidecar: {e}"))?;
        match msg.get("type").and_then(|v| v.as_str()) {
            Some("error") => {
                let m = msg
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown sidecar error");
                return Err(m.to_string());
            }
            Some("result") => {
                let data = msg.get("data").cloned().unwrap_or(serde_json::Value::Null);
                return serde_json::from_value(data)
                    .map_err(|e| format!("could not parse sidecar result: {e}"));
            }
            _ => continue,
        }
    }
    Err("sidecar produced no result".to_string())
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |folder| {
        let _ = tx.send(folder);
    });

    let folder = rx
        .await
        .map_err(|_| "folder dialog was cancelled unexpectedly".to_string())?;

    match folder {
        Some(fp) => {
            let path = fp
                .into_path()
                .map_err(|e| format!("invalid folder path: {e}"))?;
            Ok(Some(path.to_string_lossy().into_owned()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn scan_folder(path: String, app: AppHandle) -> Result<Vec<ManifestItem>, String> {
    let bin = find_sidecar()?;

    let mut child = Command::new(&bin)
        .args(["scan", &path])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to spawn sidecar: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "could not capture sidecar stdout".to_string())?;
    let mut lines = BufReader::new(stdout).lines();

    let mut manifest: Option<Vec<ManifestItem>> = None;

    while let Some(line) = lines
        .next_line()
        .await
        .map_err(|e| format!("error reading sidecar output: {e}"))?
    {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let msg: serde_json::Value =
            serde_json::from_str(line).map_err(|e| format!("invalid JSON from sidecar: {e}"))?;
        match msg.get("type").and_then(|v| v.as_str()) {
            Some("progress") => {
                if let Ok(progress) = serde_json::from_value::<ScanProgress>(msg.clone()) {
                    let _ = app.emit("scan-progress", progress);
                }
            }
            Some("result") => {
                let data = msg.get("data").cloned().unwrap_or(serde_json::Value::Null);
                manifest = Some(
                    serde_json::from_value(data)
                        .map_err(|e| format!("could not parse manifest: {e}"))?,
                );
            }
            Some("error") => {
                let m = msg
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown sidecar error");
                return Err(m.to_string());
            }
            _ => {}
        }
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("sidecar wait failed: {e}"))?;

    match manifest {
        Some(m) => Ok(m),
        None if !status.success() => {
            let mut err = String::new();
            if let Some(mut stderr) = child.stderr.take() {
                use tokio::io::AsyncReadExt;
                let _ = stderr.read_to_string(&mut err).await;
            }
            Err(format!("sidecar exited with {status}: {err}"))
        }
        None => Err("sidecar produced no manifest".to_string()),
    }
}

#[tauri::command]
pub async fn face_detect(path: String, _app: AppHandle) -> Result<Vec<FaceBox>, String> {
    let stdout = run_sidecar(&["face_detect", &path]).await?;
    parse_result_line(&stdout)
}

#[tauri::command]
pub async fn face_match(
    embedding: String,
    manifest_path: String,
    _app: AppHandle,
) -> Result<Vec<String>, String> {
    let stdout = run_sidecar(&["face_match", &embedding, &manifest_path]).await?;
    parse_result_line(&stdout)
}

#[tauri::command]
pub async fn export_renamed(
    items: Vec<ExportItem>,
    dest_folder: String,
) -> Result<ExportSummary, String> {
    let skipped_count = items.iter().filter(|i| !i.include).count() as u32;

    let mut included: Vec<ExportItem> = items.into_iter().filter(|i| i.include).collect();
    included.sort_by_key(|i| i.order_index);

    tokio::fs::create_dir_all(&dest_folder)
        .await
        .map_err(|e| format!("could not create destination folder: {e}"))?;

    let pad = if included.len() >= 100 { 3 } else { 2 };
    let dest = Path::new(&dest_folder);
    let mut exported_count = 0u32;

    for (idx, item) in included.iter().enumerate() {
        let src = Path::new(&item.src_path);
        let original = src
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .ok_or_else(|| format!("invalid source path: {}", item.src_path))?;

        let prefix = format!("{:0width$}", idx + 1, width = pad);
        let target = dest.join(format!("{prefix}_{original}"));

        tokio::fs::copy(src, &target)
            .await
            .map_err(|e| format!("failed to copy {}: {e}", item.src_path))?;
        exported_count += 1;
    }

    Ok(ExportSummary {
        exported_count,
        skipped_count,
        dest_folder,
    })
}

#[tauri::command]
pub async fn save_project(folder: String, project: ProjectJson) -> Result<(), String> {
    let dir = Path::new(&folder);
    let json = serde_json::to_vec_pretty(&project)
        .map_err(|e| format!("could not serialize project: {e}"))?;

    let tmp_name = format!(".pickr.{}.tmp", uuid::Uuid::new_v4());
    let tmp_path = dir.join(tmp_name);

    tokio::fs::write(&tmp_path, &json)
        .await
        .map_err(|e| format!("could not write project file: {e}"))?;

    let final_path = dir.join(".pickr.json");
    if let Err(e) = tokio::fs::rename(&tmp_path, &final_path).await {
        let _ = tokio::fs::remove_file(&tmp_path).await;
        return Err(format!("could not finalize project file: {e}"));
    }

    Ok(())
}

#[tauri::command]
pub async fn load_project(folder: String) -> Result<Option<ProjectJson>, String> {
    let path = Path::new(&folder).join(".pickr.json");
    match tokio::fs::read(&path).await {
        Ok(bytes) => {
            let project = serde_json::from_slice(&bytes)
                .map_err(|e| format!("could not parse project file: {e}"))?;
            Ok(Some(project))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("could not read project file: {e}")),
    }
}

#[tauri::command]
pub async fn open_in_explorer(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    let target = if p.is_dir() {
        p.to_path_buf()
    } else {
        p.parent().map(|d| d.to_path_buf()).unwrap_or(p.to_path_buf())
    };

    std::process::Command::new("xdg-open")
        .arg(&target)
        .spawn()
        .map_err(|e| format!("could not open file manager: {e}"))?;

    Ok(())
}
