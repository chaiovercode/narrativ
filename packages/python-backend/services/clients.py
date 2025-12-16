"""
AI client initialization - Gemini and fal.ai
"""

import os
from config import GOOGLE_API_KEY, FAL_API_KEY

# Gemini client
gemini_client = None
if GOOGLE_API_KEY:
    try:
        from google import genai
        gemini_client = genai.Client(api_key=GOOGLE_API_KEY)
        print("[clients] Gemini enabled")
    except ImportError:
        print("[clients] google-genai not installed")

# fal.ai client
fal_client = None
if FAL_API_KEY:
    try:
        import fal_client as fal
        os.environ["FAL_KEY"] = FAL_API_KEY
        fal_client = fal
        print("[clients] fal.ai enabled")
    except ImportError:
        print("[clients] fal-client not installed")
