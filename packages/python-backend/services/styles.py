"""
Styles service - manage visual styles and extract styles from reference images.
Supports vault-based storage like Obsidian themes.
"""

import os
import json
import base64
from pathlib import Path
from PIL import Image
from io import BytesIO
from config import BACKEND_DIR
from .clients import gemini_client

# Legacy styles storage file (used when no vault is set)
LEGACY_STYLES_FILE = os.path.join(BACKEND_DIR, "custom_styles.json")

# Vault path (set dynamically by main.py)
VAULT_PATH = None


def set_vault_path(path):
    """Set the vault path for styles storage."""
    global VAULT_PATH
    VAULT_PATH = path


def get_styles_dir():
    """Get the styles directory path."""
    if VAULT_PATH:
        styles_dir = Path(VAULT_PATH) / "styles"
        styles_dir.mkdir(exist_ok=True)
        return styles_dir
    return None


def slugify(text):
    """Convert text to a valid filename slug."""
    import re
    clean = re.sub(r'[^\w\s-]', '', text.lower())
    clean = re.sub(r'[-\s]+', '-', clean).strip('-')
    return clean[:50] if clean else 'untitled'


# Predefined styles with full JSON structure
PREDEFINED_STYLES = {
    "cinematic": {
        "id": "cinematic",
        "name": "Cinematic",
        "art_style": "cinematic film photography with dramatic composition",
        "color_palette": "rich blacks #1a1a1a, warm highlights #f5d6a8, deep shadows #2d2d2d, accent gold #d4af37",
        "lighting": "dramatic chiaroscuro lighting with strong contrast and rim lights",
        "texture": "film grain, smooth gradients, soft focus backgrounds",
        "typography_style": "bold sans-serif in white with subtle drop shadow",
        "background_style": "depth-of-field blur with bokeh highlights"
    },
    "vintage": {
        "id": "vintage",
        "name": "Vintage",
        "art_style": "retro vintage illustration with aged paper aesthetic",
        "color_palette": "sepia brown #8B7355, cream white #FFFDD0, faded red #CD5C5C, antique gold #CFB53B",
        "lighting": "soft diffused warm lighting like old photographs",
        "texture": "weathered paper, slight vignette, film scratches",
        "typography_style": "serif typewriter font in dark brown with ink stamp effect",
        "background_style": "aged parchment with subtle stains and fold marks"
    },
    "cyberpunk": {
        "id": "cyberpunk",
        "name": "Cyberpunk",
        "art_style": "neon-lit cyberpunk digital art with futuristic elements",
        "color_palette": "electric cyan #00FFFF, hot magenta #FF00FF, deep purple #4B0082, neon pink #FF1493",
        "lighting": "neon glow with harsh shadows, holographic reflections",
        "texture": "chrome surfaces, rain-slicked streets, digital glitch effects",
        "typography_style": "futuristic angular font in neon colors with glow effect",
        "background_style": "dark urban cityscape with neon signs and rain"
    },
    "minimalist": {
        "id": "minimalist",
        "name": "Minimalist",
        "art_style": "clean minimalist design with ample white space",
        "color_palette": "pure white #FFFFFF, charcoal black #36454F, accent blue #4169E1, soft gray #D3D3D3",
        "lighting": "soft even lighting with minimal shadows",
        "texture": "smooth flat surfaces, subtle gradients",
        "typography_style": "thin modern sans-serif in black, left-aligned",
        "background_style": "solid white or very subtle gradient"
    },
    "watercolor": {
        "id": "watercolor",
        "name": "Watercolor",
        "art_style": "soft watercolor painting with organic brush strokes",
        "color_palette": "soft pink #FFB6C1, sky blue #87CEEB, mint green #98FB98, lavender #E6E6FA",
        "lighting": "soft natural daylight with gentle shadows",
        "texture": "watercolor paper grain, paint bleeds, soft edges",
        "typography_style": "handwritten script in dark ink with watercolor splash",
        "background_style": "wet-on-wet watercolor wash with organic shapes"
    },
    "dark_fantasy": {
        "id": "dark_fantasy",
        "name": "Dark Fantasy",
        "art_style": "gothic dark fantasy illustration with mystical elements",
        "color_palette": "midnight blue #191970, blood red #8B0000, silver #C0C0C0, emerald #50C878",
        "lighting": "dramatic moonlight with ethereal glows and deep shadows",
        "texture": "stone, mist, ancient runes, magical particles",
        "typography_style": "ornate gothic font in silver with subtle glow",
        "background_style": "misty dark forests or ancient castle ruins"
    },
    "pop_art": {
        "id": "pop_art",
        "name": "Pop Art",
        "art_style": "bold pop art style with comic book influence",
        "color_palette": "primary red #FF0000, yellow #FFFF00, blue #0000FF, black #000000",
        "lighting": "flat bold lighting with strong outlines",
        "texture": "halftone dots, bold outlines, flat color fills",
        "typography_style": "comic book style bold letters with outline",
        "background_style": "bright solid colors or halftone patterns"
    },
    "anime": {
        "id": "anime",
        "name": "Anime",
        "art_style": "Japanese anime illustration style with vibrant colors",
        "color_palette": "sakura pink #FFB7C5, ocean blue #0077BE, sunset orange #FF7F50, grass green #7CFC00",
        "lighting": "cel-shaded lighting with dramatic highlights",
        "texture": "smooth anime cel shading, speed lines for action",
        "typography_style": "bold Japanese-inspired font with dynamic angles",
        "background_style": "detailed anime backgrounds with dramatic skies"
    },
    "nature": {
        "id": "nature",
        "name": "Nature",
        "art_style": "photorealistic nature photography with vivid details",
        "color_palette": "forest green #228B22, earth brown #8B4513, sky blue #87CEEB, sunset gold #FFD700",
        "lighting": "golden hour natural sunlight with warm tones",
        "texture": "organic textures, leaves, bark, water ripples",
        "typography_style": "clean sans-serif in white with nature-inspired accent",
        "background_style": "lush natural landscapes with depth"
    },
    "neon_glow": {
        "id": "neon_glow",
        "name": "Neon Glow",
        "art_style": "vibrant neon aesthetic with glowing elements",
        "color_palette": "neon green #39FF14, electric blue #7DF9FF, hot pink #FF69B4, purple #9400D3",
        "lighting": "intense neon glow against dark backgrounds",
        "texture": "smooth glass, reflective surfaces, light trails",
        "typography_style": "neon tube font with bright glow and reflection",
        "background_style": "dark void with neon light sources"
    }
}


