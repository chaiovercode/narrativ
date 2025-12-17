"""
Image generation service - generates story images using multiple providers.
"""

import os
import datetime
import random
import time
import requests
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, Tuple
from PIL import Image, ImageDraw, ImageFont
from google.genai import types
from config import OUTPUT_DIR
from .clients import gemini_client, fal_client
from .brand import get_brand_config, apply_watermark, get_brand_by_id


# Quality constraints to avoid common AI image failures
QUALITY_CONSTRAINTS = """
<AVOID_IN_IMAGE>
DO NOT generate any of these common AI failures:
- Blurry, illegible, misspelled, or distorted text
- Extra fingers, deformed hands, anatomical errors
- Watermarks, signatures, logos, or artist stamps
- Low quality, pixelated, JPEG artifacts, or compression noise
- Floating objects or disconnected/disembodied elements
- Duplicate body parts, merged figures, or conjoined limbs
- Text with gibberish characters or random letters
- Wrong aspect ratio, stretched, or squished content
- Uncanny valley faces or plastic-looking skin
- Overly busy backgrounds that compete with the subject
</AVOID_IN_IMAGE>
"""

# Parallel generation settings
MAX_PARALLEL_WORKERS = 3
RETRY_MAX_ATTEMPTS = 3
RETRY_BASE_DELAY = 2.0

# Text overlay settings
# Set to False to let AI render text natively (works well for comic, pop art, cinematic styles)
# Set to True to always add PIL text overlay (more reliable but less integrated)
TEXT_OVERLAY_ENABLED = False  # Default: let AI render text
TITLE_FONT_SIZE_RATIO = 0.045  # Title font as % of image height
FACT_FONT_SIZE_RATIO = 0.032  # Fact font as % of image height


def _get_system_font(bold: bool = False) -> str:
    """Get available system font path for PIL."""
    # macOS fonts
    mac_fonts = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
    ]
    # Linux fonts
    linux_fonts = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]

    for font_path in mac_fonts + linux_fonts:
        if os.path.exists(font_path):
            return font_path
    return None


