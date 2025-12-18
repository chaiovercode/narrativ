"""
Configuration and environment setup for Story Generator.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# API Keys
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
FAL_API_KEY = os.getenv("FAL_API_KEY")
HF_API_KEY = os.getenv("HF_API_KEY")

# Directories
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BACKEND_DIR, "generated_stories")
BRAND_DIR = os.path.join(BACKEND_DIR, "brand")
CACHE_DIR = os.path.join(BACKEND_DIR, ".cache")

# Create directories
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(BRAND_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

# Cache settings
CACHE_EXPIRY_HOURS = 24

# Image providers
IMAGE_PROVIDERS = ["gemini-flash", "gemini-pro", "fal", "huggingface"]

# LLM providers
LLM_PROVIDERS = ["gemini", "ollama"]

# Ollama settings
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:latest")  # Default model, auto-detected if available
OLLAMA_URL = "http://localhost:11434"

# RSS Feed sources
RSS_FEEDS = {
    "tech": [
        "https://feeds.arstechnica.com/arstechnica/technology-lab",
        "https://www.theverge.com/rss/index.xml",
    ],
    "world": [
        "https://feeds.bbci.co.uk/news/world/rss.xml",
        "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    ],
    "india": [
        "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
        "https://www.thehindu.com/news/national/feeder/default.rss",
    ],
    "business": [
        "https://feeds.bloomberg.com/markets/news.rss",
        "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    ],
    "science": [
        "https://www.sciencedaily.com/rss/all.xml",
        "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml",
    ],
}

# Category search queries
CATEGORY_QUERIES = {
    "tech": "latest technology news innovations",
    "ai": "artificial intelligence AI breakthroughs news",
    "india": "top trending India news events today specific",
    "world": "major world news events headlines today specific",
    "politics": "politics news government elections policy",
    "sports": "latest sports news scoreboard results today",
    "cricket": "Indian Premier League cricket auction news players",
    "movies": "new movies releases reviews entertainment news",
    "business": "major business news market trends specific",
    "finance": "stock market movers finance news today",
    "science": "new science discoveries research study",
}

# Region settings for search (wt-wt is world, in-en is India English)
CATEGORY_REGIONS = {
    "cricket": "in-en",
    "india": "in-en",
    "politics": "wt-wt", # Default to world, but will adapt if India is selected
    "movies": "wt-wt",
}
