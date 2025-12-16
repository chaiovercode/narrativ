"""
Storage service for research and image boards.
Supports both legacy JSON storage and vault-based markdown storage.
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

# Legacy data directory (used when no vault is set)
DATA_DIR = Path(__file__).parent.parent / "data"
RESEARCH_FILE = DATA_DIR / "research.json"
IMAGES_FILE = DATA_DIR / "images.json"

# Vault path (set dynamically by main.py)
VAULT_PATH: Optional[str] = None


def set_vault_path(path: Optional[str]):
    """Set the vault path for storage."""
    global VAULT_PATH
    VAULT_PATH = path


def get_vault_path() -> Optional[str]:
    """Get the current vault path."""
    return VAULT_PATH


def ensure_data_dir():
    """Ensure legacy data directory and files exist."""
    DATA_DIR.mkdir(exist_ok=True)

    if not RESEARCH_FILE.exists():
        RESEARCH_FILE.write_text("[]")

    if not IMAGES_FILE.exists():
        IMAGES_FILE.write_text("[]")


def get_file_path(board_type: str) -> Path:
    """Get the file path for a board type (legacy JSON storage)."""
    if board_type == "research":
        return RESEARCH_FILE
    elif board_type == "images":
        return IMAGES_FILE
    else:
        raise ValueError(f"Invalid board type: {board_type}")


def slugify(text: str) -> str:
    """Convert text to a valid filename slug."""
    # Remove special characters, keep alphanumeric and spaces
    clean = re.sub(r'[^\w\s-]', '', text.lower())
    # Replace spaces with hyphens
    clean = re.sub(r'[-\s]+', '-', clean).strip('-')
    # Limit length
    return clean[:50] if clean else 'untitled'


def board_to_markdown(board: Dict[str, Any]) -> str:
    """Convert a research board to markdown with YAML frontmatter."""
    # Extract metadata
    board_id = board.get('id', int(datetime.now().timestamp() * 1000))
    topic = board.get('topic', 'Untitled')
    style = board.get('selectedStyle', {}).get('name', 'Default') if isinstance(board.get('selectedStyle'), dict) else board.get('selectedStyle', 'Default')
    image_size = board.get('imageSize', 'story')
    created = board.get('createdAt', datetime.now().isoformat())

    # Build frontmatter
    frontmatter = f"""---
id: {board_id}
topic: "{topic}"
style: "{style}"
image_size: "{image_size}"
created: {created}
---
"""

    # Build content
    content = f"# {topic}\n\n"

    # Add slides
    slides = board.get('slides', [])
    for i, slide in enumerate(slides, 1):
        content += f"## Slide {i}: {slide.get('hook', '')}\n\n"
        content += f"**Key Fact**: {slide.get('fact', '')}\n\n"
        content += f"**Visual**: {slide.get('visual', '')}\n\n"
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
        r'## Slide \d+: (.+?)\n\n\*\*Key Fact\*\*: (.+?)\n\n\*\*Visual\*\*: (.+?)\n\n(?:\*\*Mood\*\*: (.+?)\n\n)?',
        body, re.DOTALL
    )
    for match in slide_matches:
        slide = {
            'hook': match[0].strip(),
            'fact': match[1].strip(),
            'visual': match[2].strip(),
        }
        if match[3]:
            slide['mood'] = match[3].strip()
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
    if board_type == "research" and VAULT_PATH:
        research_dir = Path(VAULT_PATH) / "research"
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
    """Save all boards of a given type (legacy JSON only)."""
    ensure_data_dir()
    file_path = get_file_path(board_type)

    with open(file_path, "w") as f:
        json.dump(boards, f, indent=2)


def add_board(board_type: str, board: Dict[str, Any]) -> Dict[str, Any]:
    """Add a new board and return it."""

    # For research boards with vault, save as markdown
    if board_type == "research" and VAULT_PATH:
        research_dir = Path(VAULT_PATH) / "research"
        research_dir.mkdir(exist_ok=True)

        # Generate filename from topic
        topic = board.get('topic', 'untitled')
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
    boards.insert(0, board)

    # Limit to 100 boards per type
    boards = boards[:100]

    save_boards(board_type, boards)
    return board


def delete_board(board_type: str, board_id: int) -> bool:
    """Delete a board by ID. Returns True if deleted."""

    # For research boards with vault, delete markdown file
    if board_type == "research" and VAULT_PATH:
        research_dir = Path(VAULT_PATH) / "research"
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
