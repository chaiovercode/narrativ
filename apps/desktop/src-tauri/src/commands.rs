use crate::backend::BackendManager;
use crate::keychain;
use crate::vault;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct BackendStatus {
    pub running: bool,
    pub port: u16,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiKeyStatus {
    pub name: String,
    pub configured: bool,
}

// ============================================================================
// API Key Commands (Keychain)
// ============================================================================

/// Store an API key in the macOS Keychain
#[tauri::command]
pub fn set_api_key(service: String, key: String) -> Result<(), String> {
    keychain::store_api_key(&service, &key)
}

/// Retrieve an API key from the macOS Keychain
#[tauri::command]
pub fn get_api_key(service: String) -> Result<Option<String>, String> {
    keychain::retrieve_api_key(&service)
}

/// Delete an API key from the macOS Keychain
#[tauri::command]
pub fn delete_api_key(service: String) -> Result<(), String> {
    keychain::delete_api_key(&service)
}

/// Check which API keys are configured
#[tauri::command]
pub fn get_api_key_status() -> Vec<ApiKeyStatus> {
    keychain::get_stored_key_names()
        .iter()
        .map(|name| ApiKeyStatus {
            name: name.to_string(),
            configured: keychain::has_api_key(name),
        })
        .collect()
}

// ============================================================================
// Backend Management Commands
// ============================================================================

/// Start the Python backend
#[tauri::command]
pub fn start_backend(
    backend_manager: State<'_, Mutex<BackendManager>>,
    python_backend_path: String,
) -> Result<(), String> {
    let manager = backend_manager
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    manager.start(&python_backend_path)
}

/// Stop the Python backend
#[tauri::command]
pub fn stop_backend(backend_manager: State<'_, Mutex<BackendManager>>) -> Result<(), String> {
    let manager = backend_manager
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    manager.stop()
}

/// Get the backend status
#[tauri::command]
pub fn get_backend_status(backend_manager: State<'_, Mutex<BackendManager>>) -> BackendStatus {
    let manager = match backend_manager.lock() {
        Ok(m) => m,
        Err(_) => {
            return BackendStatus {
                running: false,
                port: 0,
            }
        }
    };

    BackendStatus {
        running: manager.is_running(),
        port: manager.get_port(),
    }
}

/// Get the backend port
#[tauri::command]
pub fn get_backend_port(backend_manager: State<'_, Mutex<BackendManager>>) -> u16 {
    match backend_manager.lock() {
        Ok(m) => m.get_port(),
        Err(_) => 0,
    }
}

/// Restart the backend (useful after changing API keys)
#[tauri::command]
pub fn restart_backend(
    backend_manager: State<'_, Mutex<BackendManager>>,
    python_backend_path: String,
) -> Result<(), String> {
    let manager = backend_manager
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    manager.restart(&python_backend_path)
}

// ============================================================================
// App Data Commands
// ============================================================================

/// Get the app data directory path
#[tauri::command]
pub fn get_app_data_dir() -> Result<String, String> {
    dirs::data_dir()
        .map(|p| p.join("com.narrativ.app").to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine app data directory".to_string())
}

/// Get the Python backend path (relative to app resources)
#[tauri::command]
pub fn get_python_backend_path(app_handle: tauri::AppHandle) -> Result<String, String> {
    // In production, use the bundled resources
    if let Some(resource_path) = app_handle.path_resolver().resource_dir() {
        let backend_path = resource_path.join("python-backend");
        if backend_path.exists() {
            return Ok(backend_path.to_string_lossy().to_string());
        }
    }

    // Fallback for development - try common dev paths
    let dev_paths = vec![
        // From src-tauri directory
        std::path::PathBuf::from("../../packages/python-backend"),
        // From project root
        std::path::PathBuf::from("packages/python-backend"),
        // Absolute path for dev (adjust if needed)
        dirs::home_dir()
            .map(|h| h.join("Code/narrativ/packages/python-backend"))
            .unwrap_or_default(),
    ];

    for path in dev_paths {
        if path.exists() {
            if let Ok(canonical) = path.canonicalize() {
                return Ok(canonical.to_string_lossy().to_string());
            }
        }
    }

    Err("Python backend not found. Please ensure it's properly bundled.".to_string())
}

// ============================================================================
// Vault Commands
// ============================================================================

/// Get the current vault path (if configured)
#[tauri::command]
pub fn get_vault_path() -> Option<String> {
    vault::load_vault_path()
}

/// Set the vault path
#[tauri::command]
pub fn set_vault_path(path: String) -> Result<(), String> {
    vault::save_vault_path(&path)
}

/// Create a new vault at the specified path
#[tauri::command]
pub fn create_vault(path: String) -> Result<(), String> {
    let vault_path = std::path::Path::new(&path);
    vault::Vault::create(vault_path)?;
    vault::save_vault_path(&path)?;
    Ok(())
}

/// Validate if a path is a valid Narrativ vault
#[tauri::command]
pub fn validate_vault(path: String) -> bool {
    let vault_path = std::path::Path::new(&path);
    vault::Vault::is_valid_vault(vault_path)
}

/// Open vault folder in Finder
#[tauri::command]
pub fn reveal_vault_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
    }
    Ok(())
}

/// Clear the vault path (reset vault)
#[tauri::command]
pub fn clear_vault_path() -> Result<(), String> {
    vault::clear_vault_path()
}

/// Get vault history
#[tauri::command]
pub fn get_vault_history() -> Vec<vault::VaultHistoryEntry> {
    vault::load_vault_history()
}

/// Add vault to history
#[tauri::command]
pub fn add_vault_to_history(name: String, path: String) -> Result<(), String> {
    vault::add_to_vault_history(&name, &path)
}

/// Remove vault from history
#[tauri::command]
pub fn remove_vault_from_history(path: String) -> Result<(), String> {
    vault::remove_from_vault_history(&path)
}
