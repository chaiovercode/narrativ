import { useState, useRef } from 'react';

export function StyleExtractor({ onStyleExtracted, disabled = false }) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [styleName, setStyleName] = useState('');
  const [extractedStyle, setExtractedStyle] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);

    // Extract style
    setIsExtracting(true);
    setError(null);
    setExtractedStyle(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', styleName || 'Custom Style');

      const response = await fetch('http://localhost:8000/extract_style', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Extraction failed');
      }

      const data = await response.json();
      setExtractedStyle(data.style);
    } catch (err) {
      console.error('Style extraction failed:', err);
      setError(err.message || 'Failed to extract style');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveStyle = async () => {
    if (!extractedStyle) return;

    // Update name if changed
    const styleToSave = {
      ...extractedStyle,
      name: styleName || extractedStyle.name
    };

    try {
      const response = await fetch('http://localhost:8000/styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(styleToSave)
      });

      if (!response.ok) throw new Error('Failed to save style');

      const data = await response.json();
      onStyleExtracted(data.style);

      // Reset
      setPreview(null);
      setStyleName('');
      setExtractedStyle(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err.message || 'Failed to save style');
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setStyleName('');
    setExtractedStyle(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`style-extractor ${disabled ? 'disabled' : ''}`}>
      {!preview ? (
        <div
          className="style-extractor-upload"
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={disabled}
          />
          <div className="upload-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="upload-content">
            <span className="upload-text">Upload reference</span>
            <span className="upload-hint">Extract style with AI</span>
          </div>
        </div>
      ) : (
        <div className="style-extractor-preview">
          <div className="preview-image-container">
            <img src={preview} alt="Reference" className="preview-image" />
            {isExtracting && (
              <div className="preview-overlay">
                <div className="extracting-spinner"></div>
                <span>Extracting style...</span>
              </div>
            )}
          </div>

          {error && (
            <div className="extractor-error">{error}</div>
          )}

          {extractedStyle && (
            <div className="extracted-style-preview">
              <input
                type="text"
                className="style-name-input"
                placeholder="Style name..."
                value={styleName}
                onChange={(e) => setStyleName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              />

              <div className="extracted-style-details">
                <div className="style-detail-row">
                  <span className="detail-label">Charm</span>
                  <span className="detail-value">{extractedStyle.art_style?.slice(0, 50)}...</span>
                </div>
                <div className="style-detail-row">
                  <span className="detail-label">Colors</span>
                  <div className="extracted-colors">
                    {extractColors(extractedStyle.color_palette).map((color, idx) => (
                      <span
                        key={idx}
                        className="color-swatch"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
                <div className="style-detail-row">
                  <span className="detail-label">Lighting</span>
                  <span className="detail-value">{extractedStyle.lighting?.slice(0, 40)}...</span>
                </div>
              </div>

              <div className="extractor-actions">
                <button type="button" className="extractor-btn cancel" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="button" className="extractor-btn save" onClick={handleSaveStyle}>
                  Save Style
                </button>
              </div>
            </div>
          )}

          {!extractedStyle && !isExtracting && (
            <div className="extractor-actions">
              <button type="button" className="extractor-btn cancel" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper to extract hex colors from palette string
function extractColors(palette) {
  if (!palette) return ['#888'];
  const hexPattern = /#[0-9A-Fa-f]{6}/g;
  const matches = palette.match(hexPattern);
  return matches || ['#888'];
}

export default StyleExtractor;
