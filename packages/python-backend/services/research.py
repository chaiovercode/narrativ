"""
Research service - deep research and story concept generation.
Enhanced with topic classification, parallel search, and AI fact extraction.
"""

import json
import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from utils.cache import get_cache_key, get_cached, set_cache
from utils.search import search, deep_search
from utils.json_utils import clean_json_response
from .llm import generate_text


# Topic category definitions for smarter query generation
TOPIC_CATEGORIES = {
    "sports": {
        "keywords": ["football", "soccer", "basketball", "cricket", "tennis", "olympics", "world cup", "league", "championship", "player", "team", "match", "game", "athlete", "coach", "stadium", "nba", "nfl", "fifa", "premier league", "la liga", "uefa", "ipl"],
        "query_templates": [
            "{topic} latest match results {year}",
            "{topic} season statistics {year}",
            "{topic} transfer news {year}",
            "{topic} records achievements history",
            "{topic} upcoming fixtures schedule",
        ]
    },
    "technology": {
        "keywords": ["ai", "artificial intelligence", "software", "app", "startup", "tech", "computer", "phone", "iphone", "android", "google", "apple", "microsoft", "amazon", "robot", "machine learning", "blockchain", "crypto", "programming"],
        "query_templates": [
            "{topic} latest updates {year}",
            "{topic} features specifications",
            "{topic} comparison review {year}",
            "{topic} future predictions {year}",
            "{topic} impact industry",
        ]
    },
    "science": {
        "keywords": ["research", "study", "discovery", "space", "nasa", "planet", "climate", "environment", "biology", "physics", "chemistry", "medicine", "health", "disease", "vaccine", "dna", "evolution", "quantum"],
        "query_templates": [
            "{topic} latest research {year}",
            "{topic} scientific discovery",
            "{topic} facts data statistics",
            "{topic} impact implications",
            "{topic} expert analysis",
        ]
    },
    "history": {
        "keywords": ["ancient", "historical", "century", "war", "empire", "civilization", "king", "queen", "dynasty", "monument", "heritage", "museum", "archaeological"],
        "query_templates": [
            "{topic} historical facts",
            "{topic} timeline events",
            "{topic} significance importance",
            "{topic} current status today",
            "{topic} interesting stories",
        ]
    },
    "entertainment": {
        "keywords": ["movie", "film", "actor", "actress", "music", "singer", "album", "concert", "celebrity", "hollywood", "bollywood", "netflix", "streaming", "tv show", "series"],
        "query_templates": [
            "{topic} latest news {year}",
            "{topic} biography career",
            "{topic} awards achievements",
            "{topic} upcoming projects {year}",
            "{topic} interesting facts",
        ]
    },
    "business": {
        "keywords": ["company", "stock", "market", "economy", "finance", "investment", "ceo", "billion", "revenue", "profit", "startup", "ipo", "merger", "acquisition"],
        "query_templates": [
            "{topic} financial performance {year}",
            "{topic} market analysis {year}",
            "{topic} company news {year}",
            "{topic} growth strategy",
            "{topic} industry impact",
        ]
    },
    "politics": {
        "keywords": ["election", "president", "prime minister", "government", "parliament", "congress", "policy", "law", "vote", "campaign", "democrat", "republican", "party"],
        "query_templates": [
            "{topic} latest developments {year}",
            "{topic} policy decisions {year}",
            "{topic} public opinion polls",
            "{topic} impact analysis",
            "{topic} historical context",
        ]
    },
    "lifestyle": {
        "keywords": ["food", "recipe", "travel", "destination", "fashion", "fitness", "health", "wellness", "diet", "restaurant", "hotel", "vacation"],
        "query_templates": [
            "{topic} best recommendations {year}",
            "{topic} tips guide",
            "{topic} trends {year}",
            "{topic} facts benefits",
            "{topic} expert advice",
        ]
    },
}


def _classify_topic(topic: str) -> str:
    """
    Classifies a topic into a category for smarter query generation.
    Returns category name or 'general' if no match.
    """
    topic_lower = topic.lower()

    # Score each category
    scores = {}
    for category, config in TOPIC_CATEGORIES.items():
        score = sum(1 for keyword in config["keywords"] if keyword in topic_lower)
        if score > 0:
            scores[category] = score

    if scores:
        best_category = max(scores, key=scores.get)
        return best_category

    return "general"


