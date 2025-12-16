import { useState, useEffect, useCallback } from 'react';
import {
  fetchResearch,
  saveResearch,
  deleteResearch as apiDeleteResearch,
  fetchImages,
  saveImages,
  deleteImages as apiDeleteImages,
} from '../services/api';

/**
 * Hook for managing research and image boards with backend persistence.
 */
export function useBoards() {
  const [savedResearch, setSavedResearch] = useState([]);
  const [savedImageBoards, setSavedImageBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch boards on mount
  useEffect(() => {
    async function loadBoards() {
      try {
        setLoading(true);
        const [research, images] = await Promise.all([
          fetchResearch(),
          fetchImages(),
        ]);
        setSavedResearch(research);
        setSavedImageBoards(images);
        setError(null);
      } catch (err) {
        console.error('Failed to load boards:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadBoards();
  }, []);

  // Add research board
  const addResearch = useCallback(async (board) => {
    try {
      await saveResearch(board);
      setSavedResearch((prev) => [board, ...prev]);
    } catch (err) {
      console.error('Failed to save research:', err);
      // Still update local state for resilience
      setSavedResearch((prev) => [board, ...prev]);
    }
  }, []);

  // Delete research board
  const deleteResearch = useCallback(async (id) => {
    try {
      await apiDeleteResearch(id);
      setSavedResearch((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to delete research:', err);
    }
  }, []);

  // Add image board
  const addImageBoard = useCallback(async (board) => {
    try {
      await saveImages(board);
      setSavedImageBoards((prev) => [board, ...prev]);
    } catch (err) {
      console.error('Failed to save image board:', err);
      // Still update local state for resilience
      setSavedImageBoards((prev) => [board, ...prev]);
    }
  }, []);

  // Delete image board
  const deleteImageBoard = useCallback(async (id) => {
    try {
      await apiDeleteImages(id);
      setSavedImageBoards((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      console.error('Failed to delete image board:', err);
    }
  }, []);

  return {
    savedResearch,
    savedImageBoards,
    loading,
    error,
    addResearch,
    deleteResearch,
    addImageBoard,
    deleteImageBoard,
  };
}