def get_predefined_styles():
    """Get all predefined styles as a list."""
    return list(PREDEFINED_STYLES.values())


def get_style_by_id(style_id):
    """Get a specific style by ID."""
    # Check predefined first
    if style_id in PREDEFINED_STYLES:
        return PREDEFINED_STYLES[style_id]

    # Check custom styles
    custom_styles = load_custom_styles()
    for style in custom_styles:
        if style.get('id') == style_id:
            return style

    return None


def load_custom_styles():
    """Load custom styles from vault or legacy file."""
    styles_dir = get_styles_dir()

    # If vault is set, load from vault's styles folder
    if styles_dir and styles_dir.exists():
        styles = []
        for json_file in styles_dir.glob("*.json"):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    style = json.load(f)
                    style['_filename'] = json_file.name
                    styles.append(style)
            except Exception as e:
                print(f"[styles] Failed to load {json_file}: {e}")
        return styles

    # Fallback to legacy file
    if os.path.exists(LEGACY_STYLES_FILE):
        try:
            with open(LEGACY_STYLES_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"[styles] Failed to load custom styles: {e}")

    return []


def save_custom_style(style):
    """Save a custom style to vault or legacy file."""
    styles_dir = get_styles_dir()

    # Add ID if not present
    if 'id' not in style:
        import time
        style['id'] = f"custom_{int(time.time() * 1000)}"

    # If vault is set, save as individual JSON file
    if styles_dir:
        # Generate filename from style name
        name = style.get('name', 'Custom Style')
        filename = f"{slugify(name)}.json"

        # Handle duplicate names
        file_path = styles_dir / filename
        counter = 1
        while file_path.exists():
            # Check if it's the same style (same ID)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    existing = json.load(f)
                    if existing.get('id') == style.get('id'):
                        break  # Same style, will overwrite
            except:
                pass
            filename = f"{slugify(name)}-{counter}.json"
            file_path = styles_dir / filename
            counter += 1

        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(style, f, indent=2)
            print(f"[styles] Saved style to vault: {filename}")
            style['_filename'] = filename
            return style
        except Exception as e:
            print(f"[styles] Failed to save style to vault: {e}")
            raise

    # Fallback to legacy file
    styles = load_custom_styles()

    # Check if style with same ID exists, update it
    existing_idx = next((i for i, s in enumerate(styles) if s['id'] == style['id']), None)
    if existing_idx is not None:
        styles[existing_idx] = style
    else:
        styles.append(style)

    try:
        with open(LEGACY_STYLES_FILE, 'w') as f:
            json.dump(styles, f, indent=2)
        print(f"[styles] Saved custom style: {style.get('name', style['id'])}")
        return style
    except Exception as e:
        print(f"[styles] Failed to save custom style: {e}")
        raise


