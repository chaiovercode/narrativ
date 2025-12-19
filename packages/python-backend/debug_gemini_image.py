
import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv
from io import BytesIO
from PIL import Image

# Try to load .env from project root
project_root = Path(__file__).parent.parent.parent
env_path = project_root / '.env'
load_dotenv(env_path)

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    # Try looking in the backend folder
    load_dotenv(Path(__file__).parent / '.env')
    api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("Error: GOOGLE_API_KEY not found in environment")
    sys.exit(1)

from google import genai
from google.genai import types

print(f"Initializing Gemini client...")
client = genai.Client(api_key=api_key)

prompt = "A cute robot banana, simple vector art"
model = "gemini-2.5-flash-image"

print(f"Testing generation with model='{model}'...")
print(f"Prompt: {prompt}")

try:
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            safety_settings=[
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_ONLY_HIGH"
                ),
            ]
        )
    )
    
    print("Response received.")
    
    # Check parts structure
    parts = None
    if hasattr(response, 'parts'):
        print("Response has 'parts' attribute")
        parts = response.parts
    elif hasattr(response, 'candidates') and response.candidates:
        print("Response has 'candidates', accessing candidates[0].content.parts")
        parts = response.candidates[0].content.parts
    else:
        print("Response has neither 'parts' nor valid 'candidates'")
        
    if parts:
        for i, part in enumerate(parts):
            print(f"Part {i}: inline_data={hasattr(part, 'inline_data')}")
            if hasattr(part, 'inline_data') and part.inline_data:
                print(f"Part {i} has inline_data!")
                image_bytes = part.inline_data.data
                image = Image.open(BytesIO(image_bytes))
                print(f"SUCCESS: Image generated! Size: {image.size}")
                sys.exit(0)
    
    print("FAILURE: No image data found in response.")
    print(f"Response object: {response}")

except Exception as e:
    print(f"EXCEPTION: {e}")
    import traceback
    traceback.print_exc()
