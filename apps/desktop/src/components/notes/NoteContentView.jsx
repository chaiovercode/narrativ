import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ConfirmModal } from '../ConfirmModal';
import '../../styles/note-content.css';

/**
 * Full-width note editor/viewer for the main content area.
 * Shown when notes panel is open and a note is selected.
 */
function NoteContentView({ note, onSave, onDelete, researchBoards = [], onOpenResearch }) {
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
    const lineHeight = 24;
    const charWidth = 8;
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
        const lastOpenBracket = textBeforeCursor.lastIndexOf('[[');
        if (lastOpenBracket !== -1) {
          const textAfterBracket = textBeforeCursor.slice(lastOpenBracket + 2);
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

    const lastOpenBracket = textBeforeCursor.lastIndexOf('[[');
    if (lastOpenBracket === -1) return;

    const beforeLink = content.slice(0, lastOpenBracket);
    const linkText = `[[${research.topic}]]`;
    const newContent = beforeLink + linkText + textAfterCursor;

    setContent(newContent);
    setShowLinkPicker(false);
    setLinkSearchQuery('');

    if (title.trim()) {
      debouncedSave(title, newContent);
    }

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

    if (title.trim()) {
      debouncedSave(title, newContent);
    }

    requestAnimationFrame(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      } else {
        textarea.setSelectionRange(start + prefix.length, start + prefix.length);
      }
    });
  }, [content, title, debouncedSave]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    const isMod = e.metaKey || e.ctrlKey;

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
          insertFormatting('\n```\n', '\n```\n');
        } else {
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

    if (e.key === 'Escape' && mode === 'edit' && !showLinkPicker) {
      e.preventDefault();
      setMode('view');
    }
  }, [content, mode, showLinkPicker, filteredResearch, insertResearchLink, insertFormatting]);

  // Double-click in view mode to edit
  const handleViewDoubleClick = useCallback(() => {
    setMode('edit');
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const isMod = e.metaKey || e.ctrlKey;
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
    // Split content by wiki-links and render them separately
    const parts = [];
    let lastIndex = 0;
    const regex = /\[\[([^\]]+)\]\]/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Add text before the wiki-link
      if (match.index > lastIndex) {
        const textBefore = content.slice(lastIndex, match.index);
        parts.push(
          <ReactMarkdown key={`md-${lastIndex}`} remarkPlugins={[remarkGfm]} components={{
            code: ({ node, inline, className, children, ...props }) => {
              return inline ? (
                <code className="inline-code" {...props}>{children}</code>
              ) : (
                <code className={className} {...props}>{children}</code>
              );
            },
          }}>
            {textBefore}
          </ReactMarkdown>
        );
      }

      // Add the wiki-link as a clickable span
      const topic = match[1];
      parts.push(
        <span
          key={`wiki-${match.index}`}
          className="wiki-link clickable"
          title={`Open research: ${topic}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onOpenResearch) {
              onOpenResearch(topic);
            }
          }}
        >
          {topic}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last wiki-link
    if (lastIndex < content.length) {
      const textAfter = content.slice(lastIndex);
      parts.push(
        <ReactMarkdown key={`md-${lastIndex}`} remarkPlugins={[remarkGfm]} components={{
          code: ({ node, inline, className, children, ...props }) => {
            return inline ? (
              <code className="inline-code" {...props}>{children}</code>
            ) : (
              <code className={className} {...props}>{children}</code>
            );
          },
        }}>
          {textAfter}
        </ReactMarkdown>
      );
    }

    // If no wiki-links found, just render as markdown
    if (parts.length === 0) {
      return (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
          code: ({ node, inline, className, children, ...props }) => {
            return inline ? (
              <code className="inline-code" {...props}>{children}</code>
            ) : (
              <code className={className} {...props}>{children}</code>
            );
          },
        }}>
          {content}
        </ReactMarkdown>
      );
    }

    return <>{parts}</>;
  }, [content, onOpenResearch]);

  // Show empty state if no note
  if (!note) {
    return (
      <div className="note-content-view empty">
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
          <h3>No note selected</h3>
          <p>Select a note from the list or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="note-content-view" onKeyDown={handleKeyDown}>
      <div className="note-content-header">
        <input
          type="text"
          className="note-title-input"
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
        <div className="header-right">
          <span className="note-status">
            {saving && <span className="saving">Saving...</span>}
            {!saving && lastSaved && <span className="saved">{formatLastSaved()}</span>}
          </span>
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
        </div>
      </div>

      <div className="note-content-body">
        {mode === 'edit' ? (
          <div className="note-textarea-wrapper">
            <textarea
              ref={textareaRef}
              className="note-content-input"
              placeholder="Write your note here... (supports Markdown)"
              value={content}
              onChange={handleContentChange}
            />

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
            className="note-markdown-content"
            onDoubleClick={handleViewDoubleClick}
            title="Double-click to edit"
            onClick={(e) => {
              // Intercept clicks on wiki-links
              const target = e.target;
              if (target.classList?.contains('wiki-link')) {
                e.preventDefault();
                e.stopPropagation();
                const topic = target.textContent;
                if (topic && onOpenResearch) {
                  onOpenResearch(topic);
                }
              }
            }}
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

export default NoteContentView;
