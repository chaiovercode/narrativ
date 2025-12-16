import { useState, useCallback, useEffect } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { useBoards } from '../../hooks/useBoards';
import NotesList from './NotesList';
import NoteEditor from './NoteEditor';
import '../../styles/notes-panel.css';

/**
 * Main notes panel that slides out from the sidebar.
 * Contains list view and editor view.
 */
function NotesPanel({ isOpen, onClose }) {
  const { notes, loading, createNote, updateNote, removeNote, searchNotes, refreshNotes } = useNotes();
  const { savedResearch } = useBoards();
  const [view, setView] = useState('list'); // 'list' or 'editor'
  const [activeNote, setActiveNote] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Refresh notes when panel opens
  useEffect(() => {
    if (isOpen) {
      refreshNotes();
    }
  }, [isOpen, refreshNotes]);

  // Handle creating a new note
  const handleNewNote = useCallback(() => {
    setActiveNote(null);
    setView('editor');
  }, []);

  // Handle selecting a note to edit
  const handleSelectNote = useCallback((note) => {
    setActiveNote(note);
    setView('editor');
  }, []);

  // Handle saving a note (create or update)
  const handleSaveNote = useCallback(
    async (noteData) => {
      try {
        if (activeNote?.id) {
          // Update existing note
          const saved = await updateNote(activeNote.id, noteData);
          setActiveNote(saved);
          return saved;
        } else {
          // Create new note
          const saved = await createNote(noteData);
          setActiveNote(saved);
          return saved;
        }
      } catch (err) {
        console.error('Failed to save note:', err);
        throw err;
      }
    },
    [activeNote, createNote, updateNote]
  );

  // Handle deleting a note
  const handleDeleteNote = useCallback(
    async (id) => {
      try {
        await removeNote(id);
        setActiveNote(null);
        setView('list');
      } catch (err) {
        console.error('Failed to delete note:', err);
      }
    },
    [removeNote]
  );

  // Handle going back to list
  const handleBack = useCallback(() => {
    setActiveNote(null);
    setView('list');
  }, []);

  // Get filtered notes based on search
  const filteredNotes = searchQuery ? searchNotes(searchQuery) : notes;

  return (
    <div className={`notes-panel ${isOpen ? 'open' : ''}`}>
      <div className="notes-panel-header">
        <h3>Notes</h3>
        <div className="header-actions">
          {view === 'list' && (
            <>
              <button
                className="refresh-btn"
                onClick={refreshNotes}
                title="Refresh notes"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </svg>
              </button>
              <button className="new-note-btn" onClick={handleNewNote}>
                + New
              </button>
            </>
          )}
          <button className="notes-close-btn" onClick={onClose} title="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="notes-panel-content">
        {view === 'list' ? (
          <NotesList
            notes={filteredNotes}
            loading={loading}
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            onSelectNote={handleSelectNote}
            onDeleteNote={handleDeleteNote}
          />
        ) : (
          <NoteEditor
            note={activeNote}
            onSave={handleSaveNote}
            onDelete={handleDeleteNote}
            onBack={handleBack}
            researchBoards={savedResearch}
          />
        )}
      </div>
    </div>
  );
}

export default NotesPanel;
