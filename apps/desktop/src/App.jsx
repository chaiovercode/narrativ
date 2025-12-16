import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import Create from './pages/Create';
import Gallery from './pages/Gallery';
import VaultSetup from './pages/VaultSetup';
import SettingsModal from './components/SettingsModal';
import NotesPanel from './components/notes/NotesPanel';
import StatusBar from './components/StatusBar';
import { setVaultPath as setBackendVaultPath } from './services/api';
import './App.css';
import './styles/vault-setup.css';
import './styles/notes-panel.css';
import './styles/status-bar.css';

// Obsidian-style icons
const Icons = {
  create: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  gallery: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  chevron: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  help: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  ),
  notes: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
};

function App() {
  const [activeView, setActiveView] = useState('create');
  const [backendStatus, setBackendStatus] = useState({ running: false, port: 8000 });
  const [vaultPath, setVaultPath] = useState(null);
  const [vaultName, setVaultName] = useState(null);
  const [vaultLoading, setVaultLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+, for Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(prev => !prev);
      }
      // Cmd+N for Create (new)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setActiveView('create');
        setSettingsOpen(false);
        setNotesOpen(false);
      }
      // Cmd+G for Gallery
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        setActiveView('gallery');
        setSettingsOpen(false);
        setNotesOpen(false);
      }
      // Cmd+Shift+N for Notes panel
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'n') {
        e.preventDefault();
        setNotesOpen(prev => {
          const newState = !prev;
          if (newState && activeView === 'gallery') {
            setActiveView('create');
          }
          return newState;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check if vault is configured on startup
  useEffect(() => {
    const checkVault = async () => {
      try {
        const path = await invoke('get_vault_path');
        if (path) {
          setVaultPath(path);
          // Extract vault name from path
          const name = path.split('/').pop();
          setVaultName(name);
          // Notify Python backend of vault path
          try {
            await setBackendVaultPath(path);
          } catch (err) {
            console.warn('Failed to notify backend of vault path:', err);
          }
        }
      } catch (err) {
        console.log('No vault configured:', err);
      } finally {
        setVaultLoading(false);
      }
    };
    checkVault();
  }, []);

  // Check backend status periodically and ensure vault path is set
  useEffect(() => {
    let vaultPathSent = false;

    const checkBackend = async () => {
      try {
        const status = await invoke('get_backend_status');
        setBackendStatus(status);

        // When backend becomes ready, ensure vault path is set
        if (status.running && vaultPath && !vaultPathSent) {
          try {
            await setBackendVaultPath(vaultPath);
            vaultPathSent = true;
            console.log('Vault path sent to backend:', vaultPath);
          } catch (err) {
            console.warn('Failed to send vault path to backend:', err);
          }
        }
      } catch (err) {
        console.log('Backend check failed:', err);
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 3000);
    return () => clearInterval(interval);
  }, [vaultPath]);

  // Handle vault selection
  const handleVaultSelected = async (path, name) => {
    setVaultPath(path);
    setVaultName(name);
    // Notify Python backend of vault path
    try {
      await setBackendVaultPath(path);
    } catch (err) {
      console.warn('Failed to notify backend of vault path:', err);
      // Continue anyway - backend will be notified on next API call
    }
  };

  // Show loading while checking vault
  if (vaultLoading) {
    return (
      <div className="vault-setup">
        <div className="vault-setup-content">
          <div className="vault-logo">
            <span className="vault-logo-icon">R</span>
          </div>
          <p style={{ color: '#888' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Show vault setup if no vault configured or user wants to switch
  if (!vaultPath || showVaultPicker) {
    return (
      <VaultSetup
        onVaultSelected={(path, name) => {
          handleVaultSelected(path, name);
          setShowVaultPicker(false);
        }}
        onClose={() => setShowVaultPicker(false)}
        canClose={showVaultPicker && !!vaultPath}
      />
    );
  }

  const renderView = () => {
    switch (activeView) {
      case 'create':
        return <Create />;
      case 'gallery':
        return <Gallery />;
      default:
        return <Create />;
    }
  };

  return (
    <div className="app-wrapper">
      <StatusBar backendStatus={backendStatus} />
      <div className="app-container">
        <aside className="app-sidebar collapsed">
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeView === 'create' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('create');
                setNotesOpen(false);
              }}
              title="Create (Cmd+N)"
            >
              <span className="nav-chevron">{Icons.chevron}</span>
              {Icons.create}
            </button>
            <button
              className={`nav-item ${activeView === 'gallery' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('gallery');
                setNotesOpen(false);
              }}
              title="Gallery (Cmd+G)"
            >
              <span className="nav-chevron">{Icons.chevron}</span>
              {Icons.gallery}
            </button>
            <button
              className={`nav-item ${notesOpen ? 'active' : ''}`}
              onClick={() => {
                const newState = !notesOpen;
                setNotesOpen(newState);
                if (newState && activeView === 'gallery') {
                  setActiveView('create');
                }
              }}
              title="Notes (Cmd+Shift+N)"
            >
              <span className="nav-chevron">{Icons.chevron}</span>
              {Icons.notes}
            </button>
          </nav>
          <div className="sidebar-footer">
            <div className="footer-actions">
              <button
                className={`footer-btn ${settingsOpen ? 'active' : ''}`}
                title="Settings (Cmd+,)"
                onClick={() => setSettingsOpen(true)}
              >
                {Icons.settings}
              </button>
            </div>
          </div>
        </aside>
        <main className="app-main">
          {renderView()}
        </main>
        <NotesPanel isOpen={notesOpen} onClose={() => setNotesOpen(false)} />
        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onResetVault={() => {
            setShowVaultPicker(true);
          }}
        />
      </div>
    </div>
  );
}

export default App;