def _wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int, draw: ImageDraw.Draw) -> list:
    """Wrap text to fit within max_width, returning list of lines."""
    words = text.split()
    lines = []
    current_line = []

    for word in words:
        test_line = ' '.join(current_line + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        line_width = bbox[2] - bbox[0]

        if line_width <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(' '.join(current_line))
            current_line = [word]

    if current_line:
        lines.append(' '.join(current_line))

    return lines


def _apply_text_overlay(image: Image.Image, slide: dict, aesthetic: dict) -> Image.Image:
    """
    Apply text overlay to image using PIL.
    Adds title at top and key_fact at bottom with style-appropriate formatting.
    """
    if not TEXT_OVERLAY_ENABLED:
        return image

    title = slide.get('title', '')
    key_fact = slide.get('key_fact', '')

    if not title and not key_fact:
        return image

    # Create a copy to draw on
    img = image.copy()
    draw = ImageDraw.Draw(img)
    width, height = img.size

    # Calculate font sizes based on image dimensions
    title_font_size = max(24, int(height * TITLE_FONT_SIZE_RATIO))
    fact_font_size = max(18, int(height * FACT_FONT_SIZE_RATIO))

    # Get fonts
    bold_font_path = _get_system_font(bold=True)
    regular_font_path = _get_system_font(bold=False)

    try:
        title_font = ImageFont.truetype(bold_font_path or regular_font_path, title_font_size) if bold_font_path or regular_font_path else ImageFont.load_default()
        fact_font = ImageFont.truetype(regular_font_path or bold_font_path, fact_font_size) if regular_font_path or bold_font_path else ImageFont.load_default()
    except Exception:
        title_font = ImageFont.load_default()
        fact_font = ImageFont.load_default()

    padding = int(width * 0.05)  # 5% padding
    max_text_width = width - (padding * 2)

    # Draw title at top with gradient background
    if title:
        title_lines = _wrap_text(title.upper(), title_font, max_text_width, draw)

        # Calculate title area height
        line_height = title_font_size + 8
        title_area_height = (len(title_lines) * line_height) + (padding * 2)

        # Draw semi-transparent gradient at top
        gradient_overlay = Image.new('RGBA', (width, title_area_height), (0, 0, 0, 0))
        gradient_draw = ImageDraw.Draw(gradient_overlay)
        for y in range(title_area_height):
            alpha = int(180 * (1 - y / title_area_height))  # Fade from 180 to 0
            gradient_draw.rectangle([(0, y), (width, y + 1)], fill=(0, 0, 0, alpha))

        img = img.convert('RGBA')
        img.paste(gradient_overlay, (0, 0), gradient_overlay)
        draw = ImageDraw.Draw(img)

        # Draw title text with shadow
        y_offset = padding
        for line in title_lines:
            bbox = draw.textbbox((0, 0), line, font=title_font)
            line_width = bbox[2] - bbox[0]
            x = (width - line_width) // 2  # Center text

            # Draw shadow
            shadow_offset = max(2, title_font_size // 20)
            draw.text((x + shadow_offset, y_offset + shadow_offset), line, font=title_font, fill=(0, 0, 0, 200))
            # Draw text
            draw.text((x, y_offset), line, font=title_font, fill=(255, 255, 255, 255))
            y_offset += line_height

    # Draw key_fact at bottom with gradient background
    if key_fact:
        fact_lines = _wrap_text(key_fact, fact_font, max_text_width, draw)

        # Calculate fact area height
        line_height = fact_font_size + 6
        fact_area_height = (len(fact_lines) * line_height) + (padding * 2)

        # Draw semi-transparent gradient at bottom
        gradient_overlay = Image.new('RGBA', (width, fact_area_height), (0, 0, 0, 0))
        gradient_draw = ImageDraw.Draw(gradient_overlay)
        for y in range(fact_area_height):
            alpha = int(160 * (y / fact_area_height))  # Fade from 0 to 160
            gradient_draw.rectangle([(0, y), (width, y + 1)], fill=(0, 0, 0, alpha))

        img = img.convert('RGBA')
        img.paste(gradient_overlay, (0, height - fact_area_height), gradient_overlay)
        draw = ImageDraw.Draw(img)

        # Draw fact text
        y_offset = height - fact_area_height + padding
        for line in fact_lines:
            bbox = draw.textbbox((0, 0), line, font=fact_font)
            line_width = bbox[2] - bbox[0]
            x = (width - line_width) // 2  # Center text

            # Draw shadow
            shadow_offset = max(1, fact_font_size // 25)
            draw.text((x + shadow_offset, y_offset + shadow_offset), line, font=fact_font, fill=(0, 0, 0, 180))
            # Draw text
            draw.text((x, y_offset), line, font=fact_font, fill=(255, 255, 255, 255))
            y_offset += line_height

    # Convert back to RGB for saving
    if img.mode == 'RGBA':
        # Use a background color sampled from the image center (works for both light and dark images)
        center_x, center_y = width // 2, height // 2
        try:
            bg_color = image.getpixel((center_x, center_y))[:3]  # Original image background
        except:
            bg_color = (0, 0, 0)  # Default to black
        rgb_img = Image.new('RGB', img.size, bg_color)
        rgb_img.paste(img, mask=img.split()[3])
        return rgb_img

    return img


def _get_style_specific_text_instructions(aesthetic: dict) -> str:
    """
    Returns text styling instructions that match the art style.
    Uses both art_style keywords and typography_style from aesthetic dict.
    """
    art_style = aesthetic.get('art_style', '').lower()
    typography_style = aesthetic.get('typography_style', '')

    # Build custom typography hint if available
    typography_hint = ""
    if typography_style:
        typography_hint = f"\nTypography Direction: {typography_style}"

    # ANIME / MANGA / JAPANESE
    if any(k in art_style for k in ['anime', 'manga', 'japanese', 'ghibli', 'shinkai']):
        return f"""TEXT STYLE (Anime/Manga):
- Title: Bold Japanese manga-style impact text, dynamic angle, with speed lines or glow effects
- Fact: Clean white text in a stylized text box with rounded corners
- Add dramatic manga effects: sparkles, motion lines, emphasis marks
- Text should feel like it's from a professional anime poster or Studio Ghibli film{typography_hint}"""

    # COMIC / POP ART / MARVEL
    elif any(k in art_style for k in ['comic', 'pop art', 'marvel', 'dc', 'warhol', 'lichtenstein']):
        return f"""TEXT STYLE (Comic Book/Pop Art):
- Title: BOLD ALL-CAPS comic book lettering with thick black outline, halftone dots behind
- Fact: Speech bubble or caption box style, bold sans-serif
- Add comic effects: Ben-Day dots, action words, bold outlines
- Text should feel like classic Marvel/DC comics or Roy Lichtenstein art{typography_hint}"""

    # CYBERPUNK / NEON / TECH / FUTURISTIC
    elif any(k in art_style for k in ['cyberpunk', 'neon', 'futuristic', 'holographic', 'tech', 'digital', 'blade runner', 'ghost in the shell']):
        return f"""TEXT STYLE (Cyberpunk/Neon):
- Title: Glowing neon text with electric blue/pink glow, holographic effect
- Fact: Digital display style text, like a futuristic HUD interface
- Add tech elements: glitch effects, scan lines, digital noise
- Text should feel like Blade Runner or Ghost in the Shell{typography_hint}"""

    # VINTAGE / RETRO / CLASSIC
    elif any(k in art_style for k in ['vintage', 'retro', 'classic', 'old', '1950', '1960', 'nostalgia', 'antique']):
        return f"""TEXT STYLE (Vintage/Retro):
- Title: Classic vintage typography, serif fonts, aged paper texture
- Fact: Typewriter style or old newspaper headline font
- Add vintage elements: worn edges, sepia tones, film grain
- Text should feel like a 1950s advertisement or old movie poster{typography_hint}"""

    # MINIMAL / CLEAN / CORPORATE / PREMIUM
    elif any(k in art_style for k in ['minimal', 'clean', 'corporate', 'premium', 'business', 'professional', 'bloomberg', 'fortune']):
        return f"""TEXT STYLE (Minimal/Corporate):
- Title: Ultra-clean sans-serif, lots of whitespace, elegant positioning
- Fact: Thin, sophisticated typography with perfect kerning
- Keep text simple and uncluttered, no effects
- Text should feel like high-end magazine, Apple design, or Bloomberg{typography_hint}"""

    # WATERCOLOR / PAINTING / ARTISTIC / EDITORIAL
    elif any(k in art_style for k in ['watercolor', 'painting', 'artistic', 'brush', 'editorial', 'kinfolk']):
        return f"""TEXT STYLE (Artistic/Editorial):
- Title: Hand-lettered brush script, flowing and artistic
- Fact: Elegant serif font that complements the painterly style
- Text should blend with the artwork, feel hand-crafted and premium
- Add subtle artistic touches that complement the style{typography_hint}"""

    # CINEMATIC / FILM / PHOTO / DRAMATIC / SPORTS
    elif any(k in art_style for k in ['cinematic', 'film', 'photo', 'realistic', 'dramatic', 'sports', 'dynamic', 'motion', 'espn', 'nike', 'national geographic']):
        return f"""TEXT STYLE (Cinematic/Sports):
- Title: Bold movie poster typography, strong contrast, slight 3D depth
- Fact: Clean white text at bottom with subtle gradient overlay for readability
- Professional film credits or sports broadcast style positioning
- Text should feel like a Hollywood movie poster or ESPN graphic{typography_hint}"""

    # FANTASY / MAGICAL / ETHEREAL
    elif any(k in art_style for k in ['fantasy', 'magical', 'ethereal', 'mystical', 'elvish', 'lord of the rings', 'enchanted']):
        return f"""TEXT STYLE (Fantasy/Magical):
- Title: Ornate fantasy lettering with magical glow, elvish or mystical feel
- Fact: Elegant text on a semi-transparent magical scroll or banner
- Add magical particles, sparkles, or runes around text
- Text should feel like Lord of the Rings or fantasy book cover{typography_hint}"""

    # SACRED / SPIRITUAL / RELIGIOUS / GOLDEN
    elif any(k in art_style for k in ['sacred', 'spiritual', 'religious', 'golden', 'divine', 'holy', 'temple', 'renaissance']):
        return f"""TEXT STYLE (Sacred/Spiritual):
- Title: Elegant gold-embossed lettering with divine glow, ornate serifs
- Fact: Classical text on parchment-style banner or sacred scroll
- Add subtle golden light rays, sacred geometry, or divine particles
- Text should feel like illuminated manuscripts or temple inscriptions{typography_hint}"""

    # COSMIC / SPACE / STELLAR
    elif any(k in art_style for k in ['cosmic', 'space', 'stellar', 'galaxy', 'nebula', 'interstellar', 'cosmos']):
        return f"""TEXT STYLE (Cosmic/Space):
- Title: Glowing stellar text with cosmic particle effects, floating in space
- Fact: Clean futuristic font with subtle starlight glow
- Add space elements: star particles, nebula wisps, cosmic dust
- Text should feel like Interstellar or Cosmos documentary{typography_hint}"""

    # 3D / PIXAR / ANIMATED / PLAYFUL
    elif any(k in art_style for k in ['3d', 'pixar', 'animated', 'playful', 'cartoon', 'nintendo', 'render']):
        return f"""TEXT STYLE (3D/Animated):
- Title: Bold 3D extruded text with colorful shadows, playful and fun
- Fact: Rounded, friendly font like Pixar movie titles
- Text should pop out, feel touchable and dimensional
- Add subtle reflections and glossy finish to text{typography_hint}"""

    # GRAFFITI / STREET / URBAN / HIP-HOP
    elif any(k in art_style for k in ['graffiti', 'street', 'urban', 'hip-hop', 'spray', 'stencil']):
        return f"""TEXT STYLE (Street Art/Graffiti):
- Title: Bold graffiti-style lettering, spray paint effect, drips
- Fact: Stencil style or bold urban typography
- Add street art elements: tags, paint splatters, brick texture
- Text should feel like authentic street art or hip-hop album cover{typography_hint}"""

    # HORROR / DARK / GOTHIC / MYSTERY
    elif any(k in art_style for k in ['horror', 'dark', 'gothic', 'mystery', 'eerie', 'creepy', 'crimson', 'souls']):
        return f"""TEXT STYLE (Horror/Gothic):
- Title: Dripping, distressed text with eerie glow, blood red or ghostly white
- Fact: Gothic serif font, slightly unsettling
- Add horror elements: cracks, fog, shadows, decay
- Text should feel like a horror movie poster or Dark Souls{typography_hint}"""

    # WARM / FOOD / LIFESTYLE / COZY
    elif any(k in art_style for k in ['warm', 'food', 'lifestyle', 'cozy', 'appetit', 'culinary', 'cafe']):
        return f"""TEXT STYLE (Warm/Lifestyle):
- Title: Warm, inviting serif or script font with soft shadows
- Fact: Clean text with warm color tones, organic feel
- Keep text cozy and approachable, like a cookbook or cafe menu
- Text should feel like Bon Appétit or a premium lifestyle brand{typography_hint}"""

    # NATURE / WILDLIFE / EARTH / DOCUMENTARY
    elif any(k in art_style for k in ['nature', 'wildlife', 'earth', 'documentary', 'forest', 'ocean', 'planet']):
        return f"""TEXT STYLE (Nature/Documentary):
- Title: Strong, authoritative sans-serif with subtle earth-tone shadow
- Fact: Clean documentary-style lower third text
- Professional but organic feel, respecting the natural subject
- Text should feel like Planet Earth or National Geographic{typography_hint}"""

    # DEFAULT - Use typography_style if available, otherwise professional
    else:
        if typography_style:
            return f"""TEXT STYLE (Custom - {typography_style}):
- Title: {typography_style}, prominent and eye-catching at top
- Fact: Complementary clean text at bottom with good contrast
- Ensure text matches the overall {art_style} aesthetic
- Text should be professional, readable, and style-appropriate{typography_hint}"""
        else:
            return f"""TEXT STYLE (Professional):
- Title: Bold, clean sans-serif text with subtle drop shadow
- Fact: Clear white text on semi-transparent dark gradient bar
- Professional and readable, optimized for social media
- Text should be crisp, modern, and highly legible"""


def _get_style_enforcement(art_style: str) -> str:
    """
    Returns strong style enforcement instructions for non-photorealistic styles.
    This prevents AI from defaulting to photorealism for real people.
    """
    style_lower = art_style.lower()

    # Anime/Manga style enforcement
    if any(k in style_lower for k in ['anime', 'manga', 'japanese']):
        return """
<STYLE_DIRECTIVE>
ART STYLE: Anime/Manga Illustration
- Render in Japanese anime art style with cel-shading
- Use anime facial features and proportions
- Apply flat colors with clean cel-shaded shadows
- Style reference: Studio Ghibli, Makoto Shinkai
⚠️ IMPORTANT: Keep the SAME subject/person described below, just render them in anime style
</STYLE_DIRECTIVE>
"""

    # Comic/Pop Art style enforcement
    elif any(k in style_lower for k in ['comic', 'pop art', 'marvel']):
        return """
<STYLE_DIRECTIVE>
ART STYLE: Pop Art / Comic Book
- Render in bold comic book pop art style
- Use thick black outlines, halftone dots, flat primary colors
- Apply Roy Lichtenstein / Andy Warhol aesthetic
- Style reference: Marvel Comics, classic pop art
⚠️ IMPORTANT: Keep the SAME subject/person described below, just render them in comic style
</STYLE_DIRECTIVE>
"""

    # Cyberpunk/Neon style
    elif any(k in style_lower for k in ['cyberpunk', 'neon']):
        return """
<STYLE_DIRECTIVE>
ART STYLE: Cyberpunk Neon
- Apply strong neon lighting (cyan, magenta, pink)
- Dark atmospheric background with neon accents
- Style reference: Blade Runner 2049, Cyberpunk 2077
⚠️ IMPORTANT: Keep the SAME subject/person described below, with cyberpunk lighting
</STYLE_DIRECTIVE>
"""

    # Minimalist style
    elif any(k in style_lower for k in ['minimal', 'clean']):
        return """
<STYLE_DIRECTIVE>
ART STYLE: Minimalist / Clean
- Maximum white space and simplicity
- Clean geometric shapes, professional aesthetic
- Style reference: Apple design, Swiss typography
</STYLE_DIRECTIVE>
"""

    return ""


def _build_consistency_section(slide: dict, consistency_data: dict) -> str:
    """Build prompt section with consistent character/element descriptions."""
    if not consistency_data:
        return ""

    slide_num = slide['slide_number']
    sections = []

    # Add character descriptions for characters in this slide
    for char in consistency_data.get('characters', []):
        if slide_num in char.get('appears_in_slides', []):
            sections.append(f"CHARACTER - {char['name']}: {char['description']}")

    # Add object descriptions
    for obj in consistency_data.get('objects', []):
        if slide_num in obj.get('appears_in_slides', []):
            sections.append(f"RECURRING ELEMENT - {obj['name']}: {obj['description']}")

    # Add environment consistency
    env = consistency_data.get('environment', {})
    if env:
        if env.get('primary_setting'):
            sections.append(f"SETTING: {env['primary_setting']}")
        if env.get('lighting_consistency'):
            sections.append(f"LIGHTING: {env['lighting_consistency']}")

    if sections:
        return "<VISUAL_CONSISTENCY>\nMaintain these consistent elements:\n" + "\n".join(sections) + "\n</VISUAL_CONSISTENCY>\n\n"
    return ""


def generate_story_image(
    slide: dict,
    topic: str,
    total_slides: int,
    aesthetic: dict,
    image_size: str = "story",
    provider: str = "gemini-flash",
    consistency_data: dict = None,
    seed: int = None
) -> Image.Image:
    """
    Generates a single story image using the specified provider.
    Providers: gemini-flash, gemini-pro, fal
    image_size: 'story' (portrait) or 'square'
    consistency_data: Optional dict with character/element descriptions for visual coherence
    seed: Optional seed for reproducible generation (fal.ai only)
    """
    print(f"[image] Generating slide {slide['slide_number']}/{total_slides}: {slide['title']} [{provider}]")

    if image_size == "square":
        aspect_info = "square 1:1 format for Instagram posts"
    else:
        aspect_info = "vertical 9:16 portrait format for Instagram/WhatsApp stories"

    art_style = aesthetic.get('art_style', 'cinematic illustration')
    text_instructions = _get_style_specific_text_instructions(aesthetic)
    consistency_section = _build_consistency_section(slide, consistency_data)
    style_enforcement = _get_style_enforcement(art_style)

    prompt = f"""<IMAGE_GENERATION_BRIEF>
{style_enforcement}
TOPIC: {topic}
FORMAT: {aspect_info.upper()}
QUALITY: Award-winning professional artwork, 8K resolution, museum-quality detail

{consistency_section}<SCENE_DIRECTION>
Subject: {topic}
Scene: {slide['visual_description']}
</SCENE_DIRECTION>

<VISUAL_STYLE_SYSTEM>
Art Direction: {art_style}
Color Palette: {aesthetic.get('color_palette', 'vibrant, eye-catching colors')}
Lighting Design: {aesthetic.get('lighting', 'dramatic, professional lighting')}
Texture: {aesthetic.get('texture', 'refined surface quality')}
Background: {aesthetic.get('background_style', 'complementary atmosphere')}
</VISUAL_STYLE_SYSTEM>

<INTEGRATED_TEXT_ELEMENTS>
HEADLINE (Top Zone - 15% of frame):
"{slide['title']}"

KEY FACT (Bottom Zone - 20% of frame):
"{slide['key_fact']}"

{text_instructions}
</INTEGRATED_TEXT_ELEMENTS>

<COMPOSITION_RULES>
1. FOCAL HIERARCHY: Main subject at center or rule-of-thirds intersection
2. TEXT ZONES: Reserve top 15% and bottom 20% for text with appropriate contrast
3. VISUAL FLOW: Guide eye from title → main visual → fact
4. BREATHING ROOM: Ensure text has clean background behind it (gradient, blur, or solid overlay)
5. BALANCE: No element should fight for attention - harmonious composition
</COMPOSITION_RULES>

<QUALITY_STANDARDS>
MUST ACHIEVE:
✓ Text is perfectly spelled, crisp, and instantly readable
✓ Art style is unmistakably {art_style.split()[0] if art_style else 'professional'}
✓ Colors are vibrant and screen-optimized (not muddy or dull)
✓ Composition feels intentional and professionally designed
✓ Image would make someone stop scrolling and screenshot

MUST AVOID:
✗ Blurry or illegible text
✗ Cluttered composition with competing focal points
✗ Generic stock photo aesthetic
✗ Text that blends into busy backgrounds
✗ Inconsistent style elements
</QUALITY_STANDARDS>

{QUALITY_CONSTRAINTS}
</IMAGE_GENERATION_BRIEF>

Generate this image now. English text only."""

    if provider == "fal":
        return _generate_with_fal(prompt, image_size, seed=seed)
    elif provider == "gemini-pro":
        return _generate_with_gemini(prompt, image_size, model="imagen-3.0-generate-002")
    else:  # gemini-flash (default)
        return _generate_with_gemini(prompt, image_size, model="imagen-3.0-fast-generate-001")


def _generate_with_fal(prompt: str, image_size: str, seed: int = None) -> Image.Image:
    """Generate image using fal.ai Flux with optional seed for consistency."""
    if not fal_client:
        print("   [image] fal.ai client not initialized")
        return None

    # Nano Banana Pro uses width/height instead of image_size presets
    if image_size == "square":
        width, height = 1024, 1024
        aspect_prompt = "[ASPECT: Square 1:1] "
    else:
        # Story format 9:16 portrait
        width, height = 768, 1365
        aspect_prompt = "[ASPECT: Vertical Portrait 9:16] "

    full_prompt = aspect_prompt + prompt

    arguments = {
        "prompt": full_prompt,
        "image_size": {
            "width": width,
            "height": height
        },
        "num_images": 1,
    }

    # Add seed for style consistency across slides
    if seed is not None:
        arguments["seed"] = seed
        print(f"   [image] Using seed {seed} for consistency")

    try:
        result = fal_client.subscribe(
            "fal-ai/nano-banana-pro",
            arguments=arguments,
        )

        if result and result.get('images') and len(result['images']) > 0:
            image_url = result['images'][0]['url']
            image_response = requests.get(image_url)

            if image_response.status_code == 200:
                image = Image.open(BytesIO(image_response.content))
                print(f"   [image] Generated with fal.ai Nano Banana Pro ({width}x{height})")
                return image

        print(f"   [image] No image returned from fal.ai")
        return None

    except Exception as e:
        print(f"   [image] fal.ai generation failed: {e}")
        return None


def _generate_with_gemini(prompt: str, image_size: str, model: str = "imagen-3.0-fast-generate-001") -> Image.Image:
    """Generate image using Google Gemini/Imagen."""
    if not gemini_client:
        print("   [image] Gemini client not initialized")
        return None

    if image_size == "square":
        aspect_ratio = "1:1"
    else:
        aspect_ratio = "9:16"

    try:
        response = gemini_client.models.generate_images(
            model=model,
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio=aspect_ratio,
                safety_filter_level="BLOCK_ONLY_HIGH",
                person_generation="ALLOW_ADULT",
            )
        )

        if response.generated_images and len(response.generated_images) > 0:
            image_bytes = response.generated_images[0].image.image_bytes
            image = Image.open(BytesIO(image_bytes))
            model_short = "Gemini Pro" if "002" in model else "Gemini Flash"
            print(f"   [image] Generated with {model_short}")
            return image

        print(f"   [image] No image returned from Gemini")
        return None

    except Exception as e:
        print(f"   [image] Gemini generation failed: {e}")
        return None


def generate_story_from_plan(plan: dict, output_dir: str = None, provider: str = "gemini-flash", brand_id: str = None, text_overlay: bool = None) -> list:
    """
    Phase 2: Generate images from an approved plan.
    Returns list of saved file paths.
    provider: gemini-flash, gemini-pro, fal
    brand_id: optional brand ID to apply as watermark
    """
    if output_dir is None:
        output_dir = OUTPUT_DIR

    topic = plan['topic']
    aesthetic = plan['aesthetic']
    slides = plan['slides']
    image_size = plan.get('image_size', 'story')

    provider_names = {
        "gemini-flash": "Gemini Flash (Fast)",
        "gemini-pro": "Gemini Pro (Quality)",
        "fal": "fal.ai Nano Banana Pro"
    }

    print(f"\n{'='*50}")
    print(f"[image] PHASE 2: IMAGE GENERATION")
    print(f"{'='*50}")
    print(f"Topic: {topic}")
    print(f"Style: {aesthetic.get('art_style', 'Unknown')}")
    print(f"Size: {image_size}")
    print(f"Provider: {provider_names.get(provider, provider)}")
    if brand_id:
        print(f"Brand: {brand_id}")
    print(f"{'='*50}\n")

    os.makedirs(output_dir, exist_ok=True)

    generated_images = []
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_topic = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in topic)[:30].strip()

    # Get brand config - use specific brand if ID provided, otherwise fall back to legacy
    if brand_id:
        brand_config = get_brand_by_id(brand_id)
        if brand_config:
            brand_config["enabled"] = True
    else:
        brand_config = get_brand_config()

    # Determine if text overlay should be applied
    use_text_overlay = text_overlay if text_overlay is not None else TEXT_OVERLAY_ENABLED

    for slide in slides:
        image = generate_story_image(slide, topic, len(slides), aesthetic, image_size, provider)

        if image:
            # Apply text overlay if enabled
            if use_text_overlay:
                image = _apply_text_overlay(image, slide, aesthetic)
            # Apply brand watermark
            image = apply_watermark(image, brand_config)

            filename = os.path.join(output_dir, f"{safe_topic}_{timestamp}_slide{slide['slide_number']}.png")
            image.save(filename)
            generated_images.append(filename)
            print(f"   [image] Saved: {os.path.basename(filename)}")
        else:
            print(f"   [image] Skipped slide {slide['slide_number']}")

    print(f"\n[image] Generated {len(generated_images)}/{len(slides)} images")
    return generated_images


def _generate_single_slide_worker(args: tuple) -> Tuple[int, Optional[Image.Image]]:
    """
    Worker function for parallel generation.
    Returns (slide_number, image or None).
    Includes retry logic for rate limit errors.
    """
    slide, topic, total_slides, aesthetic, image_size, provider, consistency_data, seed = args
    slide_num = slide['slide_number']

    for attempt in range(RETRY_MAX_ATTEMPTS):
        try:
            image = generate_story_image(
                slide, topic, total_slides, aesthetic,
                image_size, provider, consistency_data, seed
            )
            return (slide_num, image)
        except Exception as e:
            error_str = str(e).lower()
            # Check for rate limit errors
            if any(x in error_str for x in ['rate', '429', 'quota', 'limit']):
                delay = (RETRY_BASE_DELAY ** attempt) + random.uniform(0, 1)
                print(f"   [image] Slide {slide_num} rate limited, retry {attempt + 1}/{RETRY_MAX_ATTEMPTS} in {delay:.1f}s...")
                time.sleep(delay)
            else:
                print(f"   [image] Slide {slide_num} failed: {e}")
                return (slide_num, None)

    print(f"   [image] Slide {slide_num} failed after {RETRY_MAX_ATTEMPTS} retries")
    return (slide_num, None)


def generate_story_from_plan_parallel(
    plan: dict,
    output_dir: str = None,
    provider: str = "gemini-flash",
    brand_id: str = None,
    consistency_data: dict = None,
    max_workers: int = MAX_PARALLEL_WORKERS,
    text_overlay: bool = None
) -> list:
    """
    Phase 2: Generate images from an approved plan IN PARALLEL.
    Returns list of saved file paths in slide order.

    Args:
        plan: Story plan with topic, aesthetic, slides
        output_dir: Directory to save images
        provider: Image generation provider (gemini-flash, gemini-pro, fal)
        brand_id: Optional brand ID for watermark
        consistency_data: Optional character/element descriptions for visual coherence
        max_workers: Maximum parallel generation threads (default 3)
        text_overlay: If True, add PIL text overlay. If None, use TEXT_OVERLAY_ENABLED setting.
    """
    if output_dir is None:
        output_dir = OUTPUT_DIR

    topic = plan['topic']
    aesthetic = plan['aesthetic']
    slides = plan['slides']
    image_size = plan.get('image_size', 'story')

    provider_names = {
        "gemini-flash": "Gemini Flash (Fast)",
        "gemini-pro": "Gemini Pro (Quality)",
        "fal": "fal.ai Nano Banana Pro"
    }

    print(f"\n{'='*50}")
    print(f"[image] PHASE 2: PARALLEL IMAGE GENERATION")
    print(f"{'='*50}")
    print(f"Topic: {topic}")
    print(f"Style: {aesthetic.get('art_style', 'Unknown')}")
    print(f"Size: {image_size}")
    print(f"Provider: {provider_names.get(provider, provider)}")
    print(f"Workers: {max_workers} parallel")
    if consistency_data:
        print(f"Consistency: {len(consistency_data.get('characters', []))} characters tracked")
    if brand_id:
        print(f"Brand: {brand_id}")
    print(f"{'='*50}\n")

    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_topic = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in topic)[:30].strip()

    # Generate a consistent seed for Flux provider (same seed = similar style)
    base_seed = random.randint(1, 2147483647) if provider == "fal" else None
    if base_seed:
        print(f"[image] Using base seed {base_seed} for style consistency\n")

    # Prepare task arguments for each slide
    task_args = [
        (slide, topic, len(slides), aesthetic, image_size, provider, consistency_data, base_seed)
        for slide in slides
    ]

    # Generate images in parallel
    results = {}  # slide_number -> image

    print(f"[image] Starting parallel generation of {len(slides)} slides...")
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_slide = {
            executor.submit(_generate_single_slide_worker, args): args[0]['slide_number']
            for args in task_args
        }

        # Collect results as they complete
        for future in as_completed(future_to_slide):
            slide_num = future_to_slide[future]
            try:
                result_num, image = future.result()
                results[result_num] = image
                if image:
                    print(f"   [image] Slide {result_num} completed")
            except Exception as e:
                print(f"   [image] Slide {slide_num} exception: {e}")
                results[slide_num] = None

    elapsed = time.time() - start_time
    print(f"\n[image] Parallel generation completed in {elapsed:.1f}s")

    # Get brand config
    if brand_id:
        brand_config = get_brand_by_id(brand_id)
        if brand_config:
            brand_config["enabled"] = True
    else:
        brand_config = get_brand_config()

    # Determine if text overlay should be applied
    use_text_overlay = text_overlay if text_overlay is not None else TEXT_OVERLAY_ENABLED

    # Save images in correct slide order
    generated_images = []
    for slide in slides:
        slide_num = slide['slide_number']
        image = results.get(slide_num)

        if image:
            # Apply text overlay if enabled
            if use_text_overlay:
                image = _apply_text_overlay(image, slide, aesthetic)
            # Apply brand watermark
            image = apply_watermark(image, brand_config)
            filename = os.path.join(output_dir, f"{safe_topic}_{timestamp}_slide{slide_num}.png")
            image.save(filename)
            generated_images.append(filename)
            print(f"   [image] Saved: {os.path.basename(filename)}")
        else:
            print(f"   [image] Skipped slide {slide_num} (generation failed)")

    print(f"\n[image] Generated {len(generated_images)}/{len(slides)} images")
    return generated_images


def create_story_series(topic: str, num_slides: int = 5, user_aesthetic: str = None, output_dir: str = None, provider: str = "gemini-flash") -> list:
    """
    Complete story generation in one call.
    Combines research and generation phases.
    """
    from .research import research_story_concept

    plan = research_story_concept(topic, num_slides, user_aesthetic)
    if not plan:
        return []
    return generate_story_from_plan(plan, output_dir or OUTPUT_DIR, provider)
