import { useState, useEffect, useRef } from 'react';

// Fallback predefined styles (in case API fails)
const FALLBACK_STYLES = [
  { id: "cinematic", name: "Cinematic", art_style: "cinematic film photography with dramatic composition", color_palette: "rich blacks #1a1a1a, warm highlights #f5d6a8, deep shadows #2d2d2d, accent gold #d4af37", lighting: "dramatic chiaroscuro lighting", texture: "film grain, smooth gradients", typography_style: "bold sans-serif in white", background_style: "depth-of-field blur with bokeh" },
  { id: "vintage", name: "Vintage", art_style: "retro vintage illustration with aged paper aesthetic", color_palette: "sepia brown #8B7355, cream white #FFFDD0, faded red #CD5C5C, antique gold #CFB53B", lighting: "soft diffused warm lighting", texture: "weathered paper, slight vignette", typography_style: "serif typewriter font", background_style: "aged parchment with subtle stains" },
  { id: "cyberpunk", name: "Cyberpunk", art_style: "neon-lit cyberpunk digital art with futuristic elements", color_palette: "electric cyan #00FFFF, hot magenta #FF00FF, deep purple #4B0082, neon pink #FF1493", lighting: "neon glow with harsh shadows", texture: "chrome surfaces, digital glitch effects", typography_style: "futuristic angular font in neon", background_style: "dark urban cityscape with neon signs" },
  { id: "minimalist", name: "Minimalist", art_style: "clean minimalist design with ample white space", color_palette: "pure white #FFFFFF, charcoal black #36454F, accent blue #4169E1, soft gray #D3D3D3", lighting: "soft even lighting", texture: "smooth flat surfaces", typography_style: "thin modern sans-serif", background_style: "solid white or subtle gradient" },
  { id: "watercolor", name: "Watercolor", art_style: "soft watercolor painting with organic brush strokes", color_palette: "soft pink #FFB6C1, sky blue #87CEEB, mint green #98FB98, lavender #E6E6FA", lighting: "soft natural daylight", texture: "watercolor paper grain, paint bleeds", typography_style: "handwritten script in dark ink", background_style: "wet-on-wet watercolor wash" },
  { id: "dark_fantasy", name: "Dark Fantasy", art_style: "gothic dark fantasy illustration with mystical elements", color_palette: "midnight blue #191970, blood red #8B0000, silver #C0C0C0, emerald #50C878", lighting: "dramatic moonlight with ethereal glows", texture: "stone, mist, ancient runes", typography_style: "ornate gothic font in silver", background_style: "misty dark forests or castle ruins" },
  { id: "pop_art", name: "Pop Art", art_style: "bold pop art style with comic book influence", color_palette: "primary red #FF0000, yellow #FFFF00, blue #0000FF, black #000000", lighting: "flat bold lighting", texture: "halftone dots, bold outlines", typography_style: "comic book style bold letters", background_style: "bright solid colors or halftone patterns" },
  { id: "anime", name: "Anime", art_style: "Japanese anime illustration style with vibrant colors", color_palette: "sakura pink #FFB7C5, ocean blue #0077BE, sunset orange #FF7F50, grass green #7CFC00", lighting: "cel-shaded lighting", texture: "smooth anime cel shading", typography_style: "bold Japanese-inspired font", background_style: "detailed anime backgrounds with dramatic skies" },
  { id: "nature", name: "Nature", art_style: "photorealistic nature photography with vivid details", color_palette: "forest green #228B22, earth brown #8B4513, sky blue #87CEEB, sunset gold #FFD700", lighting: "golden hour natural sunlight", texture: "organic textures, leaves, bark", typography_style: "clean sans-serif in white", background_style: "lush natural landscapes" },
  { id: "neon_glow", name: "Neon Glow", art_style: "vibrant neon aesthetic with glowing elements", color_palette: "neon green #39FF14, electric blue #7DF9FF, hot pink #FF69B4, purple #9400D3", lighting: "intense neon glow against dark backgrounds", texture: "smooth glass, reflective surfaces", typography_style: "neon tube font with bright glow", background_style: "dark void with neon light sources" }
];

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

  // Fetch styles on mount with retry
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    const tryFetch = async () => {
      const success = await fetchStyles();
      if (!success && retryCount < maxRetries) {
        retryCount++;
        console.log(`[StyleSelector] Retrying fetch (${retryCount}/${maxRetries})...`);
        setTimeout(tryFetch, 1000);
      }
    };

    tryFetch();
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
      console.log('[StyleSelector] Fetching styles...');
      const response = await fetch('http://localhost:8000/styles');
      if (response.ok) {
        const data = await response.json();
        console.log('[StyleSelector] Got styles:', {
          predefined: data.predefined?.length || 0,
          custom: data.custom?.length || 0
        });
        const styles = data.predefined || FALLBACK_STYLES;
        setPredefinedStyles(styles);
        if (data.custom && onCustomStylesChange) {
          onCustomStylesChange(data.custom);
        }
        // Auto-select first style if none selected
        if (!selectedStyle && styles.length > 0) {
          onStyleSelect(styles[0]);
        }
        setLoading(false);
        return true;
      } else {
        console.error('[StyleSelector] Failed to fetch styles, using fallback');
        setPredefinedStyles(FALLBACK_STYLES);
        // Auto-select first fallback style if none selected
        if (!selectedStyle && FALLBACK_STYLES.length > 0) {
          onStyleSelect(FALLBACK_STYLES[0]);
        }
        setLoading(false);
        return false;
      }
    } catch (err) {
      console.error('[StyleSelector] Failed to fetch styles, using fallback:', err);
      setPredefinedStyles(FALLBACK_STYLES);
      // Auto-select first fallback style if none selected
      if (!selectedStyle && FALLBACK_STYLES.length > 0) {
        onStyleSelect(FALLBACK_STYLES[0]);
      }
      setLoading(false);
      return false;
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
