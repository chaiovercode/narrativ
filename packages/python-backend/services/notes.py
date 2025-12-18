"""
Notes service for markdown note storage in vault.
Supports folders, YAML frontmatter, and [[wiki-links]] to research boards.
"""

import json
import os
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from utils.vault import get_vault_path, set_vault_path
from utils.text import slugify


def get_notes_dir() -> Optional[Path]:
    """Get the notes directory, creating if needed."""
    vault_path = get_vault_path()
    if not vault_path:
        return None
    notes_dir = Path(vault_path) / "notes"
    notes_dir.mkdir(exist_ok=True)
    return notes_dir


def note_to_markdown(note: Dict[str, Any]) -> str:
    """Convert note dict to markdown with YAML frontmatter."""
    note_id = note.get('id', str(int(datetime.now().timestamp() * 1000)))
    title = note.get('title', 'Untitled')
    created = note.get('createdAt', datetime.now().isoformat())
    modified = datetime.now().isoformat()
    links = note.get('links', [])
    folder = note.get('folder', '')

    # Build frontmatter
    links_str = str(links).replace("'", '"') if links else "[]"
    frontmatter = f"""---
id: "{note_id}"
title: "{title}"
folder: "{folder}"
created: {created}
modified: {modified}
links: {links_str}
---

"""
    return frontmatter + note.get('content', '')


def markdown_to_note(content: str, filename: str, relative_path: str = '') -> Dict[str, Any]:
    """Parse markdown with YAML frontmatter to note dict."""
    note = {'filename': filename, 'path': relative_path}

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
                    elif key == 'folder':
                        note['folder'] = value
                    elif key == 'created':
                        note['createdAt'] = value
                    elif key == 'modified':
                        note['modifiedAt'] = value
                    elif key == 'links':
                        # Parse links array
                        try:
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
        note['id'] = str(hash(filename + relative_path) & 0xFFFFFFFF)
    if 'title' not in note:
        note['title'] = filename.replace('.md', '')
    if 'links' not in note:
        note['links'] = []
    if 'folder' not in note:
        note['folder'] = relative_path

    return note


def load_notes() -> List[Dict[str, Any]]:
    """Load all notes from vault, including from subdirectories."""
    notes_dir = get_notes_dir()
    if not notes_dir or not notes_dir.exists():
        return []

    notes = []

    # Recursively find all markdown files
    for md_file in notes_dir.rglob("*.md"):
        try:
            content = md_file.read_text(encoding='utf-8')
            # Get relative path from notes_dir
            relative_path = str(md_file.parent.relative_to(notes_dir))
            if relative_path == '.':
                relative_path = ''
            note = markdown_to_note(content, md_file.name, relative_path)
            notes.append(note)
        except Exception as e:
            print(f"Error reading note {md_file}: {e}")

    # Sort by modified date (newest first)
    notes.sort(key=lambda n: n.get('modifiedAt', n.get('createdAt', '')), reverse=True)
    return notes


def load_folders() -> List[Dict[str, Any]]:
    """Load all folders from the notes directory."""
    notes_dir = get_notes_dir()
    if not notes_dir or not notes_dir.exists():
        return []

    folders = []

    # Find all directories
    for item in notes_dir.rglob("*"):
        if item.is_dir():
            relative_path = str(item.relative_to(notes_dir))
            folders.append({
                'name': item.name,
                'path': relative_path,
                'parent': str(item.parent.relative_to(notes_dir)) if item.parent != notes_dir else ''
            })

    # Sort by path for consistent ordering
    folders.sort(key=lambda f: f['path'])
    return folders


def create_folder(name: str, parent_path: str = '') -> Dict[str, Any]:
    """Create a new folder in the notes directory."""
    notes_dir = get_notes_dir()
    if not notes_dir:
        raise ValueError("No vault configured")

    # Build full path
    if parent_path:
        base_path = notes_dir / parent_path
    else:
        base_path = notes_dir

    # Ensure parent exists
    base_path.mkdir(parents=True, exist_ok=True)

    # Handle duplicate folder names - add suffix if needed
    folder_path = base_path / name
    original_name = name
    counter = 1
    while folder_path.exists():
        name = f"{original_name} ({counter})"
        folder_path = base_path / name
        counter += 1

    # Create the folder
    folder_path.mkdir(parents=True, exist_ok=False)

    return {
        'name': name,
        'path': str(folder_path.relative_to(notes_dir)),
        'parent': parent_path
    }


