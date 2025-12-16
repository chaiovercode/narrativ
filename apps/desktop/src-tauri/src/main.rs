// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backend;
mod commands;
mod keychain;
mod vault;

use backend::BackendManager;
use std::sync::Mutex;
use std::path::PathBuf;
use tauri::Manager;

fn find_python_backend() -> Option<PathBuf> {
    // Try multiple locations for the Python backend
    let possible_paths = vec![
        // Development: relative to the project
        std::env::current_dir().ok()?.join("../../packages/python-backend"),
        std::env::current_dir().ok()?.join("../../../packages/python-backend"),
        // From home directory (common dev location)
        dirs::home_dir()?.join("Code/revelio/packages/python-backend"),
        // Bundled in app resources (for production)
        std::env::current_exe().ok()?.parent()?.join("../Resources/python-backend"),
    ];

    for path in possible_paths {
        let main_py = path.join("main.py");
        if main_py.exists() {
            return Some(path.canonicalize().unwrap_or(path));
        }
    }
    None
}

fn main() {
    // Initialize the backend manager with default port
    let backend_manager = Mutex::new(BackendManager::new(8000));

    tauri::Builder::default()
        .manage(backend_manager)
        .invoke_handler(tauri::generate_handler![
            // API Key commands
            commands::set_api_key,
            commands::get_api_key,
            commands::delete_api_key,
            commands::get_api_key_status,
            // Backend commands
            commands::start_backend,
            commands::stop_backend,
            commands::get_backend_status,
            commands::get_backend_port,
            commands::restart_backend,
            // App data commands
            commands::get_app_data_dir,
            commands::get_python_backend_path,
            // Vault commands
            commands::get_vault_path,
            commands::set_vault_path,
            commands::create_vault,
            commands::validate_vault,
            commands::reveal_vault_in_finder,
            commands::clear_vault_path,
        ])
        .setup(|app| {
            println!("Revelio is starting...");

            // Auto-start the Python backend
            if let Some(backend_path) = find_python_backend() {
                println!("Found Python backend at: {:?}", backend_path);

                let backend_manager = app.state::<Mutex<BackendManager>>();
                let result = backend_manager.lock();
                if let Ok(manager) = result {
                    match manager.start(backend_path.to_str().unwrap_or("")) {
                        Ok(_) => println!("Backend started successfully on port 8000"),
                        Err(e) => println!("Failed to start backend: {}", e),
                    }
                }
            } else {
                println!("Warning: Python backend not found. Please start it manually.");
            }

            Ok(())
        })
        .on_window_event(|event| {
            // Handle window close to cleanup backend
            if let tauri::WindowEvent::CloseRequested { .. } = event.event() {
                println!("Revelio is closing, cleaning up...");
                // Backend will be cleaned up via BackendManager's Drop impl
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
