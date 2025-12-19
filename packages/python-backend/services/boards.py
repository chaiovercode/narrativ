"""
Storage service for research and image boards.
Supports both legacy JSON storage and vault-based markdown storage.
"""

import json
import os
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

from utils.vault import get_vault_path, set_vault_path
from utils.text import slugify


# Legacy data directory (used when no vault is set)
DATA_DIR = Path(__file__).parent.parent / "data"
RESEARCH_FILE = DATA_DIR / "research.json"
IMAGES_FILE = DATA_DIR / "images.json"


def ensure_data_dir():
    """Ensure legacy data directory and files exist."""
    DATA_DIR.mkdir(exist_ok=True)

    if not RESEARCH_FILE.exists():
        RESEARCH_FILE.write_text("[]")

    if not IMAGES_FILE.exists():
        IMAGES_FILE.write_text("[]")


def get_file_path(board_type: str) -> Path:
    """Get the file path for a board type."""
    if board_type == "research":
        return RESEARCH_FILE
    elif board_type == "images":
        return IMAGES_FILE
    else:
        raise ValueError(f"Invalid board type: {board_type}")


def board_to_markdown(board: Dict[str, Any]) -> str:
    """Convert a research board to markdown with YAML frontmatter."""
    # Extract metadata
    board_id = board.get('id', int(datetime.now().timestamp() * 1000))
    topic = board.get('topic', 'Untitled')
    style = board.get('selectedStyle', {}).get('name', 'Default') if isinstance(board.get('selectedStyle'), dict) else board.get('selectedStyle', 'Default')
    image_size = board.get('imageSize', 'story')
    created = board.get('createdAt', datetime.now().isoformat())
    provider = board.get('provider', '')
    model = board.get('model', '')

    # Build frontmatter
    frontmatter = f"""---
id: {board_id}
topic: "{topic}"
style: "{style}"
image_size: "{image_size}"
provider: "{provider}"
model: "{model}"
created: {created}
---
"""

    # Build content
    content = f"# {topic}\n\n"

    # Add slides
    slides = board.get('slides', [])
    for i, slide in enumerate(slides, 1):
        # Support both old format (hook/fact/visual) and new format (title/key_fact/visual_description)
        title = slide.get('title') or slide.get('hook', '') if isinstance(slide, dict) else ''
        key_fact = slide.get('key_fact') or slide.get('fact', '') if isinstance(slide, dict) else ''
        visual = slide.get('visual_description') or slide.get('visual', '') if isinstance(slide, dict) else ''

        content += f"## Slide {i}: {title}\n\n"
        content += f"**Key Fact**: {key_fact}\n\n"
        content += f"**Visual**: {visual}\n\n"
        if slide.get('mood'):
            content += f"**Mood**: {slide.get('mood')}\n\n"

        # Add image reference if exists
        if slide.get('imageUrl'):
            image_path = slide.get('imageUrl', '')
            content += f"![Slide {i}]({image_path})\n\n"

        content += "---\n\n"

    # Add caption
    caption = board.get('caption', '')
    if caption:
        content += f"## Caption\n\n{caption}\n\n"

    # Add hashtags
    hashtags = board.get('hashtags', [])
    if hashtags:
        content += f"## Hashtags\n\n{' '.join(hashtags)}\n\n"

    # Add sources
    sources = board.get('sources', [])
    if sources:
        content += "## Sources\n\n"
        for source in sources:
            if isinstance(source, dict):
                content += f"- [{source.get('title', 'Source')}]({source.get('url', '')})\n"
            else:
                content += f"- {source}\n"
        content += "\n"

    return frontmatter + content


