use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::Rng;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

const NONCE_SIZE: usize = 12;
const APP_SALT: &[u8] = b"revelio_secrets_v2_stable";

/// Derive encryption key from user's home directory path (consistent across builds)
fn get_encryption_key() -> [u8; 32] {
    // Use home directory as the unique identifier - consistent across app versions
    let home_dir = dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "default_user".to_string());

    let mut hasher = Sha256::new();
    hasher.update(home_dir.as_bytes());
    hasher.update(APP_SALT);
    hasher.finalize().into()
}

/// Encrypt data using AES-256-GCM
fn encrypt(plaintext: &str) -> Result<String, String> {
    let key = get_encryption_key();
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;

    // Generate random nonce
    let mut rng = rand::thread_rng();
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    rng.fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| e.to_string())?;

    // Prepend nonce to ciphertext and encode as base64
    let mut combined = nonce_bytes.to_vec();
    combined.extend(ciphertext);
    Ok(BASE64.encode(combined))
}

/// Decrypt data using AES-256-GCM
fn decrypt(encrypted: &str) -> Result<String, String> {
    let key = get_encryption_key();
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;

    let combined = BASE64.decode(encrypted).map_err(|e| e.to_string())?;

    if combined.len() < NONCE_SIZE {
        return Err("Invalid encrypted data".to_string());
    }

    let (nonce_bytes, ciphertext) = combined.split_at(NONCE_SIZE);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed - keys may need to be re-entered".to_string())?;

    String::from_utf8(plaintext).map_err(|e| e.to_string())
}

/// Get the secrets file path in the app data directory
fn get_secrets_path() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("com.revelio.app");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path.push("secrets.enc");
    path
}

/// Read and decrypt secrets from file
fn read_secrets() -> HashMap<String, String> {
    let path = get_secrets_path();
    if path.exists() {
        if let Ok(encrypted) = fs::read_to_string(&path) {
            if let Ok(decrypted) = decrypt(&encrypted) {
                return serde_json::from_str(&decrypted).unwrap_or_default();
            } else {
                // If decryption fails, the key derivation changed - clear old secrets
                println!("Warning: Could not decrypt secrets file, may need to re-enter API keys");
            }
        }
    }
    HashMap::new()
}

/// Encrypt and write secrets to file
fn write_secrets(secrets: &HashMap<String, String>) -> Result<(), String> {
    let path = get_secrets_path();
    let json = serde_json::to_string_pretty(secrets).map_err(|e| e.to_string())?;
    let encrypted = encrypt(&json)?;
    fs::write(&path, encrypted).map_err(|e| e.to_string())
}

/// Store an API key
pub fn store_api_key(key_name: &str, key_value: &str) -> Result<(), String> {
    let mut secrets = read_secrets();
    secrets.insert(key_name.to_string(), key_value.to_string());
    write_secrets(&secrets)
}

/// Retrieve an API key
pub fn retrieve_api_key(key_name: &str) -> Result<Option<String>, String> {
    let secrets = read_secrets();
    Ok(secrets.get(key_name).cloned())
}

/// Delete an API key
pub fn delete_api_key(key_name: &str) -> Result<(), String> {
    let mut secrets = read_secrets();
    secrets.remove(key_name);
    write_secrets(&secrets)
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
