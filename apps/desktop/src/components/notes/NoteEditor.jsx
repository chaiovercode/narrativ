import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ConfirmModal } from '../ConfirmModal';

/**
 * Obsidian-style editor with Edit/View mode toggle.
 * Features auto-save, markdown rendering, and keyboard shortcuts.
 */
function NoteEditor({ note, onSave, onDelete, onBack, researchBoards = [] }) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [mode, setMode] = useState('edit'); // 'edit' or 'view'
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const saveTimeoutRef = useRef(null);
  const textareaRef = useRef(null);
  const isNewNote = !note?.id;

  // Reset form when note changes
  useEffect(() => {
    setTitle(note?.title || '');
    setContent(note?.content || '');
    setLastSaved(null);
    setShowLinkPicker(false);
    // Start new notes in edit mode, existing notes in view mode
    setMode(note?.id ? 'view' : 'edit');
  }, [note?.id]);

  // Auto-save with debounce
  const debouncedSave = useCallback(
    (newTitle, newContent) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      if (!newTitle.trim()) return;

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          setSaving(true);
          await onSave({
            id: note?.id,
            title: newTitle,
            content: newContent,
            filename: note?.filename,
          });
          setLastSaved(new Date());
        } catch (err) {
          console.error('Auto-save failed:', err);
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [note?.id, note?.filename, onSave]
  );

  // Handle title change
  const handleTitleChange = useCallback(
    (e) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      if (!isNewNote || content) {
        debouncedSave(newTitle, content);
      }
    },
    [content, debouncedSave, isNewNote]
  );

  // Calculate cursor coordinates in textarea
  const getCursorCoordinates = useCallback((textarea, position) => {
    const text = textarea.value.substring(0, position);
    const lines = text.split('\n');
    const lineNumber = lines.length - 1;
    const lineHeight = 24; // Approximate line height
    const charWidth = 8; // Approximate char width for monospace
    const lastLineLength = lines[lines.length - 1].length;

    return {
      top: (lineNumber + 1) * lineHeight + 8,
      left: Math.min(lastLineLength * charWidth, 200)
    };
  }, []);

  // Handle content change and detect [[
  const handleContentChange = useCallback(
    (e) => {
      const newContent = e.target.value;
      const cursorPos = e.target.selectionStart;
      setContent(newContent);
      setCursorPosition(cursorPos);

      // Check if user just typed [[
      const textBeforeCursor = newContent.slice(0, cursorPos);
      const lastTwoChars = textBeforeCursor.slice(-2);

      if (lastTwoChars === '[[') {
        const coords = getCursorCoordinates(e.target, cursorPos);
        setPickerPosition(coords);
        setShowLinkPicker(true);
        setLinkSearchQuery('');
      } else if (showLinkPicker) {
        // Check if we're still inside [[ ]]
        const lastOpenBracket = textBeforeCursor.lastIndexOf('[[');
        if (lastOpenBracket !== -1) {
          const textAfterBracket = textBeforeCursor.slice(lastOpenBracket + 2);
          // If there's no ]] yet, update search query
          if (!textAfterBracket.includes(']]')) {
            setLinkSearchQuery(textAfterBracket);
          } else {
            setShowLinkPicker(false);
          }
        } else {
          setShowLinkPicker(false);
        }
      }

      if (title.trim()) {
        debouncedSave(title, newContent);
      }
    },
    [title, debouncedSave, showLinkPicker, getCursorCoordinates]
  );

  // Insert selected research link
  const insertResearchLink = useCallback((research) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const textBeforeCursor = content.slice(0, cursorPosition);
    const textAfterCursor = content.slice(cursorPosition);

    // Find the [[ position
    const lastOpenBracket = textBeforeCursor.lastIndexOf('[[');
    if (lastOpenBracket === -1) return;

    // Build new content with the link
    const beforeLink = content.slice(0, lastOpenBracket);
    const linkText = `[[${research.topic}]]`;
    const newContent = beforeLink + linkText + textAfterCursor;

    setContent(newContent);
    setShowLinkPicker(false);
    setLinkSearchQuery('');

    // Save after inserting link
    if (title.trim()) {
      debouncedSave(title, newContent);
    }

    // Focus back on textarea
    requestAnimationFrame(() => {
      textarea.focus();
      const newCursorPos = lastOpenBracket + linkText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }, [content, cursorPosition, title, debouncedSave]);

  // Filter research boards based on search
  const filteredResearch = researchBoards.filter(r =>
    r.topic?.toLowerCase().includes(linkSearchQuery.toLowerCase())
  );

  // Handle delete
  const handleDelete = useCallback(() => {
    if (note?.id) {
      setShowDeleteConfirm(true);
    }
  }, [note?.id]);

  const confirmDelete = useCallback(() => {
    if (note?.id) {
      onDelete(note.id);
    }
    setShowDeleteConfirm(false);
  }, [note?.id, onDelete]);

  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  // Toggle mode
  const toggleMode = useCallback(() => {
    setMode(m => m === 'edit' ? 'view' : 'edit');
  }, []);

  // Insert markdown formatting around selection
  const insertFormatting = useCallback((prefix, suffix = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end);
    const beforeText = content.slice(0, start);
    const afterText = content.slice(end);

    const newContent = beforeText + prefix + selectedText + suffix + afterText;
    setContent(newContent);

    // Save and update cursor
    if (title.trim()) {
      debouncedSave(title, newContent);
    }

    requestAnimationFrame(() => {
      textarea.focus();
      if (selectedText) {
        // Select the formatted text
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      } else {
        // Place cursor between the markers
        textarea.setSelectionRange(start + prefix.length, start + prefix.length);
      }
    });
  }, [content, title, debouncedSave]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    const isMod = e.metaKey || e.ctrlKey;

    // Link picker shortcuts
    if (showLinkPicker) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowLinkPicker(false);
      } else if ((e.key === 'Enter' || e.key === 'Tab') && filteredResearch.length > 0) {
        e.preventDefault();
        insertResearchLink(filteredResearch[0]);
      }
      return;
    }

    // Edit mode only shortcuts
    if (mode === 'edit') {
      if (isMod && e.key === 'b') {
        e.preventDefault();
        insertFormatting('**');
      } else if (isMod && e.key === 'i') {
        e.preventDefault();
        insertFormatting('*');
      } else if (isMod && e.key === 'k') {
        e.preventDefault();
        if (e.shiftKey) {
          // Code block
          insertFormatting('\n```\n', '\n```\n');
        } else {
          // Link
          const textarea = textareaRef.current;
          const selectedText = content.slice(textarea.selectionStart, textarea.selectionEnd);
          insertFormatting('[', `](${selectedText ? 'url' : ''})`);
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        const newContent = content.slice(0, start) + '  ' + content.slice(end);
        setContent(newContent);
        requestAnimationFrame(() => {
          e.target.selectionStart = e.target.selectionEnd = start + 2;
        });
      }
    }

    // Escape to switch to view mode
    if (e.key === 'Escape' && mode === 'edit' && !showLinkPicker) {
      e.preventDefault();
      setMode('view');
    }
  }, [content, mode, showLinkPicker, filteredResearch, insertResearchLink, toggleMode, insertFormatting]);

  // Double-click in view mode to edit
  const handleViewDoubleClick = useCallback(() => {
    setMode('edit');
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, []);

  // Global keyboard shortcuts (work even when not focused on textarea)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+E to toggle mode (global)
      if (isMod && e.key === 'e') {
        e.preventDefault();
        toggleMode();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [toggleMode]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Format last saved time
  const formatLastSaved = useCallback(() => {
    if (!lastSaved) return '';
    const now = new Date();
    const diff = Math.floor((now - lastSaved) / 1000);
    if (diff < 5) return 'Just saved';
    if (diff < 60) return `Saved ${diff}s ago`;
    return `Saved at ${lastSaved.toLocaleTimeString()}`;
  }, [lastSaved]);

  // Custom renderer for wiki links [[...]]
  const renderContent = useCallback(() => {
    // Process wiki links before rendering
    const processedContent = content.replace(
      /\[\[([^\]]+)\]\]/g,
      (match, linkText) => `[${linkText}](wiki:${encodeURIComponent(linkText)})`
    );

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom link handler for wiki links
          a: ({ href, children }) => {
            if (href?.startsWith('wiki:')) {
              const topic = decodeURIComponent(href.slice(5));
              return (
                <span className="wiki-link" title={`Research: ${topic}`}>
                  {children}
                </span>
              );
            }
            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
          },
          // Better code blocks
          code: ({ node, inline, className, children, ...props }) => {
            return inline ? (
              <code className="inline-code" {...props}>{children}</code>
            ) : (
              <code className={className} {...props}>{children}</code>
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    );
  }, [content]);

  return (
    <div className="note-editor" onKeyDown={handleKeyDown}>
      <div className="editor-header">
        <button className="back-btn" onClick={onBack} title="Back to list">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="editor-status">
          {saving && <span className="saving">Saving...</span>}
          {!saving && lastSaved && <span className="saved">{formatLastSaved()}</span>}
        </div>

        <button
          className={`mode-toggle-btn ${mode}`}
          onClick={toggleMode}
          title={mode === 'edit' ? 'View mode (Cmd+E)' : 'Edit mode (Cmd+E)'}
        >
          {mode === 'edit' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          )}
        </button>

        {note?.id && (
          <button className="delete-btn" onClick={handleDelete} title="Delete note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        )}
      </div>

      <div className="editor-body">
        <input
          type="text"
          className="title-input"
          placeholder="Note title..."
          value={title}
          onChange={handleTitleChange}
          autoFocus={isNewNote}
          onKeyDown={(e) => {
            if (e.key === 'Tab' && !e.shiftKey) {
              e.preventDefault();
              textareaRef.current?.focus();
            }
          }}
        />

        {mode === 'edit' ? (
          <div className="textarea-wrapper">
            <textarea
              ref={textareaRef}
              className="content-input"
              placeholder="Write your note here... (supports Markdown)"
              value={content}
              onChange={handleContentChange}
            />

            {/* Research Link Picker */}
            {showLinkPicker && filteredResearch.length > 0 && (
              <div
                className="link-picker"
                style={{ top: pickerPosition.top, left: pickerPosition.left }}
              >
                {filteredResearch.slice(0, 5).map((research) => (
                  <button
                    key={research.id}
                    className="link-picker-item"
                    onClick={() => insertResearchLink(research)}
                  >
                    {research.topic}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className="markdown-content"
            onDoubleClick={handleViewDoubleClick}
            title="Double-click to edit"
          >
            {content ? renderContent() : (
              <p className="empty-content">Double-click to start writing...</p>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        message={`Delete "${title || 'this note'}"?`}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}

export default NoteEditor;
