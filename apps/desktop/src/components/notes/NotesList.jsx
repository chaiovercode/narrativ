import { useCallback } from 'react';

/**
 * List view for notes with search functionality.
 */
function NotesList({ notes, loading, searchQuery, onSearch, onSelectNote, onDeleteNote }) {
  // Get preview text from note content
  const getPreview = useCallback((content) => {
    if (!content) return 'No content';
    // Get first 100 characters, remove markdown formatting
    const clean = content
      .replace(/^#+\s*/gm, '') // Remove headings
      .replace(/\*\*|__/g, '') // Remove bold
      .replace(/\*|_/g, '') // Remove italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with text
      .replace(/\[\[([^\]]+)\]\]/g, '$1') // Replace wiki links with text
      .trim();
    return clean.slice(0, 100) + (clean.length > 100 ? '...' : '');
  }, []);

  // Format date for display
  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now - date;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days} days ago`;
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  }, []);

  // Handle delete with confirmation
  const handleDelete = useCallback(
    (e, note) => {
      e.stopPropagation();
      if (window.confirm(`Delete "${note.title}"?`)) {
        onDeleteNote(note.id);
      }
    },
    [onDeleteNote]
  );

  if (loading) {
    return (
      <div className="notes-loading">
        <span>Loading notes...</span>
      </div>
    );
  }

  return (
    <div className="notes-list">
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
        />
        {searchQuery && (
          <button className="clear-search" onClick={() => onSearch('')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {notes.length === 0 ? (
        <div className="notes-empty">
          {searchQuery ? (
            <p>No notes match your search</p>
          ) : (
            <>
              <p>No notes yet</p>
              <p className="hint">Click "+ New" to create one</p>
            </>
          )}
        </div>
      ) : (
        <div className="notes-items">
          {notes.map((note) => (
            <div
              key={note.id}
              className="note-item"
              onClick={() => onSelectNote(note)}
            >
              <div className="note-item-header">
                <h4 className="note-title">{note.title || 'Untitled'}</h4>
                <button
                  className="delete-btn"
                  onClick={(e) => handleDelete(e, note)}
                  title="Delete note"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
              <p className="note-preview">{getPreview(note.content)}</p>
              <span className="note-date">{formatDate(note.modifiedAt || note.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotesList;
