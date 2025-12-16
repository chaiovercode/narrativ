export function ResearchPanel({
  completedResearch,
  setCompletedResearch,
  researchCollapsed,
  setResearchCollapsed,
  onRegenerateImages
}) {
  if (!completedResearch) return null;

  const handleEditSlide = (field, value, slideIndex) => {
    const updatedSlides = [...completedResearch.slides];
    updatedSlides[slideIndex] = { ...updatedSlides[slideIndex], [field]: value };
    setCompletedResearch({ ...completedResearch, slides: updatedSlides });
  };

  return (
    <>
      <button
        className={`research-toggle ${researchCollapsed ? '' : 'expanded'}`}
        onClick={() => setResearchCollapsed(!researchCollapsed)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className={`research-panel ${researchCollapsed ? 'collapsed' : 'expanded'}`}>
        <div className="research-panel-content">
          <div className="research-panel-header">
            <h3>Refine & Conjure</h3>
            <span className="research-topic">{completedResearch.topic}</span>
          </div>

          <div className="research-panel-section">
            <label>Visual Charm</label>
            <p
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setCompletedResearch({
                ...completedResearch,
                aesthetic: { ...completedResearch.aesthetic, art_style: e.target.innerText }
              })}
              className="editable-research-field"
            >
              {completedResearch.aesthetic?.art_style}
            </p>
          </div>

          <div className="research-panel-section">
            <label>Scenes (click to edit)</label>
            {completedResearch.slides?.map((slide, idx) => (
              <div key={idx} className="research-slide-item editable">
                <span className="slide-num">{slide.slide_number}</span>
                <div>
                  <strong
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleEditSlide('title', e.target.innerText, idx)}
                  >
                    {slide.title}
                  </strong>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleEditSlide('key_fact', e.target.innerText, idx)}
                  >
                    {slide.key_fact}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {completedResearch.sources?.length > 0 && (
            <div className="research-panel-section">
              <label>Sources</label>
              {completedResearch.sources.slice(0, 5).map((src, idx) => (
                <a key={idx} href={src.url} target="_blank" rel="noopener noreferrer" className="research-source-link">
                  {src.title}
                </a>
              ))}
            </div>
          )}

          <button className="regenerate-btn" onClick={() => onRegenerateImages()}>
            Conjure Again
          </button>
        </div>
      </div>
    </>
  );
}
