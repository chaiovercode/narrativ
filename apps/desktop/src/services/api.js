/**
 * API service for backend communication.
 * Handles research and image boards persistence.
 */

const API_BASE = 'http://127.0.0.1:8000';

// =============================================================================
// Health Check
// =============================================================================

export async function checkBackendHealth() {
  const response = await fetch(`${API_BASE}/health`, {
    signal: AbortSignal.timeout(500) // Quick timeout for health checks
  });
  if (!response.ok) throw new Error('Backend not ready');
  return await response.json();
}

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

export async function updateImages(id, board) {
  const response = await fetch(`${API_BASE}/boards/images/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(board),
  });
  if (!response.ok) throw new Error('Failed to update images');
  const data = await response.json();
  return data.board;
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

// =============================================================================
// Notes
// =============================================================================

export async function fetchNotes() {
  console.log('[API] Fetching notes from', `${API_BASE}/notes`);
  const response = await fetch(`${API_BASE}/notes`);
  if (!response.ok) {
    const text = await response.text();
    console.error('[API] fetchNotes failed:', response.status, text);
    throw new Error('Failed to fetch notes');
  }
  const data = await response.json();
  console.log('[API] fetchNotes result:', data);
  return data.notes;
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

export async function moveNoteApi(id, folder) {
  const response = await fetch(`${API_BASE}/notes/${id}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder }),
  });
  if (!response.ok) throw new Error('Failed to move note');
  const data = await response.json();
  return data.note;
}

// =============================================================================
// FOLDERS API
// =============================================================================

export async function fetchFolders() {
  console.log('[API] Fetching folders from', `${API_BASE}/folders`);
  const response = await fetch(`${API_BASE}/folders`);
  if (!response.ok) {
    const text = await response.text();
    console.error('[API] fetchFolders failed:', response.status, text);
    throw new Error('Failed to fetch folders');
  }
  const data = await response.json();
  console.log('[API] fetchFolders result:', data);
  return data.folders;
}

export async function createFolderApi(name, parent = '') {
  console.log('[API] Creating folder:', name, 'parent:', parent);
  const response = await fetch(`${API_BASE}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parent }),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error('[API] createFolder failed:', response.status, text);
    throw new Error('Failed to create folder');
  }
  const data = await response.json();
  console.log('[API] createFolder result:', data);
  return data.folder;
}

export async function deleteFolderApi(path) {
  const response = await fetch(`${API_BASE}/folders/${encodeURIComponent(path)}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete folder');
  return true;
}

export async function renameFolderApi(path, newName) {
  const response = await fetch(`${API_BASE}/folders/${encodeURIComponent(path)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  });
  if (!response.ok) throw new Error('Failed to rename folder');
  const data = await response.json();
  return data.folder;
}

export async function moveFolderApi(path, newParent) {
  const response = await fetch(`${API_BASE}/folders/${encodeURIComponent(path)}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parent: newParent }),
  });
  if (!response.ok) throw new Error('Failed to move folder');
  const data = await response.json();
  return data.folder;
}

export async function duplicateNoteApi(id) {
  console.log('[API] Duplicating note:', id);
  const response = await fetch(`${API_BASE}/notes/${id}/duplicate`, {
    method: 'POST',
  });
  if (!response.ok) {
    const text = await response.text();
    console.error('[API] duplicateNote failed:', response.status, text);
    throw new Error('Failed to duplicate note');
  }
  const data = await response.json();
  console.log('[API] duplicateNote result:', data);
  return data.note;
}

export async function duplicateFolderApi(path) {
  console.log('[API] Duplicating folder:', path);
  const response = await fetch(`${API_BASE}/folders/${encodeURIComponent(path)}/duplicate`, {
    method: 'POST',
  });
  if (!response.ok) {
    const text = await response.text();
    console.error('[API] duplicateFolder failed:', response.status, text);
    throw new Error('Failed to duplicate folder');
  }
  const data = await response.json();
  console.log('[API] duplicateFolder result:', data);
  return data.folder;
}
