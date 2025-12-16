import { useState } from 'react';
import { ConfirmModal } from './ConfirmModal';

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
  onDeleteImages
}) {
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, id: null });

  const handleDeleteRequest = (e, type, id) => {
    e.stopPropagation();
    setConfirmModal({ isOpen: true, type, id });
  };

  const handleConfirmDelete = () => {
    const { type, id } = confirmModal;
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
    }
    setConfirmModal({ isOpen: false, type: null, id: null });
  };

  const handleCancelDelete = () => {
    setConfirmModal({ isOpen: false, type: null, id: null });
  };

  return (
    <div className="boards-container">
      {/* Tabs */}
      {/* Tabs - only show if no board selected */}
      {!selectedBoard && !selectedResearchBoard && (
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
        />
      ) : (
        <ResearchBoardsContent
          savedResearch={savedResearch}
          selectedResearchBoard={selectedResearchBoard}
          setSelectedResearchBoard={setSelectedResearchBoard}
          selectedStyle={selectedStyle}
          onReviewForRegenerate={onReviewForRegenerate}
          onDeleteRequest={(e, id) => handleDeleteRequest(e, 'research', id)}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.type === 'image' ? 'Delete this image board?' : 'Delete this research?'}
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
  onDeleteRequest
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
              <div className="grid-overlay" onClick={() => onImageClick({ src: img, idx, board: selectedBoard })}>
                <h3>Slide {idx + 1}</h3>
              </div>
              <button
                className="grid-download-btn"
                onClick={(e) => { e.stopPropagation(); onDownloadImage(img, idx); }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v8m0 0l-3-3m3 3l3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="boards-grid">
      {savedImageBoards.map((board) => (
        <div key={board.id} className="board-card" onClick={() => setSelectedBoard(board)}>
          <button className="card-delete-btn" onClick={(e) => onDeleteRequest(e, board.id)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="board-stack-preview">
            {board.images.slice(0, 3).map((img, idx) => (
              <img key={idx} src={img} alt="" className={`stack-img stack-${idx}`} />
            ))}
          </div>
          <div className="board-info">
            <h3>{board.topic}</h3>
            <p>{board.images.length} images</p>
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
  onDeleteRequest
}) {
  // Use selected style if available, otherwise fall back to saved aesthetic
  const displayAesthetic = selectedStyle || selectedResearchBoard?.aesthetic;
  if (savedResearch.length === 0) {
    return (
      <div className="empty-state">
        <h2>No Research Yet</h2>
        <p>Your research will be saved here after generating stories.</p>
      </div>
    );
  }

  if (selectedResearchBoard) {
    return (
      <div className="research-detail">
        <div className="board-detail-header">
          <button className="back-btn" onClick={() => setSelectedResearchBoard(null)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <h2>{selectedResearchBoard.topic}</h2>
          <div className="board-detail-actions">
            <button
              className="download-all-btn"
              onClick={() => onReviewForRegenerate({
                ...selectedResearchBoard,
                aesthetic: displayAesthetic
              })}
            >
              Conjure Visuals
            </button>
            <button className="delete-btn" onClick={(e) => onDeleteRequest(e, selectedResearchBoard.id)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="research-detail-content">
          <div className="research-detail-section">
            <label>Scenes</label>
            <div className="research-detail-slides">
              {selectedResearchBoard.slides?.map((slide, idx) => (
                <div key={idx} className="research-detail-slide">
                  <div className="slide-header">
                    <span className="slide-num">{slide.slide_number}</span>
                    <h4>{slide.title}</h4>
                  </div>
                  <p className="slide-fact">{slide.key_fact}</p>
                  <p className="slide-visual">{slide.visual_description}</p>
                </div>
              ))}
            </div>
          </div>

          {selectedResearchBoard.sources?.length > 0 && (
            <div className="research-detail-section">
              <label>Sources ({selectedResearchBoard.sources.length})</label>
              <div className="research-detail-sources">
                {selectedResearchBoard.sources.map((src, idx) => (
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

  return (
    <div className="research-boards-grid">
      {savedResearch.map((research) => (
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
          <p className="research-style">{research.aesthetic?.art_style}</p>
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
