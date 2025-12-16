"""
Caching utilities for research results.
"""

import os
import json
import hashlib
import datetime
from config import CACHE_DIR, CACHE_EXPIRY_HOURS


def get_cache_key(text: str) -> str:
    """Generate a cache key from text."""
    return hashlib.md5(text.lower().strip().encode()).hexdigest()


def get_cached(cache_type: str, key: str) -> dict | None:
    """Get cached data if exists and not expired."""
    cache_file = os.path.join(CACHE_DIR, f"{cache_type}_{key}.json")
    if not os.path.exists(cache_file):
        return None

    try:
        with open(cache_file, 'r') as f:
            cached = json.load(f)

        cached_time = datetime.datetime.fromisoformat(cached.get('_cached_at', '2000-01-01'))
        age_hours = (datetime.datetime.now() - cached_time).total_seconds() / 3600

        if age_hours > CACHE_EXPIRY_HOURS:
            os.remove(cache_file)
            return None

        print(f"   [cache] Hit ({cache_type})")
        return cached.get('data')
    except Exception as e:
        print(f"   [cache] Read error: {e}")
        return None


def set_cache(cache_type: str, key: str, data: dict):
    """Store data in cache."""
    cache_file = os.path.join(CACHE_DIR, f"{cache_type}_{key}.json")
    try:
        with open(cache_file, 'w') as f:
            json.dump({
                '_cached_at': datetime.datetime.now().isoformat(),
                'data': data
            }, f)
        print(f"   [cache] Stored ({cache_type})")
    except Exception as e:
        print(f"   [cache] Write error: {e}")
