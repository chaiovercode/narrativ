import { useState, useEffect, useCallback } from 'react';
import { open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';
import '../styles/vault-setup.css';

function VaultSetup({ onVaultSelected, onClose, canClose = false }) {
  const [vaultHistory, setVaultHistory] = useState([]);
  const [step, setStep] = useState('choose'); // 'choose', 'name', 'confirm'
  const [vaultName, setVaultName] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  // Load vault history on mount
  useEffect(() => {
    loadVaultHistory();
  }, []);

  // Handle Escape key to close
  useEffect(() => {
    if (!canClose) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && step === 'choose') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canClose, onClose, step]);

  const handleBackdropClick = useCallback((e) => {
    if (canClose && e.target === e.currentTarget && step === 'choose') {
      onClose?.();
    }
  }, [canClose, onClose, step]);

  const loadVaultHistory = async () => {
    try {
      const history = await invoke('get_vault_history');
      setVaultHistory(history || []);
    } catch (err) {
      console.log('Failed to load vault history:', err);
    }
  };

  const handleSelectVault = async (vault) => {
    try {
      setIsCreating(true);
      setError(null);

      // Validate the vault still exists
      const isValid = await invoke('validate_vault', { path: vault.path });
      if (!isValid) {
        setError('This vault no longer exists. Remove it from the list?');
        setIsCreating(false);
        return;
      }

      await invoke('set_vault_path', { path: vault.path });
      await invoke('add_vault_to_history', { name: vault.name, path: vault.path });
      onVaultSelected(vault.path, vault.name);
    } catch (err) {
      console.error('Failed to select vault:', err);
      setError('Failed to open vault. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRemoveFromHistory = async (vault, e) => {
    e.stopPropagation();
    try {
      await invoke('remove_vault_from_history', { path: vault.path });
      await loadVaultHistory();
      setError(null);
    } catch (err) {
      console.error('Failed to remove vault from history:', err);
    }
  };

  const handleCreateVault = () => {
    setStep('name');
    setError(null);
  };

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    if (!vaultName.trim()) {
      setError('Please enter a vault name');
      return;
    }
    await handleSelectFolder();
  };

  const handleSelectFolder = async () => {
    try {
      setError(null);
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Choose location for your vault',
      });

      if (selected) {
        setSelectedLocation(selected);
        setStep('confirm');
      }
    } catch (err) {
      console.error('Failed to select folder:', err);
      setError('Failed to select folder. Please try again.');
    }
  };

  const handleConfirmCreate = async () => {
    try {
      setIsCreating(true);
      setError(null);

      const vaultPath = `${selectedLocation}/${vaultName.trim()}`;
      await invoke('create_vault', { path: vaultPath });
      await invoke('add_vault_to_history', { name: vaultName.trim(), path: vaultPath });
      onVaultSelected(vaultPath, vaultName.trim());
    } catch (err) {
      console.error('Failed to create vault:', err);
      setError('Failed to create vault. Please try again.');
      setIsCreating(false);
    }
  };

  const handleOpenVault = async () => {
    try {
      setIsCreating(true);
      setError(null);

      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Open existing Narrativ vault',
      });

      if (selected) {
        const isValid = await invoke('validate_vault', { path: selected });

        if (isValid) {
          await invoke('set_vault_path', { path: selected });
          const name = selected.split('/').pop();
          await invoke('add_vault_to_history', { name, path: selected });
          onVaultSelected(selected, name);
        } else {
          setError('This folder is not a valid Narrativ vault.');
        }
      }
    } catch (err) {
      console.error('Failed to open vault:', err);
      setError('Failed to open vault. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Confirmation step
  if (step === 'confirm') {
    const fullPath = `${selectedLocation}/${vaultName.trim()}`;
    return (
      <div className="vault-setup">
        <div className="vault-setup-content compact">
          <div className="vault-logo">
            <span className="vault-logo-icon">N</span>
          </div>

          <h1 className="vault-title">Create vault</h1>

          <div className="vault-preview">
            <div className="preview-row">
              <span className="preview-label">Name</span>
              <span className="preview-value">{vaultName}</span>
              <button className="preview-edit" onClick={() => setStep('name')}>Edit</button>
            </div>
            <div className="preview-row">
              <span className="preview-label">Location</span>
              <span className="preview-value preview-path">{selectedLocation}</span>
              <button className="preview-edit" onClick={handleSelectFolder}>Change</button>
            </div>
            <div className="preview-row full-path">
              <span className="preview-label">Full path</span>
              <span className="preview-value preview-path">{fullPath}</span>
            </div>
          </div>

          <div className="vault-actions">
            <button
              className="vault-btn primary"
              onClick={handleConfirmCreate}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Vault'}
            </button>
            <button
              className="vault-btn secondary"
              onClick={() => setStep('choose')}
              disabled={isCreating}
            >
              Cancel
            </button>
          </div>

          {error && <div className="vault-error">{error}</div>}
        </div>
      </div>
    );
  }

  // Name entry step
  if (step === 'name') {
    return (
      <div className="vault-setup">
        <div className="vault-setup-content compact">
          <div className="vault-logo">
            <span className="vault-logo-icon">N</span>
          </div>

          <h1 className="vault-title">Name your vault</h1>

          <form onSubmit={handleNameSubmit} className="vault-name-form">
            <input
              type="text"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              placeholder="My Vault"
              className="vault-name-input"
              autoFocus
            />
            <div className="vault-form-actions">
              <button
                type="button"
                className="vault-btn secondary"
                onClick={() => { setStep('choose'); setVaultName(''); }}
              >
                Back
              </button>
              <button
                type="submit"
                className="vault-btn primary"
                disabled={!vaultName.trim()}
              >
                Choose Location
              </button>
            </div>
          </form>

          {error && <div className="vault-error">{error}</div>}
        </div>
      </div>
    );
  }

  // Main vault picker (Obsidian-style)
  return (
    <div className={`vault-setup ${canClose ? 'closeable' : ''}`} onClick={handleBackdropClick}>
      <div className="vault-picker">
        {/* Left sidebar - vault list */}
        <div className="vault-list-section">
          {vaultHistory.length > 0 ? (
            <div className="vault-list">
              {vaultHistory.map((vault, idx) => (
                <button
                  key={idx}
                  className="vault-list-item"
                  onClick={() => handleSelectVault(vault)}
                  disabled={isCreating}
                >
                  <div className="vault-item-info">
                    <span className="vault-item-name">{vault.name}</span>
                    <span className="vault-item-path">{vault.path}</span>
                  </div>
                  <button
                    className="vault-item-remove"
                    onClick={(e) => handleRemoveFromHistory(vault, e)}
                    title="Remove from list"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </button>
              ))}
            </div>
          ) : (
            <div className="vault-list-empty">
              <span>No recent vaults</span>
            </div>
          )}
        </div>

        {/* Right side - logo and actions */}
        <div className="vault-actions-section">
          <div className="vault-logo">
            <span className="vault-logo-icon">N</span>
          </div>
          <h1 className="vault-brand">Narrativ</h1>
          <span className="vault-version">Version 1.0.0</span>

          <div className="vault-action-buttons">
            <div className="vault-action-item" onClick={handleCreateVault}>
              <div className="vault-action-info">
                <span className="vault-action-title">Create new vault</span>
                <span className="vault-action-desc">Create a new Narrativ vault under a folder.</span>
              </div>
              <button className="vault-btn primary" disabled={isCreating}>
                Create
              </button>
            </div>

            <div className="vault-action-item" onClick={handleOpenVault}>
              <div className="vault-action-info">
                <span className="vault-action-title">Open folder as vault</span>
                <span className="vault-action-desc">Choose an existing folder of Markdown files.</span>
              </div>
              <button className="vault-btn secondary" disabled={isCreating}>
                Open
              </button>
            </div>
          </div>

          {error && <div className="vault-error">{error}</div>}
        </div>
      </div>
    </div>
  );
}

export default VaultSetup;
