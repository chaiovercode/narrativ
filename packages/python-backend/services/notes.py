"""
Notes service for markdown note storage in vault.
Supports YAML frontmatter and [[wiki-links]] to research boards.
"""

import os
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

# Vault path (set dynamically by main.py)
VAULT_PATH: Optional[str] = None


def set_vault_path(path: Optional[str]):
    """Set the vault path for storage."""
    global VAULT_PATH
    VAULT_PATH = path


def get_vault_path() -> Optional[str]:
    """Get the current vault path."""
    return VAULT_PATH


def get_notes_dir() -> Optional[Path]:
    """Get the notes directory, creating if needed."""
    if not VAULT_PATH:
        return None
    notes_dir = Path(VAULT_PATH) / "notes"
    notes_dir.mkdir(exist_ok=True)
    return notes_dir


def slugify(text: str) -> str:
    """Convert text to a valid filename slug."""
    clean = re.sub(r'[^\w\s-]', '', text.lower())
    clean = re.sub(r'[-\s]+', '-', clean).strip('-')
    return clean[:50] if clean else 'untitled'


def note_to_markdown(note: Dict[str, Any]) -> str:
    """Convert note dict to markdown with YAML frontmatter."""
    note_id = note.get('id', str(int(datetime.now().timestamp() * 1000)))
    title = note.get('title', 'Untitled')
    created = note.get('createdAt', datetime.now().isoformat())
    modified = datetime.now().isoformat()
    links = note.get('links', [])

    # Build frontmatter
    links_str = str(links).replace("'", '"') if links else "[]"
    frontmatter = f"""---
id: "{note_id}"
title: "{title}"
created: {created}
modified: {modified}
links: {links_str}
---

"""
    return frontmatter + note.get('content', '')


def markdown_to_note(content: str, filename: str) -> Dict[str, Any]:
    """Parse markdown with YAML frontmatter to note dict."""
    note = {'filename': filename}

    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            frontmatter = parts[1].strip()
            body = parts[2].strip()

            # Parse YAML frontmatter manually
            for line in frontmatter.split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")

                    if key == 'id':
                        note['id'] = value
                    elif key == 'title':
                        note['title'] = value
                    elif key == 'created':
                        note['createdAt'] = value
                    elif key == 'modified':
                        note['modifiedAt'] = value
                    elif key == 'links':
                        # Parse links array
                        try:
                            import json
                            note['links'] = json.loads(value.replace("'", '"'))
                        except:
                            note['links'] = []

            note['content'] = body
        else:
            note['content'] = content
    else:
        note['content'] = content
        note['title'] = filename.replace('.md', '')

    # Extract [[links]] from content
    wiki_links = re.findall(r'\[\[([^\]]+)\]\]', note.get('content', ''))
    if wiki_links and 'links' not in note:
        note['links'] = wiki_links

    # Set defaults
    if 'id' not in note:
        note['id'] = str(hash(filename) & 0xFFFFFFFF)
    if 'title' not in note:
        note['title'] = filename.replace('.md', '')
    if 'links' not in note:
        note['links'] = []

    return note


def load_notes() -> List[Dict[str, Any]]:
    """Load all notes from vault."""
    notes_dir = get_notes_dir()
    if not notes_dir or not notes_dir.exists():
        return []

    notes = []
    for md_file in notes_dir.glob("*.md"):
        try:
            content = md_file.read_text(encoding='utf-8')
            note = markdown_to_note(content, md_file.name)
            notes.append(note)
        except Exception as e:
            print(f"Error reading note {md_file}: {e}")

    # Sort by modified date (newest first)
    notes.sort(key=lambda n: n.get('modifiedAt', n.get('createdAt', '')), reverse=True)
    return notes


def save_note(note: Dict[str, Any]) -> Dict[str, Any]:
    """Save a note to the vault. Creates new or updates existing."""
    notes_dir = get_notes_dir()
    if not notes_dir:
        raise ValueError("No vault configured")

    # Generate ID if not present
    note_id = note.get('id') or str(int(datetime.now().timestamp() * 1000))
    note['id'] = note_id

    # Set created timestamp for new notes
    if not note.get('createdAt'):
        note['createdAt'] = datetime.now().isoformat()

    # Set modified timestamp
    note['modifiedAt'] = datetime.now().isoformat()

    # Get current filename and generate new one based on title
    old_filename = note.get('filename')
    new_title = note.get('title', 'untitled')
    new_slug = slugify(new_title)
    new_filename = f"{new_slug}.md"

    # Handle duplicate filenames (add number suffix if needed)
    if old_filename != new_filename:
        base_filename = new_slug
        counter = 1
        while (notes_dir / new_filename).exists():
            # Check if this existing file is the same note (by ID)
            try:
                existing_content = (notes_dir / new_filename).read_text(encoding='utf-8')
                existing_note = markdown_to_note(existing_content, new_filename)
                if existing_note.get('id') == note_id:
                    break  # Same note, ok to overwrite
            except:
                pass
            new_filename = f"{base_filename}-{counter}.md"
            counter += 1

    # Handle file rename if title changed
    if old_filename and old_filename != new_filename:
        old_path = notes_dir / old_filename
        new_path = notes_dir / new_filename

        # Rename the file if old one exists
        if old_path.exists():
            old_path.rename(new_path)

    # Update filename in note
    note['filename'] = new_filename

    # Write to file
    file_path = notes_dir / new_filename
    markdown = note_to_markdown(note)
    file_path.write_text(markdown, encoding='utf-8')

    return note


def delete_note(note_id: str) -> bool:
    """Delete a note by ID."""
    notes_dir = get_notes_dir()
    if not notes_dir:
        return False

    for md_file in notes_dir.glob("*.md"):
        try:
            content = md_file.read_text(encoding='utf-8')
            note = markdown_to_note(content, md_file.name)
            if note.get('id') == note_id:
                md_file.unlink()
                return True
        except Exception:
            pass
    return False


def get_note_by_id(note_id: str) -> Optional[Dict[str, Any]]:
    """Get a single note by ID."""
    notes = load_notes()
    for note in notes:
        if note.get('id') == note_id:
            return note
    return None
