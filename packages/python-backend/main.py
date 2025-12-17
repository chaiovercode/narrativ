"""
Narrativ Backend API
FastAPI server for the AI-powered story generation service.
Designed for desktop app integration with Tauri.
"""

import os
import datetime
import traceback
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import uvicorn

from dotenv import load_dotenv

# Load environment variables from .env file (fallback for dev)
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

# Dynamic port for Tauri integration (defaults to 8000)
PORT = int(os.getenv("NARRATIV_PORT", "8000"))

# Import from modular services
from config import OUTPUT_DIR as CONFIG_OUTPUT_DIR, BRAND_DIR
from services import (
    research_story_concept,
    generate_story_from_plan,
    create_story_series,
    get_trending_topics,
    fetch_rss_topics,
    get_rss_story_topics,
    get_brand_config,
    save_brand_config,
    create_slides_from_text,
    get_predefined_styles,
    load_custom_styles,
    save_custom_style,
    delete_custom_style,
    extract_style_from_image,
)
from services.image import generate_story_from_plan_parallel
from services.consistency import generate_story_characters
from services.brand import get_brands, save_brand, delete_brand, get_brand_by_id
from services.boards import load_boards, add_board, delete_board, update_board, set_vault_path as set_boards_vault_path, cleanup_orphaned_attachments, sync_attachments_with_boards
from services.styles import set_vault_path as set_styles_vault_path
from services.notes import (
    load_notes,
    load_folders,
    save_note,
    delete_note as delete_note_service,
    get_note_by_id,
    create_folder,
    delete_folder,
    rename_folder,
    move_folder,
    move_note,
    set_vault_path as set_notes_vault_path
)

# =============================================================================
# APP SETUP
# =============================================================================

app = FastAPI(
    title="Narrativ API",
    description="AI-powered visual story creation for social media",
    version="1.0.0"
)

# CORS for Tauri desktop app and web development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "tauri://localhost",           # Tauri desktop app
        "http://localhost:5173",       # Vite dev server
        "http://localhost:*",          # Any localhost port
        "http://127.0.0.1:*",          # Alternative localhost
        "*",                           # Fallback for development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Output directory setup
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BACKEND_DIR, "generated_stories")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Vault path (set by Tauri app)
VAULT_PATH = None

# Dynamic image serving (supports vault path changes)
@app.get("/images/{folder}/{filename}")
async def serve_image(folder: str, filename: str):
    """Serve generated images from OUTPUT_DIR (supports vault)."""
    file_path = os.path.join(OUTPUT_DIR, folder, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="image/png")
    raise HTTPException(status_code=404, detail="Image not found")


# =============================================================================
# REQUEST MODELS
# =============================================================================

class StoryRequest(BaseModel):
    topic: str
    num_slides: int = 5
    aesthetic: str = ""
    image_size: str = "story"  # 'story' (9:16) or 'square' (1:1)


class TextToSlidesRequest(BaseModel):
    text: str
    topic: str = "Custom Content"
    num_slides: int = 5
    aesthetic: str = ""
    image_size: str = "story"


class GenerateFromPlanRequest(BaseModel):
    plan: dict
    provider: str = "gemini-flash"  # gemini-flash, gemini-pro, fal
    brand_id: Optional[str] = None  # optional brand ID for watermark


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def create_story_folder(topic: str) -> tuple[str, str]:
    """Creates a unique folder for story output. Returns (folder_name, full_path)."""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_topic = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in topic)[:20].strip()
    folder_name = f"{safe_topic}_{timestamp}"
    full_path = os.path.join(OUTPUT_DIR, folder_name)
    return folder_name, full_path


def files_to_urls(file_paths: list, folder_name: str) -> list:
    """Converts file paths to serving URLs."""
    return [
        f"http://localhost:{PORT}/images/{folder_name}/{os.path.basename(f)}"
        for f in file_paths
    ]


# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "Story Generator API"}


# =============================================================================
# VAULT ENDPOINTS
# =============================================================================

class VaultRequest(BaseModel):
    path: str

