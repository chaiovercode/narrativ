"""
Consistency service - maintains visual coherence across story slides.
Generates detailed character and element descriptions to embed in image prompts.
"""

import json
from utils.json_utils import clean_json_response
from .clients import gemini_client


def generate_story_characters(topic: str, slides: list, aesthetic: dict) -> dict:
    """
    Analyzes the story plan and generates consistent character/element descriptions.
    This ensures visual coherence when the same characters or elements appear
    across multiple slides.

    Args:
        topic: Story topic
        slides: List of slide dicts with visual_description
        aesthetic: Aesthetic dict with art_style

    Returns:
        dict with 'characters', 'objects', and 'environment' keys
    """
    print(f"[consistency] Analyzing '{topic}' for recurring elements...")

    slide_summaries = "\n".join([
        f"Slide {s['slide_number']}: {s['title']} - {s.get('visual_description', '')[:150]}..."
        for s in slides
    ])

    prompt = f"""<ROLE>
You are a film production designer ensuring visual continuity across scenes.
Your job is to identify recurring visual elements and create detailed, consistent descriptions.
</ROLE>

<TASK>
Analyze this {len(slides)}-slide story and identify ANY recurring visual elements that must remain consistent:

TOPIC: {topic}
ART STYLE: {aesthetic.get('art_style', 'cinematic')}

SLIDES:
{slide_summaries}
</TASK>

<ANALYSIS_GUIDE>
Look for:
1. CHARACTERS: People, animals, mascots that appear in multiple slides
2. OBJECTS: Logos, products, vehicles, buildings that recur
3. ENVIRONMENT: Consistent setting, time of day, weather across slides
</ANALYSIS_GUIDE>

<OUTPUT_FORMAT>
Return JSON with consistent descriptions. Be EXTREMELY SPECIFIC about visual details.

{{
  "characters": [
    {{
      "name": "Character identifier (e.g., 'The Scientist', 'Main Subject')",
      "description": "DETAILED physical description: exact age range (30s, elderly), gender, ethnicity, hair color AND style (short brown curly hair), eye color, facial features (square jaw, prominent nose), body type, SPECIFIC clothing (navy blue lab coat, round wire-frame glasses), distinguishing marks (scar on left cheek). Be precise enough that an artist could draw them consistently.",
      "appears_in_slides": [1, 3, 5]
    }}
  ],
  "objects": [
    {{
      "name": "Object identifier",
      "description": "DETAILED description: exact color (cherry red, not just 'red'), material (brushed aluminum, weathered wood), size relative to scene, condition (pristine, battle-worn), distinctive marks or logos",
      "appears_in_slides": [2, 4]
    }}
  ],
  "environment": {{
    "primary_setting": "Detailed setting description if consistent across slides",
    "lighting_consistency": "Specific lighting direction and quality (golden hour from the left, harsh overhead fluorescent)",
    "color_grading": "Consistent color temperature and mood (warm amber tones, cool blue shadows)"
  }}
}}

IMPORTANT:
- Only include elements that appear in 2+ slides
- If no recurring elements, return empty arrays/objects
- Be specific enough that images will look like they're from the same story
</OUTPUT_FORMAT>

Return ONLY valid JSON. No markdown, no explanation."""

    try:
        response = gemini_client.models.generate_content(
            model='gemini-3-flash',
            contents=prompt
        )
        text = clean_json_response(response.text)
        consistency_data = json.loads(text)

        # Log what we found
        num_chars = len(consistency_data.get('characters', []))
        num_objects = len(consistency_data.get('objects', []))
        has_env = bool(consistency_data.get('environment', {}).get('primary_setting'))

        if num_chars or num_objects or has_env:
            print(f"   [consistency] Found: {num_chars} characters, {num_objects} objects, environment: {has_env}")
        else:
            print(f"   [consistency] No recurring elements identified")

        return consistency_data

    except json.JSONDecodeError as e:
        print(f"   [consistency] JSON parse failed: {e}")
        return {"characters": [], "objects": [], "environment": {}}
    except Exception as e:
        print(f"   [consistency] Failed: {e}")
        return {"characters": [], "objects": [], "environment": {}}


def get_character_summary(consistency_data: dict) -> str:
    """
    Returns a human-readable summary of consistency data.
    Useful for logging and debugging.
    """
    if not consistency_data:
        return "No consistency data"

    parts = []

    chars = consistency_data.get('characters', [])
    if chars:
        char_names = [c['name'] for c in chars]
        parts.append(f"Characters: {', '.join(char_names)}")

    objects = consistency_data.get('objects', [])
    if objects:
        obj_names = [o['name'] for o in objects]
        parts.append(f"Objects: {', '.join(obj_names)}")

    env = consistency_data.get('environment', {})
    if env.get('primary_setting'):
        parts.append(f"Setting: {env['primary_setting'][:50]}...")

    return " | ".join(parts) if parts else "No recurring elements"