def delete_folder(folder_path: str) -> bool:
    """Delete a folder and all its contents."""
    notes_dir = get_notes_dir()
    if not notes_dir:
        return False

    full_path = notes_dir / folder_path
    if full_path.exists() and full_path.is_dir():
        shutil.rmtree(full_path)
        return True
    return False


def rename_folder(old_path: str, new_name: str) -> Dict[str, Any]:
    """Rename a folder and update all notes inside."""
    notes_dir = get_notes_dir()
    if not notes_dir:
        raise ValueError("No vault configured")

    old_full_path = notes_dir / old_path
    if not old_full_path.exists():
        raise ValueError(f"Folder not found: {old_path}")

    # Build new path
    new_full_path = old_full_path.parent / new_name
    old_full_path.rename(new_full_path)

    new_folder_path = str(new_full_path.relative_to(notes_dir))

    # Update the folder field in all notes inside this folder
    for md_file in new_full_path.rglob("*.md"):
        try:
            content = md_file.read_text(encoding='utf-8')
            relative_path = str(md_file.parent.relative_to(notes_dir))
            if relative_path == '.':
                relative_path = ''
            note = markdown_to_note(content, md_file.name, relative_path)
            # Update the folder field to the new path
            note['folder'] = relative_path
            note['path'] = relative_path
            # Rewrite the note with updated frontmatter
            markdown = note_to_markdown(note)
            md_file.write_text(markdown, encoding='utf-8')
        except Exception as e:
            print(f"Warning: Failed to update note {md_file}: {e}")

    return {
        'name': new_name,
        'path': new_folder_path,
        'parent': str(new_full_path.parent.relative_to(notes_dir)) if new_full_path.parent != notes_dir else ''
    }


def move_folder(folder_path: str, new_parent: str) -> Dict[str, Any]:
    """Move a folder to a new parent, updating all notes inside."""
    notes_dir = get_notes_dir()
    if not notes_dir:
        raise ValueError("No vault configured")

    old_full_path = notes_dir / folder_path
    if not old_full_path.exists():
        raise ValueError(f"Folder not found: {folder_path}")

    # Destination
    if new_parent:
        new_parent_full = notes_dir / new_parent
        if not new_parent_full.exists():
             raise ValueError(f"Parent folder not found: {new_parent}")
        new_full_path = new_parent_full / old_full_path.name
    else:
        # Move to root
        new_full_path = notes_dir / old_full_path.name

    if new_full_path.exists() and new_full_path != old_full_path:
         raise ValueError(f"Destination folder already exists: {new_full_path.name}")

    # Calculate new folder path relative to notes_dir
    new_folder_path = str(new_full_path.relative_to(notes_dir))

    # Perform move
    if new_full_path != old_full_path:
        # Ensure parent exists
        new_full_path.parent.mkdir(parents=True, exist_ok=True)
        # Rename/move the directory
        shutil.move(str(old_full_path), str(new_full_path))

        # Update the folder field in all notes inside this folder
        for md_file in new_full_path.rglob("*.md"):
            try:
                content = md_file.read_text(encoding='utf-8')
                relative_path = str(md_file.parent.relative_to(notes_dir))
                if relative_path == '.':
                    relative_path = ''
                note = markdown_to_note(content, md_file.name, relative_path)
                # Update the folder field to the new path
                note['folder'] = relative_path
                note['path'] = relative_path
                # Rewrite the note with updated frontmatter
                markdown = note_to_markdown(note)
                md_file.write_text(markdown, encoding='utf-8')
            except Exception as e:
                print(f"Warning: Failed to update note {md_file}: {e}")

    return {
        'name': new_full_path.name,
        'path': new_folder_path,
        'parent': new_parent
    }