@app.post("/vault/set")
async def set_vault(request: VaultRequest):
    """
    Set the vault path for file storage.
    Called by Tauri when vault is selected.
    """
    global VAULT_PATH, OUTPUT_DIR

    if not os.path.isdir(request.path):
        raise HTTPException(status_code=400, detail="Invalid vault path")

    VAULT_PATH = request.path

    # Notify services of vault path
    set_boards_vault_path(request.path)
    set_styles_vault_path(request.path)
    set_notes_vault_path(request.path)

    # Update output directory to vault attachments
    attachments_dir = os.path.join(VAULT_PATH, "attachments")
    os.makedirs(attachments_dir, exist_ok=True)
    OUTPUT_DIR = attachments_dir

    # Create research directory
    research_dir = os.path.join(VAULT_PATH, "research")
    os.makedirs(research_dir, exist_ok=True)

    # Create styles directory
    styles_dir = os.path.join(VAULT_PATH, "styles")
    os.makedirs(styles_dir, exist_ok=True)

    # Create notes directory
    notes_dir = os.path.join(VAULT_PATH, "notes")
    os.makedirs(notes_dir, exist_ok=True)

    # Sync attachments folder with image boards
    sync_result = sync_attachments_with_boards()
    if sync_result.get("added", 0) > 0 or sync_result.get("removed", 0) > 0:
        print(f"[vault] Synced attachments: {sync_result.get('added', 0)} added, {sync_result.get('removed', 0)} removed")

    return {
        "status": "ok",
        "vault_path": VAULT_PATH,
        "attachments_dir": OUTPUT_DIR,
        "research_dir": research_dir,
        "styles_dir": styles_dir,
        "notes_dir": notes_dir,
        "sync_result": sync_result
    }

@app.get("/vault")
async def get_vault():
    """Get current vault configuration."""
    return {
        "vault_path": VAULT_PATH,
        "attachments_dir": OUTPUT_DIR if VAULT_PATH else None
    }


@app.post("/vault/cleanup")
async def cleanup_vault():
    """Clean up orphaned attachment folders that don't have gallery entries."""
    if not VAULT_PATH:
        raise HTTPException(status_code=400, detail="No vault configured")

    removed_count = cleanup_orphaned_attachments()
    return {
        "status": "ok",
        "orphaned_attachments_removed": removed_count
    }


@app.post("/vault/sync")
async def sync_vault():
    """
    Comprehensive sync of all vault folders with the app.
    - Syncs attachments folder with image boards
    - Reloads research from markdown files
    - Reloads notes from markdown files
    - Reloads custom styles from JSON files
    """
    if not VAULT_PATH:
        raise HTTPException(status_code=400, detail="No vault configured")

    result = {
        "status": "ok",
        "attachments": {},
        "research": {},
        "notes": {},
        "styles": {}
    }

    # Sync attachments with image boards
    attachments_result = sync_attachments_with_boards()
    result["attachments"] = attachments_result

    # Count research files
    research_dir = os.path.join(VAULT_PATH, "research")
    if os.path.exists(research_dir):
        research_files = list(Path(research_dir).glob("*.md"))
        result["research"] = {"count": len(research_files), "path": research_dir}

    # Count notes
    notes_dir = os.path.join(VAULT_PATH, "notes")
    if os.path.exists(notes_dir):
        note_files = list(Path(notes_dir).glob("*.md"))
        result["notes"] = {"count": len(note_files), "path": notes_dir}

    # Count styles
    styles_dir = os.path.join(VAULT_PATH, "styles")
    if os.path.exists(styles_dir):
        style_files = list(Path(styles_dir).glob("*.json"))
        result["styles"] = {"count": len(style_files), "path": styles_dir}

    print(f"[vault/sync] Synced: {result['attachments'].get('added', 0)} images added, "
          f"{result['research'].get('count', 0)} research, "
          f"{result['notes'].get('count', 0)} notes, "
          f"{result['styles'].get('count', 0)} styles")

    return result


@app.get("/rss_topics")
async def rss_topics(category: str = None):
    """
    Get news topics from RSS feeds.
    Optional category: tech, world, india, business, science
    Returns full entries with title, summary, link, source.
    """
    try:
        entries = fetch_rss_topics(category, limit=10)
        return {"category": category or "all", "topics": entries}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/brand")