def delete_custom_style(style_id):
    """Delete a custom style by ID."""
    styles_dir = get_styles_dir()

    # If vault is set, find and delete the file
    if styles_dir and styles_dir.exists():
        for json_file in styles_dir.glob("*.json"):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    style = json.load(f)
                    if style.get('id') == style_id:
                        json_file.unlink()
                        print(f"[styles] Deleted style from vault: {json_file.name}")
                        return True
            except Exception as e:
                print(f"[styles] Error checking {json_file}: {e}")
        return False

    # Fallback to legacy file
    styles = load_custom_styles()
    new_styles = [s for s in styles if s['id'] != style_id]

    if len(new_styles) == len(styles):
        return False  # Style not found

    try:
        with open(LEGACY_STYLES_FILE, 'w') as f:
            json.dump(new_styles, f, indent=2)
        print(f"[styles] Deleted custom style: {style_id}")
        return True
    except Exception as e:
        print(f"[styles] Failed to delete custom style: {e}")
        return False


def extract_style_from_image(image_data, name="Custom Style"):
    """
    Extract visual style from a reference image using Gemini Vision.
    Returns a style object in the standard JSON format.
    """
    print(f"[styles] Extracting style from image...")

    if not gemini_client:
        raise ValueError("Gemini client not initialized")

    # Convert image to base64
    base64_image = base64.b64encode(image_data).decode('utf-8')

    # Detect image type
    try:
        img = Image.open(BytesIO(image_data))
        img_format = img.format.lower() if img.format else 'jpeg'
        mime_type = f"image/{img_format}"
    except:
        mime_type = "image/jpeg"

    prompt = """Analyze this image and extract its visual style for use in AI image generation.

Provide a detailed JSON style definition with these exact fields:
1. art_style: Overall artistic style (e.g., "cinematic photography", "watercolor illustration", "digital art")
2. color_palette: 3-4 dominant colors with hex codes (e.g., "deep blue #1a237e, warm gold #ffd54f, soft cream #fff8e1")
3. lighting: Lighting style and mood (e.g., "soft diffused daylight", "dramatic rim lighting")
4. texture: Surface qualities and textures present (e.g., "smooth gradients", "rough brush strokes", "film grain")
5. typography_style: Suggested text style that would match (e.g., "bold sans-serif in white", "elegant serif in gold")
6. background_style: Background treatment (e.g., "soft blur bokeh", "solid dark gradient", "detailed environment")

Return ONLY a valid JSON object, no markdown, no explanation.

Example output:
{
    "art_style": "moody cinematic photography with dramatic shadows",
    "color_palette": "midnight blue #1a237e, amber gold #ffc107, charcoal #37474f, cream #fffde7",
    "lighting": "dramatic side lighting with strong shadows and warm highlights",
    "texture": "film grain, soft focus edges, subtle vignette",
    "typography_style": "bold condensed sans-serif in white with subtle shadow",
    "background_style": "deep out-of-focus dark tones with light leak accents"
}"""

    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.0-flash',
            contents=[
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": base64_image
                            }
                        }
                    ]
                }
            ]
        )

        text = response.text.strip()
        # Clean up response
        text = text.replace("```json", "").replace("```", "").strip()

        style = json.loads(text)

        # Add metadata
        import time
        style['id'] = f"extracted_{int(time.time() * 1000)}"
        style['name'] = name
        style['is_custom'] = True
        style['is_extracted'] = True

        print(f"[styles] Extracted style: {style.get('art_style', 'Unknown')[:50]}...")
        return style

    except json.JSONDecodeError as e:
        print(f"[styles] Failed to parse style JSON: {e}")
        # Return a fallback style
        import time
        return {
            "id": f"extracted_{int(time.time() * 1000)}",
            "name": name,
            "is_custom": True,
            "is_extracted": True,
            "art_style": "custom extracted style",
            "color_palette": "extracted colors from reference image",
            "lighting": "lighting style from reference",
            "texture": "texture qualities from reference",
            "typography_style": "complementary typography",
            "background_style": "background style from reference"
        }
    except Exception as e:
        print(f"[styles] Style extraction failed: {e}")
        raise