def save_note(note: Dict[str, Any]) -> Dict[str, Any]:
    """Save a note to the vault. Creates new or updates existing."""
    notes_dir = get_notes_dir()
    if not notes_dir:
        raise ValueError("No vault configured")

    # Generate ID if not present
    note_id = note.get('id') or str(int(datetime.now().timestamp() * 1000))
    note['id'] = note_id

    # FIRST: Check if a note with this ID already exists (to prevent duplicates)
    existing_file = None
    existing_folder = ''
    if note_id:
        for md_file in notes_dir.rglob("*.md"):
            try:
                content = md_file.read_text(encoding='utf-8')
                relative_path = str(md_file.parent.relative_to(notes_dir))
                if relative_path == '.':
                    relative_path = ''
                existing_note = markdown_to_note(content, md_file.name, relative_path)
                if str(existing_note.get('id', '')) == str(note_id):
                    existing_file = md_file
                    existing_folder = relative_path
                    # Preserve createdAt from existing note
                    if not note.get('createdAt') and existing_note.get('createdAt'):
                        note['createdAt'] = existing_note['createdAt']
                    break
            except:
                pass

    # Set created timestamp for new notes
    if not note.get('createdAt'):
        note['createdAt'] = datetime.now().isoformat()

    # Set modified timestamp
    note['modifiedAt'] = datetime.now().isoformat()

    # Get folder path - use existing folder if not specified
    folder = note.get('folder', '') or note.get('path', '') or existing_folder
    note['folder'] = folder

    # Ensure folder exists
    if folder:
        folder_path = notes_dir / folder
        folder_path.mkdir(parents=True, exist_ok=True)
        target_dir = folder_path
    else:
        target_dir = notes_dir

    # Get current filename and generate new one based on title
    old_filename = note.get('filename') or (existing_file.name if existing_file else None)
    old_folder = note.get('path', '') or existing_folder
    new_title = note.get('title', 'untitled')
    new_slug = slugify(new_title)
    new_filename = f"{new_slug}.md"

    # Handle duplicate filenames (add number suffix if needed)
    if old_filename != new_filename or old_folder != folder:
        base_filename = new_slug
        counter = 1
        while (target_dir / new_filename).exists():
            # Check if this existing file is the same note (by ID)
            try:
                existing_content = (target_dir / new_filename).read_text(encoding='utf-8')
                existing_note = markdown_to_note(existing_content, new_filename, folder)
                if existing_note.get('id') == note_id:
                    break  # Same note, ok to overwrite
            except:
                pass
            new_filename = f"{base_filename}-{counter}.md"
            counter += 1

    # Handle file rename/move if needed
    new_path = target_dir / new_filename

    # If we found an existing file with the same ID, use that as the old path
    if existing_file:
        old_path = existing_file
        if old_path.exists() and old_path != new_path:
            old_path.rename(new_path)
    elif old_filename:
        if old_folder:
            old_path = notes_dir / old_folder / old_filename
        else:
            old_path = notes_dir / old_filename
        if old_path.exists() and old_path != new_path:
            old_path.rename(new_path)

    # Update note metadata
    note['filename'] = new_filename
    note['path'] = folder

    # Write to file
    file_path = target_dir / new_filename
    markdown = note_to_markdown(note)
    file_path.write_text(markdown, encoding='utf-8')

    return note


def move_note(note_id: str, new_folder: str) -> Dict[str, Any]:
    """Move a note to a different folder."""
    note = get_note_by_id(note_id)
    if not note:
        raise ValueError(f"Note not found: {note_id}")

    note['folder'] = new_folder
    return save_note(note)


def delete_note(note_id: str) -> bool:
    """Delete a note by ID."""
    notes_dir = get_notes_dir()
    if not notes_dir:
        return False

    # Convert ID to string for comparison
    note_id_str = str(note_id)
    deleted_any = False

    # Search recursively and delete ALL matching notes (handle duplicates)
    for md_file in notes_dir.rglob("*.md"):
        try:
            content = md_file.read_text(encoding='utf-8')
            relative_path = str(md_file.parent.relative_to(notes_dir))
            if relative_path == '.':
                relative_path = ''
            note = markdown_to_note(content, md_file.name, relative_path)
            if str(note.get('id', '')) == note_id_str:
                md_file.unlink()
                deleted_any = True
        except Exception as e:
            print(f"Error deleting note {md_file}: {e}")
    return deleted_any


