"""
Caption generation service - generates captions and hashtags.
"""

import json
from utils.json_utils import clean_json_response
from .clients import gemini_client


def generate_story_caption(topic: str, slides: list) -> dict:
    """
    Generates an overall caption and hashtags for the story series.
    """
    print(f"[caption] Generating for '{topic}'...")

    slide_summaries = "\n".join([f"- {s['title']}: {s['key_fact']}" for s in slides])

    prompt = f"""I've created a {len(slides)}-part Instagram/WhatsApp story series about: "{topic}"

Here are the slides:
{slide_summaries}

Generate ONE engaging social media caption for the ENTIRE story series.

Requirements:
- 2-4 sentences, conversational tone
- Highlight the most striking fact
- Create curiosity to swipe through
- End with thought-provoking statement

Also provide exactly 3 relevant hashtags (without # symbol).

Return as JSON object only. No markdown.

Example:
{{"caption": "Did you know Delhi's air is 16x more toxic than WHO limits? Swipe through to see how this invisible killer is affecting millions.", "hashtags": ["DelhiPollution", "AirQuality", "HealthAwareness"]}}"""

    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=prompt
        )
        text = clean_json_response(response.text)
        result = json.loads(text)
        print(f"   [caption] Generated")
        return result
    except Exception as e:
        print(f"   [caption] Failed: {e}")
        return {
            "caption": f"Swipe through to discover fascinating facts about {topic}.",
            "hashtags": ["DidYouKnow", "Facts", "Learn"],
        }
