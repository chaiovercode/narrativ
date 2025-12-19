
import os
import sys
from dotenv import load_dotenv
from io import BytesIO
from PIL import Image

# Load env from current directory or parent
load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("Please set GOOGLE_API_KEY environment variable.")
    print("Usage: GOOGLE_API_KEY=AI... python3 test_fix.py")
    sys.exit(1)

from google import genai
from google.genai import types

print(f"Initializing Gemini client...")
client = genai.Client(api_key=api_key)

prompt = "A cute robot banana, simple vector art"
model = "gemini-2.5-flash-image"

print("-" * 50)
print(f"TEST 1: Simulating Version 1.0.8 (With response_modalities=['IMAGE'])")
print("-" * 50)

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
    if hasattr(response, 'parts'):
        print(f"Parts count: {len(response.parts)}")
    elif hasattr(response, 'candidates'):
        print(f"Candidates count: {len(response.candidates)}")
    print("SUCCESS (Unexpected for v1.0.8 if that was the bug)")
except Exception as e:
    print(f"FAILED as expected (likely): {e}")

print("\n" + "-" * 50)
print(f"TEST 2: Simulating Version 1.0.9 (WITHOUT response_modalities)")
print("-" * 50)

try:
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            # response_modalities REMOVED
            safety_settings=[
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_ONLY_HIGH"
                ),
            ]
        )
    )
    
    print("Response received.")
    
    # Check for image data
    image_found = False
    
    # Handle response.parts (Google GenAI SDK v2 style)
    if hasattr(response, 'parts') and response.parts:
        for part in response.parts:
            if hasattr(part, 'inline_data') and part.inline_data:
                print("Found inline_data in response.parts")
                image_found = True
    
    # Handle candidates (fallback/alternative)
    if not image_found and hasattr(response, 'candidates') and response.candidates:
        for part in response.candidates[0].content.parts:
            if hasattr(part, 'inline_data') and part.inline_data:
                print("Found inline_data in candidates")
                image_found = True

    if image_found:
        print("SUCCESS: Image generated successfully!")
    else:
        print("FAILURE: No image data found in response.")
        print(response)

except Exception as e:
    print(f"FAILED: {e}")
