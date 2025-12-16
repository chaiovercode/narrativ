import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchNotes,
  saveNoteApi,
  deleteNoteApi,
} from '../services/api';

/**
 * Hook for managing notes with backend persistence.
 * Includes auto-refresh on window focus and periodic sync.
 */
export function useNotes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastFetchRef = useRef(0);

  // Fetch notes on mount
  useEffect(() => {
    loadNotes();
  }, []);

  // Refresh notes when window regains focus (for iCloud sync)
  useEffect(() => {
    const handleFocus = () => {
      // Only refresh if last fetch was more than 2 seconds ago
      if (Date.now() - lastFetchRef.current > 2000) {
        loadNotes();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      lastFetchRef.current = Date.now();
      const notesList = await fetchNotes();
      setNotes(notesList);
      setError(null);
    } catch (err) {
      console.error('Failed to load notes:', err);
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

  return {
    notes,
    loading,
    error,
    createNote,
    updateNote,
    removeNote,
    searchNotes,
    refreshNotes: loadNotes,
  };
}
