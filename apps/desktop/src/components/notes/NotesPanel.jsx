import { useState, useCallback } from 'react';
import NotesList from './NotesList';
import '../../styles/notes-panel.css';

/**
 * Notes panel sidebar - shows list of notes with folder tree.
 * Note editing happens in NoteContentView in the main area.
 */
function NotesPanel({
  isOpen,
  onClose,
  notes = [],
  folders = [],
  loading,
  selectedNote,
  onSelectNote,
  onNewNote,
  onDeleteNote,
  onDuplicateNote,
  onCreateFolder,
  onDeleteFolder,
  onDuplicateFolder,
  onRenameFolder,
  onMoveNote,
  onMoveFolder,
  onRenameNote,
  onRefresh,
  searchNotes,
  getTreeStructure,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // Handle new folder creation
  const handleNewFolder = useCallback(async () => {
    if (!onCreateFolder) return;
    try {
      await onCreateFolder('New Folder', '');
      // Refresh to show the new folder
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  }, [onCreateFolder, onRefresh]);

  // Handle sync/refresh
  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    try {
      await onRefresh();
    } catch (err) {
      console.error('Failed to refresh notes:', err);
    }
  }, [onRefresh]);

  // Handle note selection
  const handleSelectNote = useCallback((note) => {
    onSelectNote(note);
  }, [onSelectNote]);

  return (
    <div className={`notes-panel ${isOpen ? 'open' : ''}`}>
      <div className="notes-panel-header">
        <h3>Notes</h3>
        <div className="header-actions">
          <button
            className="header-icon-btn"
            onClick={handleRefresh}
            title="Sync notes"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
          <button
            className="header-icon-btn"
            onClick={handleNewFolder}
            title="New folder"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 10v6m-3-3h6" />
              <path d="M3 7a2 2 0 012-2h3.93a2 2 0 011.66.9l.82 1.2a2 2 0 001.66.9H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
          </button>
          <button
            className="header-icon-btn"
            onClick={onNewNote}
            title="New note"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 8v8m-4-4h8" />
              <rect x="4" y="3" width="16" height="18" rx="2" />
            </svg>
          </button>
        </div>
      </div>

      <div className="notes-panel-content">
        <NotesList
          notes={notes}
          folders={folders}
          loading={loading}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          onSelectNote={handleSelectNote}
          onDeleteNote={onDeleteNote}
          onDuplicateNote={onDuplicateNote}
          onCreateFolder={onCreateFolder}
          onDeleteFolder={onDeleteFolder}
          onDuplicateFolder={onDuplicateFolder}
          onRenameFolder={onRenameFolder}
          onMoveNote={onMoveNote}
          onMoveFolder={onMoveFolder}
          onRenameNote={onRenameNote}
          selectedNoteId={selectedNote?.id}
          getTreeStructure={getTreeStructure}
        />
      </div>
    </div>
  );
}

export default NotesPanel;