def markdown_to_board(content: str, filename: str) -> Dict[str, Any]:
    """Parse markdown with YAML frontmatter back to a board object."""
    board = {}

    # Parse frontmatter
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            frontmatter = parts[1].strip()
            body = parts[2].strip()

            # Parse YAML frontmatter manually (simple key: value pairs)
            for line in frontmatter.split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")

                    if key == 'id':
                        try:
                            board['id'] = int(value)
                        except ValueError:
                            board['id'] = hash(filename) & 0xFFFFFFFF
                    elif key == 'topic':
                        board['topic'] = value
                    elif key == 'style':
                        board['selectedStyle'] = value
                    elif key == 'image_size':
                        board['imageSize'] = value
                    elif key == 'provider':
                        board['provider'] = value
                    elif key == 'model':
                        board['model'] = value
                    elif key == 'created':
                        board['createdAt'] = value
        else:
            body = content
    else:
        body = content

    # Set defaults
    if 'id' not in board:
        board['id'] = hash(filename) & 0xFFFFFFFF
    if 'topic' not in board:
        # Try to extract from first heading
        match = re.search(r'^# (.+)$', body, re.MULTILINE)
        board['topic'] = match.group(1) if match else filename.replace('.md', '')

    # Parse slides from body
    slides = []
    slide_matches = re.findall(
        r'## Slide (\d+): (.+?)\n\n\*\*Key Fact\*\*: (.+?)\n\n\*\*Visual\*\*: (.+?)\n\n(?:\*\*Mood\*\*: (.+?)\n\n)?',
        body, re.DOTALL
    )
    for match in slide_matches:
        slide = {
            'slide_number': int(match[0]),
            'title': match[1].strip(),
            'key_fact': match[2].strip(),
            'visual_description': match[3].strip(),
        }
        if match[4]:
            slide['mood'] = match[4].strip()
        slides.append(slide)

    board['slides'] = slides

    # Parse caption
    caption_match = re.search(r'## Caption\n\n(.+?)(?=\n\n##|\n\n---|\Z)', body, re.DOTALL)
    if caption_match:
        board['caption'] = caption_match.group(1).strip()

    # Parse hashtags
    hashtag_match = re.search(r'## Hashtags\n\n(.+?)(?=\n\n##|\Z)', body, re.DOTALL)
    if hashtag_match:
        hashtags = re.findall(r'#\w+', hashtag_match.group(1))
        board['hashtags'] = hashtags

    # Parse sources
    sources_match = re.search(r'## Sources\n\n(.+?)(?=\n\n##|\Z)', body, re.DOTALL)
    if sources_match:
        sources = []
        for line in sources_match.group(1).strip().split('\n'):
            line = line.strip()
            if line.startswith('- '):
                line = line[2:]
                # Check for markdown link
                link_match = re.match(r'\[(.+?)\]\((.+?)\)', line)
                if link_match:
                    sources.append({'title': link_match.group(1), 'url': link_match.group(2)})
                else:
                    sources.append(line)
        board['sources'] = sources

    return board


def load_boards(board_type: str) -> List[Dict[str, Any]]:
    """Load all boards of a given type."""

    # For research boards with vault, use markdown files
    if board_type == "research" and get_vault_path():
        research_dir = Path(get_vault_path()) / "research"
        if not research_dir.exists():
            return []

        boards = []
        for md_file in research_dir.glob("*.md"):
            try:
                content = md_file.read_text(encoding='utf-8')
                board = markdown_to_board(content, md_file.name)
                board['_filename'] = md_file.name
                boards.append(board)
            except Exception as e:
                print(f"Error reading {md_file}: {e}")

        # Sort by created date (newest first)
        boards.sort(key=lambda b: b.get('createdAt', ''), reverse=True)
        return boards

    # Legacy JSON storage
    ensure_data_dir()
    file_path = get_file_path(board_type)

    try:
        with open(file_path, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def save_boards(board_type: str, boards: List[Dict[str, Any]]) -> None:
    """Save all boards of a given type."""
    file_path = get_file_path(board_type)

    # Ensure parent directory exists
    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, "w") as f:
        json.dump(boards, f, indent=2)


def add_board(board_type: str, board: Dict[str, Any]) -> Dict[str, Any]:
    """Add a new board and return it. For research, skips if topic already exists."""

    # For research boards with vault, save as markdown
    if board_type == "research" and get_vault_path():
        research_dir = Path(get_vault_path()) / "research"
        research_dir.mkdir(exist_ok=True)

        # Check if research with same topic already exists
        topic = board.get('topic', 'untitled')
        topic_lower = topic.lower().strip()

        for md_file in research_dir.glob("*.md"):
            try:
                content = md_file.read_text(encoding='utf-8')
                existing = markdown_to_board(content, md_file.name)
                if existing.get('topic', '').lower().strip() == topic_lower:
                    print(f"[boards] Research for '{topic}' already exists, skipping")
                    existing['_filename'] = md_file.name
                    return existing  # Return existing board instead of creating duplicate
            except Exception:
                pass

        # Generate filename from topic
        slug = slugify(topic)

        # Add timestamp to ensure uniqueness
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        filename = f"{slug}-{timestamp}.md"

        # Convert to markdown and save
        markdown = board_to_markdown(board)
        file_path = research_dir / filename
        file_path.write_text(markdown, encoding='utf-8')

        board['_filename'] = filename
        return board

    # Legacy JSON storage
    boards = load_boards(board_type)

    # Add to beginning of list (newest first)
    # Check if exists first
    existing_idx = next((i for i, b in enumerate(boards) if b.get('id') == board.get('id')), -1)
    if existing_idx >= 0:
        boards[existing_idx] = board
    else:
        boards.insert(0, board)

    # Limit to 100 boards per type
    boards = boards[:100]

    save_boards(board_type, boards)
    return board


