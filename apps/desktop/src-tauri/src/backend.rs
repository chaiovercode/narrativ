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

    /// Start the Python backend process
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

        // Build the command
        let main_py = format!("{}/main.py", python_backend_path);

        let child = Command::new("python3")
            .arg(&main_py)
            .env("REVELIO_PORT", self.port.to_string())
            .env("GOOGLE_API_KEY", google_key)
            .env("TAVILY_API_KEY", tavily_key)
            .env("FAL_KEY", fal_key)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start backend: {}", e))?;

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
