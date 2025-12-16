use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

const REVELIO_CONFIG_DIR: &str = ".revelio";
const REVELIO_CONFIG_FILE: &str = "config.json";

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultConfig {
    pub version: String,
    pub created_at: String,
}

pub struct Vault {
    pub path: PathBuf,
}

impl Vault {
    /// Create a new vault at the specified path
    pub fn create(path: &Path) -> Result<Self, String> {
        // Create the vault directory if it doesn't exist
        if !path.exists() {
            fs::create_dir_all(path)
                .map_err(|e| format!("Failed to create vault directory: {}", e))?;
        }

        // Create vault structure
        let vault = Self { path: path.to_path_buf() };

        // Create subdirectories
        fs::create_dir_all(vault.config_dir())
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
        fs::create_dir_all(vault.research_dir())
            .map_err(|e| format!("Failed to create research directory: {}", e))?;
        fs::create_dir_all(vault.attachments_dir())
            .map_err(|e| format!("Failed to create attachments directory: {}", e))?;
        fs::create_dir_all(vault.styles_dir())
            .map_err(|e| format!("Failed to create styles directory: {}", e))?;

        // Write vault config
        let config = VaultConfig {
            version: "1.0.0".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        let config_path = vault.config_dir().join(REVELIO_CONFIG_FILE);
        let config_json = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        fs::write(&config_path, config_json)
            .map_err(|e| format!("Failed to write config file: {}", e))?;

        Ok(vault)
    }

    /// Open an existing vault
    #[allow(dead_code)]
    pub fn open(path: &Path) -> Result<Self, String> {
        if !Self::is_valid_vault(path) {
            return Err("Not a valid Revelio vault".to_string());
        }
        Ok(Self { path: path.to_path_buf() })
    }

    /// Check if a path is a valid Revelio vault
    pub fn is_valid_vault(path: &Path) -> bool {
        let config_path = path.join(REVELIO_CONFIG_DIR).join(REVELIO_CONFIG_FILE);
        config_path.exists()
    }

    /// Get the hidden config directory
    pub fn config_dir(&self) -> PathBuf {
        self.path.join(REVELIO_CONFIG_DIR)
    }

    /// Get the research directory
    pub fn research_dir(&self) -> PathBuf {
        self.path.join("research")
    }

    /// Get the attachments directory
    pub fn attachments_dir(&self) -> PathBuf {
        self.path.join("attachments")
    }

    /// Get the styles directory
    pub fn styles_dir(&self) -> PathBuf {
        self.path.join("styles")
    }
}

/// Get the app settings file path
pub fn get_settings_path() -> Option<PathBuf> {
    dirs::data_dir().map(|p| p.join("com.revelio.app").join("settings.json"))
}

/// Load the vault path from app settings
pub fn load_vault_path() -> Option<String> {
    let settings_path = get_settings_path()?;
    if !settings_path.exists() {
        return None;
    }

    let content = fs::read_to_string(&settings_path).ok()?;
    let settings: serde_json::Value = serde_json::from_str(&content).ok()?;
    settings.get("vault_path")?.as_str().map(|s| s.to_string())
}

/// Save the vault path to app settings
pub fn save_vault_path(path: &str) -> Result<(), String> {
    let settings_path = get_settings_path()
        .ok_or_else(|| "Could not determine settings path".to_string())?;

    // Ensure the settings directory exists
    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }

    // Load existing settings or create new
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read settings: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Update vault_path
    settings["vault_path"] = serde_json::json!(path);

    // Write settings
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&settings_path, content)
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok(())
}

/// Clear the vault path from app settings
pub fn clear_vault_path() -> Result<(), String> {
    let settings_path = get_settings_path()
        .ok_or_else(|| "Could not determine settings path".to_string())?;

    if !settings_path.exists() {
        return Ok(());
    }

    // Load existing settings
    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;
    let mut settings: serde_json::Value = serde_json::from_str(&content)
        .unwrap_or(serde_json::json!({}));

    // Remove vault_path
    if let Some(obj) = settings.as_object_mut() {
        obj.remove("vault_path");
    }

    // Write settings
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&settings_path, content)
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok(())
}

/// Vault history entry
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VaultHistoryEntry {
    pub name: String,
    pub path: String,
}

/// Load vault history from app settings
pub fn load_vault_history() -> Vec<VaultHistoryEntry> {
    let settings_path = match get_settings_path() {
        Some(p) => p,
        None => return vec![],
    };

    if !settings_path.exists() {
        return vec![];
    }

    let content = match fs::read_to_string(&settings_path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    let settings: serde_json::Value = match serde_json::from_str(&content) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    match settings.get("vault_history") {
        Some(history) => serde_json::from_value(history.clone()).unwrap_or(vec![]),
        None => vec![],
    }
}

/// Add a vault to history
pub fn add_to_vault_history(name: &str, path: &str) -> Result<(), String> {
    let settings_path = get_settings_path()
        .ok_or_else(|| "Could not determine settings path".to_string())?;

    // Ensure the settings directory exists
    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }

    // Load existing settings or create new
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read settings: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Get or create vault history array
    let mut history: Vec<VaultHistoryEntry> = settings
        .get("vault_history")
        .and_then(|h| serde_json::from_value(h.clone()).ok())
        .unwrap_or(vec![]);

    // Remove existing entry with same path (if any)
    history.retain(|v| v.path != path);

    // Add new entry at the beginning
    history.insert(0, VaultHistoryEntry {
        name: name.to_string(),
        path: path.to_string(),
    });

    // Keep only last 10 vaults
    history.truncate(10);

    // Update settings
    settings["vault_history"] = serde_json::to_value(&history)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;

    // Write settings
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&settings_path, content)
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok(())
}

/// Remove a vault from history
pub fn remove_from_vault_history(path: &str) -> Result<(), String> {
    let settings_path = get_settings_path()
        .ok_or_else(|| "Could not determine settings path".to_string())?;

    if !settings_path.exists() {
        return Ok(());
    }

    // Load existing settings
    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;
    let mut settings: serde_json::Value = serde_json::from_str(&content)
        .unwrap_or(serde_json::json!({}));

    // Get vault history
    let mut history: Vec<VaultHistoryEntry> = settings
        .get("vault_history")
        .and_then(|h| serde_json::from_value(h.clone()).ok())
        .unwrap_or(vec![]);

    // Remove entry with matching path
    history.retain(|v| v.path != path);

    // Update settings
    settings["vault_history"] = serde_json::to_value(&history)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;

    // Write settings
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&settings_path, content)
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok(())
}
