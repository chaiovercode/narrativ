import { useState } from 'react';
import { appWindow } from '@tauri-apps/api/window';

/**
 * Custom title bar with app name and status icons.
 * Integrates with macOS title bar overlay.
 */
function StatusBar({ backendStatus }) {
  const [updateAvailable] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const isConnected = backendStatus?.running;
  const port = backendStatus?.port || 8000;

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

      {/* Status Icons */}
      <div className="title-bar-right">
        {updateAvailable && (
          <button className="title-icon update" title="Update available">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </button>
        )}

        <div className="status-wrapper">
          <button
            className={`title-icon status ${isConnected ? 'connected' : 'disconnected'}`}
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            title={isConnected ? 'Backend connected' : 'Backend disconnected'}
          >
            {isConnected ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <path d="M22 4L12 14.01l-3-3" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            )}
          </button>

          {showStatusMenu && (
            <div className="status-menu">
              <div className="status-menu-header">
                <span className={`status-dot ${isConnected ? 'connected' : ''}`} />
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
              <div className="status-menu-item">
                <span className="label">Backend</span>
                <span className="value">localhost:{port}</span>
              </div>
              <div className="status-menu-item">
                <span className="label">Status</span>
                <span className={`value ${isConnected ? 'success' : 'warning'}`}>
                  {isConnected ? 'Running' : 'Starting...'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close menu */}
      {showStatusMenu && (
        <div className="status-menu-backdrop" onClick={() => setShowStatusMenu(false)} />
      )}
    </div>
  );
}

export default StatusBar;