def delete_board(board_type: str, board_id: int) -> bool:
    """Delete a board by ID. Returns True if deleted."""

    # For research boards with vault, delete markdown file
    if board_type == "research" and get_vault_path():
        research_dir = Path(get_vault_path()) / "research"
        if not research_dir.exists():
            return False

        # Find and delete the file with matching ID
        for md_file in research_dir.glob("*.md"):
            try:
                content = md_file.read_text(encoding='utf-8')
                board = markdown_to_board(content, md_file.name)
                if board.get('id') == board_id:
                    md_file.unlink()
                    return True
            except Exception:
                pass
        return False

    # For images boards, also delete the actual image files
    if board_type == "images":
        boards = load_boards(board_type)
        board_to_delete = next((b for b in boards if b.get("id") == board_id), None)

        if board_to_delete and get_vault_path():
            # Get image URLs and extract folder name
            images = board_to_delete.get("images", [])
            if images:
                # Extract folder name from first image URL
                # URL format: http://localhost:8000/images/{folder_name}/{filename}
                try:
                    first_url = images[0]
                    path_parts = urlparse(first_url).path.split('/')
                    # Find 'images' in path and get the next part (folder name)
                    if 'images' in path_parts:
                        idx = path_parts.index('images')
                        if idx + 1 < len(path_parts):
                            folder_name = path_parts[idx + 1]
                            attachments_dir = Path(get_vault_path()) / "attachments" / folder_name
                            if attachments_dir.exists():
                                shutil.rmtree(attachments_dir)
                                print(f"[boards] Deleted attachments folder: {attachments_dir}")
                except Exception as e:
                    print(f"[boards] Error deleting image files: {e}")

    # Legacy JSON storage
    boards = load_boards(board_type)
    original_length = len(boards)

    boards = [b for b in boards if b.get("id") != board_id]

    if len(boards) < original_length:
        save_boards(board_type, boards)
        return True

    return False


def get_board(board_type: str, board_id: int) -> Optional[Dict[str, Any]]:
    """Get a single board by ID."""
    boards = load_boards(board_type)

    for board in boards:
        if board.get("id") == board_id:
            return board

    return None


