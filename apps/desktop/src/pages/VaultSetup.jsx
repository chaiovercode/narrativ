import { useState } from 'react';
import { open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';
import '../styles/vault-setup.css';

function VaultSetup({ onVaultSelected }) {
  const [step, setStep] = useState('choose'); // 'choose', 'name', 'confirm'
  const [vaultName, setVaultName] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

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
    // Go to folder selection
    await handleSelectFolder();
  };

  const handleSelectFolder = async () => {
    try {
      setError(null);

      // Open folder picker dialog
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

  const handleChangeFolder = async () => {
    await handleSelectFolder();
  };

  const handleChangeName = () => {
    setStep('name');
  };

  const handleConfirmCreate = async () => {
    try {
      setIsCreating(true);
      setError(null);

      // Create vault with name in the selected location
      const vaultPath = `${selectedLocation}/${vaultName.trim()}`;
      await invoke('create_vault', { path: vaultPath });
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

      // Open folder picker dialog
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Open existing Revelio vault',
      });

      if (selected) {
        // Validate it's a revelio vault
        const isValid = await invoke('validate_vault', { path: selected });

        if (isValid) {
          await invoke('set_vault_path', { path: selected });
          // Extract vault name from path
          const name = selected.split('/').pop();
          onVaultSelected(selected, name);
        } else {
          setError('This folder is not a valid Revelio vault. Please select a folder created by Revelio or create a new vault.');
        }
      }
    } catch (err) {
      console.error('Failed to open vault:', err);
      setError('Failed to open vault. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Confirmation step - show name and location before creating
  if (step === 'confirm') {
    const fullPath = `${selectedLocation}/${vaultName.trim()}`;
    return (
      <div className="vault-setup">
        <div className="vault-setup-content">
          <div className="vault-logo">
            <span className="vault-logo-icon">R</span>
          </div>

          <h1 className="vault-title">Create vault</h1>
          <p className="vault-subtitle">
            Review your vault settings
          </p>

          <div className="vault-preview">
            <div className="preview-row">
              <span className="preview-label">Name</span>
              <span className="preview-value">{vaultName}</span>
              <button className="preview-edit" onClick={handleChangeName}>
                Edit
              </button>
            </div>
            <div className="preview-row">
              <span className="preview-label">Location</span>
              <span className="preview-value preview-path">{selectedLocation}</span>
              <button className="preview-edit" onClick={handleChangeFolder}>
                Change
              </button>
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

          {error && (
            <div className="vault-error">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Name entry step
  if (step === 'name') {
    return (
      <div className="vault-setup">
        <div className="vault-setup-content">
          <div className="vault-logo">
            <span className="vault-logo-icon">R</span>
          </div>

          <h1 className="vault-title">Name your vault</h1>
          <p className="vault-subtitle">
            Choose a name for your new vault
          </p>

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
                onClick={() => {
                  setStep('choose');
                  setVaultName('');
                }}
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

          {error && (
            <div className="vault-error">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Initial choose step
  return (
    <div className="vault-setup">
      <div className="vault-setup-content">
        <div className="vault-logo">
          <span className="vault-logo-icon">R</span>
        </div>

        <h1 className="vault-title">Welcome to Revelio</h1>
        <p className="vault-subtitle">
          Create or open a vault to store your research and generated images.
        </p>

        <div className="vault-actions">
          <button
            className="vault-btn primary"
            onClick={handleCreateVault}
            disabled={isCreating}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create New Vault
          </button>

          <button
            className="vault-btn secondary"
            onClick={handleOpenVault}
            disabled={isCreating}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            Open Existing Vault
          </button>
        </div>

        {error && (
          <div className="vault-error">
            {error}
          </div>
        )}

        <div className="vault-info">
          <h3>What is a vault?</h3>
          <p>
            A vault is a folder on your computer where Revelio stores all your data:
          </p>
          <ul>
            <li><strong>research/</strong> - Your research as markdown files</li>
            <li><strong>attachments/</strong> - Generated images</li>
            <li><strong>styles/</strong> - Custom styles</li>
          </ul>
          <p className="vault-info-note">
            You can open your vault in any text editor or file manager.
          </p>
        </div>
      </div>
    </div>
  );
}

export default VaultSetup;
