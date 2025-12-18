import { useState, useEffect, useRef } from 'react';
import { ConfirmModal } from './ConfirmModal';
import '../styles/boards.css';

export function BoardsView({
  activeTab,
  setActiveTab,
  savedResearch,
  savedImageBoards,
  selectedBoard,
  setSelectedBoard,
  selectedResearchBoard,
  setSelectedResearchBoard,
  selectedStyle,
  onImageClick,
  onDownloadImage,
  onDownloadAll,
  onReviewForRegenerate,
  onDeleteResearch,
  onDeleteImages,
  onDeleteSingleImage,
  onAddMoreSlides,
  onUpdateResearch
}) {
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, id: null, imageIndex: null });

  const handleDeleteRequest = (e, type, id, imageIndex = null) => {
    e.stopPropagation();
    setConfirmModal({ isOpen: true, type, id, imageIndex });
  };

  const handleConfirmDelete = () => {
    const { type, id, imageIndex } = confirmModal;
    if (type === 'image') {
      onDeleteImages(id);
      if (selectedBoard?.id === id) {
        setSelectedBoard(null);
      }
    } else if (type === 'research') {
      onDeleteResearch(id);
      if (selectedResearchBoard?.id === id) {
        setSelectedResearchBoard(null);
      }
    } else if (type === 'single-image' && onDeleteSingleImage) {
      onDeleteSingleImage(id, imageIndex);
    }
    setConfirmModal({ isOpen: false, type: null, id: null, imageIndex: null });
  };

  const handleCancelDelete = () => {
    setConfirmModal({ isOpen: false, type: null, id: null, imageIndex: null });
  };

  const getConfirmMessage = () => {
    if (confirmModal.type === 'image') return 'Delete this entire board?';
    if (confirmModal.type === 'research') return 'Delete this research?';
    if (confirmModal.type === 'single-image') return 'Delete this image?';
    return 'Are you sure?';
  };

  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  return (
    <div className="boards-container">
      {/* Header Controls: Tabs + View Toggle */}
      {!selectedBoard && !selectedResearchBoard && (
        <div className="boards-header-controls">
          <div className="boards-tabs">
            <button
              className={`board-tab ${activeTab === 'research' ? 'active' : ''}`}
              onClick={() => setActiveTab('research')}
            >
              Research
              {savedResearch.length > 0 && <span className="tab-count">{savedResearch.length}</span>}
            </button>
            <button
              className={`board-tab ${activeTab === 'images' ? 'active' : ''}`}
              onClick={() => setActiveTab('images')}
            >
              Images
              {savedImageBoards.length > 0 && <span className="tab-count">{savedImageBoards.length}</span>}
            </button>
          </div>

          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === 'images' ? (
        <ImageBoardsContent
          savedImageBoards={savedImageBoards}
          selectedBoard={selectedBoard}
          setSelectedBoard={setSelectedBoard}
          onImageClick={onImageClick}
          onDownloadImage={onDownloadImage}
          onDownloadAll={onDownloadAll}
          onDeleteRequest={(e, id) => handleDeleteRequest(e, 'image', id)}
          onDeleteSingleImage={(e, id, idx) => handleDeleteRequest(e, 'single-image', id, idx)}
          viewMode={viewMode}
        />
      ) : (
        <ResearchBoardsContent
          savedResearch={savedResearch}
          selectedResearchBoard={selectedResearchBoard}
          setSelectedResearchBoard={setSelectedResearchBoard}
          selectedStyle={selectedStyle}
          onReviewForRegenerate={onReviewForRegenerate}
          onDeleteRequest={(e, id) => handleDeleteRequest(e, 'research', id)}
          onAddMoreSlides={onAddMoreSlides}
          onUpdateResearch={onUpdateResearch}
          viewMode={viewMode}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={getConfirmMessage()}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}

function ImageBoardsContent({
  savedImageBoards,
  selectedBoard,
  setSelectedBoard,
  onImageClick,
  onDownloadImage,
  onDownloadAll,
  onDeleteRequest,
  onDeleteSingleImage,
  viewMode
}) {
  if (savedImageBoards.length === 0) {
    return (
      <div className="empty-state">
        <h2>No Images Yet</h2>
        <p>Enter a topic on the left to generate your first story.</p>
      </div>
    );
  }

  if (selectedBoard && selectedBoard.images) {
    return (
      <div className="board-detail">
        <div className="board-detail-header">
          <button className="back-btn" onClick={() => setSelectedBoard(null)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <h2>{selectedBoard.topic}</h2>
          <div className="board-detail-actions">
            {selectedBoard.provider && (
              <span className="provider-badge-small">
                via {selectedBoard.provider === 'gemini' ? 'Gemini' :
                  selectedBoard.provider === 'ollama' ? 'Ollama' :
                    selectedBoard.provider === 'fal' ? 'Fal.ai' :
                      selectedBoard.provider === 'huggingface' ? 'Hugging Face' : selectedBoard.provider}
              </span>
            )}
            <span className="board-detail-count">{selectedBoard.images.length} images</span>
            <button className="download-all-btn" onClick={() => onDownloadAll(selectedBoard.images, selectedBoard.topic)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8m0 0l-3-3m3 3l3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download All
            </button>
            <button className="delete-btn" onClick={(e) => onDeleteRequest(e, selectedBoard.id)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="pinterest-grid">
          {selectedBoard.images.map((img, idx) => (
            <div key={idx} className="grid-item">
              <img src={img} alt="" onClick={() => onImageClick({ src: img, idx, board: selectedBoard })} />

              <button
                className="grid-download-btn"
                onClick={(e) => { e.stopPropagation(); onDownloadImage(img, idx); }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v8m0 0l-3-3m3 3l3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {selectedBoard.images.length > 1 && (
                <button
                  className="grid-delete-btn"
                  onClick={(e) => onDeleteSingleImage(e, selectedBoard.id, idx)}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }


  if (viewMode === 'list') {
    return (
      <div className="boards-list-container">
        <div className="list-header-row">
          <div className="col-topic">Topic</div>
          <div className="col-count">Images</div>
          <div className="col-provider">Provider</div>
          <div className="col-date">Date</div>
          <div className="col-actions"></div>
        </div>
        <div className="list-body">
          {[...savedImageBoards].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).map((board) => (
            <div key={board.id} className="list-row" onClick={() => setSelectedBoard(board)}>
              <div className="cell-topic">
                <h3>{board.topic}</h3>
              </div>
              <div className="cell-count">
                {board.images.length}
              </div>
              <div className="cell-provider">
                {board.provider && (
                  <span className="provider-text-small">
                    {board.provider === 'gemini' ? 'Gemini' :
                      board.provider === 'ollama' ? 'Ollama' :
                        board.provider === 'fal' ? 'Fal' :
                          board.provider === 'huggingface' ? 'HF' : board.provider}
                  </span>
                )}
              </div>
              <div className="cell-date">
                {board.createdAt ? new Date(board.createdAt).toLocaleDateString() : '-'}
              </div>
              <div className="cell-actions">
                <button className="card-delete-btn-list" onClick={(e) => onDeleteRequest(e, board.id)}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="boards-grid">
      {[...savedImageBoards].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).map((board) => (
        <div key={board.id} className="board-card" onClick={() => setSelectedBoard(board)}>
          <button className="card-delete-btn" onClick={(e) => onDeleteRequest(e, board.id)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {board.provider && (
            <span className="card-provider-tag">
              {board.provider === 'gemini' ? 'Gemini' :
                board.provider === 'ollama' ? 'Ollama' :
                  board.provider === 'fal' ? 'Fal' :
                    board.provider === 'huggingface' ? 'HF' : board.provider}
            </span>
          )}
          <div className="board-stack-preview">
            {board.images.slice(0, 3).map((img, idx) => (
              <img key={idx} src={img} alt="" className={`stack-img stack-${idx}`} />
            ))}
          </div>
          <div className="board-info">
            <h3>{board.topic}</h3>
            <div className="board-meta">
              <span>{board.images.length} images</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

}

function ResearchBoardsContent({
  savedResearch,
  selectedResearchBoard,
  setSelectedResearchBoard,
  selectedStyle,
  onReviewForRegenerate,
  onDeleteRequest,
  onAddMoreSlides,
  onUpdateResearch,
  viewMode
}) {
  const [additionalSlides, setAdditionalSlides] = useState(0);
  const [isAddingSlides, setIsAddingSlides] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [localResearch, setLocalResearch] = useState(null);

  // Sync local state with selected research
  useEffect(() => {
    if (selectedResearchBoard) {
      setLocalResearch({ ...selectedResearchBoard });
    } else {
      setLocalResearch(null);
    }
  }, [selectedResearchBoard?.id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  // Use selected style if available, otherwise fall back to saved aesthetic
  const displayAesthetic = selectedStyle || selectedResearchBoard?.aesthetic;

  // Calculate max additional slides (10 - current)
  const currentSlideCount = selectedResearchBoard?.slides?.length || 0;
  const maxAdditional = Math.max(0, 10 - currentSlideCount);

  // Handle adding more slides
  const handleAddSlides = async () => {
    if (additionalSlides <= 0 || !onAddMoreSlides) return;
    setIsAddingSlides(true);
    try {
      await onAddMoreSlides(selectedResearchBoard, additionalSlides);
      setAdditionalSlides(0);
    } finally {
      setIsAddingSlides(false);
    }
  };

  const handleSelectSlides = (num) => {
    setAdditionalSlides(num);
    setDropdownOpen(false);
  };

  // Edit a slide field
  const handleEditSlide = (slideIndex, field, value) => {
    if (!localResearch) return;
    const updatedSlides = [...localResearch.slides];
    updatedSlides[slideIndex] = { ...updatedSlides[slideIndex], [field]: value };
    const updated = { ...localResearch, slides: updatedSlides };
    setLocalResearch(updated);
    // Save to backend
    if (onUpdateResearch) {
      onUpdateResearch(updated);
    }
  };

  // Delete a slide
  const handleDeleteSlide = (slideIndex) => {
    if (!localResearch || localResearch.slides.length <= 1) return;
    const updatedSlides = localResearch.slides.filter((_, idx) => idx !== slideIndex);
    // Renumber slides
    updatedSlides.forEach((slide, idx) => {
      slide.slide_number = idx + 1;
    });
    const updated = { ...localResearch, slides: updatedSlides };
    setLocalResearch(updated);
    setSelectedResearchBoard(updated);
    // Save to backend
    if (onUpdateResearch) {
      onUpdateResearch(updated);
    }
  };

  // Add a new blank slide
  const handleAddBlankSlide = () => {
    if (!localResearch || localResearch.slides.length >= 10) return;
    const newSlideNumber = localResearch.slides.length + 1;
    const newSlide = {
      slide_number: newSlideNumber,
      title: 'New Scene',
      key_fact: 'Add your fact here...',
      visual_description: 'Describe the visual scene...'
    };
    const updated = { ...localResearch, slides: [...localResearch.slides, newSlide] };
    setLocalResearch(updated);
    setSelectedResearchBoard(updated);
    // Save to backend
    if (onUpdateResearch) {
      onUpdateResearch(updated);
    }
  };

  // Use local research for display if available
  const displayResearch = localResearch || selectedResearchBoard;

  if (savedResearch.length === 0) {
    return (
      <div className="empty-state">
        <h2>No Research Yet</h2>
        <p>Your research will be saved here after generating stories.</p>
      </div>
    );
  }

  if (displayResearch) {
    const slideCount = displayResearch.slides?.length || 0;
    const canAddMore = slideCount < 10;

    return (
      <div className="research-detail">
        <div className="board-detail-header">
          <button className="back-btn" onClick={() => setSelectedResearchBoard(null)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <h2>{displayResearch.topic}</h2>
          {(displayResearch.provider || displayResearch.model) && (
            <span className="provider-badge-small">
              {displayResearch.model || (displayResearch.provider === 'ollama' ? 'Ollama' : 'Gemini')}
            </span>
          )}
          <div className="board-detail-actions">
            <button
              className="download-all-btn"
              onClick={() => onReviewForRegenerate({
                ...displayResearch,
                aesthetic: displayAesthetic
              })}
            >
              Review
            </button>
            <button className="delete-btn" onClick={(e) => onDeleteRequest(e, displayResearch.id)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="research-detail-content">
          <div className="research-detail-section">
            <div className="scenes-header">
              <label>Scenes ({slideCount}/10)</label>
              {maxAdditional > 0 && onAddMoreSlides && (
                <div className="add-slides-control">
                  <div ref={dropdownRef} className={`custom-dropdown ${dropdownOpen ? 'open' : ''}`}>
                    <button
                      className="dropdown-trigger"
                      onClick={() => !isAddingSlides && setDropdownOpen(!dropdownOpen)}
                      disabled={isAddingSlides}
                    >
                      {additionalSlides > 0 ? `+${additionalSlides} AI scene${additionalSlides > 1 ? 's' : ''}` : 'AI Generate...'}
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {dropdownOpen && (
                      <div className="dropdown-menu">
                        {Array.from({ length: maxAdditional }, (_, i) => i + 1).map(num => (
                          <button
                            key={num}
                            className={`dropdown-item ${additionalSlides === num ? 'selected' : ''}`}
                            onClick={() => handleSelectSlides(num)}
                          >
                            +{num} AI scene{num > 1 ? 's' : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {additionalSlides > 0 && (
                    <button
                      className="add-slides-btn"
                      onClick={handleAddSlides}
                      disabled={isAddingSlides}
                    >
                      {isAddingSlides ? 'Adding...' : `Add ${additionalSlides}`}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="research-detail-slides">
              {displayResearch.slides?.map((slide, idx) => (
                <div key={idx} className="research-detail-slide">
                  <div className="slide-header">
                    <span className="slide-num">{slide.slide_number}</span>
                    <h4
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => handleEditSlide(idx, 'title', e.target.innerText)}
                      className="editable-title"
                    >
                      {slide.title}
                    </h4>
                    {slideCount > 1 && (
                      <button
                        className="slide-delete-btn"
                        onClick={() => handleDeleteSlide(idx)}
                        title="Delete scene"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p
                    className="slide-fact editable-field"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleEditSlide(idx, 'key_fact', e.target.innerText)}
                  >
                    {slide.key_fact}
                  </p>
                  <p
                    className="slide-visual editable-field"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleEditSlide(idx, 'visual_description', e.target.innerText)}
                  >
                    {slide.visual_description}
                  </p>
                </div>
              ))}

              {/* Add Scene Button */}
              {canAddMore && (
                <button className="add-scene-btn" onClick={handleAddBlankSlide}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Add Scene Manually
                </button>
              )}
            </div>
          </div>

          {displayResearch.sources?.length > 0 && (
            <div className="research-detail-section">
              <label>Sources ({displayResearch.sources.length})</label>
              <div className="research-detail-sources">
                {displayResearch.sources.map((src, idx) => (
                  <a key={idx} href={src.url} target="_blank" rel="noopener noreferrer" className="source-link">
                    {src.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }


  if (viewMode === 'list') {
    return (
      <div className="boards-list-container">
        <div className="list-header-row">
          <div className="col-topic">Topic</div>
          <div className="col-scenes">Scenes</div>
          <div className="col-sources">Sources</div>
          <div className="col-provider">Provider</div>
          <div className="col-date">Date</div>
          <div className="col-actions"></div>
        </div>
        <div className="list-body">
          {[...savedResearch].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).map((research) => (
            <div key={research.id} className="list-row" onClick={() => setSelectedResearchBoard(research)}>
              <div className="cell-topic">
                <h3>{research.topic}</h3>
              </div>
              <div className="cell-scenes">
                {research.slides?.length}
              </div>
              <div className="cell-sources">
                {research.sources?.length || 0}
              </div>
              <div className="cell-provider">
                {(research.provider || research.model) && (
                  <span className="provider-text-small">
                    {research.model || (research.provider === 'ollama' ? 'Ollama' : 'Gemini')}
                  </span>
                )}
              </div>
              <div className="cell-date">
                {research.createdAt ? new Date(research.createdAt).toLocaleDateString() : '-'}
              </div>
              <div className="cell-actions">
                <button className="card-delete-btn-list" onClick={(e) => onDeleteRequest(e, research.id)}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="research-boards-grid">
      {[...savedResearch].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).map((research) => (
        <div
          key={research.id}
          className="research-board-card"
          onClick={() => setSelectedResearchBoard(research)}
        >
          <button className="card-delete-btn" onClick={(e) => onDeleteRequest(e, research.id)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="research-board-header">
            <h3>{research.topic}</h3>
            <span className="slide-count">{research.slides?.length} scenes</span>
          </div>
          <div className="research-meta-row">
            <p className="research-style">{research.aesthetic?.art_style}</p>
            {(research.provider || research.model) && (
              <span className="provider-text-small">
                via {research.model || (research.provider === 'ollama' ? 'Ollama' : 'Gemini')}
              </span>
            )}
          </div>
          <div className="research-slides-preview">
            {research.slides?.slice(0, 3).map((slide, idx) => (
              <div key={idx} className="research-slide-preview">
                <span>{slide.slide_number}.</span> {slide.title}
              </div>
            ))}
            {research.slides?.length > 3 && (
              <div className="research-slide-preview more">+{research.slides.length - 3} more</div>
            )}
          </div>
          {research.sources?.length > 0 && (
            <div className="research-sources-count">{research.sources.length} sources</div>
          )}
        </div>
      ))}
    </div>
  );
}
