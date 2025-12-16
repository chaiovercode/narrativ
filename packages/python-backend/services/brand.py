"""
Brand kit service - logo and text watermark branding.
Supports both logo (PNG with transparency) and text watermarks.
Positions limited to 4 corners: top-left, top-right, bottom-left, bottom-right.
Now supports multiple brands.
"""

import os
import json
import uuid
import shutil
from PIL import Image, ImageDraw, ImageFont
from config import BRAND_DIR


# Valid positions (4 corners only, no center)
VALID_POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right"]


def get_brands_file() -> str:
    """Get the path to the brands.json file."""
    return os.path.join(BRAND_DIR, "brands.json")


def get_brands() -> list:
    """Load all brands from brands.json"""
    brands_path = get_brands_file()
    if os.path.exists(brands_path):
        try:
            with open(brands_path, 'r') as f:
                data = json.load(f)
                return data.get("brands", [])
        except:
            pass
    return []


def save_brands(brands: list):
    """Save all brands to brands.json"""
    os.makedirs(BRAND_DIR, exist_ok=True)
    brands_path = get_brands_file()
    with open(brands_path, 'w') as f:
        json.dump({"brands": brands}, f, indent=2)


def get_brand_by_id(brand_id: str) -> dict | None:
    """Get a specific brand by ID."""
    brands = get_brands()
    for brand in brands:
        if brand.get("id") == brand_id:
            return brand
    return None


def save_brand(brand_data: dict) -> dict:
    """Save or update a brand."""
    brands = get_brands()
    brand_id = brand_data.get("id")

    if not brand_id:
        # New brand - generate ID
        brand_id = str(uuid.uuid4())[:8]
        brand_data["id"] = brand_id

    # Find and update existing or append new
    found = False
    for i, brand in enumerate(brands):
        if brand.get("id") == brand_id:
            brands[i] = brand_data
            found = True
            break

    if not found:
        brands.append(brand_data)

    save_brands(brands)
    return brand_data


def delete_brand(brand_id: str) -> bool:
    """Delete a brand by ID."""
    brands = get_brands()
    original_len = len(brands)

    # Find and remove the brand
    brands = [b for b in brands if b.get("id") != brand_id]

    if len(brands) < original_len:
        # Delete logo if exists
        logo_path = os.path.join(BRAND_DIR, "logos", f"{brand_id}.png")
        if os.path.exists(logo_path):
            os.remove(logo_path)

        save_brands(brands)
        return True

    return False


# Legacy support
def get_brand_config() -> dict:
    """Load brand configuration (legacy - returns first brand or default)"""
    brands = get_brands()
    if brands:
        brand = brands[0]
        return {**brand, "enabled": True}
    return {"enabled": False, "type": "logo", "position": "bottom-right"}


def save_brand_config(config: dict):
    """Save brand configuration (legacy - saves as first brand)."""
    if config.get("enabled", False):
        config["id"] = config.get("id", "default")
        config["name"] = config.get("name", "Default")
        save_brand(config)
    # If disabled, don't save


def apply_watermark(image: Image.Image, config: dict = None) -> Image.Image:
    """
    Apply watermark to image based on brand config.
    Supports both logo and text watermarks.

    Config schema:
    {
        "enabled": bool,
        "type": "logo" | "text",
        "logoPath": str (optional, path to logo file),
        "text": str (optional, text to display),
        "fontSize": int (optional, default 24),
        "fontColor": str (optional, hex color like "#FFFFFF"),
        "position": "top-left" | "top-right" | "bottom-left" | "bottom-right",
        "opacity": float (0.0 - 1.0, default 0.7),
        "padding": int (pixels from edge, default 20)
    }
    """
    if config is None:
        config = get_brand_config()

    if not config.get("enabled", False):
        return image

    brand_type = config.get("type", "logo")

    if brand_type == "text":
        return _apply_text_watermark(image, config)
    else:
        return _apply_logo_watermark(image, config)


