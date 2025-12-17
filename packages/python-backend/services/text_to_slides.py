"""
Text-to-slides service - creates story slides from user-provided text.
"""

import json
from .clients import gemini_client
from .aesthetic import define_series_aesthetic
from .caption import generate_story_caption


def create_slides_from_text(text: str, topic: str = "Custom Content", num_slides: int = 5, user_aesthetic: str = None) -> dict:
    """
    Creates story slides from user-provided text (no web research).
    Uses Gemini to extract key facts and generate slide content.
    """
    print(f"\n{'='*50}")
    print(f"[text_to_slides] TEXT-TO-SLIDES")
    print(f"{'='*50}")
    print(f"Topic: {topic}")
    print(f"Slides: {num_slides}")
    print(f"Text length: {len(text)} chars")
    print(f"{'='*50}\n")

    aesthetic = define_series_aesthetic(topic, user_aesthetic)

    print(f"[text_to_slides] Extracting key facts from text...")

    prompt = f"""You are an expert content analyst and visual storyteller.

I have the following text content that I want to turn into a {num_slides}-slide Instagram/WhatsApp story series:

===== USER'S TEXT =====
{text[:8000]}
=======================

Your task:
1. Analyze this text and extract the {num_slides} most important, interesting, or impactful facts/points
2. Create engaging story slides from these facts
3. Each slide should be self-contained but flow as a narrative

REQUIREMENTS:
- Extract REAL facts from the provided text - do NOT make up information
- Each fact should be specific with numbers, names, or concrete details when available
- Create compelling titles (max 5 words, NO years in titles)
- Write engaging key facts (15-25 words each)
- Describe visuals that would work well for each slide

For each slide provide:
1. slide_number (1-{num_slides})
2. title: Short catchy title (max 5 words)
3. key_fact: The main fact/point extracted from the text (15-25 words)
4. visual_description: DETAILED scene description for image generation
5. mood: Emotional tone

Return as JSON array only. No markdown, no explanation.

Example output format:
[
    {{
        "slide_number": 1,
        "title": "The Discovery",
        "key_fact": "Scientists found that the phenomenon occurs in 73% of cases, far higher than previously thought.",
        "visual_description": "Scientists in a modern lab examining data on screens, with charts showing rising percentages",
        "mood": "enlightening"
    }}
]"""

    try:
        response = gemini_client.models.generate_content(
            model='gemini-3-flash',
            contents=prompt
        )
        text_response = response.text.strip().replace("```json", "").replace("```", "")
        slides = json.loads(text_response)
        print(f"   [text_to_slides] Created {len(slides)} slides from text")
    except Exception as e:
        print(f"   [text_to_slides] Slide extraction failed: {e}")
        return None

    caption_data = generate_story_caption(topic, slides)

    print(f"\n[text_to_slides] Story Plan:")
    for slide in slides:
        print(f"   {slide['slide_number']}. {slide['title']}")

    return {
        "topic": topic,
        "aesthetic": aesthetic,
        "slides": slides,
        "sources": [],
        "caption": caption_data.get("caption", ""),
        "hashtags": caption_data.get("hashtags", [])
    }
