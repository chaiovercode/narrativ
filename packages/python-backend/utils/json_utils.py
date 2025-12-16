"""
JSON utilities for cleaning AI responses.
"""

import re


def clean_json_response(text: str) -> str:
    """
    Clean and extract JSON from AI response.
    Handles common issues like markdown code blocks, trailing commas, etc.
    """
    text = text.strip()

    # Remove markdown code blocks
    text = re.sub(r'^```json\s*', '', text)
    text = re.sub(r'^```\s*', '', text)
    text = re.sub(r'\s*```$', '', text)

    # Try to find JSON array or object boundaries
    # First try array
    arr_start = text.find('[')
    arr_end = text.rfind(']')

    # Then try object
    obj_start = text.find('{')
    obj_end = text.rfind('}')

    # Use whichever comes first and is valid
    if arr_start != -1 and arr_end > arr_start:
        if obj_start == -1 or arr_start < obj_start:
            text = text[arr_start:arr_end + 1]
    elif obj_start != -1 and obj_end > obj_start:
        text = text[obj_start:obj_end + 1]

    # Fix common JSON issues
    # Remove trailing commas before ] or }
    text = re.sub(r',\s*([}\]])', r'\1', text)

    return text
