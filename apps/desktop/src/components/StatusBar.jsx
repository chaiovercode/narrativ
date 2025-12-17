import { appWindow } from '@tauri-apps/api/window';

/**
 * Minimal title bar with app name.
 * Integrates with macOS title bar overlay.
 */
function StatusBar() {
  const handleDoubleClick = async () => {
    const isMaximized = await appWindow.isMaximized();
    if (isMaximized) {
      await appWindow.unmaximize();
    } else {
      await appWindow.maximize();
    }
  };

  return (
    <div className="title-bar" data-tauri-drag-region onDoubleClick={handleDoubleClick}>
      {/* Traffic light spacer (macOS) */}
      <div className="traffic-light-spacer" data-tauri-drag-region />

      {/* App Title */}
      <div className="title-bar-center" data-tauri-drag-region>
        <span className="app-title" data-tauri-drag-region>Revelio</span>
      </div>

      {/* Version */}
      <div className="title-bar-right">
        <span className="app-version">v1.0.0</span>
      </div>
    </div>
  );
}

export default StatusBar;