def _generate_smart_queries(topic: str, category: str) -> dict:
    """
    Generates targeted search queries based on topic category.
    Returns dict with 'deep' and 'basic' query lists.
    """
    current_year = datetime.datetime.now().year

    if category in TOPIC_CATEGORIES:
        templates = TOPIC_CATEGORIES[category]["query_templates"]
        # Use first 2 templates for deep search, rest for basic
        deep_queries = [t.format(topic=topic, year=current_year) for t in templates[:2]]
        basic_queries = [t.format(topic=topic, year=current_year) for t in templates[2:]]
    else:
        # General fallback queries
        deep_queries = [
            f"{topic} {current_year}",
            f"{topic} latest news {current_year}",
        ]
        basic_queries = [
            f"{topic} statistics data {current_year}",
            f"{topic} facts history",
            f"{topic} current situation today",
        ]

    return {"deep": deep_queries, "basic": basic_queries}


def _execute_search(query: str, search_type: str, max_results: int = 3) -> list:
    """Worker function for parallel search execution."""
    try:
        if search_type == "deep":
            return deep_search(query, max_results=max_results)
        else:
            return search(query, max_results=max_results)
    except Exception as e:
        print(f"      [!] Search failed for '{query[:30]}...': {e}")
        return []


def _extract_and_dedupe_facts(raw_content: str, topic: str) -> str:
    """
    Uses AI to extract clean, deduplicated facts from raw search results.
    Returns structured fact list.
    """
    if not raw_content or len(raw_content) < 100:
        return raw_content

    prompt = f"""<ROLE>
You are a research analyst extracting key facts from search results.
</ROLE>

<TASK>
Extract the most important, unique facts about "{topic}" from these search results.
</TASK>

<RAW_SEARCH_RESULTS>
{raw_content[:8000]}
</RAW_SEARCH_RESULTS>

<EXTRACTION_RULES>
1. Extract 10-15 unique, specific facts
2. Prioritize facts with numbers, dates, statistics
3. Remove duplicate or near-duplicate information
4. Keep only verifiable, factual statements
5. Include source attribution where available
6. Prefer recent information (2024-2025) for current events
7. For each fact, include the specific number/date/statistic
</EXTRACTION_RULES>

<OUTPUT_FORMAT>
Return facts as a numbered list, one per line:
1. [Fact with specific number/date]
2. [Another unique fact]
...

No other text or explanation.
</OUTPUT_FORMAT>"""

    try:
        extracted = generate_text(prompt)
        if extracted and len(extracted) > 50:
            print(f"   [research] AI extracted and deduplicated facts")
            return extracted
    except Exception as e:
        print(f"   [research] Fact extraction failed: {e}")

    return raw_content


