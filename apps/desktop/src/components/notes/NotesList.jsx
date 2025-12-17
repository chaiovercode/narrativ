import { useState, useCallback, useMemo } from 'react';
import { ConfirmModal } from '../ConfirmModal';

/**
 * Tree view for notes with folder support.
 */
function NotesList({
  notes,
  folders,
  loading,
  searchQuery,
  onSearch,
  onSelectNote,
  onDeleteNote,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onMoveNote,
  onMoveFolder,
  onRenameNote,
  selectedNoteId,
  getTreeStructure,
}) {
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, item: null, type: null });
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [newFolderParent, setNewFolderParent] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');

  // Renaming state
  // item: { id/path, ... }
  // type: 'note' | 'folder'
  const [renaming, setRenaming] = useState({ item: null, type: null, value: '' });

  // DnD state - using React state for better Tauri compatibility
  const [dragOverFolder, setDragOverFolder] = useState(null);
  const [draggingItem, setDraggingItem] = useState(null); // { type: 'note'|'folder', id: string }

  // Get tree structure
  const tree = useMemo(() => {
    if (getTreeStructure) {
      return getTreeStructure();
    }
    return { folders: [], notes: notes || [] };
  }, [getTreeStructure, notes]);

  // Toggle folder expansion
  const toggleFolder = useCallback((path) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Handle delete with confirmation
  const handleDelete = useCallback((e, item, type) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, item, type });
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteConfirm.type === 'note' && deleteConfirm.item) {
      onDeleteNote(deleteConfirm.item.id);
    } else if (deleteConfirm.type === 'folder' && deleteConfirm.item && onDeleteFolder) {
      onDeleteFolder(deleteConfirm.item.path);
    }
    setDeleteConfirm({ isOpen: false, item: null, type: null });
  }, [deleteConfirm, onDeleteNote, onDeleteFolder]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirm({ isOpen: false, item: null, type: null });
  }, []);

  // Handle new folder creation
  const handleCreateFolder = useCallback((parent = '') => {
    setNewFolderParent(parent);
    setNewFolderName('');
  }, []);

  const submitNewFolder = useCallback(async () => {
    if (newFolderName.trim() && onCreateFolder) {
      await onCreateFolder(newFolderName.trim(), newFolderParent || '');
      setNewFolderParent(null);
      setNewFolderName('');
    }
  }, [newFolderName, newFolderParent, onCreateFolder]);

  const cancelNewFolder = useCallback(() => {
    setNewFolderParent(null);
    setNewFolderName('');
  }, []);

  // Handle Renaming
  const startRenaming = useCallback((e, item, type) => {
    e.stopPropagation();
    setRenaming({
      item,
      type,
      value: type === 'folder' ? item.name : item.title
    });
  }, []);

  const submitRename = useCallback(async () => {
    if (!renaming.item || !renaming.value.trim()) {
      setRenaming({ item: null, type: null, value: '' });
      return;
    }

    try {
      if (renaming.type === 'folder' && onRenameFolder) {
        await onRenameFolder(renaming.item.path, renaming.value.trim());
      } else if (renaming.type === 'note' && onRenameNote) {
        await onRenameNote(renaming.item.id, renaming.value.trim());
      }
    } catch (err) {
      console.error('Rename failed:', err);
    } finally {
      setRenaming({ item: null, type: null, value: '' });
    }
  }, [renaming, onRenameFolder, onRenameNote]);

  const cancelRename = useCallback(() => {
    setRenaming({ item: null, type: null, value: '' });
  }, []);

  // Handle Drag and Drop
  const handleDragStart = useCallback((e, item, type) => {
    console.log('[DnD] Drag started:', type, item.id || item.path);
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.dropEffect = 'move';
    const data = JSON.stringify({
      type,
      id: type === 'note' ? item.id : item.path
    });
    e.dataTransfer.setData('text/plain', data);
    e.dataTransfer.setData('application/json', data);
    // Set dragging item in state as fallback
    setDraggingItem({ type, id: type === 'note' ? item.id : item.path });
    // Set drag image
    if (e.target) {
      e.dataTransfer.setDragImage(e.target, 10, 10);
    }
  }, []);

  const handleDragOver = useCallback((e, folderPath) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    // Don't allow dropping a folder onto itself
    if (draggingItem?.type === 'folder' && draggingItem.id === folderPath) {
      return;
    }
    // Don't allow dropping a folder into its own children
    if (draggingItem?.type === 'folder' && folderPath.startsWith(draggingItem.id + '/')) {
      return;
    }

    console.log('[DnD] Drag over folder:', folderPath);
    if (dragOverFolder !== folderPath) {
      setDragOverFolder(folderPath);
      // Auto-expand folder when hovering over it
      if (folderPath) {
        setExpandedFolders((prev) => new Set(prev).add(folderPath));
      }
    }
  }, [dragOverFolder, draggingItem]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    // Only clear if leaving the tree entirely
    const relatedTarget = e.relatedTarget;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverFolder(null);
    }
  }, []);

  // Fallback: use dragEnd to perform the move if drop doesn't fire
  const handleDragEnd = useCallback(async (e) => {
    console.log('[DnD] Drag ended, dragOverFolder:', dragOverFolder, 'draggingItem:', draggingItem);

    if (draggingItem && dragOverFolder !== null) {
      const targetFolder = dragOverFolder;
      console.log('[DnD] Using dragEnd fallback - moving', draggingItem.type, draggingItem.id, 'to', targetFolder);

      try {
        if (draggingItem.type === 'note' && onMoveNote) {
          await onMoveNote(draggingItem.id, targetFolder);
          if (targetFolder) {
            setExpandedFolders((prev) => new Set(prev).add(targetFolder));
          }
        } else if (draggingItem.type === 'folder' && onMoveFolder) {
          if (targetFolder.startsWith(draggingItem.id) && targetFolder !== draggingItem.id) {
            console.log('[DnD] Cannot move folder into itself');
          } else {
            await onMoveFolder(draggingItem.id, targetFolder);
            if (targetFolder) {
              setExpandedFolders((prev) => new Set(prev).add(targetFolder));
            }
          }
        }
      } catch (err) {
        console.error('[DnD] Failed to move item:', err);
      }
    }

    setDraggingItem(null);
    setDragOverFolder(null);
  }, [draggingItem, dragOverFolder, onMoveNote, onMoveFolder]);

  const handleDrop = useCallback(async (e, targetFolder) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[DnD] Drop event fired on folder:', targetFolder);
    setDragOverFolder(null);

    // Try to get data from dataTransfer, fall back to state
    let data = null;
    const dataStr = e.dataTransfer?.getData('text/plain') || e.dataTransfer?.getData('application/json');

    if (dataStr) {
      try {
        data = JSON.parse(dataStr);
        console.log('[DnD] Got data from dataTransfer:', data);
      } catch (err) {
        console.log('[DnD] Failed to parse dataTransfer');
      }
    }

    // Fallback to state-based dragging
    if (!data && draggingItem) {
      data = draggingItem;
      console.log('[DnD] Using fallback draggingItem state:', data);
    }

    if (!data) {
      console.log('[DnD] No drag data available');
      setDraggingItem(null);
      return;
    }

    try {
      console.log('[DnD] Moving', data.type, data.id, 'to folder:', targetFolder);

      if (data.type === 'note' && onMoveNote) {
        await onMoveNote(data.id, targetFolder);
        if (targetFolder) {
          setExpandedFolders((prev) => new Set(prev).add(targetFolder));
        }
      } else if (data.type === 'folder' && onMoveFolder) {
        // Prevent moving folder into itself or its children
        if (targetFolder.startsWith(data.id) && targetFolder !== data.id) {
          console.log('[DnD] Cannot move folder into itself');
          return;
        }
        await onMoveFolder(data.id, targetFolder);
        if (targetFolder) {
          setExpandedFolders((prev) => new Set(prev).add(targetFolder));
        }
      }
    } catch (err) {
      console.error('[DnD] Failed to move item:', err);
    } finally {
      setDraggingItem(null);
    }
  }, [onMoveNote, onMoveFolder, draggingItem]);

  // Render text or rename input
  const renderLabelOrInput = useCallback((item, type) => {
    const isRenaming = renaming.item && (
      (type === 'folder' && renaming.item.path === item.path) ||
      (type === 'note' && renaming.item.id === item.id)
    );

    if (isRenaming) {
      return (
        <input
          type="text"
          className="rename-input"
          value={renaming.value}
          onChange={(e) => setRenaming(prev => ({ ...prev, value: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitRename();
            if (e.key === 'Escape') cancelRename();
            e.stopPropagation(); // Prevent tree navigation
          }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          onBlur={submitRename}
        />
      );
    }

    return <span className="tree-label">{type === 'folder' ? item.name : (item.title || 'Untitled')}</span>;
  }, [renaming, submitRename, cancelRename]);

  // Render a note item
  const renderNote = useCallback((note, depth = 0) => {
    return (
      <div
        key={note.id}
        className={`tree-item note-item ${note.id === selectedNoteId ? 'selected' : ''}`}
        onClick={() => onSelectNote(note)}
        draggable={true}
        onDragStart={(e) => handleDragStart(e, note, 'note')}
        onDragEnd={handleDragEnd}
      >
        <span className="tree-item-icon note-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8M16 17H8M10 9H8" />
          </svg>
        </span>
        {renderLabelOrInput(note, 'note')}

        <div className="tree-actions">
          <button
            className="tree-action"
            onClick={(e) => startRenaming(e, note, 'note')}
            title="Rename note"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            className="tree-action delete-btn"
            onClick={(e) => handleDelete(e, note, 'note')}
            title="Delete note"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }, [selectedNoteId, onSelectNote, handleDelete, startRenaming, renderLabelOrInput, handleDragStart, handleDragEnd]);

  // Render a folder and its contents
  const renderFolder = useCallback((folder, depth = 0) => {
    // Prevent infinite recursion loops
    if (depth > 50) return null;

    const isExpanded = expandedFolders.has(folder.path);
    const hasChildren = (folder.children?.length > 0) || (folder.notes?.length > 0);
    const isDragOver = dragOverFolder === folder.path;

    return (
      <div key={folder.path} className="tree-folder">
        <div
          className={`tree-item folder-item ${isExpanded ? 'expanded' : ''} ${isDragOver ? 'drag-over' : ''}`}
          onClick={() => toggleFolder(folder.path)}
          draggable={true}
          onDragStart={(e) => handleDragStart(e, folder, 'folder')}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, folder.path)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder.path)}
        >
          <span className="tree-chevron">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isExpanded ? (
                <path d="M6 9l6 6 6-6" />
              ) : (
                <path d="M9 18l6-6-6-6" />
              )}
            </svg>
          </span>
          <span className="tree-item-icon folder-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isExpanded ? (
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z" />
              ) : (
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              )}
            </svg>
          </span>
          {renderLabelOrInput(folder, 'folder')}

          <div className="tree-actions">
            <button
              className="tree-action"
              onClick={(e) => startRenaming(e, folder, 'folder')}
              title="Rename folder"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              className="tree-action delete-btn"
              onClick={(e) => handleDelete(e, folder, 'folder')}
              title="Delete folder"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {isExpanded && (
          <div
            className="tree-children"
            onDragOver={(e) => handleDragOver(e, folder.path)}
            onDrop={(e) => handleDrop(e, folder.path)}
          >
            {/* Render subfolders recursively */}
            {folder.children?.map((child) => renderFolder(child, depth + 1))}
            {/* Render notes in this folder */}
            {folder.notes?.map((note) => renderNote(note, depth + 1))}

            {/* Empty state */}
            {!hasChildren && (
              <div style={{ padding: '4px 8px', color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic', userSelect: 'none' }}>
                Empty
              </div>
            )}
          </div>
        )}
      </div>
    );
  }, [
    expandedFolders, toggleFolder, handleDelete, startRenaming,
    renderNote, renderLabelOrInput,
    handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop, dragOverFolder
  ]);

  // Filter notes when searching
  const filteredResults = useMemo(() => {
    if (!searchQuery?.trim()) return null;

    const lower = searchQuery.toLowerCase();
    return notes.filter(
      (n) =>
        (n.title && n.title.toLowerCase().includes(lower)) ||
        (n.content && n.content.toLowerCase().includes(lower))
    );
  }, [searchQuery, notes]);

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

      {/* New folder input */}
      {newFolderParent !== null && (
        <div className="new-folder-input" style={{ paddingLeft: newFolderParent ? '28px' : '12px' }}>
          <input
            type="text"
            placeholder="Folder name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNewFolder();
              if (e.key === 'Escape') cancelNewFolder();
            }}
            autoFocus
          />
          <button className="confirm-btn" onClick={submitNewFolder}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>
          <button className="cancel-btn" onClick={cancelNewFolder}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Show search results or tree view */}
      {filteredResults ? (
        <div className="notes-items search-results">
          {filteredResults.length === 0 ? (
            <div className="notes-empty">
              <p>No notes match your search</p>
            </div>
          ) : (
            filteredResults.map((note) => renderNote(note, 0))
          )}
        </div>
      ) : (
        <div
          className="notes-tree"
          onDragOver={(e) => handleDragOver(e, '')}
          onDrop={(e) => handleDrop(e, '')}
          style={dragOverFolder === '' ? { background: 'var(--bg-muted)' } : {}}
        >
          {/* Render folders */}
          {tree.folders.map((folder) => renderFolder(folder, 0))}

          {/* Render root-level notes */}
          {tree.notes.map((note) => renderNote(note, 0))}

          {/* Empty state */}
          {tree.folders.length === 0 && tree.notes.length === 0 && (
            <div className="notes-empty">
              <p>No notes yet</p>
              <p className="hint">Click "+ New" to create one</p>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        message={
          deleteConfirm.type === 'folder'
            ? `Delete folder "${deleteConfirm.item?.name}" and all its contents?`
            : `Delete "${deleteConfirm.item?.title || 'this note'}"?`
        }
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}

export default NotesList;
