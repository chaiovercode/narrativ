import { CustomDropdown } from './CustomDropdown';
import { TrendingTopics } from './TrendingTopics';
import { StyleSelector } from './StyleSelector';
import { StyleExtractor } from './StyleExtractor';
import { CollapsibleSection } from './CollapsibleSection';

const IMAGE_PROVIDERS = [
  { id: 'gemini-pro', label: 'Nano Banana Pro', description: 'Higher quality images' },
  { id: 'fal', label: 'fal.ai Flux', description: 'Fast & cheap, ~$0.01/image' },
];

export function Sidebar({
  topic,
  setTopic,
  numSlides,
  setNumSlides,
  selectedStyle,
  setSelectedStyle,
  customStyles,
  setCustomStyles,
  imageSize,
  setImageSize,
  imageProvider,
  setImageProvider,
  inputMode,
  setInputMode,
  pastedText,
  setPastedText,
  isGenerating,
  generatingPhase,
  storyPlan,
  setStoryPlan,
  currentGeneratingSlide,
  expectedSlides,
  onGenerate,
  onCancel,
  brands = [],
  selectedBrand,
  setSelectedBrand
}) {
  const isResearching = isGenerating && generatingPhase === 'research';
  const isGeneratingImages = isGenerating && generatingPhase === 'images';
  const formDisabled = isResearching || storyPlan !== null;
  const styleDisabled = isResearching;

  const handleStyleExtracted = (style) => {
    setCustomStyles(prev => [style, ...prev]);
    setSelectedStyle(style);
  };

  const getButtonContent = () => {
    if (isGenerating && generatingPhase === 'research') {
      return (
        <>
          <span className="btn-spinner"></span>
          Discovering...
        </>
      );
    }
    if (isGenerating && generatingPhase === 'images') {
      return (
        <>
          <span className="btn-spinner"></span>
          Slide {currentGeneratingSlide} of {expectedSlides}
        </>
      );
    }
    if (!topic) {
      return 'Enter a topic to reveal';
    }
    return 'Revelio';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-content">
        <form onSubmit={onGenerate}>
          {/* Primary Input Section */}
          <div className="input-section-primary">
            {inputMode === 'topic' ? (
              <input
                type="text"
                className="topic-input-hero"
                placeholder="What's your story about?"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={formDisabled}
                autoFocus
              />
            ) : (
              <div className="paste-section">
                <input
                  type="text"
                  className="paste-title-input"
                  placeholder="Title"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={formDisabled}
                />
                <div className="paste-textarea-wrapper">
                  <textarea
                    className="paste-textarea"
                    placeholder="Paste your article, notes, or any text here..."
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value.slice(0, 5000))}
                    disabled={formDisabled}
                    rows={5}
                    maxLength={5000}
                  />
                  {pastedText.length > 0 && (
                    <span className={`paste-char-count ${pastedText.length > 4500 ? 'warning' : ''} ${pastedText.length >= 5000 ? 'limit' : ''}`}>
                      {pastedText.length >= 5000
                        ? 'Limit reached'
                        : pastedText.length > 4500
                          ? `${(5000 - pastedText.length).toLocaleString()} left`
                          : `${pastedText.trim().split(/\s+/).filter(w => w).length} words`
                      }
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Compact Mode Toggle */}
            <div className="mode-toggle-compact">
              <button
                type="button"
                className={`mode-btn-compact ${inputMode === 'topic' ? 'active' : ''}`}
                onClick={() => setInputMode('topic')}
                disabled={formDisabled}
              >
                Discover
              </button>
              <button
                type="button"
                className={`mode-btn-compact ${inputMode === 'paste' ? 'active' : ''}`}
                onClick={() => setInputMode('paste')}
                disabled={formDisabled}
              >
                Summon Text
              </button>
            </div>
          </div>

          {/* Inspiration Section (Topic mode only) */}
          {inputMode === 'topic' && !isGenerating && !storyPlan && (
            <CollapsibleSection title="Need a spark?" defaultOpen={false}>
              <TrendingTopics
                onTopicSelect={setTopic}
                disabled={formDisabled}
              />
            </CollapsibleSection>
          )}

          <div className="section-divider" />

          {/* Visual Style Section */}
          <div className="style-section">
            <label className="section-label">
              Visual Charm
              {isGeneratingImages && <span className="style-active-badge">Active</span>}
            </label>
            <StyleSelector
              selectedStyle={selectedStyle}
              onStyleSelect={setSelectedStyle}
              customStyles={customStyles}
              onCustomStylesChange={setCustomStyles}
              disabled={styleDisabled}
            />
            {!isGenerating && !storyPlan && (
              <StyleExtractor
                onStyleExtracted={handleStyleExtracted}
                disabled={styleDisabled}
              />
            )}
          </div>

          {/* Options Row - Always Visible */}
          <div className="options-row">
            <CustomDropdown
              label="Scenes"
              value={`${numSlides}`}
              options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => ({ label: `${n}`, value: n }))}
              onSelect={setNumSlides}
              disabled={formDisabled}
            />
            <CustomDropdown
              label="Canvas"
              value={imageSize}
              options={[
                { label: 'Story (9:16)', value: 'story' },
                { label: 'Square (1:1)', value: 'square' }
              ]}
              onSelect={setImageSize}
              disabled={styleDisabled}
            />
          </div>

          <div className="section-divider" />

          {/* Image Generator */}
          <CustomDropdown
            label="Conjurer"
            value={IMAGE_PROVIDERS.find(p => p.id === imageProvider)?.label || 'Select'}
            options={IMAGE_PROVIDERS.map(p => ({
              label: p.label,
              value: p.id,
            }))}
            onSelect={setImageProvider}
            disabled={styleDisabled}
          />

          {/* Brand Watermark */}
          {brands.length > 0 && (
            <CustomDropdown
              label="Watermark"
              value={selectedBrand ? brands.find(b => b.id === selectedBrand)?.name || 'None' : 'None'}
              options={[
                { label: 'None', value: null },
                ...brands.map(b => ({
                  label: b.name,
                  value: b.id,
                }))
              ]}
              onSelect={setSelectedBrand}
              disabled={styleDisabled}
            />
          )}
        </form>
      </div>

      {/* Sticky Footer with CTA */}
      <div className="sidebar-sticky-footer">
        {!storyPlan && !isGenerating ? (
          <button
            type="submit"
            className="generate-btn"
            disabled={!topic}
            onClick={onGenerate}
          >
            <span className="btn-content">{getButtonContent()}</span>
          </button>
        ) : isGenerating ? (
          <div className="sidebar-button-row">
            <button type="button" className="generate-btn" disabled>
              <span className="btn-content">{getButtonContent()}</span>
            </button>
            {generatingPhase === 'research' && (
              <button type="button" className="sidebar-btn cancel" onClick={onCancel}>
                Cancel
              </button>
            )}
          </div>
        ) : (
          <div className="sidebar-button-row">
            <button type="button" className="sidebar-btn cancel" onClick={() => setStoryPlan(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="sidebar-btn reset"
              onClick={() => {
                setStoryPlan(null);
                setTopic('');
                setNumSlides(5);
              }}
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