def _deep_research(topic: str) -> dict:
    """
    Performs deep research on a topic using intelligent query generation,
    parallel search execution, and AI-powered fact extraction.

    Features:
    - Topic classification for targeted queries
    - Parallel search execution (faster)
    - AI deduplication of facts
    - Source quality tracking

    Returns dict with 'content' (for AI) and 'sources' (for display).
    Results are cached for 24 hours.
    """
    cache_key = get_cache_key(topic)
    cached = get_cached("research", cache_key)
    if cached:
        print(f"   [research] Using cached research for '{topic}'")
        return cached

    print(f"   [research] Deep researching '{topic}'...")

    # Classify topic for smarter queries
    category = _classify_topic(topic)
    print(f"   [research] Topic category: {category}")

    # Generate targeted queries
    queries = _generate_smart_queries(topic, category)
    print(f"   [research] Generated {len(queries['deep'])} deep + {len(queries['basic'])} basic queries")

    all_facts = []
    sources = []
    seen_urls = set()

    # Execute searches in parallel
    search_tasks = []
    for q in queries['deep']:
        search_tasks.append((q, "deep"))
    for q in queries['basic']:
        search_tasks.append((q, "basic"))

    print(f"   [research] Executing {len(search_tasks)} searches in parallel...")

    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_query = {
            executor.submit(_execute_search, query, search_type): (query, search_type)
            for query, search_type in search_tasks
        }

        for future in as_completed(future_to_query):
            query, search_type = future_to_query[future]
            try:
                results = future.result()
                prefix = "Deep" if search_type == "deep" else "Basic"
                print(f"      -> {prefix}: {query[:40]}... ({len(results)} results)")

                for r in results:
                    if r.get('content') and len(r['content']) > 50:
                        all_facts.append(f"[{r.get('title', 'Unknown')}]: {r['content']}")
                        url = r.get('url', '')
                        if url and url not in seen_urls:
                            seen_urls.add(url)
                            sources.append({
                                "title": r.get('title', 'Unknown'),
                                "url": url,
                                "type": search_type
                            })
            except Exception as e:
                print(f"      [!] Failed: {query[:30]}... - {e}")

    if all_facts:
        # Deduplicate facts
        unique_facts = list(set(all_facts))[:20]
        raw_content = "\n\n".join(unique_facts)

        # AI extraction and deduplication
        extracted_content = _extract_and_dedupe_facts(raw_content, topic)

        print(f"   [research] Gathered {len(unique_facts)} snippets from {len(sources)} sources")

        # Sort sources: deep searches first, then by title length (shorter = more authoritative)
        sources.sort(key=lambda x: (0 if x.get('type') == 'deep' else 1, len(x.get('title', ''))))

        result = {
            "content": extracted_content,
            "sources": sources[:10],
            "category": category,
            "query_count": len(search_tasks)
        }
        set_cache("research", cache_key, result)
        return result
    else:
        print(f"   [research] No data found, using AI knowledge only")
        return {"content": "", "sources": [], "category": category}


def _get_category_specific_guidance(category: str) -> str:
    """Returns category-specific storytelling guidance."""
    guidance = {
        "sports": """
<CATEGORY_GUIDANCE: SPORTS>
- Lead with records, statistics, or historic moments
- Include player names, team achievements, scores
- Use dynamic action-oriented visual descriptions
- Reference rivalries, comebacks, underdog stories
- Make fans feel the excitement and drama
</CATEGORY_GUIDANCE>""",
        "technology": """
<CATEGORY_GUIDANCE: TECHNOLOGY>
- Lead with impact numbers (users, market size, speed)
- Explain complex tech in simple, visual terms
- Compare to relatable things ("faster than X")
- Include future implications and predictions
- Make innovation feel tangible and exciting
</CATEGORY_GUIDANCE>""",
        "science": """
<CATEGORY_GUIDANCE: SCIENCE>
- Lead with mind-blowing discoveries or statistics
- Use analogies to make scale understandable
- Include researcher names and institutions for credibility
- Show real-world applications and implications
- Balance wonder with accuracy
</CATEGORY_GUIDANCE>""",
        "history": """
<CATEGORY_GUIDANCE: HISTORY>
- Lead with surprising historical facts
- Connect past events to present relevance
- Include specific dates, names, places
- Reveal lesser-known stories behind famous events
- Make history feel alive and relevant
</CATEGORY_GUIDANCE>""",
        "entertainment": """
<CATEGORY_GUIDANCE: ENTERTAINMENT>
- Lead with surprising career facts or achievements
- Include box office numbers, awards, records
- Reference iconic moments and quotes
- Show behind-the-scenes insights
- Connect celebrity stories to broader cultural impact
</CATEGORY_GUIDANCE>""",
        "business": """
<CATEGORY_GUIDANCE: BUSINESS>
- Lead with impressive financial metrics
- Include market position, growth rates, valuations
- Reference founders, CEOs, key decisions
- Show competitive landscape and disruption
- Make business stories human and relatable
</CATEGORY_GUIDANCE>""",
        "politics": """
<CATEGORY_GUIDANCE: POLITICS>
- Lead with policy impact on real people
- Include polling numbers, electoral data
- Present balanced, factual information
- Reference historical precedents
- Focus on what matters to ordinary citizens
</CATEGORY_GUIDANCE>""",
        "lifestyle": """
<CATEGORY_GUIDANCE: LIFESTYLE>
- Lead with surprising benefits or facts
- Include practical tips and recommendations
- Reference expert opinions and studies
- Show aspirational yet achievable content
- Make information immediately actionable
</CATEGORY_GUIDANCE>""",
    }
    return guidance.get(category, "")


