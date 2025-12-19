import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchResearch,
  saveResearch,
  deleteResearch as apiDeleteResearch,
  fetchImages,
  saveImages,
  updateImages,
  deleteImages as apiDeleteImages,
} from '../services/api';

/**
 * Hook for managing research and image boards with backend persistence.
 * @param {boolean} vaultReady - Whether vault is synced and ready for API calls
 */
export function useBoards(vaultReady = true) {
  const [savedResearch, setSavedResearch] = useState([]);
  const [savedImageBoards, setSavedImageBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);

  // Load boards function
  const loadBoards = useCallback(async () => {
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
  }, []);

  // Fetch boards when vault becomes ready
  useEffect(() => {
    if (vaultReady && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadBoards();
    }
  }, [vaultReady, loadBoards]);

  // Add research board (checks for duplicates by topic)
  const addResearch = useCallback(async (board) => {
    try {
      await saveResearch(board);
      // Only add to state if topic doesn't already exist
      setSavedResearch((prev) => {
        const topicLower = board.topic?.toLowerCase().trim();
        const exists = prev.some(r => r.topic?.toLowerCase().trim() === topicLower);
        if (exists) {
          console.log('[useBoards] Research already exists locally, skipping add');
          return prev;
        }
        return [board, ...prev];
      });
    } catch (err) {
      console.error('Failed to save research:', err);
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

  // Update research board in local state
  const updateResearch = useCallback((updatedBoard) => {
    setSavedResearch((prev) =>
      prev.map((r) => r.id === updatedBoard.id ? updatedBoard : r)
    );
  }, []);

  // Add image board (merges with existing if same topic exists)
  const addImageBoard = useCallback(async (board) => {
    try {
      // Check if board with same topic already exists
      const topicLower = board.topic?.toLowerCase().trim();
      const existingBoard = savedImageBoards.find(
        b => b.topic?.toLowerCase().trim() === topicLower
      );

      if (existingBoard) {
        // Merge images into existing board
        const mergedBoard = {
          ...existingBoard,
          images: [...existingBoard.images, ...board.images],
          slides: [...(existingBoard.slides || []), ...(board.slides || [])],
          // Update timestamp
          updatedAt: new Date().toISOString()
        };

        await updateImages(existingBoard.id, mergedBoard);
        setSavedImageBoards((prev) =>
          prev.map(b => b.id === existingBoard.id ? mergedBoard : b)
        );
        console.log('[useBoards] Merged images into existing board:', existingBoard.id);
        return mergedBoard;
      } else {
        // Create new board
        await saveImages(board);
        setSavedImageBoards((prev) => [board, ...prev]);
        return board;
      }
    } catch (err) {
      console.error('Failed to save image board:', err);
      // Still update local state for resilience
      setSavedImageBoards((prev) => [board, ...prev]);
      return board;
    }
  }, [savedImageBoards]);

  // Delete image board
  const deleteImageBoard = useCallback(async (id) => {
    try {
      await apiDeleteImages(id);
      setSavedImageBoards((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      console.error('Failed to delete image board:', err);
    }
  }, []);

  // Update image board
  const updateImageBoard = useCallback(async (updatedBoard) => {
    try {
      await updateImages(updatedBoard.id, updatedBoard);
      setSavedImageBoards((prev) =>
        prev.map(b => b.id === updatedBoard.id ? updatedBoard : b)
      );
      return updatedBoard;
    } catch (err) {
      console.error('Failed to update image board:', err);
    }
  }, []);

  return {
    savedResearch,
    savedImageBoards,
    loading,
    error,
    addResearch,
    updateResearch,
    deleteResearch,
    addImageBoard,
    updateImageBoard,
    deleteImageBoard,
    refreshBoards: loadBoards,
  };
}
