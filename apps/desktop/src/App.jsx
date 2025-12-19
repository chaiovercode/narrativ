import { useState, useEffect, useCallback } from 'react';
import Create from './pages/Create';
import Gallery from './pages/Gallery';
import VaultSetup from './pages/VaultSetup';
import SettingsModal from './components/SettingsModal';
import NotesPanel from './components/notes/NotesPanel';
import NoteContentView from './components/notes/NoteContentView';
import StatusBar from './components/StatusBar';
import LoadingScreen from './components/LoadingScreen';
import { useNotes } from './hooks/useNotes';
import { useBoards } from './hooks/useBoards';
import { useAppInit } from './hooks/useAppInit';
import './App.css';
import './styles/status-bar.css';

// Obsidian-style icons
const Icons = {
  create: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  gallery: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  chevron: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  help: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  ),
  notes: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
};

function App() {
  const [activeView, setActiveView] = useState('create');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [openResearchTopic, setOpenResearchTopic] = useState(null);

  // App initialization hook - handles backend, vault, and data loading
  const {
    status: initStatus,
    isReady,
    vaultPath,
    vaultName,
    setVaultPath,
    setVaultName,
    handleVaultSelected,
  } = useAppInit();

  // Vault is ready when initialization is complete and vault is synced
  const vaultReady = isReady && !!vaultPath && initStatus.vaultSet;

  // Notes hooks for split view - wait for vault to be ready
  const {
    notes,
    folders,
    loading: notesLoading,
    createNote,
    updateNote,
    removeNote,
    duplicateNote,
    createFolder,
    removeFolder,
    renameFolder,
    moveFolder,
    duplicateFolder,
    moveNote,
    searchNotes,
    refreshNotes,
    getTreeStructure,
  } = useNotes(vaultReady);
  const { savedResearch, refreshBoards } = useBoards(vaultReady);

  // Refresh notes and boards when notes panel opens
  useEffect(() => {
    if (notesOpen) {
      refreshNotes();
      refreshBoards();
    }
  }, [notesOpen, refreshNotes, refreshBoards]);

  // Note handlers for split view
  const handleSelectNote = useCallback((note) => {
    setSelectedNote(note);
  }, []);

  const handleNewNote = useCallback(async () => {
    // Generate unique "Untitled" name
    const existingTitles = new Set(notes.map(n => n.title?.toLowerCase() || ''));
    let title = 'Untitled';
    let counter = 1;
    while (existingTitles.has(title.toLowerCase())) {
      title = `Untitled ${counter}`;
      counter++;
    }

    // Create the note immediately
    try {
      const saved = await createNote({ title, content: '' });
      setSelectedNote(saved);
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  }, [notes, createNote]);

  const handleSaveNote = useCallback(
    async (noteData) => {
      try {
        const noteId = noteData.id || selectedNote?.id;
        if (noteId) {
          const saved = await updateNote(noteId, noteData);
          setSelectedNote(saved);
          return saved;
        } else {
          const saved = await createNote(noteData);
          setSelectedNote(saved);
          return saved;
        }
      } catch (err) {
        console.error('Failed to save note:', err);
        throw err;
      }
    },
    [selectedNote, createNote, updateNote]
  );

  const handleDeleteNote = useCallback(
    async (id) => {
      try {
        await removeNote(id);
        setSelectedNote(null);
      } catch (err) {
        console.error('Failed to delete note:', err);
      }
    },
    [removeNote]
  );

  // Handle opening research from wiki-links
  const handleOpenResearch = useCallback((topic) => {
    // Close notes panel and switch to create view
    setNotesOpen(false);
    setSelectedNote(null);
    setActiveView('create');
    // Set the topic to open
    setOpenResearchTopic(topic);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+, for Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(prev => !prev);
      }
      // Cmd+N for Create (new)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setActiveView('create');
        setSettingsOpen(false);
        setNotesOpen(false);
        setSelectedNote(null);
      }
      // Cmd+G for Gallery
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        setActiveView('gallery');
        setSettingsOpen(false);
        setNotesOpen(false);
        setSelectedNote(null);
      }
      // Cmd+Shift+N for Notes panel
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'n') {
        e.preventDefault();
        setNotesOpen(prev => {
          const newState = !prev;
          if (newState && activeView === 'gallery') {
            setActiveView('create');
          }
          return newState;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Show loading screen while initializing
  if (!isReady) {
    return <LoadingScreen status={initStatus} />;
  }

  // Show vault setup if no vault configured or user wants to switch
  if (!vaultPath || showVaultPicker) {
    return (
      <VaultSetup
        onVaultSelected={async (path, name) => {
          await handleVaultSelected(path, name);
          setShowVaultPicker(false);
        }}
        onClose={() => setShowVaultPicker(false)}
        canClose={showVaultPicker && !!vaultPath}
      />
    );
  }

  const renderView = () => {
    // Always render Create to preserve generation state, hide when not active
    const showCreate = activeView === 'create' && !notesOpen;
    const showGallery = activeView === 'gallery' && !notesOpen;
    const showNotes = notesOpen;

    return (
      <>
        {/* Create is always mounted to preserve generation state */}
        <div style={{ display: showCreate ? 'contents' : 'none' }}>
          <Create openResearchTopic={openResearchTopic} onResearchOpened={() => setOpenResearchTopic(null)} />
        </div>

        {/* Gallery only mounts when active */}
        {showGallery && <Gallery />}

        {/* Notes content view */}
        {showNotes && (
          <NoteContentView
            note={selectedNote}
            onSave={handleSaveNote}
            onDelete={handleDeleteNote}
            researchBoards={savedResearch}
            onOpenResearch={handleOpenResearch}
          />
        )}
      </>
    );
  };

  return (
    <div className="app-wrapper">
      <StatusBar />
      <div className="app-container">
        <aside className="app-sidebar collapsed">
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeView === 'create' && !notesOpen ? 'active' : ''}`}
              onClick={() => {
                setActiveView('create');
                setNotesOpen(false);
                setSelectedNote(null);
              }}
              title="Create (Cmd+N)"
            >
              <span className="nav-chevron">{Icons.chevron}</span>
              {Icons.create}
            </button>
            <button
              className={`nav-item ${activeView === 'gallery' && !notesOpen ? 'active' : ''}`}
              onClick={() => {
                setActiveView('gallery');
                setNotesOpen(false);
                setSelectedNote(null);
              }}
              title="Gallery (Cmd+G)"
            >
              <span className="nav-chevron">{Icons.chevron}</span>
              {Icons.gallery}
            </button>
            <button
              className={`nav-item ${notesOpen ? 'active' : ''}`}
              onClick={() => {
                const newState = !notesOpen;
                setNotesOpen(newState);
                if (newState && activeView === 'gallery') {
                  setActiveView('create');
                }
              }}
              title="Notes (Cmd+Shift+N)"
            >
              <span className="nav-chevron">{Icons.chevron}</span>
              {Icons.notes}
            </button>
          </nav>
          <div className="sidebar-footer">
            <div className="footer-actions">
              <button
                className={`footer-btn ${settingsOpen ? 'active' : ''}`}
                title="Settings (Cmd+,)"
                onClick={() => setSettingsOpen(true)}
              >
                {Icons.settings}
              </button>
            </div>
          </div>
        </aside>
        <main className={`app-main ${notesOpen ? 'notes-open' : ''}`}>
          {renderView()}
        </main>
        <NotesPanel
          isOpen={notesOpen}
          onClose={() => {
            setNotesOpen(false);
            setSelectedNote(null);
          }}
          notes={notes}
          folders={folders}
          loading={notesLoading}
          selectedNote={selectedNote}
          onSelectNote={handleSelectNote}
          onNewNote={handleNewNote}
          onDeleteNote={handleDeleteNote}
          onDuplicateNote={duplicateNote}
          onCreateFolder={createFolder}
          onDeleteFolder={removeFolder}
          onDuplicateFolder={duplicateFolder}
          onRenameFolder={renameFolder}
          onMoveNote={moveNote}
          onMoveFolder={moveFolder}
          onRenameNote={(id, newName) => {
            const note = notes.find(n => n.id === id);
            updateNote(id, { title: newName, folder: note?.folder, path: note?.path || note?.folder, filename: note?.filename });
          }}
          onRefresh={refreshNotes}
          searchNotes={searchNotes}
          getTreeStructure={getTreeStructure}
        />
        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onResetVault={() => {
            setShowVaultPicker(true);
          }}
        />
      </div>
    </div>
  );
}

export default App;
