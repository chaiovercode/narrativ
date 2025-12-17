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

    prompt = f"""<ROLE>
You are a viral social media copywriter who has written captions for accounts with 10M+ followers. You understand the psychology of engagement: curiosity gaps, pattern interrupts, and emotional triggers that drive shares.
</ROLE>

<CONTEXT>
I've created a {len(slides)}-part Instagram/WhatsApp story series about: "{topic}"

SLIDE CONTENT:
{slide_summaries}
</CONTEXT>

<TASK>
Write ONE caption that maximizes story views and shares.
</TASK>

<VIRAL_CAPTION_FORMULA>
Structure your caption using this proven framework:

1. HOOK (First Line) - Pattern Interrupt:
   → Open with the most shocking stat or counterintuitive claim
   → Use specific numbers (they outperform vague claims by 73%)
   → Create an open loop that demands closure

2. BRIDGE (1-2 sentences) - Emotional Connection:
   → Connect the fact to something personal or universal
   → Use "you" to make it feel relevant to the reader
   → Build anticipation for the story content

3. CTA (Final Line) - Clear Direction:
   → Tell them exactly what to do: "Swipe to see..." / "Tap through..."
   → Create FOMO: what they'll miss if they don't watch
   → Optional: soft engagement prompt (save/share if valuable)
</VIRAL_CAPTION_FORMULA>

<CAPTION_PSYCHOLOGY>
HIGH-PERFORMING PATTERNS:
✓ "Most people don't know that [shocking fact]..."
✓ "[Specific number] - that's [context that makes it impactful]"
✓ "I spent [X hours/days] researching [topic]. Here's what I found..."
✓ "This changed how I think about [topic]..."
✓ "The [topic] industry doesn't want you to know this..."

AVOID:
✗ "Hey guys!" or generic greetings
✗ "Check out my new post" (zero value)
✗ Starting with "Did you know" (overused)
✗ Asking questions without providing value first
✗ Generic CTAs like "link in bio"
</CAPTION_PSYCHOLOGY>

<HASHTAG_STRATEGY>
Provide exactly 3 hashtags optimized for discovery:
1. Niche hashtag (specific to topic, 10K-500K posts)
2. Community hashtag (targets interested audience)
3. Broad reach hashtag (1M+ posts for discovery)

Format: Without # symbol, CamelCase
</HASHTAG_STRATEGY>

<OUTPUT_FORMAT>
Return ONLY valid JSON. No markdown, no explanation.

{{"caption": "Your 2-4 sentence viral caption here", "hashtags": ["NicheTag", "CommunityTag", "BroadTag"]}}
</OUTPUT_FORMAT>

<QUALITY_CHECK>
Before outputting, verify:
□ Does the first line stop the scroll?
□ Would YOU want to swipe after reading this?
□ Is there a clear reason to watch NOW vs later (they won't)?
□ Are hashtags relevant and properly sized?
</QUALITY_CHECK>

LANGUAGE: English only. Generate the caption now."""

    try:
        response = gemini_client.models.generate_content(
            model='gemini-3-flash',
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