def research_topic(topic: str, num_slides: int = 5) -> dict:
    """
    Researches a topic deeply and creates fact-rich story slides.
    Uses intelligent web search with topic classification, then Gemini for storytelling.
    Returns dict with 'slides', 'sources', and 'category'.
    """
    print(f"[research] Researching '{topic}' ({num_slides} slides)...")

    research_result = _deep_research(topic)
    research_content = research_result.get("content", "")
    sources = research_result.get("sources", [])
    category = research_result.get("category", "general")

    research_section = ""
    if research_content:
        research_section = f"""
<VERIFIED_RESEARCH_DATA>
{research_content}
</VERIFIED_RESEARCH_DATA>

<RESEARCH_USAGE_RULES>
1. ONLY use facts from the research data above or universally known verified facts
2. NEVER fabricate statistics, dates, or claims not in the research
3. For current events (sports, politics, tech): Use ONLY 2024-2025 data
4. For historical topics: Include both historical facts AND current relevance
5. When research conflicts, prefer more recent sources
6. Every key_fact MUST include a specific number, date, or statistic
</RESEARCH_USAGE_RULES>
"""

    # Get category-specific guidance
    category_guidance = _get_category_specific_guidance(category)

    prompt = f"""<ROLE>
You are a world-class content strategist who has created viral educational content for National Geographic, BBC, and The Economist. You specialize in transforming complex topics into scroll-stopping social media stories that educate and captivate.

Your content has:
- Generated 100M+ views across platforms
- Been featured by major publications
- Set the standard for educational entertainment
</ROLE>

<TASK>
Create a {num_slides}-slide Instagram/WhatsApp story series about: "{topic}"
Topic Category: {category.upper()}
</TASK>
{research_section}{category_guidance}
<STORYTELLING_FRAMEWORK>

SLIDE 1 - THE HOOK (Pattern Interrupt):
→ Lead with your most shocking/counterintuitive fact from the research
→ Create cognitive dissonance or challenge assumptions
→ Use specific numbers for credibility (not "many" but "47 million")
→ Goal: Stop the scroll in 0.5 seconds
→ Make them think "Wait, WHAT?!"

SLIDES 2 to {num_slides - 1} - THE JOURNEY (Value Delivery):
→ Each slide = ONE powerful fact + ONE visual moment
→ Build narrative momentum - each slide should make them NEED the next
→ Vary the emotion arc: awe → concern → hope → surprise → wonder
→ Include human elements: names, places, real people affected
→ Make complex information feel simple and visual

SLIDE {num_slides} - THE PAYOFF (Memorable Close):
→ Most shareable insight or call to awareness
→ Leave them with something to think about for days
→ Create "I need to tell someone this RIGHT NOW" feeling
→ End on hope, action, or profound realization

</STORYTELLING_FRAMEWORK>

<VISUAL_DESCRIPTION_MASTERCLASS>
Your visual_description will be sent to an AI image generator. Write it like an award-winning film director:

COMPOSITION TECHNIQUES:
- Specify camera angle: aerial drone shot, intimate close-up, sweeping wide shot, Dutch angle
- Define lighting: golden hour backlighting, harsh noon shadows, soft diffused overcast, dramatic Rembrandt lighting
- Place focal subject using rule of thirds or dead center for impact
- Layer depth: specific foreground element → subject in midground → atmospheric background

ATMOSPHERE & MOOD:
- Environmental effects: morning mist, dust particles in light beams, rain-slicked surfaces
- Color temperature: warm amber sunset, cool blue twilight, neutral daylight
- Texture: rough concrete, polished metal, organic wood grain

SIGNATURE ELEMENTS:
- One unique visual hook that makes this image unforgettable
- Motion suggestion: frozen action, implied movement, dynamic tension
- Scale indicators: human figure for massive objects, everyday object for tiny things

AVOID AT ALL COSTS:
✗ Generic descriptions ("beautiful", "nice", "amazing")
✗ Text instructions in visual description
✗ Multiple competing focal points
✗ Physically impossible scenes
✗ Clichéd stock photo compositions

</VISUAL_DESCRIPTION_MASTERCLASS>

<TITLE_ENGINEERING>
Titles must create instant curiosity using psychological triggers:

POWER PATTERNS:
✓ "The [Adjective] [Noun]" - "The Hidden Cost", "The Silent Killer"
✓ "[Number] [Surprising Element]" - "47 Million Forgotten"
✓ "[Action] [Unexpected Object]" - "Breaking Silence"
✓ "Against [Obstacle]" - "Against All Odds"
✓ "[Possessive] Secret" - "Nature's Secret", "History's Lie"

FORBIDDEN PATTERNS:
✗ Years in titles (2024, 2025)
✗ "Amazing Facts About..."
✗ "Did You Know..."
✗ "Top X Things..."
✗ Generic words: great, awesome, incredible

Maximum 5 words. Every word must earn its place.
</TITLE_ENGINEERING>

<OUTPUT_SCHEMA>
Return ONLY a valid JSON array. No markdown code blocks. No explanation. No preamble.

[
  {{
    "slide_number": 1,
    "title": "Powerful Title Here",
    "key_fact": "Specific verifiable fact with exact number/date/statistic in 15-25 words",
    "visual_description": "Cinematic scene description with camera angle, lighting, composition, atmosphere in 50-70 words",
    "mood": "Single powerful emotion word"
  }}
]
</OUTPUT_SCHEMA>

<FINAL_QUALITY_GATE>
Before outputting, ruthlessly verify EACH slide passes ALL checks:

□ TITLE: Creates instant "I need to know more" curiosity?
□ KEY_FACT: Contains specific, verifiable number/date/statistic from research?
□ VISUAL: Would make an award-winning photograph? Specific enough for AI to generate?
□ FLOW: Does this slide create desperate need to see the next one?
□ SHAREABILITY: Would someone screenshot this to share with friends?

If ANY slide fails ANY check, rewrite it before outputting.
</FINAL_QUALITY_GATE>

LANGUAGE: English only. Generate exactly {num_slides} slides now."""

    try:
        response_text = generate_text(prompt)
        text = clean_json_response(response_text)
        slides = json.loads(text)
        print(f"   [research] Created {len(slides)} slides ({category} category)")
        return {"slides": slides, "sources": sources, "category": category}
    except json.JSONDecodeError as e:
        print(f"   [research] JSON parse failed: {e}")
        print(f"   [research] Raw response: {response_text[:500]}...")
        return None
    except Exception as e:
        print(f"   [research] Failed: {e}")
        return None