def update_board(board_type: str, board_id: int, updated_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update an existing board by ID. Returns updated board or None if not found."""

    # For research boards with vault, update markdown file
    if board_type == "research" and get_vault_path():
        research_dir = Path(get_vault_path()) / "research"
        if not research_dir.exists():
            return None

        # Find the file with matching ID
        for md_file in research_dir.glob("*.md"):
            try:
                content = md_file.read_text(encoding='utf-8')
                board = markdown_to_board(content, md_file.name)
                if board.get('id') == board_id:
                    # Merge updated data
                    board.update(updated_data)
                    board['id'] = board_id  # Ensure ID stays the same

                    # Convert back to markdown and save
                    markdown = board_to_markdown(board)
                    md_file.write_text(markdown, encoding='utf-8')

                    board['_filename'] = md_file.name
                    return board
            except Exception as e:
                print(f"[boards] Error updating {md_file}: {e}")

        return None

    # Legacy JSON storage
    boards = load_boards(board_type)

    for i, board in enumerate(boards):
        if board.get("id") == board_id:
            # Merge updated data
            boards[i].update(updated_data)
            boards[i]['id'] = board_id  # Ensure ID stays the same
            save_boards(board_type, boards)
            return boards[i]

    return None


def sync_attachments_with_boards() -> Dict[str, Any]:
    """
    Sync the vault's attachments folder with image boards.
    - Adds new boards for folders not in the gallery
    - Updates existing boards with new images from their folders
    - Removes board entries for folders that no longer exist
    Returns stats about the sync operation.
    """
    if not get_vault_path():
        return {"added": 0, "removed": 0, "updated": 0, "error": "No vault configured"}

    attachments_dir = Path(get_vault_path()) / "attachments"
    if not attachments_dir.exists():
        return {"added": 0, "removed": 0, "updated": 0, "error": "Attachments directory doesn't exist"}

    print(f"[DEBUG] Syncing vault: {get_vault_path()}")
    print(f"[DEBUG] Attachments dir: {attachments_dir}")

    # Try to list directory contents - may fail with permission errors on iCloud
    try:
        folder_names = [x.name for x in attachments_dir.iterdir() if x.is_dir()]
        print(f"[DEBUG] Attachments Content: {folder_names}")
    except PermissionError as e:
        print(f"[sync] Permission denied accessing attachments folder: {e}")
        return {
            "added": 0,
            "removed": 0,
            "updated": 0,
            "error": "Permission denied. Grant Full Disk Access to Narrativ in System Settings > Privacy & Security."
        }

    # Load current image boards
    boards = load_boards("images")
    print(f"[DEBUG] Loaded {len(boards)} existing boards")

    # Build a map of folder_name -> board index for existing boards
    folder_to_board_idx = {}
    for i, board in enumerate(boards):
        images = board.get("images", [])
        for img_url in images:
            try:
                path_parts = urlparse(img_url).path.split('/')
                if 'images' in path_parts:
                    idx = path_parts.index('images')
                    if idx + 1 < len(path_parts):
                        folder_name = path_parts[idx + 1]
                        folder_to_board_idx[folder_name] = i
                        break  # Only need first image to identify folder
            except Exception:
                pass

    existing_folders = set(folder_to_board_idx.keys())
    actual_folders = set(folder_names)

    added_count = 0
    removed_count = 0
    updated_count = 0
    
    # Pre-calculate folder images in parallel
    folder_images_map = {}
    
    def scan_folder(name):
        path = attachments_dir / name
        images = []
        try:
            # Single pass iteration instead of multiple globs
            valid_exts = {'.png', '.jpg', '.jpeg', '.webp'}
            for entry in path.iterdir():
                if entry.is_file() and entry.suffix.lower() in valid_exts:
                    img_url = f"http://127.0.0.1:8000/images/{name}/{entry.name}"
                    images.append(img_url)
            images.sort()
            return name, images
        except Exception as e:
            print(f"[sync] Error scanning folder {name}: {e}")
            return name, []

    # Use thread pool to scan folders
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(scan_folder, name): name for name in actual_folders}
        for future in as_completed(futures):
            name, images = future.result()
            folder_images_map[name] = images

    # Process updates (CPU bound, fast)
    
    # First: Update existing boards
    for folder_name in existing_folders & actual_folders:
        current_images = folder_images_map.get(folder_name, [])
        
        board_idx = folder_to_board_idx[folder_name]
        existing_images = set(boards[board_idx].get("images", []))
        
        # Check if there are new images
        if set(current_images) != existing_images:
            boards[board_idx]["images"] = current_images
            updated_count += 1
            # print(f"[sync] Updated board: {folder_name}")

    # Then: Add new boards
    for folder_name in actual_folders - existing_folders:
        images = folder_images_map.get(folder_name, [])
        
        if images:
            # Strip timestamp suffix
            clean_name = re.sub(r'_\d{8}_\d{6}$', '', folder_name)
            topic = clean_name.replace("-", " ").replace("_", " ").title()
            
            new_board = {
                "id": int(datetime.now().timestamp() * 1000) + added_count,
                "topic": topic,
                "images": images,
                "slides": [],
                "caption": "",
                "hashtags": [],
                "createdAt": datetime.now().isoformat(),
                "synced": True
            }
            boards.append(new_board)
            added_count += 1
            print(f"[sync] Added board: {folder_name}")

    # Finally: Remove boards for missing folders
    boards_to_keep = []
    for board in boards:
        images = board.get("images", [])
        if not images:
            boards_to_keep.append(board)
            continue
            
        # Check first image's folder
        item_kept = True
        try:
            first_url = images[0]
            path_parts = urlparse(first_url).path.split('/')
            if 'images' in path_parts:
                idx = path_parts.index('images')
                if idx + 1 < len(path_parts):
                    folder_name = path_parts[idx + 1]
                    if folder_name not in actual_folders:
                        removed_count += 1
                        item_kept = False
        except Exception:
            pass
            
        if item_kept:
            boards_to_keep.append(board)

    # Save updated boards
    if added_count > 0 or removed_count > 0 or updated_count > 0:
        save_boards("images", boards_to_keep)

    total_images_count = sum(len(b.get("images", [])) for b in boards_to_keep)

    return {
        "added": added_count,
        "removed": removed_count,
        "updated": updated_count,
        "total_boards": len(boards_to_keep),
        "total_folders": len(actual_folders),
        "total_images": total_images_count
    }


def cleanup_orphaned_attachments() -> int:
    """
    Remove attachment folders that don't have corresponding entries in the gallery.
    Returns the number of orphaned folders removed.
    """
    if not get_vault_path():
        return 0

    attachments_dir = Path(get_vault_path()) / "attachments"
    if not attachments_dir.exists():
        return 0

    # Load all image boards
    boards = load_boards("images")

    # Extract all folder names from image URLs
    valid_folders = set()
    for board in boards:
        images = board.get("images", [])
        for img_url in images:
            try:
                path_parts = urlparse(img_url).path.split('/')
                if 'images' in path_parts:
                    idx = path_parts.index('images')
                    if idx + 1 < len(path_parts):
                        valid_folders.add(path_parts[idx + 1])
            except Exception:
                pass

    # Find and remove orphaned folders
    removed_count = 0
    for folder in attachments_dir.iterdir():
        if folder.is_dir() and folder.name not in valid_folders:
            try:
                shutil.rmtree(folder)
                print(f"[boards] Removed orphaned attachment folder: {folder.name}")
                removed_count += 1
            except Exception as e:
                print(f"[boards] Error removing orphaned folder {folder.name}: {e}")

    return removed_count
