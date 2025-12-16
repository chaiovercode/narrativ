import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';
import { readBinaryFile, writeBinaryFile, createDir, exists } from '@tauri-apps/api/fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import '../styles/settings.css';

const API_KEYS = [
  {
    id: 'google_api_key',
    label: 'Google API Key',
    description: 'Required for Gemini AI (text & image generation)',
    link: 'https://aistudio.google.com/apikey'
  },
  {
    id: 'tavily_api_key',
    label: 'Tavily API Key',
    description: 'Optional - for enhanced research capabilities',
    link: 'https://tavily.com'
  },
  {
    id: 'fal_api_key',
    label: 'FAL API Key',
    description: 'Optional - for additional image generation models',
    link: 'https://fal.ai'
  },
];

const POSITIONS = [
  { id: 'top-left', label: 'Top Left' },
  { id: 'top-right', label: 'Top Right' },
  { id: 'bottom-left', label: 'Bottom Left' },
  { id: 'bottom-right', label: 'Bottom Right' },
];

function Settings() {
  // API Keys state
  const [apiKeys, setApiKeys] = useState({});
  const [keyVisibility, setKeyVisibility] = useState({});
  const [keyStatus, setKeyStatus] = useState({});
  const [saving, setSaving] = useState({});

  // Vault state
  const [vaultPath, setVaultPath] = useState(null);

  // Brand config state
  const [brandConfig, setBrandConfig] = useState({
    enabled: false,
    type: 'logo',
    text: '',
    fontSize: 24,
    fontColor: '#FFFFFF',
    position: 'bottom-right',
    opacity: 0.7,
    padding: 20,
  });
  const [logoPreview, setLogoPreview] = useState(null);
  const [brandSaving, setBrandSaving] = useState(false);

  // Backend status
  const [backendStatus, setBackendStatus] = useState({ running: false, port: 0 });

  // Load initial data
  useEffect(() => {
    loadApiKeyStatus();
    loadBrandConfig();
    checkBackendStatus();
    loadVaultPath();
  }, []);

  const loadVaultPath = async () => {
    try {
      const path = await invoke('get_vault_path');
      setVaultPath(path);
    } catch (err) {
      console.log('No vault configured:', err);
    }
  };

  const handleRevealVault = async () => {
    if (vaultPath) {
      try {
        await invoke('reveal_vault_in_finder', { path: vaultPath });
      } catch (err) {
        console.error('Failed to reveal vault:', err);
      }
    }
  };

  const handleChangeVault = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select a vault folder',
      });

      if (selected) {
        // Check if it's an existing vault or create new
        const isValid = await invoke('validate_vault', { path: selected });
        if (isValid) {
          await invoke('set_vault_path', { path: selected });
        } else {
          await invoke('create_vault', { path: selected });
        }
        setVaultPath(selected);

        // Notify backend
        try {
          await fetch('http://localhost:8000/vault/set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: selected }),
          });
        } catch (err) {
          console.warn('Failed to notify backend:', err);
        }
      }
    } catch (err) {
      console.error('Failed to change vault:', err);
    }
  };

  const loadApiKeyStatus = async () => {
    try {
      const status = await invoke('get_api_key_status');
      const statusMap = {};
      status.forEach(s => {
        statusMap[s.name] = s.configured;
      });
      setKeyStatus(statusMap);
    } catch (err) {
      console.error('Failed to load API key status:', err);
    }
  };

  const loadBrandConfig = async () => {
    try {
      const dataDir = await appDataDir();
      const configPath = await join(dataDir, 'brand', 'config.json');

      if (await exists(configPath)) {
        const response = await fetch(`http://localhost:8000/brand`);
        if (response.ok) {
          const config = await response.json();
          setBrandConfig(prev => ({ ...prev, ...config }));
        }
      }

      // Check for logo
      const logoPath = await join(dataDir, 'brand', 'logo.png');
      if (await exists(logoPath)) {
        const logoData = await readBinaryFile(logoPath);
        const blob = new Blob([logoData], { type: 'image/png' });
        setLogoPreview(URL.createObjectURL(blob));
      }
    } catch (err) {
      console.error('Failed to load brand config:', err);
    }
  };

  const checkBackendStatus = async () => {
    try {
      const status = await invoke('get_backend_status');
      setBackendStatus(status);
    } catch (err) {
      console.error('Failed to check backend status:', err);
    }
  };

  // API Key handlers
  const handleKeyChange = (keyId, value) => {
    setApiKeys(prev => ({ ...prev, [keyId]: value }));
  };

  const toggleKeyVisibility = (keyId) => {
    setKeyVisibility(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const saveApiKey = async (keyId) => {
    const value = apiKeys[keyId];
    if (!value || !value.trim()) return;

    setSaving(prev => ({ ...prev, [keyId]: true }));
    try {
      await invoke('set_api_key', { service: keyId, key: value.trim() });
      setKeyStatus(prev => ({ ...prev, [keyId]: true }));
      setApiKeys(prev => ({ ...prev, [keyId]: '' }));

      // Restart backend to pick up new keys
      if (backendStatus.running) {
        const dataDir = await appDataDir();
        const backendPath = await join(dataDir, '..', '..', 'python-backend');
        await invoke('restart_backend', { pythonBackendPath: backendPath });
      }
    } catch (err) {
      console.error('Failed to save API key:', err);
      alert(`Failed to save API key: ${err}`);
    } finally {
      setSaving(prev => ({ ...prev, [keyId]: false }));
    }
  };

  const deleteApiKey = async (keyId) => {
    if (!confirm(`Are you sure you want to delete the ${keyId.replace(/_/g, ' ')}?`)) return;

    try {
      await invoke('delete_api_key', { service: keyId });
      setKeyStatus(prev => ({ ...prev, [keyId]: false }));
    } catch (err) {
      console.error('Failed to delete API key:', err);
      alert(`Failed to delete API key: ${err}`);
    }
  };

  // Brand handlers
  const handleBrandChange = (field, value) => {
    setBrandConfig(prev => ({ ...prev, [field]: value }));
  };

  const selectLogo = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Image',
          extensions: ['png']
        }]
      });

      if (selected) {
        const logoData = await readBinaryFile(selected);
        const dataDir = await appDataDir();
        const brandDir = await join(dataDir, 'brand');

        // Create brand directory if it doesn't exist
        if (!(await exists(brandDir))) {
          await createDir(brandDir, { recursive: true });
        }

        // Save logo
        const logoPath = await join(brandDir, 'logo.png');
        await writeBinaryFile(logoPath, logoData);

        // Update preview
        const blob = new Blob([logoData], { type: 'image/png' });
        setLogoPreview(URL.createObjectURL(blob));
      }
    } catch (err) {
      console.error('Failed to select logo:', err);
      alert(`Failed to select logo: ${err}`);
    }
  };

  const saveBrandConfig = async () => {
    setBrandSaving(true);
    try {
      const response = await fetch('http://localhost:8000/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandConfig),
      });

      if (!response.ok) {
        throw new Error('Failed to save brand config');
      }

      alert('Brand settings saved successfully!');
    } catch (err) {
      console.error('Failed to save brand config:', err);
      alert(`Failed to save brand config: ${err}`);
    } finally {
      setBrandSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-container">
        <h1>Settings</h1>

        {/* API Keys Section */}
        <section className="settings-section">
          <h2>API Keys</h2>
          <p className="section-description">
            Your API keys are stored securely in the macOS Keychain and never leave your device.
          </p>

          <div className="api-keys-list">
            {API_KEYS.map(key => (
              <div key={key.id} className="api-key-item">
                <div className="api-key-header">
                  <label>{key.label}</label>
                  {keyStatus[key.id] && (
                    <span className="key-status configured">Configured</span>
                  )}
                </div>
                <p className="api-key-description">{key.description}</p>

                <div className="api-key-input-row">
                  <div className="input-wrapper">
                    <input
                      type={keyVisibility[key.id] ? 'text' : 'password'}
                      value={apiKeys[key.id] || ''}
                      onChange={(e) => handleKeyChange(key.id, e.target.value)}
                      placeholder={keyStatus[key.id] ? '••••••••••••••••' : 'Enter API key'}
                    />
                    <button
                      className="visibility-toggle"
                      onClick={() => toggleKeyVisibility(key.id)}
                      type="button"
                    >
                      {keyVisibility[key.id] ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  <button
                    className="save-key-btn"
                    onClick={() => saveApiKey(key.id)}
                    disabled={!apiKeys[key.id] || saving[key.id]}
                  >
                    {saving[key.id] ? 'Saving...' : 'Save'}
                  </button>

                  {keyStatus[key.id] && (
                    <button
                      className="delete-key-btn"
                      onClick={() => deleteApiKey(key.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>

                <a href={key.link} target="_blank" rel="noopener noreferrer" className="get-key-link">
                  Get API key
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Vault Section */}
        <section className="settings-section">
          <h2>Vault</h2>
          <p className="section-description">
            Your research and generated images are stored in a vault folder on your computer, just like Obsidian.
          </p>

          <div className="vault-config">
            <div className="vault-path-display">
              <span className="vault-label">Current Vault:</span>
              <span className="vault-path">{vaultPath || 'Not configured'}</span>
            </div>

            <div className="vault-actions">
              {vaultPath && (
                <button className="vault-btn reveal" onClick={handleRevealVault}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Reveal in Finder
                </button>
              )}
              <button className="vault-btn change" onClick={handleChangeVault}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
                {vaultPath ? 'Change Vault' : 'Select Vault'}
              </button>
            </div>

            <div className="vault-info">
              <p>Your vault contains:</p>
              <ul>
                <li><strong>research/</strong> - Markdown files for each story research</li>
                <li><strong>attachments/</strong> - Generated images organized by topic</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Brand Kit Section */}
        <section className="settings-section">
          <h2>Brand Kit</h2>
          <p className="section-description">
            Add your branding to generated images. Use a logo (PNG with transparent background) or text.
          </p>

          <div className="brand-config">
            <div className="brand-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={brandConfig.enabled}
                  onChange={(e) => handleBrandChange('enabled', e.target.checked)}
                />
                Enable branding on generated images
              </label>
            </div>

            {brandConfig.enabled && (
              <>
                <div className="brand-type-selector">
                  <label>Branding Type:</label>
                  <div className="type-options">
                    <button
                      className={`type-btn ${brandConfig.type === 'logo' ? 'active' : ''}`}
                      onClick={() => handleBrandChange('type', 'logo')}
                    >
                      Logo
                    </button>
                    <button
                      className={`type-btn ${brandConfig.type === 'text' ? 'active' : ''}`}
                      onClick={() => handleBrandChange('type', 'text')}
                    >
                      Text
                    </button>
                  </div>
                </div>

                {brandConfig.type === 'logo' ? (
                  <div className="logo-config">
                    <div className="logo-preview-area">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Brand logo" className="logo-preview" />
                      ) : (
                        <div className="logo-placeholder">No logo selected</div>
                      )}
                    </div>
                    <button className="select-logo-btn" onClick={selectLogo}>
                      {logoPreview ? 'Change Logo' : 'Select Logo'}
                    </button>
                    <p className="logo-requirements">
                      Requirements: PNG format, transparent background, recommended size 200x200px
                    </p>
                  </div>
                ) : (
                  <div className="text-config">
                    <div className="config-row">
                      <label>Brand Text:</label>
                      <input
                        type="text"
                        value={brandConfig.text}
                        onChange={(e) => handleBrandChange('text', e.target.value)}
                        placeholder="@username or Brand Name"
                      />
                    </div>
                    <div className="config-row">
                      <label>Font Size:</label>
                      <input
                        type="number"
                        value={brandConfig.fontSize}
                        onChange={(e) => handleBrandChange('fontSize', parseInt(e.target.value))}
                        min="12"
                        max="72"
                      />
                    </div>
                    <div className="config-row">
                      <label>Font Color:</label>
                      <input
                        type="color"
                        value={brandConfig.fontColor}
                        onChange={(e) => handleBrandChange('fontColor', e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="position-selector">
                  <label>Position:</label>
                  <div className="position-grid">
                    {POSITIONS.map(pos => (
                      <button
                        key={pos.id}
                        className={`position-btn ${brandConfig.position === pos.id ? 'active' : ''}`}
                        onClick={() => handleBrandChange('position', pos.id)}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="config-row">
                  <label>Opacity: {Math.round(brandConfig.opacity * 100)}%</label>
                  <input
                    type="range"
                    value={brandConfig.opacity}
                    onChange={(e) => handleBrandChange('opacity', parseFloat(e.target.value))}
                    min="0.1"
                    max="1"
                    step="0.1"
                  />
                </div>

                <div className="config-row">
                  <label>Padding: {brandConfig.padding}px</label>
                  <input
                    type="range"
                    value={brandConfig.padding}
                    onChange={(e) => handleBrandChange('padding', parseInt(e.target.value))}
                    min="5"
                    max="50"
                    step="5"
                  />
                </div>
              </>
            )}

            <button
              className="save-brand-btn"
              onClick={saveBrandConfig}
              disabled={brandSaving}
            >
              {brandSaving ? 'Saving...' : 'Save Brand Settings'}
            </button>
          </div>
        </section>

        {/* About Section */}
        <section className="settings-section">
          <h2>About</h2>
          <div className="about-info">
            <p><strong>Revelio</strong> v1.0.0</p>
            <p>AI-powered social media story creator</p>
            <p className="backend-status">
              Backend: {backendStatus.running ? (
                <span className="status-running">Running on port {backendStatus.port}</span>
              ) : (
                <span className="status-stopped">Stopped</span>
              )}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Settings;
