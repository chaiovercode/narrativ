import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { fetchImages, deleteImages } from '../services/api';
import { ConfirmModal } from '../components/ConfirmModal';
import '../App.css';

function Gallery() {
  const [imageBoards, setImageBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStory, setSelectedStory] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      setLoading(true);
      const boards = await fetchImages();
      setImageBoards(boards);
    } catch (err) {
      console.error('Failed to load images:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteImages(id);
      setImageBoards(prev => prev.filter(b => b.id !== id));
      if (selectedStory?.id === id) {
        setSelectedStory(null);
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    }
    setConfirmModal({ isOpen: false, id: null });
  };

  const handleDownloadAll = async (images, topicName) => {
    const zip = new JSZip();
    const folder = zip.folder('images');

    for (let i = 0; i < images.length; i++) {
      try {
        const response = await fetch(images[i]);
        const blob = await response.blob();
        folder.file(`slide_${i + 1}.png`, blob);
      } catch (err) {
        console.error(`Failed to add image ${i + 1} to zip:`, err);
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const safeName = topicName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    saveAs(content, `${safeName}_images.zip`);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Empty state
  if (!loading && imageBoards.length === 0) {
    return (
      <div className="gallery-page">
        <div className="gallery-empty">
          <div className="empty-icon">✦</div>
          <h2>No Stories Yet</h2>
          <p>Your generated stories will appear here.</p>
          <p className="empty-hint">Click "Create" in the sidebar to get started.</p>
        </div>
      </div>
    );
  }

  // Story detail view
  if (selectedStory) {
    return (
      <div className="gallery-page">
        <div className="gallery-detail">
          <div className="detail-header">
            <button className="back-btn" onClick={() => setSelectedStory(null)}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to Gallery
            </button>
            <div className="detail-info">
              <h1>{selectedStory.topic}</h1>
              <span className="detail-meta">
                {selectedStory.images.length} images • {formatDate(selectedStory.createdAt)}
              </span>
            </div>
            <div className="detail-actions">
              <button
                className="action-btn download"
                onClick={() => handleDownloadAll(selectedStory.images, selectedStory.topic)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v8m0 0l-3-3m3 3l3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download All
              </button>
              <button
                className="action-btn delete"
                onClick={() => setConfirmModal({ isOpen: true, id: selectedStory.id })}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          <div className="detail-grid">
            {selectedStory.images.map((img, idx) => (
              <div key={idx} className="detail-image" onClick={() => setLightboxImage({ src: img, idx })}>
                <img src={img} alt={`Slide ${idx + 1}`} />
                <div className="image-overlay">
                  <span className="slide-label">Slide {idx + 1}</span>
                </div>
              </div>
            ))}
          </div>

          {selectedStory.caption && (
            <div className="detail-caption">
              <h3>Caption</h3>
              <p>{selectedStory.caption}</p>
              {selectedStory.hashtags?.length > 0 && (
                <div className="hashtags">
                  {selectedStory.hashtags.map((tag, i) => (
                    <span key={i} className="hashtag">#{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lightbox */}
        {lightboxImage && (
          <div className="gallery-lightbox" onClick={() => setLightboxImage(null)}>
            <button className="lightbox-close" onClick={() => setLightboxImage(null)}>×</button>
            <img src={lightboxImage.src} alt="" onClick={(e) => e.stopPropagation()} />
            {lightboxImage.idx > 0 && (
              <button
                className="nav-btn prev"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxImage({ src: selectedStory.images[lightboxImage.idx - 1], idx: lightboxImage.idx - 1 });
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
            {lightboxImage.idx < selectedStory.images.length - 1 && (
              <button
                className="nav-btn next"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxImage({ src: selectedStory.images[lightboxImage.idx + 1], idx: lightboxImage.idx + 1 });
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
        )}

        <ConfirmModal
          isOpen={confirmModal.isOpen}
          message="Delete this story? This cannot be undone."
          onConfirm={() => handleDelete(confirmModal.id)}
          onCancel={() => setConfirmModal({ isOpen: false, id: null })}
        />
      </div>
    );
  }

  // Loading state - show full page loader with bouncy dots
  if (loading) {
    return (
      <div className="gallery-page">
        <div className="loading-fun">
          <div className="loading-dots">
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
          </div>
          <p className="loading-text">Loading your stories...</p>
        </div>
      </div>
    );
  }

  // Gallery grid view
  return (
    <div className="gallery-page">
      <div className="gallery-header">
        <h1>Your Stories</h1>
        <p>{imageBoards.length} {imageBoards.length === 1 ? 'story' : 'stories'} created</p>
      </div>

      <div className="gallery-grid">
          {imageBoards.map((board) => (
            <div
              key={board.id}
              className="gallery-card"
              onClick={() => setSelectedStory(board)}
            >
              <div className="card-preview">
                {board.images.slice(0, 4).map((img, idx) => (
                  <div key={idx} className={`preview-img preview-${idx}`}>
                    <img src={img} alt="" />
                  </div>
                ))}
                <div className="card-overlay">
                  <span className="image-count">{board.images.length} images</span>
                </div>
              </div>
              <div className="card-info">
                <h3>{board.topic}</h3>
                <span className="card-date">{formatDate(board.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message="Delete this story? This cannot be undone."
        onConfirm={() => handleDelete(confirmModal.id)}
        onCancel={() => setConfirmModal({ isOpen: false, id: null })}
      />
    </div>
  );
}

export default Gallery;
