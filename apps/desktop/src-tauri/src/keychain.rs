#[cfg(not(debug_assertions))]
use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[cfg(not(debug_assertions))]
const SERVICE_NAME: &str = "com.revelio.app";

#[cfg(debug_assertions)]
fn get_dev_secrets_path() -> PathBuf {
    let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push(".revelio");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path.push("dev_secrets.json");
    path
}

#[cfg(debug_assertions)]
fn read_dev_secrets() -> HashMap<String, String> {
    let path = get_dev_secrets_path();
    if path.exists() {
        let content = fs::read_to_string(path).unwrap_or_else(|_| "{}".to_string());
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        HashMap::new()
    }
}

#[cfg(debug_assertions)]
fn write_dev_secrets(secrets: &HashMap<String, String>) -> Result<(), String> {
    let path = get_dev_secrets_path();
    let content = serde_json::to_string_pretty(secrets).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

/// Store an API key
pub fn store_api_key(key_name: &str, key_value: &str) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        let mut secrets = read_dev_secrets();
        secrets.insert(key_name.to_string(), key_value.to_string());
        write_dev_secrets(&secrets)
    }

    #[cfg(not(debug_assertions))]
    {
        // First try to delete any existing key
        let _ = delete_generic_password(SERVICE_NAME, key_name);
        set_generic_password(SERVICE_NAME, key_name, key_value.as_bytes())
            .map_err(|e| format!("Failed to store API key in Keychain: {}", e))
    }
}

/// Retrieve an API key
pub fn retrieve_api_key(key_name: &str) -> Result<Option<String>, String> {
    #[cfg(debug_assertions)]
    {
        let secrets = read_dev_secrets();
        Ok(secrets.get(key_name).cloned())
    }

    #[cfg(not(debug_assertions))]
    {
        match get_generic_password(SERVICE_NAME, key_name) {
            Ok(password) => String::from_utf8(password)
                .map(Some)
                .map_err(|e| format!("Failed to decode API key: {}", e)),
            Err(e) => {
                // If key not found, return None instead of error
                if e.to_string().contains("not found") || e.to_string().contains("SecItemNotFound") {
                    Ok(None)
                } else {
                    Err(format!("Failed to retrieve API key from Keychain: {}", e))
                }
            }
        }
    }
}

/// Delete an API key
pub fn delete_api_key(key_name: &str) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        let mut secrets = read_dev_secrets();
        secrets.remove(key_name);
        write_dev_secrets(&secrets)
    }

    #[cfg(not(debug_assertions))]
    {
        delete_generic_password(SERVICE_NAME, key_name)
            .map_err(|e| format!("Failed to delete API key from Keychain: {}", e))
    }
}

/// Get all stored API key names (for UI display)
pub fn get_stored_key_names() -> Vec<&'static str> {
    vec!["google_api_key", "tavily_api_key", "fal_api_key"]
}

/// Check if an API key exists
pub fn has_api_key(key_name: &str) -> bool {
    retrieve_api_key(key_name)
        .map(|opt| opt.is_some())
        .unwrap_or(false)
}
