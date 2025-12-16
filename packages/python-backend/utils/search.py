"""
Search utilities - DuckDuckGo (default) and Tavily (deep research).
"""

from config import TAVILY_API_KEY

# Initialize search clients
_tavily_client = None
_ddgs_available = False

# DuckDuckGo is default (free)
try:
    from ddgs import DDGS
    _ddgs_available = True
    print("[search] DuckDuckGo enabled (default, free)")
except ImportError:
    print("[search] DuckDuckGo (ddgs) not installed")

# Tavily for deep research (paid)
if TAVILY_API_KEY:
    try:
        from tavily import TavilyClient
        _tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
        print("[search] Tavily enabled (deep research)")
    except ImportError:
        print("[search] Tavily not installed")


def _search_tavily(query: str, max_results: int = 5) -> list:
    """Search using Tavily API."""
    if not _tavily_client:
        return []
    try:
        result = _tavily_client.search(query=query, search_depth="advanced", max_results=max_results)
        return [
            {"title": r.get('title', ''), "content": r.get('content', ''), "url": r.get('url', '')}
            for r in result.get('results', [])
        ]
    except Exception as e:
        print(f"   [search] Tavily failed: {e}")
        return []


def _search_ddgs(query: str, max_results: int = 5, region: str = "wt-wt", news_mode: bool = False) -> list:
    """Search using DuckDuckGo."""
    if not _ddgs_available:
        return []
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            if news_mode:
                # Use news search for better trending topics
                results = list(ddgs.news(query, region=region, max_results=max_results))
            else:
                # Use standard text search for general info
                results = list(ddgs.text(query, region=region, max_results=max_results))
                
            return [
                {"title": r.get('title', ''), "content": r.get('body', ''), "url": r.get('href', '')}
                for r in results
            ]
    except Exception as e:
        print(f"   [search] DuckDuckGo failed: {e}")
        return []


def search(query: str, max_results: int = 5, region: str = "wt-wt", news_mode: bool = False) -> list:
    """Search using DuckDuckGo (free, default)."""
    if _ddgs_available:
        return _search_ddgs(query, max_results, region, news_mode)
    elif _tavily_client:
        return _search_tavily(query, max_results)
    return []


def deep_search(query: str, max_results: int = 5) -> list:
    """Deep search using Tavily (paid, higher quality) with DDGS fallback."""
    if _tavily_client:
        return _search_tavily(query, max_results)
    elif _ddgs_available:
        return _search_ddgs(query, max_results)
    return []