def _apply_logo_watermark(image: Image.Image, config: dict) -> Image.Image:
    """Apply logo-based watermark to image."""
    # Try config path first, then default location
    logo_path = config.get("logoPath")
    if not logo_path or not os.path.exists(logo_path):
        logo_path = os.path.join(BRAND_DIR, "logo.png")

    if not os.path.exists(logo_path):
        print("   [brand] No logo found, skipping watermark")
        return image

    try:
        logo = Image.open(logo_path).convert("RGBA")

        # Resize logo (max 15% of image width by default)
        logo_size_percent = config.get("logoSize", 15) / 100
        max_logo_width = int(image.width * logo_size_percent)
        if logo.width > max_logo_width:
            ratio = max_logo_width / logo.width
            logo = logo.resize(
                (int(logo.width * ratio), int(logo.height * ratio)),
                Image.Resampling.LANCZOS
            )

        # Apply opacity
        opacity = config.get("opacity", 0.7)
        if opacity < 1:
            alpha = logo.split()[3]
            alpha = alpha.point(lambda p: int(p * opacity))
            logo.putalpha(alpha)

        # Calculate position (4 corners only)
        x, y = _calculate_position(
            image.width, image.height,
            logo.width, logo.height,
            config.get("position", "bottom-right"),
            config.get("padding", 20)
        )

        # Paste logo
        image = image.convert("RGBA")
        image.paste(logo, (x, y), logo)
        image = image.convert("RGB")

        print(f"   [brand] Logo watermark applied at {config.get('position', 'bottom-right')}")
        return image

    except Exception as e:
        print(f"   [brand] Logo watermark failed: {e}")
        return image


def _apply_text_watermark(image: Image.Image, config: dict) -> Image.Image:
    """Apply text-based watermark to image."""
    text = config.get("text", "")
    if not text:
        print("   [brand] No text provided, skipping watermark")
        return image

    try:
        # Create a transparent overlay
        overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # Get font settings
        font_size = config.get("fontSize", 24)
        font_color = config.get("fontColor", "#FFFFFF")
        opacity = config.get("opacity", 0.7)

        # Try to load a system font, fallback to default
        try:
            # Try common macOS fonts
            font_paths = [
                "/System/Library/Fonts/Helvetica.ttc",
                "/System/Library/Fonts/SFNSText.ttf",
                "/Library/Fonts/Arial.ttf",
            ]
            font = None
            for fp in font_paths:
                if os.path.exists(fp):
                    font = ImageFont.truetype(fp, font_size)
                    break
            if font is None:
                font = ImageFont.load_default()
        except:
            font = ImageFont.load_default()

        # Get text bounding box
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        # Calculate position
        x, y = _calculate_position(
            image.width, image.height,
            text_width, text_height,
            config.get("position", "bottom-right"),
            config.get("padding", 20)
        )

        # Parse color and apply opacity
        rgb = _hex_to_rgb(font_color)
        alpha = int(255 * opacity)
        color = (*rgb, alpha)

        # Draw text shadow for better visibility
        shadow_offset = max(1, font_size // 12)
        shadow_color = (0, 0, 0, int(alpha * 0.5))
        draw.text((x + shadow_offset, y + shadow_offset), text, font=font, fill=shadow_color)

        # Draw main text
        draw.text((x, y), text, font=font, fill=color)

        # Composite the overlay onto the image
        image = image.convert("RGBA")
        image = Image.alpha_composite(image, overlay)
        image = image.convert("RGB")

        print(f"   [brand] Text watermark '{text}' applied at {config.get('position', 'bottom-right')}")
        return image

    except Exception as e:
        print(f"   [brand] Text watermark failed: {e}")
        return image


def _calculate_position(
    img_width: int, img_height: int,
    element_width: int, element_height: int,
    position: str, padding: int
) -> tuple:
    """
    Calculate x, y coordinates for watermark placement.
    Only supports 4 corners (no center).
    """
    # Validate position - default to bottom-right if invalid
    if position not in VALID_POSITIONS:
        position = "bottom-right"

    positions = {
        "top-left": (padding, padding),
        "top-right": (img_width - element_width - padding, padding),
        "bottom-left": (padding, img_height - element_height - padding),
        "bottom-right": (img_width - element_width - padding, img_height - element_height - padding),
    }

    return positions[position]


def _hex_to_rgb(hex_color: str) -> tuple:
    """Convert hex color string to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    if len(hex_color) != 6:
        return (255, 255, 255)  # Default to white
    try:
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    except ValueError:
        return (255, 255, 255)
