#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use reqwest::Client;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use std::process::Command;

struct AppState {
  temp_dir: PathBuf,
}

#[tauri::command]
async fn download_and_open_file(
  url: String,
  file_name: String,
  state: State<'_, AppState>,
) -> Result<String, String> {
  // Create temp directory if it doesn't exist
  fs::create_dir_all(&state.temp_dir)
    .map_err(|e| format!("Failed to create temp directory: {}", e))?;

  let file_path = state.temp_dir.join(&file_name);

  // Download file
  let client = Client::new();
  let response = client
    .get(&url)
    .send()
    .await
    .map_err(|e| format!("Failed to download file: {}", e))?;

  let bytes = response
    .bytes()
    .await
    .map_err(|e| format!("Failed to read response: {}", e))?;

  // Write file to temp directory
  let mut file = File::create(&file_path)
    .await
    .map_err(|e| format!("Failed to create file: {}", e))?;

  file
    .write_all(&bytes)
    .await
    .map_err(|e| format!("Failed to write file: {}", e))?;

  file.flush().await
    .map_err(|e| format!("Failed to flush file: {}", e))?;

  // Open file with default application
  open_file(&file_path)?;

  Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn open_file(file_path: &str) -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    Command::new("cmd")
      .args(&["/c", "start", "\"\"", file_path])
      .spawn()
      .map_err(|e| format!("Failed to open file: {}", e))?;
  }

  #[cfg(target_os = "macos")]
  {
    Command::new("open")
      .arg(file_path)
      .spawn()
      .map_err(|e| format!("Failed to open file: {}", e))?;
  }

  #[cfg(target_os = "linux")]
  {
    Command::new("xdg-open")
      .arg(file_path)
      .spawn()
      .map_err(|e| format!("Failed to open file: {}", e))?;
  }

  Ok(())
}

#[tauri::command]
fn get_platform() -> String {
  std::env::consts::OS.to_string()
}

fn main() {
  let temp_dir = std::env::temp_dir().join("r2-manager");

  tauri::Builder::default()
    .manage(AppState {
      temp_dir,
    })
    .invoke_handler(tauri::generate_handler![
      download_and_open_file,
      open_file,
      get_platform
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
