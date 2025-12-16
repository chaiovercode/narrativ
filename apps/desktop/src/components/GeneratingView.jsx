export function GeneratingView({
  generatingPhase,
  topic,
  currentGeneratingSlide,
  setCurrentGeneratingSlide,
  expectedSlides,
  generatingSlides
}) {
  if (generatingPhase === 'images') {
    return (
      <div className="live-generation-view">
        {generatingSlides.length > 0 && currentGeneratingSlide > 0 && (
          <div className="current-slide-info">
            <div className="slide-progress-header">
              <span className="generating-label">
                Generating Slide {currentGeneratingSlide} of {expectedSlides}
              </span>
            </div>

            {generatingSlides[currentGeneratingSlide - 1] && (
              <div className="generating-slide-card">
                <div className="slide-number-badge">{currentGeneratingSlide}</div>
                <h2 className="generating-slide-title">
                  {generatingSlides[currentGeneratingSlide - 1].title}
                </h2>
                <p className="generating-slide-fact">
                  {generatingSlides[currentGeneratingSlide - 1].key_fact}
                </p>
                <div className="generating-slide-visual">
                  <span className="visual-label">Visual:</span>
                  <p>{generatingSlides[currentGeneratingSlide - 1].visual_description}</p>
                </div>
              </div>
            )}

            <div className="slide-queue">
              {generatingSlides.map((slide, idx) => (
                <div
                  key={idx}
                  className={`queue-dot clickable ${idx + 1 < currentGeneratingSlide ? 'done' : ''} ${idx + 1 === currentGeneratingSlide ? 'active' : ''}`}
                  onClick={() => setCurrentGeneratingSlide(idx + 1)}
                >
                  {idx + 1}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="research-progress">
      <div className="research-spinner"></div>
      <h3>Researching "{topic}"</h3>
      <p>Finding facts and planning slides...</p>
    </div>
  );
}
