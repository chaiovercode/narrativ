"""
Services package - modular service layer for story generation.
"""

# Research services
from .research import research_topic, research_story_concept

# Image generation services
from .image import generate_story_image, generate_story_from_plan, create_story_series

# Brand kit services
from .brand import get_brand_config, save_brand_config, apply_watermark

# RSS feed services
from .rss import fetch_rss_topics, get_rss_story_topics

# Trending topics services
from .trending import get_trending_topics

# Caption generation services
from .caption import generate_story_caption

# Aesthetic definition services
from .aesthetic import define_series_aesthetic

# Text-to-slides services
from .text_to_slides import create_slides_from_text

# Styles services
from .styles import (
    get_predefined_styles,
    get_style_by_id,
    load_custom_styles,
    save_custom_style,
    delete_custom_style,
    extract_style_from_image,
    PREDEFINED_STYLES
)

__all__ = [
    # Research
    "research_topic",
    "research_story_concept",
    # Image
    "generate_story_image",
    "generate_story_from_plan",
    "create_story_series",
    # Brand
    "get_brand_config",
    "save_brand_config",
    "apply_watermark",
    # RSS
    "fetch_rss_topics",
    "get_rss_story_topics",
    # Trending
    "get_trending_topics",
    # Caption
    "generate_story_caption",
    # Aesthetic
    "define_series_aesthetic",
    # Text-to-slides
    "create_slides_from_text",
    # Styles
    "get_predefined_styles",
    "get_style_by_id",
    "load_custom_styles",
    "save_custom_style",
    "delete_custom_style",
    "extract_style_from_image",
    "PREDEFINED_STYLES",
]
