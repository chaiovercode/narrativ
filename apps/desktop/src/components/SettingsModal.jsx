import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';
import { open as openUrl } from '@tauri-apps/api/shell';
import { readBinaryFile } from '@tauri-apps/api/fs';
import { ConfirmModal } from './ConfirmModal';
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
    description: 'Optional - for Fal.ai image generation',
    link: 'https://fal.ai'
  },
  {
    id: 'hf_api_key',
    label: 'Hugging Face API Key',
    description: 'Optional - for free SDXL image generation',
    link: 'https://huggingface.co/settings/tokens'
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

  // Ollama state
  const [ollamaModels, setOllamaModels] = useState([]);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState(
    localStorage.getItem('narrativ_ollama_model') || ''
  );

  // HuggingFace quality mode state
  const [hfQualityMode, setHfQualityMode] = useState(
    localStorage.getItem('narrativ_hf_quality_mode') || 'free'
  );

  // Vault state
  const [vaultPath, setVaultPath] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  // Brands state (multiple brands)
  const [brands, setBrands] = useState([]);
  const [editingBrand, setEditingBrand] = useState(null);
  const [brandSaving, setBrandSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, type: null, id: null, message: '' });


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
      loadVaultPath();
      loadOllamaModels();
    }
  }, [isOpen]);

  const loadOllamaModels = async () => {
    try {
      console.log('Checking Ollama status...');
      const response = await fetch('http://127.0.0.1:8000/ollama_models');
      if (response.ok) {
        const data = await response.json();
        console.log('Ollama status:', data);
        setOllamaAvailable(data.available);
        setOllamaModels(data.models || []);
      }
    } catch (err) {
      console.log('Failed to load Ollama models:', err);
      // Don't auto-set to false if we just failed to fetch, keep previous state or retry?
      // Actually, if fetch fails, backend is down or ollama is down.
      setOllamaAvailable(false);
      setOllamaModels([]);
    }
  };

  const handleOllamaModelChange = (model) => {
    setSelectedOllamaModel(model);
    localStorage.setItem('narrativ_ollama_model', model);
  };

  const handleHfQualityModeChange = (mode) => {
    setHfQualityMode(mode);
    localStorage.setItem('narrativ_hf_quality_mode', mode);
  };

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

  const handleSyncVault = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      // First ensure vault path is set in backend
      if (vaultPath) {
        await fetch('http://127.0.0.1:8000/vault/set', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: vaultPath }),
        });
      }

      // Then sync
      const response = await fetch('http://127.0.0.1:8000/vault/sync', {
        method: 'POST',
      });
      if (response.ok) {
        const result = await response.json();
        setSyncResult(result);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setSyncResult({ error: errorData.detail || 'Failed to sync vault' });
      }
    } catch (err) {
      console.error('Failed to sync vault:', err);
      setSyncResult({ error: err.message || 'Failed to sync vault' });
    } finally {
      setSyncing(false);
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
      const response = await fetch('http://127.0.0.1:8000/brands');
      if (response.ok) {
        const data = await response.json();
        setBrands(data.brands || []);
      }
    } catch (err) {
      console.error('Failed to load brands:', err);
      setBrands([]);
    }
  };

  const handleKeyChange = (keyId, value) => {
    setApiKeys(prev => ({ ...prev, [keyId]: value }));
  };

  const toggleKeyVisibility = (keyId) => {
    setKeyVisibility(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  // Helper to reload backend clients after API key changes
  const reloadBackendClients = async () => {
    try {
      console.log('Reloading backend clients...');

      // Read all API keys from keychain
      const [googleKey, fapiKey, hfKey, tavilyKey] = await Promise.all([
        invoke('get_api_key', { service: 'google_api_key' }).catch(() => null),
        invoke('get_api_key', { service: 'fal_api_key' }).catch(() => null),
        invoke('get_api_key', { service: 'hf_api_key' }).catch(() => null),
        invoke('get_api_key', { service: 'tavily_api_key' }).catch(() => null),
      ]);

      console.log('Keys status - Google:', !!googleKey, 'Fal:', !!fapiKey, 'HF:', !!hfKey, 'Tavily:', !!tavilyKey);

      // Send keys to backend to reload clients
      const response = await fetch('http://127.0.0.1:8000/reload_clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_api_key: googleKey || '',
          fal_api_key: fapiKey || '',
          hf_api_key: hfKey || '',
          tavily_api_key: tavilyKey || '',
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Backend clients reloaded:', result);
        return true;
      }
      console.warn('Failed to reload clients:', response.status);
      return false;
    } catch (err) {
      console.error('Error reloading clients:', err);
      return false;
    }
  };

  const saveApiKey = async (keyId) => {
    const value = apiKeys[keyId];
    if (!value || !value.trim()) return;

    setSaving(prev => ({ ...prev, [keyId]: true }));
    try {
      await invoke('set_api_key', { service: keyId, key: value.trim() });
      setKeyStatus(prev => ({ ...prev, [keyId]: true }));
      setApiKeys(prev => ({ ...prev, [keyId]: '' }));

      // Reload backend clients to apply new key
      console.log('Reloading backend clients to apply new API key...');
      await reloadBackendClients();

      // Notify providers to refresh
      window.dispatchEvent(new CustomEvent('api-keys-changed'));
      console.log('API keys changed event dispatched');
    } catch (err) {
      console.error('Failed to save API key:', err);
      alert(`Failed to save API key: ${err}`);
    } finally {
      setSaving(prev => ({ ...prev, [keyId]: false }));
    }
  };

  const handleDeleteApiKey = useCallback((keyId) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'api-key',
      id: keyId,
      message: `Delete the ${keyId.replace(/_/g, ' ')}?`
    });
  }, []);

  const confirmDeleteApiKey = async (keyId) => {
    try {
      await invoke('delete_api_key', { service: keyId });
      setKeyStatus(prev => ({ ...prev, [keyId]: false }));

      // Reload backend clients to apply the change
      console.log('Reloading backend clients after deleting API key...');
      await reloadBackendClients();

      // Notify providers to refresh
      window.dispatchEvent(new CustomEvent('api-keys-changed'));
      console.log('API keys changed event dispatched');
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

      const response = await fetch('http://127.0.0.1:8000/brands', {
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

  const handleDeleteBrand = useCallback((brandId) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'brand',
      id: brandId,
      message: 'Delete this brand?'
    });
  }, []);

  const confirmDeleteBrand = async (brandId) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/brands/${brandId}`, {
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

  const handleConfirmDelete = useCallback(async () => {
    if (deleteConfirm.type === 'api-key') {
      await confirmDeleteApiKey(deleteConfirm.id);
    } else if (deleteConfirm.type === 'brand') {
      await confirmDeleteBrand(deleteConfirm.id);
    }
    setDeleteConfirm({ isOpen: false, type: null, id: null, message: '' });
  }, [deleteConfirm]);

  const handleCancelDelete = useCallback(() => {
    setDeleteConfirm({ isOpen: false, type: null, id: null, message: '' });
  }, []);

  if (!isOpen) return null;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="settings-tab-content">
            <h2>General</h2>
            <div className="settings-group">
              <div className="setting-item version-item">
                <div className="setting-info">
                  <span className="setting-label">Version</span>
                  <span className="setting-description">Narrativ v1.0.0</span>
                </div>
              </div>

              {/* Ollama Model Selection */}
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-header">
                    <span className="setting-label">Ollama Model</span>
                    {ollamaAvailable ? (
                      <span className="status-badge configured">Running</span>
                    ) : (
                      <span className="status-badge">Not Running</span>
                    )}
                  </div>
                  <span className="setting-description">
                    Select which Ollama model to use for local AI research
                  </span>
                </div>
                {ollamaAvailable && ollamaModels.length > 0 ? (
                  <div className="custom-select-container">
                    <div
                      className={`custom-select-trigger ${isModelDropdownOpen ? 'open' : ''}`}
                      onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                    >
                      <span>{selectedOllamaModel || 'Auto-detect (recommended)'}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                    {isModelDropdownOpen && (
                      <div className="custom-select-options">
                        <div
                          className={`custom-select-option ${selectedOllamaModel === '' ? 'selected' : ''}`}
                          onClick={() => {
                            handleOllamaModelChange('');
                            setIsModelDropdownOpen(false);
                          }}
                        >
                          Auto-detect (recommended)
                        </div>
                        {ollamaModels.map(model => (
                          <div
                            key={model}
                            className={`custom-select-option ${selectedOllamaModel === model ? 'selected' : ''}`}
                            onClick={() => {
                              handleOllamaModelChange(model);
                              setIsModelDropdownOpen(false);
                            }}
                          >
                            {model}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="setting-hint">
                    {ollamaAvailable
                      ? 'No models installed. Run: ollama pull qwen2.5'
                      : 'Start Ollama to see available models'}
                  </div>
                )}
                <button
                  type="button"
                  className="get-key-link"
                  onClick={() => openUrl('https://ollama.com/library')}
                >
                  Browse Ollama models
                </button>
              </div>

              {/* HuggingFace Quality Mode */}
              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">HuggingFace Mode</span>
                  <span className="setting-description">
                    Quality mode uses premium models (may cost credits). Free mode uses only free tier.
                  </span>
                </div>
                <div className="type-buttons">
                  <button
                    className={`type-btn ${hfQualityMode === 'free' ? 'active' : ''}`}
                    onClick={() => handleHfQualityModeChange('free')}
                  >
                    Free
                  </button>
                  <button
                    className={`type-btn ${hfQualityMode === 'quality' ? 'active' : ''}`}
                    onClick={() => handleHfQualityModeChange('quality')}
                  >
                    Quality
                  </button>
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
              Your API keys are stored securely with AES-256 encryption.
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
                      <button className="btn-danger" onClick={() => handleDeleteApiKey(key.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="get-key-link"
                    onClick={() => openUrl(key.link)}
                  >
                    Get API key
                  </button>
                </div>
              ))}
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
                {vaultPath && (
                  <button className="btn-secondary" onClick={handleSyncVault} disabled={syncing}>
                    {syncing ? 'Syncing...' : 'Sync Vault'}
                  </button>
                )}
                <button className="btn-primary" onClick={() => {
                  onClose();
                  if (onResetVault) onResetVault();
                }}>
                  Switch Vault
                </button>
              </div>
              {syncResult && (
                <div className={`sync-result ${syncResult.error ? 'error' : 'success'}`}>
                  {syncResult.error ? (
                    <span>{syncResult.error}</span>
                  ) : (
                    <div className="sync-stats">
                      <span>Sync complete!</span>
                      {syncResult.attachments && (
                        <ul>
                          <li>Images: {syncResult.attachments.total_images || 0} files ({syncResult.attachments.added} new folders)</li>
                          <li>Research: {syncResult.research?.count || 0} files</li>
                          <li>Notes: {syncResult.notes?.count || 0} files</li>
                          <li>Styles: {syncResult.styles?.count || 0} files</li>
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
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
                            <button className="btn-danger" onClick={() => handleDeleteBrand(brand.id)}>Delete</button>
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

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        message={deleteConfirm.message}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}

export default SettingsModal;