def get_note_by_id(note_id: str) -> Optional[Dict[str, Any]]:
    """Get a single note by ID."""
    notes = load_notes()
    for note in notes:
        if note.get('id') == note_id:
            return note
    return None


def get_duplicate_name(base_name: str, existing_names: List[str]) -> str:
    """Generate a duplicate name with (1), (2), etc. suffix."""
    # Check if name already has a number suffix like "Name (1)"
    match = re.match(r'^(.+?)\s*\((\d+)\)$', base_name)
    if match:
        base = match.group(1).strip()
    else:
        base = base_name

    # Find the next available number
    counter = 1
    while True:
        new_name = f"{base} ({counter})"
        if new_name not in existing_names:
            return new_name
        counter += 1


def duplicate_note(note_id: str) -> Dict[str, Any]:
    """Duplicate a note with same name + (1), (2), etc."""
    note = get_note_by_id(note_id)
    if not note:
        raise ValueError(f"Note not found: {note_id}")

    # Get all existing note titles in the same folder
    all_notes = load_notes()
    folder = note.get('folder', '')
    existing_titles = [n.get('title', '') for n in all_notes if n.get('folder', '') == folder]

    # Generate new title
    new_title = get_duplicate_name(note.get('title', 'Untitled'), existing_titles)

    # Create new note (without id to generate new one)
    new_note = {
        'title': new_title,
        'content': note.get('content', ''),
        'folder': folder,
        'links': note.get('links', []).copy(),
    }

    return save_note(new_note)


def duplicate_folder(folder_path: str) -> Dict[str, Any]:
    """Duplicate a folder and all its contents with same name + (1), (2), etc."""
    notes_dir = get_notes_dir()
    if not notes_dir:
        raise ValueError("No vault configured")

    source_path = notes_dir / folder_path
    if not source_path.exists():
        raise ValueError(f"Folder not found: {folder_path}")

    # Get parent directory and folder name
    parent_path = source_path.parent
    folder_name = source_path.name

    # Get existing folder names in parent
    existing_names = [d.name for d in parent_path.iterdir() if d.is_dir()]

    # Generate new name
    new_name = get_duplicate_name(folder_name, existing_names)
    new_path = parent_path / new_name

    # Copy the folder
    shutil.copytree(source_path, new_path)

    # Update all notes in the new folder to have new IDs, titles, and updated paths
    new_folder_path = str(new_path.relative_to(notes_dir))

    # First, collect all existing note titles (from original folder and new folder)
    all_notes = load_notes()

    for md_file in new_path.rglob("*.md"):
        try:
            content = md_file.read_text(encoding='utf-8')
            relative_path = str(md_file.parent.relative_to(notes_dir))
            if relative_path == '.':
                relative_path = ''
            note = markdown_to_note(content, md_file.name, relative_path)

            # Get existing titles in the same folder for duplicate naming
            existing_titles = [n.get('title', '') for n in all_notes if n.get('folder', '') == relative_path]

            # Generate new title with (1), (2), etc.
            old_title = note.get('title', 'Untitled')
            new_title = get_duplicate_name(old_title, existing_titles)

            # Add this new title to existing titles for next iteration
            existing_titles.append(new_title)

            # Generate new ID for the duplicated note
            note['id'] = str(int(datetime.now().timestamp() * 1000))
            note['title'] = new_title
            note['folder'] = relative_path
            note['path'] = relative_path
            note['createdAt'] = datetime.now().isoformat()

            # Generate new filename based on new title
            new_slug = slugify(new_title)
            new_filename = f"{new_slug}.md"
            new_file_path = md_file.parent / new_filename

            # Write to new file with new title
            markdown = note_to_markdown(note)
            new_file_path.write_text(markdown, encoding='utf-8')

            # Remove old file if filename changed
            if md_file != new_file_path:
                md_file.unlink()

        except Exception as e:
            print(f"Warning: Failed to update duplicated note {md_file}: {e}")

    return {
        'name': new_name,
        'path': new_folder_path,
        'parent': str(parent_path.relative_to(notes_dir)) if parent_path != notes_dir else ''
    }