def research_story_concept(topic: str, num_slides: int = 5, user_aesthetic: str = None) -> dict:
    """
    Phase 1: Research and plan the story without generating images.
    Returns a plan object for user review/editing, including sources and category.

    Features:
    - Topic classification for targeted research queries
    - Parallel search execution (5 workers)
    - AI-powered fact extraction and deduplication
    - Category-specific storytelling guidance
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
    category = research_result.get("category", "general")

    caption_data = generate_story_caption(topic, slides)

    print(f"\n[research] Story Plan ({category}):")
    for slide in slides:
        print(f"   {slide['slide_number']}. {slide['title']}")

    if sources:
        print(f"\n[research] Sources ({len(sources)}):")
        for src in sources[:5]:
            title = src.get('title', 'Unknown')[:50]
            src_type = src.get('type', 'basic')
            print(f"   - [{src_type}] {title}...")

    return {
        "topic": topic,
        "category": category,
        "aesthetic": aesthetic,
        "slides": slides,
        "sources": sources,
        "caption": caption_data.get("caption", ""),
        "hashtags": caption_data.get("hashtags", [])
    }


def _extract_keywords(text: str) -> set:
    """Extract meaningful keywords from text for semantic comparison."""
    import re
    # Common stop words to ignore
    stop_words = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
                  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
                  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
                  'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
                  'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
                  'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here',
                  'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
                  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
                  'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
                  'because', 'until', 'while', 'although', 'though', 'this', 'that', 'these',
                  'those', 'it', 'its', 'they', 'their', 'them', 'we', 'our', 'you', 'your',
                  'he', 'she', 'him', 'her', 'his', 'still', 'also', 'ever', 'first', 'last'}

    # Extract words, convert to lowercase, filter stop words and short words
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    return {w for w in words if w not in stop_words}


def _is_semantically_similar(slide1: dict, slide2: dict, threshold: float = 0.4) -> bool:
    """Check if two slides are semantically similar based on keyword overlap."""
    # Combine title and key_fact for comparison
    text1 = f"{slide1.get('title', '')} {slide1.get('key_fact', '')}"
    text2 = f"{slide2.get('title', '')} {slide2.get('key_fact', '')}"

    keywords1 = _extract_keywords(text1)
    keywords2 = _extract_keywords(text2)

    if not keywords1 or not keywords2:
        return False

    # Calculate Jaccard similarity
    intersection = len(keywords1 & keywords2)
    union = len(keywords1 | keywords2)
    similarity = intersection / union if union > 0 else 0

    return similarity >= threshold


def add_slides_to_research(topic: str, existing_slides: list, additional_count: int, aesthetic: dict = None) -> dict:
    """
    Add more slides to existing research.
    Continues from existing slide numbers and uses cached research if available.
    Uses semantic similarity to avoid duplicate topics.
    """
    print(f"\n[research] Adding {additional_count} slides to '{topic}'")
    print(f"   [research] Existing slides: {len(existing_slides)}")

    # Get the starting slide number
    max_slide_num = max(s.get('slide_number', 0) for s in existing_slides) if existing_slides else 0

    # Build existing content summary for AI prompt
    existing_summaries = []
    for s in existing_slides:
        title = s.get('title', '')
        fact = s.get('key_fact', '')
        existing_summaries.append(f"- {title}: {fact[:100]}...")

    # Get category
    category = _classify_topic(topic)
    guidance = _get_category_specific_guidance(category)

    # Generate new slides directly with AI, providing full context of existing content
    print(f"   [research] Generating {additional_count} unique slides with AI...")

    prompt = f"""<TASK>
