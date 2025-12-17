import { useState, useEffect } from 'react';

export function ReviewMode({
  storyPlan,
  selectedStyle,
  onEditAesthetic,
  onEditCaption,
  onConfirmPlan,
  onSaveResearch,
  onBack
}) {
  const [stage, setStage] = useState('scenes'); // 'scenes' or 'review'

  // Track which slides are selected for generation (all selected by default)
  const [selectedSlides, setSelectedSlides] = useState(() => {
    if (storyPlan?.slides) {
      return storyPlan.slides.map(s => s.slide_number);
    }
    return [];
  });

  // Update selectedSlides when storyPlan changes
  useEffect(() => {
    if (storyPlan?.slides) {
      setSelectedSlides(storyPlan.slides.map(s => s.slide_number));
    }
  }, [storyPlan?.slides?.length]);

  // Toggle slide selection
  const toggleSlide = (slideNumber) => {
    setSelectedSlides(prev => {
      if (prev.includes(slideNumber)) {
        return prev.filter(n => n !== slideNumber);
      } else {
        return [...prev, slideNumber].sort((a, b) => a - b);
      }
    });
  };

  // Select/deselect all
  const toggleAll = () => {
    if (selectedSlides.length === storyPlan.slides.length) {
      setSelectedSlides([]);
    } else {
      setSelectedSlides(storyPlan.slides.map(s => s.slide_number));
    }
  };

  // Handle confirm with selected slides only
  const handleConfirmWithSelection = () => {
    // Filter plan to only include selected slides
    const filteredPlan = {
      ...storyPlan,
      slides: storyPlan.slides.filter(s => selectedSlides.includes(s.slide_number))
    };
    console.log('[ReviewMode] Generating with filtered plan:', {
      selectedSlides,
      totalSlides: storyPlan.slides.length,
      filteredSlides: filteredPlan.slides.length
    });
    onConfirmPlan(filteredPlan);
  };

  // Debug logging
  console.log('[ReviewMode] Rendering with:', {
    hasStoryPlan: !!storyPlan,
    hasSlides: !!storyPlan?.slides,
    slideCount: storyPlan?.slides?.length,
    hasSelectedStyle: !!selectedStyle,
    selectedSlides,
    stage
  });

  if (!storyPlan || !storyPlan.slides) {
    console.log('[ReviewMode] Returning null - missing storyPlan or slides');
    return null;
  }

  // Extract colors from palette for display
  const extractColors = (palette) => {
    if (!palette) return [];
    if (typeof palette !== 'string') return [];
    const hexPattern = /#[0-9A-Fa-f]{6}/g;
    return palette.match(hexPattern) || [];
  };

  // Get merged aesthetic for color extraction
  const mergedAesthetic = selectedStyle || storyPlan.aesthetic || {};
  const colors = extractColors(mergedAesthetic.color_palette);

  // Stage 1: Just show scenes
  if (stage === 'scenes') {
    return (
      <div className="review-scroll-wrapper">
        <div className="review-container">
          {/* Header bar matching research detail layout */}
          <div className="board-detail-header">
            {onBack && (
              <button className="back-btn" onClick={onBack}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back
              </button>
            )}
            <h2>Select Scenes</h2>
            <div className="board-detail-actions">
              <button className="btn-secondary" onClick={onSaveResearch}>
                Save Research
              </button>
              <button
                className="btn-primary"
                onClick={() => setStage('review')}
                disabled={selectedSlides.length === 0}
              >
                Next →
              </button>
            </div>
          </div>

          <div className="slides-selection-header">
            <label className="select-all-toggle">
              <input
                type="checkbox"
                checked={selectedSlides.length === storyPlan.slides.length}
                onChange={toggleAll}
              />
              <span>
                {selectedSlides.length === storyPlan.slides.length
                  ? 'Deselect All'
                  : `Select All (${storyPlan.slides.length})`}
              </span>
            </label>
            <span className="selection-count">
              {selectedSlides.length} of {storyPlan.slides.length} selected
            </span>
          </div>

          <div className="slides-preview">
            {storyPlan.slides.map((slide) => (
              <div
                key={slide.slide_number}
                className={`slide-row ${selectedSlides.includes(slide.slide_number) ? 'selected' : 'deselected'}`}
              >
                <div className="slide-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedSlides.includes(slide.slide_number)}
                    onChange={() => toggleSlide(slide.slide_number)}
                  />
                </div>
                <div className="slide-number">{slide.slide_number}</div>
                <div className="slide-content-preview">
                  <h4>{slide.title}</h4>
                  <label className="field-label">Key Fact</label>
                  <p>{slide.key_fact}</p>
                  <label className="field-label">Visual Description</label>
                  <p className="visual-desc">{slide.visual_description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Get aesthetic - prefer selectedStyle, then storyPlan.aesthetic
  const aesthetic = selectedStyle || storyPlan.aesthetic || {};

  // Stage 2: Full review with Visual Charm, Caption, etc.
  console.log('[ReviewMode] Rendering review stage with aesthetic:', aesthetic);

  return (
    <div className="review-scroll-wrapper">
      <div className="review-container">
        {/* Header bar matching research detail layout */}
        <div className="board-detail-header">
          <button className="back-btn" onClick={() => setStage('scenes')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <h2>Review Style</h2>
          <div className="board-detail-actions">
            <button
              className="btn-primary"
              onClick={handleConfirmWithSelection}
              disabled={selectedSlides.length === 0}
            >
              Generate {selectedSlides.length} Image{selectedSlides.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>

        <h3 className="section-title">Visual Charm</h3>
        <div className="aesthetic-card">
          {(selectedStyle?.name || storyPlan.style_name) && (
            <span className="style-badge-corner">{selectedStyle?.name || storyPlan.style_name}</span>
          )}
          {colors.length > 0 && (
            <div className="color-preview-row">
              {colors.map((color, idx) => (
                <span
                  key={idx}
                  className="color-preview-swatch"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          )}

          <div className="style-grid">
            <div className="style-item">
              <label>ART STYLE</label>
              <p
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => onEditAesthetic('art_style', e.target.innerText)}
                className="editable-field"
              >
                {aesthetic.art_style || 'Not specified'}
              </p>
            </div>
            <div className="style-item">
              <label>COLOR PALETTE</label>
              <p
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => onEditAesthetic('color_palette', e.target.innerText)}
                className="editable-field"
              >
                {aesthetic.color_palette || 'Not specified'}
              </p>
            </div>
            <div className="style-item">
              <label>LIGHTING</label>
              <p
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => onEditAesthetic('lighting', e.target.innerText)}
                className="editable-field"
              >
                {aesthetic.lighting || 'Not specified'}
              </p>
            </div>
            <div className="style-item">
              <label>TEXTURE</label>
              <p
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => onEditAesthetic('texture', e.target.innerText)}
                className="editable-field"
              >
                {aesthetic.texture || 'Not specified'}
              </p>
            </div>
            <div className="style-item">
              <label>TYPOGRAPHY</label>
              <p
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => onEditAesthetic('typography_style', e.target.innerText)}
                className="editable-field"
              >
                {aesthetic.typography_style || 'Not specified'}
              </p>
            </div>
            <div className="style-item">
              <label>BACKGROUND</label>
              <p
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => onEditAesthetic('background_style', e.target.innerText)}
                className="editable-field"
              >
                {aesthetic.background_style || 'Not specified'}
              </p>
            </div>
          </div>
          <p className="edit-hint">Click to edit • Adjust charm in sidebar</p>
        </div>

        {storyPlan.caption && (
          <>
            <h3 className="section-title">The Narrative</h3>
            <div className="caption-edit-section">
              <p
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => onEditCaption(e.target.innerText)}
                className="editable-field caption-field"
              >
                {storyPlan.caption}
              </p>
              <div className="hashtags-edit">
                {storyPlan.hashtags?.map((tag, i) => (
                  <span key={i} className="hashtag-pill">#{tag}</span>
                ))}
              </div>
              <p className="edit-hint">Click to edit</p>
            </div>
          </>
        )}

        {storyPlan.sources && storyPlan.sources.length > 0 && (
          <div className="sources-section">
            <h3>Research Sources</h3>
            <div className="sources-list">
              {storyPlan.sources.map((source, index) => (
                <a
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-item"
                >
                  <span className="source-number">{index + 1}</span>
                  <span className="source-title">{source.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
