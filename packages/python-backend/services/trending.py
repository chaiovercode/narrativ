"""
Trending topics service - fetch trending topics by category.
"""

import json
from config import CATEGORY_QUERIES, CATEGORY_REGIONS
from utils.search import search
from utils.json_utils import clean_json_response
from .clients import gemini_client


def _get_fallback_topics(category: str) -> list:
    """Fallback topics when search fails."""
    fallbacks = {
        "tech": ["Latest iPhone Features", "Electric Vehicle Revolution", "5G Network Expansion", "Smart Home Innovations"],
        "ai": ["ChatGPT's Latest Updates", "AI in Healthcare Diagnosis", "Autonomous Driving Progress", "AI-Generated Art Controversy"],
        "india": ["India's Economic Growth Story", "Digital India Transformation", "Indian Space Program ISRO", "Make in India Success Stories"],
        "world": ["Global Climate Summit Updates", "UN Peace Initiatives", "International Trade Developments", "Global Health Challenges"],
        "politics": ["Election Campaign Updates", "Policy Reform Debates", "Parliamentary Proceedings", "Political Leadership Changes"],
        "sports": ["Champions League Highlights", "NBA Season Updates", "Cricket World Cup Moments", "Tennis Grand Slam News"],
        "movies": ["Upcoming Blockbuster Releases", "Oscar Predictions", "Streaming Wars Update", "Bollywood Box Office Hits"],
        "business": ["Startup Unicorn Stories", "E-commerce Growth Trends", "Remote Work Revolution", "Green Business Initiatives"],
        "finance": ["Stock Market Analysis", "Cryptocurrency Trends", "Investment Strategies", "Personal Finance Tips"],
        "science": ["Mars Exploration Updates", "Climate Change Research", "Medical Breakthroughs", "Ocean Discovery News"],
        "cricket": ["IPL 2025 Updates", "T20 World Cup Highlights", "Ashes Series Drama", "Virat Kohli's Latest Century"]
    }
    return fallbacks.get(category.lower(), ["Trending Topic 1", "Trending Topic 2", "Trending Topic 3", "Trending Topic 4"])


def get_trending_topics(categories) -> list:
    """
    Fetches trending topics for one or more categories using web search.
    Returns 4 topic suggestions based on latest news.
    """
    if isinstance(categories, str):
        categories = [categories]

    categories = [c.lower() for c in categories]
    print(f"[trending] Fetching for: {', '.join(categories)}...")

def _is_valid_result(result: dict) -> bool:
    """Filter out generic homepage/category titles and irrelevant topics."""
    title = result.get('title', '').lower()
    content = result.get('content', '').lower()
    
    # Blocklist for specific irrelevant topics (like IPL skin treatment)
    blacklist = [
        "skin", "laser", "treatment", "hair removal", "facial", 
        "dermatology", "therapy", "pulsed light", "opt", "dpl"
    ]
    if any(term in title for term in blacklist):
        return False

    # Blocklist for generic news headers
    generic_terms = [
        "latest news", "breaking news", "top stories", "headlines", "home page", 
        "click here", "read more", "news portal"
    ]
    
    # Filter if title is just a generic term or very short
    if len(title) < 15: # Increased minimum length
        return False
        
    # Check for "Source: Generic Title" pattern
    if any(term in title for term in generic_terms) and len(title.split()) < 8:
        return False
        
    return True


def get_trending_topics(categories) -> list:
    """
    Fetches trending topics for one or more categories using web search.
    Returns 4 topic suggestions based on latest news.
    """
    if isinstance(categories, str):
        categories = [categories]

    categories = [c.lower() for c in categories]
    print(f"[trending] Fetching for: {', '.join(categories)}...")

    all_results = []
    
    # Adjust results per category
    results_per_cat = 3 if len(categories) > 4 else 5

    # NOTE: Disabling strict 'in-en' region as it was returning poor results (dictionaries/portals).
    # Using 'wt-wt' (global) but with specific queries usually works better for major news.
    region = "wt-wt"

    # If multiple categories, prioritize combined search
    if len(categories) > 1:
        # Multiple search queries for better coverage
        queries = [
            f"{' '.join(categories)} news today",
            f"{' '.join(categories)} latest breaking",
            f"{' '.join(categories)} trending"
        ]
        for query in queries:
            print(f"   [trending] Search: '{query}'")
            results = search(query, max_results=8, region=region, news_mode=True)
            all_results.extend([r for r in results if _is_valid_result(r)])
    else:
        # Single category - multiple search variations for better coverage
        category = categories[0]
        base_query = CATEGORY_QUERIES.get(category, category)
        queries = [
            f"latest {base_query} news today",
            f"{base_query} breaking news",
            f"{base_query} trending today"
        ]
        for query in queries:
            print(f"   [trending] Search: '{query}'")
            results = search(query, max_results=5, region=region, news_mode=True)
            all_results.extend([r for r in results if _is_valid_result(r)])

    # Combined search only for small number of categories
    if 1 < len(categories) <= 3:
        # Create a combined query
        combined_query = f"{' '.join(categories)} news"
        print(f"   [trending] Combined search: '{combined_query}'")
        
        combined_results = search(combined_query, max_results=6, region=region, news_mode=True)
        all_results.extend([r for r in combined_results if _is_valid_result(r)])

    if not all_results:
        print(f"   [trending] No results, using fallback")
        return _get_fallback_topics(categories[0])

    content = "\n".join([f"- {r['title']}: {r['content'][:250]}" for r in all_results])

    if not content:
        return _get_fallback_topics(categories[0])

    # Build prompt
    if 1 < len(categories) <= 3:
        category_context = f"the INTERSECTION of {' and '.join(categories)}"
        example_hint = "CRITICAL: Topics MUST relate to ALL selected categories. (e.g. 'India'+\'Politics' -> 'Indian Parliament passes Bill', NOT just 'Elections')."
    elif len(categories) > 3:
        category_context = f"topics from these categories: {', '.join(categories)}"
        example_hint = "Provide a mix of distinct topics."
    else:
        category_context = categories[0]
        example_hint = "Focus on specific BREAKING news. (e.g. 'Player X sold to Team Y', NOT 'IPL Updates')."

    prompt = f"""Based on these latest news snippets about {category_context}:

{content}

IMPORTANT: Write ALL topics in ENGLISH only, regardless of the source language.

Extract exactly 4 interesting, specific topics for visual story content.
Requirements:
- MUST be based on the provided news snippets (do not hallucinate)
- CRITICAL: Do NOT return generic headers like "Latest News", "Top Headlines".
- Only return specific EVENTS with subjects and actions (e.g. "Govt announces new policy", "Player X wins match").
- Suitable for Instagram stories
- Concise (5-10 words each)
{example_hint}

Return as JSON array of strings only. No markdown."""

    try:
        response = gemini_client.models.generate_content(
            model='gemini-3-flash',
            contents=prompt
        )
        text = clean_json_response(response.text)
        topics = json.loads(text)
        print(f"   [trending] Found {len(topics)} topics")
        return topics[:4]
    except Exception as e:
        print(f"   [trending] Extraction failed: {e}")
        return _get_fallback_topics(categories[0])
