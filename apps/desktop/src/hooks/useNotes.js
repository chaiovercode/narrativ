import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchNotes,
  fetchFolders,
  saveNoteApi,
  deleteNoteApi,
  moveNoteApi,
  createFolderApi,
  deleteFolderApi,
  renameFolderApi,
  moveFolderApi,
} from '../services/api';

/**
 * Hook for managing notes and folders with backend persistence.
 * Includes auto-refresh on window focus and periodic sync.
 */
export function useNotes() {
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastFetchRef = useRef(0);

  // Fetch notes and folders on mount
  useEffect(() => {
    loadAll();
  }, []);

  // Refresh when window regains focus (for iCloud sync)
  useEffect(() => {
    const handleFocus = () => {
      // Only refresh if last fetch was more than 2 seconds ago
      if (Date.now() - lastFetchRef.current > 2000) {
        loadAll();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      lastFetchRef.current = Date.now();
      console.log('[useNotes] Loading notes and folders...');
      const [notesList, foldersList] = await Promise.all([
        fetchNotes(),
        fetchFolders(),
      ]);
      console.log('[useNotes] Loaded:', notesList?.length || 0, 'notes,', foldersList?.length || 0, 'folders');
      setNotes(notesList || []);
      setFolders(foldersList || []);
      setError(null);
    } catch (err) {
      console.error('[useNotes] Failed to load notes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new note
  const createNote = useCallback(async (note) => {
    try {
      const saved = await saveNoteApi(note);
      setNotes((prev) => [saved, ...prev]);
      return saved;
    } catch (err) {
      console.error('Failed to create note:', err);
      throw err;
    }
  }, []);

  // Update an existing note
  const updateNote = useCallback(async (id, updates) => {
    try {
      const noteToUpdate = { id, ...updates };
      const saved = await saveNoteApi(noteToUpdate);
      setNotes((prev) => prev.map((n) => (n.id === id ? saved : n)));
      return saved;
    } catch (err) {
      console.error('Failed to update note:', err);
      throw err;
    }
  }, []);

  // Delete a note
  const removeNote = useCallback(async (id) => {
    try {
      await deleteNoteApi(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Failed to delete note:', err);
      throw err;
    }
  }, []);

  // Move a note to a folder
  const moveNote = useCallback(async (id, folder) => {
    try {
      const saved = await moveNoteApi(id, folder);
      setNotes((prev) => prev.map((n) => (n.id === id ? saved : n)));
      return saved;
    } catch (err) {
      console.error('Failed to move note:', err);
      throw err;
    }
  }, []);

  // Create a folder
  const createFolder = useCallback(async (name, parent = '') => {
    try {
      console.log('[useNotes] Creating folder:', name, 'parent:', parent);
      const folder = await createFolderApi(name, parent);
      console.log('[useNotes] Created folder:', folder);
      setFolders((prev) => [...prev, folder].sort((a, b) => a.path.localeCompare(b.path)));
      return folder;
    } catch (err) {
      console.error('[useNotes] Failed to create folder:', err);
      throw err;
    }
  }, []);

  // Delete a folder
  const removeFolder = useCallback(async (path) => {
    try {
      await deleteFolderApi(path);
      // Remove the folder and any nested folders
      setFolders((prev) => prev.filter((f) => f.path !== path && !f.path.startsWith(path + '/')));
      // Also remove notes in that folder
      setNotes((prev) => prev.filter((n) => n.folder !== path && !n.folder?.startsWith(path + '/')));
    } catch (err) {
      console.error('Failed to delete folder:', err);
      throw err;
    }
  }, []);

  // Rename a folder
  const renameFolder = useCallback(async (path, newName) => {
    try {
      const updated = await renameFolderApi(path, newName);
      await loadAll(); // Reload everything since paths change
      return updated;
    } catch (err) {
      console.error('Failed to rename folder:', err);
      throw err;
    }
  }, [loadAll]);

  // Move a folder
  const moveFolder = useCallback(async (path, newParent) => {
    try {
      const updated = await moveFolderApi(path, newParent);
      await loadAll(); // Reload everything since paths change
      return updated;
    } catch (err) {
      console.error('Failed to move folder:', err);
      throw err;
    }
  }, [loadAll]);

  // Search notes by title and content
  const searchNotes = useCallback(
    (query) => {
      if (!query || !query.trim()) return notes;
      const lower = query.toLowerCase();
      return notes.filter(
        (n) =>
          (n.title && n.title.toLowerCase().includes(lower)) ||
          (n.content && n.content.toLowerCase().includes(lower))
      );
    },
    [notes]
  );

  // Build tree structure from flat notes and folders
  const getTreeStructure = useCallback(() => {
    // Create a map for quick folder lookup
    const folderMap = new Map();
    folders.forEach(f => {
      folderMap.set(f.path, { ...f, type: 'folder', children: [], notes: [] });
    });

    // Create root items array
    const tree = [];

    // Add folders to their parents or root
    folders.forEach(f => {
      const folderNode = folderMap.get(f.path);
      if (f.parent && folderMap.has(f.parent)) {
        folderMap.get(f.parent).children.push(folderNode);
      } else if (!f.parent || f.parent === '.') {
        tree.push(folderNode);
      }
    });

    // Add notes to their folders or root
    const rootNotes = [];
    notes.forEach(n => {
      const noteNode = { ...n, type: 'note' };
      const folder = n.folder || n.path || '';
      if (folder && folderMap.has(folder)) {
        folderMap.get(folder).notes.push(noteNode);
      } else {
        rootNotes.push(noteNode);
      }
    });

    // Sort folders alphabetically
    tree.sort((a, b) => a.name.localeCompare(b.name));

    // Sort notes within folders by modified date
    folderMap.forEach(folder => {
      folder.notes.sort((a, b) =>
        (b.modifiedAt || b.createdAt || '').localeCompare(a.modifiedAt || a.createdAt || '')
      );
      folder.children.sort((a, b) => a.name.localeCompare(b.name));
    });

    // Sort root notes
    rootNotes.sort((a, b) =>
      (b.modifiedAt || b.createdAt || '').localeCompare(a.modifiedAt || a.createdAt || '')
    );

    return { folders: tree, notes: rootNotes };
  }, [notes, folders]);

  return {
    notes,
    folders,
    loading,
    error,
    createNote,
    updateNote,
    removeNote,
    moveNote,
    createFolder,
    removeFolder,
    renameFolder,
    moveFolder,
    searchNotes,
    refreshNotes: loadAll,
    getTreeStructure,
  };
}
