"""
RSS feed service - fetch news from RSS feeds.
"""

import feedparser
from config import RSS_FEEDS


def fetch_rss_topics(category: str = None, limit: int = 10) -> list:
    """
    Fetch latest news topics from RSS feeds.
    Returns list of dicts with title, summary, link, published, source.
    """
    feeds_to_fetch = []

    if category and category.lower() in RSS_FEEDS:
        feeds_to_fetch = RSS_FEEDS[category.lower()]
    else:
        for feed_list in RSS_FEEDS.values():
            feeds_to_fetch.extend(feed_list)

    all_entries = []

    for feed_url in feeds_to_fetch[:4]:
        try:
            print(f"   [rss] Fetching: {feed_url[:50]}...")
            feed = feedparser.parse(feed_url)

            for entry in feed.entries[:5]:
                all_entries.append({
                    "title": entry.get("title", ""),
                    "summary": entry.get("summary", entry.get("description", ""))[:200],
                    "link": entry.get("link", ""),
                    "published": entry.get("published", ""),
                    "source": feed.feed.get("title", "Unknown"),
                })
        except Exception as e:
            print(f"   [rss] Failed for {feed_url}: {e}")

    print(f"   [rss] Fetched {len(all_entries)} entries")
    return all_entries[:limit]


def get_rss_story_topics(category: str = None) -> list:
    """Get story-ready topics from RSS feeds."""
    entries = fetch_rss_topics(category, limit=10)
    return [entry["title"] for entry in entries if entry["title"]]
