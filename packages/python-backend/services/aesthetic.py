"""
Aesthetic definition service - defines visual style for stories.
"""

import json
from utils.json_utils import clean_json_response
from .clients import gemini_client


def define_series_aesthetic(topic: str, user_aesthetic: str = None) -> dict:
    """
    Defines a consistent visual aesthetic for the entire story series.
    """
    print(f"[aesthetic] Defining for '{topic}'...")

    user_style_hint = ""
    if user_aesthetic and user_aesthetic.strip():
        user_style_hint = f'\nUSER PREFERENCE: The user wants a "{user_aesthetic}" style.'

    prompt = f"""I'm creating a multi-part Instagram/WhatsApp story series about: "{topic}"
{user_style_hint}

Define a CONSISTENT visual aesthetic for ALL slides.

CHOOSE THE BEST STYLE:
- Historical topics -> vintage illustrations, old paper textures, sepia tones
- Science/Space -> cinematic realism, deep blacks, glowing elements
- Nature/Wildlife -> photorealistic, natural earth tones
- Technology/AI -> cyberpunk neon, sleek gradients, futuristic
- Culture/Travel -> vibrant photography, rich saturated colors
- Food/Lifestyle -> warm cozy aesthetic, soft lighting
- Spiritual/Religious -> sacred golden tones, ethereal lighting
- Abstract/Philosophy -> artistic painted style, dreamy atmospheres

Provide:
1. art_style: Overall artistic style
2. color_palette: 3-4 specific colors with hex codes
3. lighting: Consistent lighting style
4. typography_style: Font style
5. texture: Surface/texture quality
6. background_style: Background treatment

Return as JSON object only. No markdown."""

    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=prompt
        )
        text = clean_json_response(response.text)
        aesthetic = json.loads(text)
        print(f"   [aesthetic] Style: {aesthetic.get('art_style', 'N/A')}")
        return aesthetic
    except Exception as e:
        print(f"   [aesthetic] Failed: {e}")
        return {
            "art_style": "modern cinematic illustration",
            "color_palette": "vibrant blues, warm oranges, clean whites",
            "lighting": "soft studio lighting with depth",
            "typography_style": "bold white sans-serif with shadow",
            "texture": "smooth polished surfaces",
            "background_style": "soft gradient background",
        }
