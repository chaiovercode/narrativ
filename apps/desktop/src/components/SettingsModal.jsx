import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';
import { readBinaryFile } from '@tauri-apps/api/fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import '../styles/settings-modal.css';

const SETTINGS_TABS = [
  { id: 'general', label: 'General', section: 'Options' },
  { id: 'api-keys', label: 'API Keys', section: 'Options' },
  { id: 'vault', label: 'Vault', section: 'Options' },
  { id: 'brands', label: 'Brands', section: 'Options' },
];

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

function SettingsModal({ isOpen, onClose, onResetVault }) {
  const [activeTab, setActiveTab] = useState('general');

  // API Keys state
  const [apiKeys, setApiKeys] = useState({});
  const [keyVisibility, setKeyVisibility] = useState({});
  const [keyStatus, setKeyStatus] = useState({});
  const [saving, setSaving] = useState({});

  // Vault state
  const [vaultPath, setVaultPath] = useState(null);

  // Brands state (multiple brands)
  const [brands, setBrands] = useState([]);
  const [editingBrand, setEditingBrand] = useState(null);
  const [brandSaving, setBrandSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);

  // Backend status
  const [backendStatus, setBackendStatus] = useState({ running: false, port: 0 });

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load initial data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadApiKeyStatus();
      loadBrands();
      checkBackendStatus();
      loadVaultPath();
    }
  }, [isOpen]);

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

  const loadBrands = async () => {
    try {
      const response = await fetch('http://localhost:8000/brands');
      if (response.ok) {
        const data = await response.json();
        setBrands(data.brands || []);
      }
    } catch (err) {
      console.error('Failed to load brands:', err);
      setBrands([]);
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

  const createNewBrand = () => {
    setEditingBrand({
      id: null,
      name: '',
      type: 'text',
      text: '',
      fontSize: 24,
      fontColor: '#FFFFFF',
      position: 'bottom-right',
      opacity: 0.7,
      padding: 20,
      logoPath: null,
    });
    setLogoPreview(null);
  };

  const handleBrandChange = (field, value) => {
    setEditingBrand(prev => ({ ...prev, [field]: value }));
  };

  const selectLogo = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg'] }]
      });

      if (selected) {
        handleBrandChange('logoPath', selected);
        const logoData = await readBinaryFile(selected);
        const blob = new Blob([logoData], { type: 'image/png' });
        setLogoPreview(URL.createObjectURL(blob));
      }
    } catch (err) {
      console.error('Failed to select logo:', err);
    }
  };

  const saveBrand = async () => {
    if (!editingBrand.name.trim()) {
      alert('Please enter a brand name');
      return;
    }

    setBrandSaving(true);
    try {
      const brandData = {
        name: editingBrand.name,
        type: editingBrand.type,
        text: editingBrand.text || '',
        fontSize: editingBrand.fontSize,
        fontColor: editingBrand.fontColor,
        position: editingBrand.position,
        opacity: editingBrand.opacity,
        padding: editingBrand.padding,
      };

      if (editingBrand.id) {
        brandData.id = editingBrand.id;
      }

      if (editingBrand.logoPath && editingBrand.type === 'logo') {
        brandData.logoPath = editingBrand.logoPath;
      }

      const response = await fetch('http://localhost:8000/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandData),
      });

      if (!response.ok) {
        throw new Error('Failed to save brand');
      }

      await loadBrands();
      setEditingBrand(null);
      setLogoPreview(null);
    } catch (err) {
      console.error('Failed to save brand:', err);
      alert(`Failed to save brand: ${err}`);
    } finally {
      setBrandSaving(false);
    }
  };

  const editBrand = async (brand) => {
    setEditingBrand({ ...brand });
    if (brand.logoPath) {
      try {
        const logoData = await readBinaryFile(brand.logoPath);
        const blob = new Blob([logoData], { type: 'image/png' });
        setLogoPreview(URL.createObjectURL(blob));
      } catch {
        setLogoPreview(null);
      }
    } else {
      setLogoPreview(null);
    }
  };

  const deleteBrand = async (brandId) => {
    if (!confirm('Are you sure you want to delete this brand?')) return;

    try {
      const response = await fetch(`http://localhost:8000/brands/${brandId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete brand');
      }

      await loadBrands();
    } catch (err) {
      console.error('Failed to delete brand:', err);
      alert(`Failed to delete brand: ${err}`);
    }
  };

  if (!isOpen) return null;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="settings-tab-content">
            <h2>General</h2>
            <div className="settings-group">
              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">Version</span>
                  <span className="setting-description">Revelio v1.0.0</span>
                </div>
              </div>
              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">Backend Status</span>
                  <span className="setting-description">
                    {backendStatus.running ? (
                      <span className="status-badge running">Running on port {backendStatus.port}</span>
                    ) : (
                      <span className="status-badge stopped">Stopped</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'api-keys':
        return (
          <div className="settings-tab-content">
            <h2>API Keys</h2>
            <p className="tab-description">
              Your API keys are stored securely in the macOS Keychain.
            </p>
            <div className="settings-group">
              {API_KEYS.map(key => (
                <div key={key.id} className="setting-item api-key-item">
                  <div className="setting-info">
                    <div className="setting-header">
                      <span className="setting-label">{key.label}</span>
                      {keyStatus[key.id] && (
                        <span className="status-badge configured">Configured</span>
                      )}
                    </div>
                    <span className="setting-description">{key.description}</span>
                  </div>
                  <div className="api-key-input-row">
                    <div className="input-wrapper">
                      <input
                        type={keyVisibility[key.id] ? 'text' : 'password'}
                        value={apiKeys[key.id] || ''}
                        onChange={(e) => handleKeyChange(key.id, e.target.value)}
                        placeholder={keyStatus[key.id] ? '••••••••' : 'Enter API key'}
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
                      className="btn-primary"
                      onClick={() => saveApiKey(key.id)}
                      disabled={!apiKeys[key.id] || saving[key.id]}
                    >
                      {saving[key.id] ? 'Saving...' : 'Save'}
                    </button>
                    {keyStatus[key.id] && (
                      <button className="btn-danger" onClick={() => deleteApiKey(key.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                  <a href={key.link} target="_blank" rel="noopener noreferrer" className="get-key-link">
                    Get API key
                  </a>
                </div>
              ))}
              <div className="setting-item" style={{ borderTop: '1px solid #363a4f', paddingTop: '16px', marginTop: '8px' }}>
                <div className="setting-info">
                  <span className="setting-label">Apply Changes</span>
                  <span className="setting-description">Restart the backend to apply new API keys</span>
                </div>
                <button
                  className="btn-secondary"
                  onClick={async () => {
                    try {
                      const backendPath = await invoke('get_python_backend_path');
                      await invoke('restart_backend', { pythonBackendPath: backendPath || '' });
                      alert('Backend restarted successfully');
                    } catch (err) {
                      console.error('Failed to restart backend:', err);
                      alert(`Failed to restart: ${err}`);
                    }
                  }}
                >
                  Restart Backend
                </button>
              </div>
            </div>
          </div>
        );

      case 'vault':
        return (
          <div className="settings-tab-content">
            <h2>Vault</h2>
            <p className="tab-description">
              Your research and images are stored in a vault folder.
            </p>
            <div className="settings-group">
              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">Current Vault</span>
                  <span className="setting-description vault-path">{vaultPath || 'Not configured'}</span>
                </div>
              </div>
              <div className="vault-actions">
                {vaultPath && (
                  <button className="btn-secondary" onClick={handleRevealVault}>
                    Reveal in Finder
                  </button>
                )}
                <button className="btn-primary" onClick={() => {
                  onClose();
                  if (onResetVault) onResetVault();
                }}>
                  Switch Vault
                </button>
              </div>
              <div className="vault-structure">
                <span className="setting-label">Vault contains:</span>
                <ul>
                  <li><code>research/</code> - Markdown files for each story</li>
                  <li><code>attachments/</code> - Generated images</li>
                  <li><code>styles/</code> - Custom styles</li>
                  <li><code>notes/</code> - Your personal notes</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'brands':
        return (
          <div className="settings-tab-content">
            <h2>Brands</h2>
            <p className="tab-description">
              Create and manage brand watermarks for your images.
            </p>
            <div className="settings-group">
              {!editingBrand ? (
                <>
                  {brands.length === 0 ? (
                    <div className="setting-item">
                      <span className="setting-description">No brands created yet. Create one to add watermarks to your images.</span>
                    </div>
                  ) : (
                    <div className="brands-list">
                      {brands.map(brand => (
                        <div key={brand.id} className="brand-item">
                          <div className="brand-info">
                            <span className="brand-name">{brand.name}</span>
                            <span className="brand-type">{brand.type === 'logo' ? 'Logo' : brand.text}</span>
                          </div>
                          <div className="brand-actions">
                            <button className="btn-secondary" onClick={() => editBrand(brand)}>Edit</button>
                            <button className="btn-danger" onClick={() => deleteBrand(brand.id)}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="btn-primary" onClick={createNewBrand}>
                    + New Brand
                  </button>
                </>
              ) : (
                <div className="brand-editor">
                  <div className="setting-item">
                    <div className="setting-info">
                      <span className="setting-label">Brand Name</span>
                    </div>
                    <input
                      type="text"
                      value={editingBrand.name}
                      onChange={(e) => handleBrandChange('name', e.target.value)}
                      placeholder="My Brand"
                      className="text-input"
                    />
                  </div>

                  <div className="setting-item">
                    <div className="setting-info">
                      <span className="setting-label">Type</span>
                    </div>
                    <div className="type-buttons">
                      <button
                        className={`type-btn ${editingBrand.type === 'logo' ? 'active' : ''}`}
                        onClick={() => handleBrandChange('type', 'logo')}
                      >
                        Logo
                      </button>
                      <button
                        className={`type-btn ${editingBrand.type === 'text' ? 'active' : ''}`}
                        onClick={() => handleBrandChange('type', 'text')}
                      >
                        Text
                      </button>
                    </div>
                  </div>

                  {editingBrand.type === 'logo' ? (
                    <div className="setting-item logo-setting">
                      <div className="logo-preview-area">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" />
                        ) : (
                          <span>No logo</span>
                        )}
                      </div>
                      <button className="btn-secondary" onClick={selectLogo}>
                        {logoPreview ? 'Change' : 'Select'} Logo
                      </button>
                    </div>
                  ) : (
                    <div className="setting-item">
                      <div className="setting-info">
                        <span className="setting-label">Watermark Text</span>
                      </div>
                      <input
                        type="text"
                        value={editingBrand.text}
                        onChange={(e) => handleBrandChange('text', e.target.value)}
                        placeholder="@username"
                        className="text-input"
                      />
                    </div>
                  )}

                  <div className="setting-item">
                    <div className="setting-info">
                      <span className="setting-label">Position</span>
                    </div>
                    <div className="position-grid">
                      {POSITIONS.map(pos => (
                        <button
                          key={pos.id}
                          className={`position-btn ${editingBrand.position === pos.id ? 'active' : ''}`}
                          onClick={() => handleBrandChange('position', pos.id)}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="setting-item">
                    <div className="setting-info">
                      <span className="setting-label">Opacity: {Math.round(editingBrand.opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      value={editingBrand.opacity}
                      onChange={(e) => handleBrandChange('opacity', parseFloat(e.target.value))}
                      min="0.1"
                      max="1"
                      step="0.1"
                      className="range-input"
                    />
                  </div>

                  <div className="brand-editor-actions">
                    <button className="btn-secondary" onClick={() => { setEditingBrand(null); setLogoPreview(null); }}>
                      Cancel
                    </button>
                    <button className="btn-primary" onClick={saveBrand} disabled={brandSaving}>
                      {brandSaving ? 'Saving...' : (editingBrand.id ? 'Update Brand' : 'Create Brand')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="settings-close" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="settings-sidebar">
          <div className="settings-sidebar-section">
            <span className="section-title">Options</span>
            {SETTINGS_TABS.map(tab => (
              <button
                key={tab.id}
                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-content">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
