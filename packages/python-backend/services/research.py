"""
Research service - deep research and story concept generation.
"""

import json
import datetime
from utils.cache import get_cache_key, get_cached, set_cache
from utils.search import search, deep_search
from utils.json_utils import clean_json_response
from .clients import gemini_client


def _deep_research(topic: str) -> dict:
    """
    Performs deep research on a topic using multiple search queries.
    Uses Tavily (paid) for key queries, DuckDuckGo (free) for supplementary.
    Returns dict with 'content' (for AI) and 'sources' (for display).
    Results are cached for 24 hours.
    """
    cache_key = get_cache_key(topic)
    cached = get_cached("research", cache_key)
    if cached:
        return cached

    print(f"   [research] Deep researching '{topic}'...")

    all_facts = []
    sources = []
    current_year = datetime.datetime.now().year

    # Key queries use Tavily (deep search) for quality
    deep_queries = [
        f"{topic} {current_year}",
        f"{topic} latest news {current_year}",
    ]

    # Supplementary queries use DuckDuckGo (free)
    basic_queries = [
        f"{topic} statistics data {current_year}",
        f"{topic} facts history",
        f"{topic} current situation today",
    ]

    seen_urls = set()

    # Deep search (Tavily) for key queries
    for query in deep_queries:
        print(f"      -> Deep: {query[:50]}...")
        results = deep_search(query, max_results=3)
        for r in results:
            if r['content'] and len(r['content']) > 50:
                all_facts.append(f"[{r['title']}]: {r['content']}")
                if r['url'] and r['url'] not in seen_urls:
                    seen_urls.add(r['url'])
                    sources.append({"title": r['title'], "url": r['url']})

    # Basic search (DuckDuckGo) for supplementary queries
    for query in basic_queries:
        print(f"      -> Basic: {query[:50]}...")
        results = search(query, max_results=3)
        for r in results:
            if r['content'] and len(r['content']) > 50:
                all_facts.append(f"[{r['title']}]: {r['content']}")
                if r['url'] and r['url'] not in seen_urls:
                    seen_urls.add(r['url'])
                    sources.append({"title": r['title'], "url": r['url']})

    unique_facts = list(set(all_facts))[:15]

    if unique_facts:
        print(f"   [research] Gathered {len(unique_facts)} snippets from {len(sources)} sources")
        result = {
            "content": "\n\n".join(unique_facts),
            "sources": sources[:10]
        }
        set_cache("research", cache_key, result)
        return result
    else:
        print(f"   [research] No data found, using AI knowledge only")
        return {"content": "", "sources": []}


def research_topic(topic: str, num_slides: int = 5) -> dict:
    """
    Researches a topic deeply and creates fact-rich story slides.
    Uses web search for real data, then Gemini for storytelling.
    Returns dict with 'slides' and 'sources'.
    """
    print(f"[research] Researching '{topic}' ({num_slides} slides)...")

    research_result = _deep_research(topic)
    research_content = research_result.get("content", "")
    sources = research_result.get("sources", [])

    research_section = ""
    if research_content:
        research_section = f"""
=====================================================
VERIFIED RESEARCH DATA - USE THESE FACTS:
=====================================================
{research_content}
=====================================================

IMPORTANT: Base your slides on the REAL FACTS above.
Use specific numbers, dates, statistics, and details from the research.
Do NOT make up facts - only use information from the research data or well-known verified facts.

CRITICAL - RECENCY RULES:
- For current events/issues (pollution, politics, sports, tech): USE ONLY 2024-2025 DATA
- For historical topics (monuments, history): Use historical facts BUT mention current status too
- NEVER use outdated statistics when current ones are available
"""

    prompt = f"""You are a researcher and visual storyteller creating an Instagram/WhatsApp story series about: "{topic}"
{research_section}

Create exactly {num_slides} story slides that are FACT-RICH and EDUCATIONAL.

CRITICAL REQUIREMENTS FOR FACTS:
- Every slide MUST include a specific, verifiable fact
- Use REAL numbers: dates, measurements, statistics, percentages
- Include historical facts with actual years/centuries
- Mention specific names of architects, builders, rulers when relevant

SLIDE STRUCTURE:
- Slide 1: Hook with a striking fact that grabs attention
- Middle slides: Deep dive with specific facts, history, data
- Final slide: Impact, significance, or call to awareness

CRITICAL - NO YEARS IN TITLES:
- NEVER put years (2023, 2024, 2025, etc.) in slide titles
- Keep ALL titles timeless and punchy

For each slide provide:
1. slide_number (1-{num_slides})
2. title: Short catchy title (max 5 words)
3. key_fact: ONE specific, verifiable fact with real numbers/dates (15-25 words)
4. visual_description: DETAILED scene description for image generation
5. mood: Emotional tone

Return as JSON array only. No markdown, no explanation."""

    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=prompt
        )
        text = clean_json_response(response.text)
        slides = json.loads(text)
        print(f"   [research] Created {len(slides)} slides")
        return {"slides": slides, "sources": sources}
    except json.JSONDecodeError as e:
        print(f"   [research] JSON parse failed: {e}")
        print(f"   [research] Raw response: {response.text[:500]}...")
        return None
    except Exception as e:
        print(f"   [research] Failed: {e}")
        return None


def research_story_concept(topic: str, num_slides: int = 5, user_aesthetic: str = None) -> dict:
    """
    Phase 1: Research and plan the story without generating images.
    Returns a plan object for user review/editing, including sources.
    """
    from .aesthetic import define_series_aesthetic
    from .caption import generate_story_caption

    print(f"\n{'='*50}")
    print(f"[research] PHASE 1: RESEARCH & PLANNING")
    print(f"{'='*50}")
    print(f"Topic: {topic}")
    print(f"Slides: {num_slides}")
    print(f"{'='*50}\n")

    aesthetic = define_series_aesthetic(topic, user_aesthetic)
    research_result = research_topic(topic, num_slides)

    if not research_result:
        return None

    slides = research_result.get("slides", [])
    sources = research_result.get("sources", [])

    caption_data = generate_story_caption(topic, slides)

    print(f"\n[research] Story Plan:")
    for slide in slides:
        print(f"   {slide['slide_number']}. {slide['title']}")

    if sources:
        print(f"\n[research] Sources ({len(sources)}):")
        for src in sources[:5]:
            print(f"   - {src['title'][:50]}...")

    return {
        "topic": topic,
        "aesthetic": aesthetic,
        "slides": slides,
        "sources": sources,
        "caption": caption_data.get("caption", ""),
        "hashtags": caption_data.get("hashtags", [])
    }