Generate exactly {additional_count} NEW story slides about "{topic}".

CRITICAL: These slides must cover COMPLETELY DIFFERENT aspects than the existing ones below.
Do NOT repeat or rephrase any of the existing topics.

EXISTING SLIDES (DO NOT DUPLICATE THESE TOPICS):
{chr(10).join(existing_summaries)}

{guidance}

Generate {additional_count} slides about DIFFERENT aspects such as:
- Key players/people not yet mentioned
- Different time periods or events
- Impact/legacy not covered
- Behind-the-scenes stories
- Statistical records not mentioned
- Cultural or social impact
- Controversies or challenges
- Future implications

Each slide MUST be about a distinctly different angle than all existing slides.
</TASK>

<OUTPUT_FORMAT>
Return ONLY valid JSON array with exactly {additional_count} slides:
[
  {{
    "title": "Unique catchy title about NEW topic",
    "key_fact": "Specific fact with data - must be different from existing facts",
    "visual_description": "Detailed scene description in 50-70 words"
  }}
]
</OUTPUT_FORMAT>"""

    new_slides = []
    try:
        response_text = generate_text(prompt)
        text = clean_json_response(response_text)
        generated_slides = json.loads(text)

        # Filter out any slides that are still semantically similar to existing ones
        for slide in generated_slides:
            is_duplicate = any(
                _is_semantically_similar(slide, existing)
                for existing in existing_slides
            )
            # Also check against already accepted new slides
            is_duplicate = is_duplicate or any(
                _is_semantically_similar(slide, accepted)
                for accepted in new_slides
            )

            if not is_duplicate and len(new_slides) < additional_count:
                new_slides.append(slide)
                print(f"   [research] Added unique slide: {slide.get('title', '')[:50]}")
            elif is_duplicate:
                print(f"   [research] Skipped duplicate: {slide.get('title', '')[:50]}")

    except Exception as e:
        print(f"   [research] AI generation failed: {e}")

    # Renumber new slides
    for i, slide in enumerate(new_slides):
        slide['slide_number'] = max_slide_num + i + 1

    # Combine existing and new slides
    combined_slides = existing_slides + new_slides

    print(f"   [research] Added {len(new_slides)} new slides (total: {len(combined_slides)})")

    return {
        "slides": combined_slides,
        "new_sources": []
    }
