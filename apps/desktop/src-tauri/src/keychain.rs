use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};

const SERVICE_NAME: &str = "com.revelio.app";

/// Store an API key in the macOS Keychain
pub fn store_api_key(key_name: &str, key_value: &str) -> Result<(), String> {
    // First try to delete any existing key
    let _ = delete_generic_password(SERVICE_NAME, key_name);

    set_generic_password(SERVICE_NAME, key_name, key_value.as_bytes())
        .map_err(|e| format!("Failed to store API key: {}", e))
}

/// Retrieve an API key from the macOS Keychain
pub fn retrieve_api_key(key_name: &str) -> Result<Option<String>, String> {
    match get_generic_password(SERVICE_NAME, key_name) {
        Ok(password) => String::from_utf8(password)
            .map(Some)
            .map_err(|e| format!("Failed to decode API key: {}", e)),
        Err(e) => {
            // If key not found, return None instead of error
            if e.to_string().contains("not found") || e.to_string().contains("SecItemNotFound") {
                Ok(None)
            } else {
                Err(format!("Failed to retrieve API key: {}", e))
            }
        }
    }
}

/// Delete an API key from the macOS Keychain
pub fn delete_api_key(key_name: &str) -> Result<(), String> {
    delete_generic_password(SERVICE_NAME, key_name)
        .map_err(|e| format!("Failed to delete API key: {}", e))
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
