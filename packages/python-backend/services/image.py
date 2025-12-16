"""
Image generation service - generates story images using multiple providers.
"""

import os
import datetime
import requests
from io import BytesIO
from PIL import Image
from google.genai import types
from config import OUTPUT_DIR
from .clients import gemini_client, fal_client
from .brand import get_brand_config, apply_watermark, get_brand_by_id


def generate_story_image(slide: dict, topic: str, total_slides: int, aesthetic: dict, image_size: str = "story", provider: str = "gemini-flash") -> Image.Image:
    """
    Generates a single story image using the specified provider.
    Providers: gemini-flash, gemini-pro, fal
    image_size: 'story' (portrait) or 'square'
    """
    print(f"[image] Generating slide {slide['slide_number']}/{total_slides}: {slide['title']} [{provider}]")

    if image_size == "square":
        aspect_info = "square format for Instagram posts"
    else:
        aspect_info = "vertical portrait format for Instagram/WhatsApp stories (9:16 aspect ratio)"

    prompt = f"""Create a {aspect_info} social media story card.

SCENE: {slide['visual_description']}

STYLE: {aesthetic.get('art_style', 'cinematic illustration')}
COLORS: {aesthetic.get('color_palette', 'vibrant colors')}
LIGHTING: {aesthetic.get('lighting', 'soft lighting')}

TEXT OVERLAY:
- Title at top: "{slide['title']}"
- Fact at bottom: "{slide['key_fact']}"
- Use bold, clean white text with subtle shadow for readability
- English only, no other scripts

Make it visually striking, professional, and perfect for social media."""

    if provider == "fal":
        return _generate_with_fal(prompt, image_size)
    elif provider == "gemini-pro":
        return _generate_with_gemini(prompt, image_size, model="imagen-3.0-generate-002")
    else:  # gemini-flash (default)
        return _generate_with_gemini(prompt, image_size, model="imagen-3.0-fast-generate-001")


def _generate_with_fal(prompt: str, image_size: str) -> Image.Image:
    """Generate image using fal.ai Nano Banana Pro."""
    if not fal_client:
        print("   [image] fal.ai client not initialized")
        return None

    if image_size == "square":
        aspect_prompt = "Square format image. "
    else:
        aspect_prompt = "Vertical portrait format (9:16 aspect ratio). "

    full_prompt = aspect_prompt + prompt

    try:
        result = fal_client.subscribe(
            "fal-ai/nano-banana-pro",
            arguments={"prompt": full_prompt},
        )

        if result and result.get('images') and len(result['images']) > 0:
            image_url = result['images'][0]['url']
            image_response = requests.get(image_url)

            if image_response.status_code == 200:
                image = Image.open(BytesIO(image_response.content))
                print(f"   [image] Generated with fal.ai Nano Banana Pro")
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


def generate_story_from_plan(plan: dict, output_dir: str = None, provider: str = "gemini-flash", brand_id: str = None) -> list:
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
        "gemini-flash": "Gemini Flash (Free)",
        "gemini-pro": "Gemini Pro",
        "fal": "fal.ai Flux"
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

    for slide in slides:
        image = generate_story_image(slide, topic, len(slides), aesthetic, image_size, provider)

        if image:
            image = apply_watermark(image, brand_config)

            filename = os.path.join(output_dir, f"{safe_topic}_{timestamp}_slide{slide['slide_number']}.png")
            image.save(filename)
            generated_images.append(filename)
            print(f"   [image] Saved: {os.path.basename(filename)}")
        else:
            print(f"   [image] Skipped slide {slide['slide_number']}")

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
