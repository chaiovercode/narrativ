/**
 * API service for backend communication.
 * Handles research and image boards persistence.
 */

const API_BASE = 'http://localhost:8000';

// =============================================================================
// Research Boards
// =============================================================================

export async function fetchResearch() {
  const response = await fetch(`${API_BASE}/boards/research`);
  if (!response.ok) throw new Error('Failed to fetch research');
  const data = await response.json();
  return data.boards;
}

export async function saveResearch(board) {
  const response = await fetch(`${API_BASE}/boards/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(board),
  });
  if (!response.ok) throw new Error('Failed to save research');
  const data = await response.json();
  return data.board;
}

export async function deleteResearch(id) {
  const response = await fetch(`${API_BASE}/boards/research/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete research');
  return true;
}

// =============================================================================
// Image Boards
// =============================================================================

export async function fetchImages() {
  const response = await fetch(`${API_BASE}/boards/images`);
  if (!response.ok) throw new Error('Failed to fetch images');
  const data = await response.json();
  return data.boards;
}

export async function saveImages(board) {
  const response = await fetch(`${API_BASE}/boards/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(board),
  });
  if (!response.ok) throw new Error('Failed to save images');
  const data = await response.json();
  return data.board;
}

export async function deleteImages(id) {
  const response = await fetch(`${API_BASE}/boards/images/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete images');
  return true;
}

// =============================================================================
// Vault
// =============================================================================

export async function setVaultPath(path) {
  const response = await fetch(`${API_BASE}/vault/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!response.ok) throw new Error('Failed to set vault path');
  const data = await response.json();
  return data;
}

export async function getVaultInfo() {
  const response = await fetch(`${API_BASE}/vault`);
  if (!response.ok) throw new Error('Failed to get vault info');
  const data = await response.json();
  return data;
}

// =============================================================================
// Notes
// =============================================================================

export async function fetchNotes() {
  const response = await fetch(`${API_BASE}/notes`);
  if (!response.ok) throw new Error('Failed to fetch notes');
  const data = await response.json();
  return data.notes;
}

export async function fetchNote(id) {
  const response = await fetch(`${API_BASE}/notes/${id}`);
  if (!response.ok) throw new Error('Failed to fetch note');
  return await response.json();
}

export async function saveNoteApi(note) {
  const response = await fetch(`${API_BASE}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(note),
  });
  if (!response.ok) throw new Error('Failed to save note');
  const data = await response.json();
  return data.note;
}

export async function deleteNoteApi(id) {
  const response = await fetch(`${API_BASE}/notes/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete note');
  return true;
}
