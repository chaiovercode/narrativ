import { useState } from 'react';

export function ReviewMode({
  storyPlan,
  selectedStyle,
  onEditAesthetic,
  onEditSlide,
  onEditCaption,
  onConfirmPlan
}) {
  const [stage, setStage] = useState('scenes'); // 'scenes' or 'review'

  if (!storyPlan || !storyPlan.slides) return null;

  // Extract colors from palette for display
  const extractColors = (palette) => {
    if (!palette) return [];
    if (typeof palette !== 'string') return [];
    const hexPattern = /#[0-9A-Fa-f]{6}/g;
    return palette.match(hexPattern) || [];
  };

  const colors = extractColors(storyPlan.aesthetic?.color_palette);

  // Stage 1: Just show scenes
  if (stage === 'scenes') {
    return (
      <div className="review-scroll-wrapper">
        <div className="review-container">
          <div className="review-header">
            <h2>Review Your Scenes</h2>
            <p>Click any field to edit before proceeding.</p>
          </div>

          <div className="slides-preview">
            {storyPlan.slides.map((slide, index) => (
              <div key={slide.slide_number} className="slide-row">
                <div className="slide-number">{slide.slide_number}</div>
                <div className="slide-content-preview">
                  <h4
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onEditSlide(index, 'title', e.target.innerText)}
                    className="editable-field"
                  >
                    {slide.title}
                  </h4>
                  <label className="field-label">Key Fact</label>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onEditSlide(index, 'key_fact', e.target.innerText)}
                    className="editable-field"
                  >
                    {slide.key_fact}
                  </p>
                  <label className="field-label">Visual Description</label>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onEditSlide(index, 'visual_description', e.target.innerText)}
                    className="editable-field visual-desc"
                  >
                    {slide.visual_description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="action-buttons">
            <button className="btn-primary" onClick={() => setStage('review')}>
              Conjure Visuals
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Stage 2: Full review with Visual Charm, Caption, etc.
  return (
    <div className="review-scroll-wrapper">
      <div className="review-container">
        <div className="review-header">
          <h2>Final Review</h2>
          <p>Review your visual style and caption before generating.</p>
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
                {storyPlan.aesthetic?.art_style}
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
                {storyPlan.aesthetic?.color_palette}
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
                {storyPlan.aesthetic?.lighting}
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
                {storyPlan.aesthetic?.texture}
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
                {storyPlan.aesthetic?.typography_style}
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
                {storyPlan.aesthetic?.background_style}
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

        <div className="action-buttons">
          <button className="btn-secondary" onClick={() => setStage('scenes')}>
            ← Back to Scenes
          </button>
          <button className="btn-primary" onClick={onConfirmPlan}>
            Generate Images
          </button>
        </div>
      </div>
    </div>
  );
}