async def get_brand():
    """Get brand kit configuration."""
    return get_brand_config()


@app.post("/brand")
async def update_brand(config: dict):
    """
    Update brand kit configuration.
    Example: {"enabled": true, "position": "bottom-right", "opacity": 0.7, "padding": 20}
    Positions: bottom-right, bottom-left, top-right, top-left, center
    """
    try:
        save_brand_config(config)
        return {"status": "ok", "config": config}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# MULTI-BRAND ENDPOINTS
# =============================================================================

@app.get("/brands")
async def list_brands():
    """Get all saved brands."""
    try:
        brands = get_brands()
        return {"brands": brands}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/brands")
async def create_or_update_brand(brand_data: dict):
    """Create or update a brand."""
    try:
        saved_brand = save_brand(brand_data)
        return {"status": "ok", "brand": saved_brand}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/brands/{brand_id}")
async def get_single_brand(brand_id: str):
    """Get a specific brand by ID."""
    try:
        brand = get_brand_by_id(brand_id)
        if brand is None:
            raise HTTPException(status_code=404, detail="Brand not found")
        return brand
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/brands/{brand_id}")
async def remove_brand(brand_id: str):
    """Delete a brand by ID."""
    try:
        success = delete_brand(brand_id)
        if not success:
            raise HTTPException(status_code=404, detail="Brand not found")
        return {"status": "ok", "deleted": brand_id}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/trending_topics")
async def trending_topics(categories: str):
    """
    Get trending topic suggestions for one or more categories.
    Pass multiple categories comma-separated: ?categories=tech,ai
    Accepts any category/topic string.
    """
    # Parse comma-separated categories
    category_list = [c.strip().lower() for c in categories.split(',') if c.strip()]

    if not category_list:
        raise HTTPException(status_code=400, detail="At least one category is required")

    try:
        topics = get_trending_topics(category_list)
        return {"categories": category_list, "topics": topics}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/plan_story")
async def plan_story(request: StoryRequest):
    """
    Phase 1: Research topic and create story plan.
    Returns plan for user review before image generation.
    """
    if not request.topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required")
    if not 1 <= request.num_slides <= 10:
        raise HTTPException(status_code=400, detail="Slides must be between 1-10")

    try:
        plan = research_story_concept(
            topic=request.topic,
            num_slides=request.num_slides,
            user_aesthetic=request.aesthetic or None
        )

        if not plan:
            raise HTTPException(status_code=500, detail="Failed to research topic")

        # Add image_size to the plan
        plan['image_size'] = request.image_size

        return {"plan": plan}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


class AddSlidesRequest(BaseModel):
    topic: str
    existing_slides: list
    additional_count: int
    aesthetic: dict = None


