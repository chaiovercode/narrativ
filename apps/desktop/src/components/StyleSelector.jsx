import { useState, useEffect, useRef } from 'react';

export function StyleSelector({
  selectedStyle,
  onStyleSelect,
  customStyles,
  onCustomStylesChange,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [predefinedStyles, setPredefinedStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);

  // Fetch styles on mount
  useEffect(() => {
    fetchStyles();
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchStyles = async () => {
    try {
      const response = await fetch('http://localhost:8000/styles');
      if (response.ok) {
        const data = await response.json();
        setPredefinedStyles(data.predefined || []);
        if (data.custom && onCustomStylesChange) {
          onCustomStylesChange(data.custom);
        }
      }
    } catch (err) {
      console.error('Failed to fetch styles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomStyle = async (e, styleId) => {
    e.stopPropagation();
    try {
      const response = await fetch(`http://localhost:8000/styles/${styleId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        const newCustomStyles = customStyles.filter(s => s.id !== styleId);
        onCustomStylesChange(newCustomStyles);
        if (selectedStyle?.id === styleId) {
          onStyleSelect(predefinedStyles[0] || null);
        }
      }
    } catch (err) {
      console.error('Failed to delete style:', err);
    }
  };

  const allStyles = [...predefinedStyles, ...(customStyles || [])];
  const currentStyle = selectedStyle || predefinedStyles[0];

  return (
    <div className="style-selector" ref={dropdownRef}>
      <div
        className={`style-selector-trigger ${isOpen ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="style-selector-content">
          <span className="style-selector-label">Style</span>
          <span className="style-selector-value">
            {loading ? 'Loading...' : (currentStyle?.name || 'Select Style')}
          </span>
        </div>
        <div className="style-selector-preview">
          {currentStyle && (
            <div
              className="style-color-dots"
              title={currentStyle.color_palette}
            >
              {extractColors(currentStyle.color_palette).slice(0, 4).map((color, idx) => (
                <span
                  key={idx}
                  className="color-dot"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}
        </div>
        <span className="dropdown-arrow">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      {isOpen && !disabled && (
        <div className="style-selector-menu">
          {/* Predefined Styles */}
          <div className="style-menu-section">
            <span className="style-menu-label">Presets</span>
            {predefinedStyles.map((style) => (
              <StyleMenuItem
                key={style.id}
                style={style}
                isSelected={currentStyle?.id === style.id}
                onClick={() => {
                  onStyleSelect(style);
                  setIsOpen(false);
                }}
              />
            ))}
          </div>

          {/* Custom Styles */}
          {customStyles && customStyles.length > 0 && (
            <div className="style-menu-section">
              <span className="style-menu-label">Custom Styles</span>
              {customStyles.map((style) => (
                <StyleMenuItem
                  key={style.id}
                  style={style}
                  isSelected={currentStyle?.id === style.id}
                  isCustom
                  onClick={() => {
                    onStyleSelect(style);
                    setIsOpen(false);
                  }}
                  onDelete={(e) => handleDeleteCustomStyle(e, style.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StyleMenuItem({ style, isSelected, isCustom, onClick, onDelete }) {
  const colors = extractColors(style.color_palette);

  return (
    <div
      className={`style-menu-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="style-item-info">
        <span className="style-item-name">
          {style.name}
          {isCustom && <span className="custom-badge">Custom</span>}
        </span>
        <span className="style-item-desc">{style.art_style?.slice(0, 40)}...</span>
      </div>
      <div className="style-item-colors">
        {colors.slice(0, 4).map((color, idx) => (
          <span
            key={idx}
            className="color-dot"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      {isCustom && onDelete && (
        <button
          className="style-delete-btn"
          onClick={onDelete}
          title="Delete style"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
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

export default StyleSelector;
