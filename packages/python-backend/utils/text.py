"""
Shared text utilities across services.
"""

import re
import time
from typing import Optional


def slugify(text: str, max_length: int = 50) -> str:
    """
    Convert text to URL-friendly slug.

    Args:
        text: Input text to slugify
        max_length: Maximum length of the slug (default 50)

    Returns:
        Slugified string
    """
    if not text:
        return 'untitled'
    clean = re.sub(r'[^\w\s-]', '', text.lower())
    clean = re.sub(r'[-\s]+', '-', clean).strip('-')
    return clean[:max_length] if clean else 'untitled'


def generate_id(prefix: str = '') -> str:
    """
    Generate a unique ID based on timestamp.

    Args:
        prefix: Optional prefix for the ID

    Returns:
        Unique ID string
    """
    timestamp = int(time.time() * 1000)
    if prefix:
        return f"{prefix}_{timestamp}"
    return str(timestamp)


def truncate(text: str, max_length: int, suffix: str = '...') -> str:
    """
    Truncate text to max length with suffix.

    Args:
        text: Input text
        max_length: Maximum length including suffix
        suffix: Suffix to add when truncated

    Returns:
        Truncated string
    """
    if not text or len(text) <= max_length:
        return text or ''
    return text[:max_length - len(suffix)] + suffix
