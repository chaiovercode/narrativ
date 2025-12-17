use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use crate::keychain;

pub struct BackendManager {
    process: Mutex<Option<Child>>,
    port: u16,
}

impl BackendManager {
    pub fn new(port: u16) -> Self {
        BackendManager {
            process: Mutex::new(None),
            port,
        }
    }

    pub fn get_port(&self) -> u16 {
        self.port
    }

    /// Find the bundled backend executable
    fn find_bundled_backend() -> Option<PathBuf> {
        // In production: look for bundled executable in Resources
        if let Ok(exe_path) = std::env::current_exe() {
            // macOS app bundle: .app/Contents/MacOS/app -> .app/Contents/Resources/
            if let Some(parent) = exe_path.parent() {
                let resources = parent.join("../Resources/narrativ-backend");
                if resources.exists() {
                    return Some(resources);
                }
            }
        }

        // Development: look in src-tauri/resources
        let dev_paths = vec![
            PathBuf::from("resources/narrativ-backend"),
            PathBuf::from("src-tauri/resources/narrativ-backend"),
            PathBuf::from("../resources/narrativ-backend"),
        ];

        for path in dev_paths {
            if path.exists() {
                return Some(path);
            }
        }

        None
    }

    /// Start the backend process (bundled or Python fallback for dev)
    pub fn start(&self, python_backend_path: &str) -> Result<(), String> {
        // Check if already running
        {
            let process = self.process.lock().map_err(|e| e.to_string())?;
            if process.is_some() {
                return Err("Backend is already running".to_string());
            }
        }

        // Get API keys from keychain
        let google_key = keychain::retrieve_api_key("google_api_key")?
            .unwrap_or_default();
        let tavily_key = keychain::retrieve_api_key("tavily_api_key")?
            .unwrap_or_default();
        let fal_key = keychain::retrieve_api_key("fal_api_key")?
            .unwrap_or_default();

        // Try bundled executable first, then fall back to Python for development
        let child = if let Some(bundled_path) = Self::find_bundled_backend() {
            println!("Using bundled backend: {:?}", bundled_path);
            Command::new(&bundled_path)
                .env("NARRATIV_PORT", self.port.to_string())
                .env("GOOGLE_API_KEY", &google_key)
                .env("TAVILY_API_KEY", &tavily_key)
                .env("FAL_API_KEY", &fal_key)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to start bundled backend: {}", e))?
        } else {
            // Fallback to Python for development
            println!("Using Python backend at: {:?}", python_backend_path);
            let main_py = format!("{}/main.py", python_backend_path);
            Command::new("python3")
                .arg(&main_py)
                .env("NARRATIV_PORT", self.port.to_string())
                .env("GOOGLE_API_KEY", &google_key)
                .env("TAVILY_API_KEY", &tavily_key)
                .env("FAL_API_KEY", &fal_key)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to start Python backend: {}", e))?
        };

        *self.process.lock().map_err(|e| e.to_string())? = Some(child);

        Ok(())
    }

    /// Stop the Python backend process
    pub fn stop(&self) -> Result<(), String> {
        let mut process = self.process.lock().map_err(|e| e.to_string())?;

        if let Some(mut child) = process.take() {
            child
                .kill()
                .map_err(|e| format!("Failed to kill backend: {}", e))?;
            let _ = child.wait();
        }

        Ok(())
    }

    /// Check if the backend is running
    pub fn is_running(&self) -> bool {
        let process = match self.process.lock() {
            Ok(p) => p,
            Err(_) => return false,
        };

        if let Some(ref child) = *process {
            // Check if process is still alive by trying to get status
            match Command::new("kill")
                .args(["-0", &child.id().to_string()])
                .status()
            {
                Ok(status) => status.success(),
                Err(_) => false,
            }
        } else {
            false
        }
    }

    /// Restart the backend
    pub fn restart(&self, python_backend_path: &str) -> Result<(), String> {
        self.stop()?;
        // Small delay to ensure port is released
        std::thread::sleep(std::time::Duration::from_millis(500));
        self.start(python_backend_path)
    }
}

impl Drop for BackendManager {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}