@app.post("/add_slides")
async def add_slides(request: AddSlidesRequest):
    """
    Add more slides to existing research.
    Continues from existing slides, up to max 10 total.
    """
    if not request.topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required")

    existing_count = len(request.existing_slides)
    if existing_count >= 10:
        raise HTTPException(status_code=400, detail="Maximum 10 slides reached")

    max_additional = 10 - existing_count
    additional_count = min(request.additional_count, max_additional)

    if additional_count <= 0:
        raise HTTPException(status_code=400, detail="No slides to add")

    try:
        from services.research import add_slides_to_research

        result = add_slides_to_research(
            topic=request.topic,
            existing_slides=request.existing_slides,
            additional_count=additional_count,
            aesthetic=request.aesthetic
        )

        if not result:
            raise HTTPException(status_code=500, detail="Failed to add slides")

        return {
            "slides": result['slides'],
            "new_sources": result.get('new_sources', [])
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/plan_from_text")
async def plan_from_text(request: TextToSlidesRequest):
    """
    Create story plan from user-provided text (no web research).
    Uses Gemini to extract key facts and create slides from pasted content.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text content is required")
    if not 1 <= request.num_slides <= 10:
        raise HTTPException(status_code=400, detail="Slides must be between 1-10")

    try:
        plan = create_slides_from_text(
            text=request.text,
            topic=request.topic or "Custom Content",
            num_slides=request.num_slides,
            user_aesthetic=request.aesthetic or None
        )

        if not plan:
            raise HTTPException(status_code=500, detail="Failed to create slides from text")

        # Add image_size to the plan
        plan['image_size'] = request.image_size

        return {"plan": plan}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate_from_plan")
async def generate_from_plan(request: GenerateFromPlanRequest):
    """
    Phase 2: Generate images from approved plan.
    Returns URLs to generated images.
    Optionally applies brand watermark if brand_id is provided.

    Features:
    - Parallel generation (3 slides at once)
    - Character/style consistency across slides
    - Seed-based style consistency for fal.ai
    - Retry logic for rate limits
    """
    if not request.plan or 'topic' not in request.plan:
        raise HTTPException(status_code=400, detail="Valid plan is required")

    try:
        folder_name, output_path = create_story_folder(request.plan['topic'])

        # Generate consistency data for visual coherence across slides
        consistency_data = None
        if len(request.plan.get('slides', [])) > 1:
            consistency_data = generate_story_characters(
                request.plan['topic'],
                request.plan['slides'],
                request.plan.get('aesthetic', {})
            )

        # Use parallel generation with consistency
        generated_files = generate_story_from_plan_parallel(
            request.plan,
            output_dir=output_path,
            provider=request.provider,
            brand_id=request.brand_id,
            consistency_data=consistency_data
        )

        return {"images": files_to_urls(generated_files, folder_name)}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Deprecated monolithic endpoint
@app.post("/generate")
async def generate_story(request: StoryRequest):
    """
    Single-call endpoint: Research and generate in one request.
    Combines both phases for simpler integration.
    """
    if not request.topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required")
    if not 1 <= request.num_slides <= 10:
        raise HTTPException(status_code=400, detail="Slides must be between 1-10")

    try:
        folder_name, output_path = create_story_folder(request.topic)

        generated_files = create_story_series(
            topic=request.topic,
            num_slides=request.num_slides,
            user_aesthetic=request.aesthetic or None,
            output_dir=output_path
        )

        return {"images": files_to_urls(generated_files, folder_name)}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# STYLES ENDPOINTS
# =============================================================================

@app.get("/styles")
async def get_styles():
    """
    Get all available styles (predefined + custom).
    Returns both predefined styles and user-saved custom styles.
    """
    try:
        predefined = get_predefined_styles()
        custom = load_custom_styles()
        return {
            "predefined": predefined,
            "custom": custom
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/styles")
async def create_style(style: dict):
    """
    Save a custom style.
    Required fields: name, art_style, color_palette, lighting, texture, typography_style, background_style
    """
    required_fields = ['name', 'art_style', 'color_palette', 'lighting', 'texture', 'typography_style', 'background_style']
    missing = [f for f in required_fields if f not in style]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required fields: {', '.join(missing)}")

    try:
        saved = save_custom_style(style)
        return {"status": "ok", "style": saved}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/styles/{style_id}")
async def remove_style(style_id: str):
    """Delete a custom style by ID."""
    try:
        success = delete_custom_style(style_id)
        if not success:
            raise HTTPException(status_code=404, detail="Style not found")
        return {"status": "ok", "deleted": style_id}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/extract_style")
async def extract_style(
    file: UploadFile = File(...),
    name: Optional[str] = Form("Custom Style")
):
    """
    Extract visual style from a reference image using AI.
    Upload an image file and get back a JSON style definition.
    """
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )

    try:
        # Read image data
        image_data = await file.read()

        # Check file size (max 10MB)
        if len(image_data) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large. Max 10MB.")

        # Extract style
        style = extract_style_from_image(image_data, name)
        return {"status": "ok", "style": style}

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# BOARDS ENDPOINTS (Research & Images persistence)
# =============================================================================

@app.get("/boards/{board_type}")
async def get_boards(board_type: str):
    """
    Get all boards of a given type.
    board_type: 'research' or 'images'
    """
    if board_type not in ['research', 'images']:
        raise HTTPException(status_code=400, detail="board_type must be 'research' or 'images'")

    try:
        boards = load_boards(board_type)
        return {"boards": boards}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/boards/{board_type}")
async def create_board(board_type: str, board: dict):
    """
    Save a new board.
    board_type: 'research' or 'images'
    """
    if board_type not in ['research', 'images']:
        raise HTTPException(status_code=400, detail="board_type must be 'research' or 'images'")

    if not board.get('id'):
        raise HTTPException(status_code=400, detail="Board must have an 'id' field")

    try:
        saved = add_board(board_type, board)
        return {"status": "ok", "board": saved}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/boards/{board_type}/{board_id}")
async def remove_board(board_type: str, board_id: int):
    """
    Delete a board by ID.
    board_type: 'research' or 'images'
    """
    if board_type not in ['research', 'images']:
        raise HTTPException(status_code=400, detail="board_type must be 'research' or 'images'")

    try:
        success = delete_board(board_type, board_id)
        if not success:
            raise HTTPException(status_code=404, detail="Board not found")
        return {"status": "ok", "deleted": board_id}
    except HTTPException:
        raise


@app.put("/boards/{board_type}/{board_id}")
async def update_board_endpoint(board_type: str, board_id: int, board: dict):
    """
    Update an existing board.
    board_type: 'research' or 'images'
    """
    if board_type not in ['research', 'images']:
        raise HTTPException(status_code=400, detail="board_type must be 'research' or 'images'")

    try:
        updated = update_board(board_type, board_id, board)
        if not updated:
            raise HTTPException(status_code=404, detail="Board not found")
        return {"status": "ok", "board": updated}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# NOTES ENDPOINTS
# =============================================================================

@app.get("/notes")
async def get_notes():
    """Get all notes from the vault."""
    try:
        notes = load_notes()
        return {"notes": notes}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/notes/{note_id}")
async def get_note(note_id: str):
    """Get a single note by ID."""
    try:
        note = get_note_by_id(note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        return note
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/notes")
async def create_or_update_note(note: dict):
    """Create or update a note."""
    if not note.get('title'):
        raise HTTPException(status_code=400, detail="Title is required")

    try:
        saved = save_note(note)
        return {"status": "ok", "note": saved}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/notes/{note_id}")
async def remove_note(note_id: str):
    """Delete a note by ID."""
    try:
        success = delete_note_service(note_id)
        if not success:
            raise HTTPException(status_code=404, detail="Note not found")
        return {"status": "ok", "deleted": note_id}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/notes/{note_id}/move")
async def move_note_to_folder(note_id: str, data: dict):
    """Move a note to a different folder."""
    try:
        folder = data.get('folder', '')
        note = move_note(note_id, folder)
        return {"status": "ok", "note": note}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# FOLDERS ENDPOINTS
# =============================================================================

@app.get("/folders")
async def get_folders():
    """Get all folders from the notes directory."""
    try:
        folders = load_folders()
        return {"folders": folders}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/folders")
async def create_new_folder(data: dict):
    """Create a new folder."""
    name = data.get('name')
    if not name:
        raise HTTPException(status_code=400, detail="Folder name is required")

    parent = data.get('parent', '')

    try:
        folder = create_folder(name, parent)
        return {"status": "ok", "folder": folder}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/folders/{folder_path:path}")
async def remove_folder(folder_path: str):
    """Delete a folder and its contents."""
    try:
        success = delete_folder(folder_path)
        if not success:
            raise HTTPException(status_code=404, detail="Folder not found")
        return {"status": "ok", "deleted": folder_path}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/folders/{folder_path:path}")
async def update_folder(folder_path: str, data: dict):
    """Rename a folder."""
    new_name = data.get('name')
    if not new_name:
        raise HTTPException(status_code=400, detail="New name is required")

    try:
        folder = rename_folder(folder_path, new_name)
        return {"status": "ok", "folder": folder}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/folders/{folder_path:path}/move")
async def move_folder_endpoint(folder_path: str, data: dict):
    """Move a folder to a new parent."""
    new_parent = data.get('parent')

    try:
        folder = move_folder(folder_path, new_parent)
        return {"status": "ok", "folder": folder}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    print("\n🚀 Starting Narrativ API...")
    print(f"📁 Output directory: {OUTPUT_DIR}")
    print(f"🌐 Server: http://localhost:{PORT}")
    print(f"📚 Docs: http://localhost:{PORT}/docs\n")

    uvicorn.run(app, host="127.0.0.1", port=PORT)
