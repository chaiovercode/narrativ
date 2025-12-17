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

    prompt = f"""<ROLE>
You are an award-winning Art Director from Pixar and Apple's creative team. You've designed visual systems for blockbuster films and iconic brand campaigns. You understand how color, light, and style create emotional impact.
</ROLE>

<TASK>
Design a cohesive visual identity system for an Instagram/WhatsApp story series about: "{topic}"
{user_style_hint}
</TASK>

<STYLE_SELECTION - CHOOSE ONE OF THESE 5 STYLES>
You MUST select one of these 5 proven styles that render text beautifully:

1. POP ART / COMIC BOOK (BEST FOR TEXT)
   → Use for: Entertainment, News, Viral Topics, Sports, Pop Culture
   → Art style: "bold pop art comic book illustration with strong outlines"
   → Colors: Primary red #FF0000, bright yellow #FFFF00, bold blue #0000FF, black #000000
   → Typography: "BOLD ALL-CAPS comic book lettering with thick black outline"
   → Reference: Marvel comics, Andy Warhol, Roy Lichtenstein

2. CINEMATIC / MOVIE POSTER
   → Use for: History, Drama, Epic Stories, War, Biographies
   → Art style: "cinematic film photography with dramatic movie poster composition"
   → Colors: Rich blacks #1a1a1a, warm highlights #f5d6a8, accent gold #d4af37
   → Typography: "bold sans-serif movie poster text in white with drop shadow"
   → Reference: Game of Thrones, Hollywood blockbusters

3. MINIMALIST / CLEAN
   → Use for: Business, Tech Companies, Professional, Corporate, Finance
   → Art style: "ultra-clean minimalist design with maximum white space"
   → Colors: Pure white #FFFFFF, charcoal black #36454F, accent blue #4169E1
   → Typography: "clean modern sans-serif in black, perfectly legible"
   → Reference: Apple design, Bloomberg, Fortune magazine

4. ANIME / MANGA
   → Use for: Gaming, Anime Topics, Youth Culture, Action, Fantasy
   → Art style: "vibrant Japanese anime manga illustration with dynamic energy"
   → Colors: Sakura pink #FFB7C5, ocean blue #0077BE, sunset orange #FF7F50
   → Typography: "bold manga-style impact text with dynamic angles"
   → Reference: Studio Ghibli, Makoto Shinkai, Marvel anime

5. CYBERPUNK / NEON
   → Use for: Technology, AI, Future, Sci-Fi, Space, Innovation
   → Art style: "neon-lit cyberpunk digital art with glowing futuristic elements"
   → Colors: Electric cyan #00FFFF, hot magenta #FF00FF, deep purple #4B0082
   → Typography: "glowing neon tube text in cyan or pink with bright glow effect"
   → Reference: Blade Runner 2049, Ghost in the Shell, Tron

</STYLE_SELECTION - CHOOSE ONE OF THESE 5 STYLES>

<OUTPUT_SPECIFICATION>
Provide a complete visual system:

{{
  "art_style": "Specific style name with technique description (e.g., 'Cinematic Film Photography with Dramatic Composition')",
  "color_palette": "Primary: [color] (#hex), Secondary: [color] (#hex), Accent: [color] (#hex), Background: [color] (#hex)",
  "lighting": "Specific lighting setup (e.g., 'Golden hour rim lighting with soft fill, 3:1 contrast ratio')",
  "typography_style": "Font style that matches the aesthetic",
  "texture": "Surface quality description (e.g., 'Film grain, subtle noise, organic imperfections')",
  "background_style": "Background treatment (e.g., 'Depth-of-field blur with bokeh, atmospheric haze')"
}}
</OUTPUT_SPECIFICATION>

<COHERENCE_RULES>
All elements MUST work together:
- Color palette should evoke the right emotion for the topic
- Lighting must match the mood (dramatic = hard light, peaceful = soft light)
- Typography should feel native to the art style
- Every slide will use these exact specifications for visual consistency
</COHERENCE_RULES>

<OUTPUT_FORMAT>
Return ONLY valid JSON. No markdown, no explanation, no preamble.
</OUTPUT_FORMAT>

Generate the visual system now."""

    try:
        response = gemini_client.models.generate_content(
            model='gemini-3-flash',
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
