
import os
import sys
from dotenv import load_dotenv

# Add current dir to path to find services
sys.path.append(os.getcwd())

from services.image import generate_story_image
from services.clients import init_clients

# Load env and init clients
load_dotenv()
init_clients()

print("Testing generate_story_image helper function...")

# Mock slide data
slide = {
    "slide_number": 1,
    "title": "Test Image",
    "key_fact": "This is a test image generation.",
    "visual_description": "A cute robot banana, simple vector art"
}

aesthetic = {
    "art_style": "minimal vector",
    "color_palette": "yellow and white"
}

# Call the function
try:
    print("Calling generate_story_image...")
    result = generate_story_image(
        slide=slide,
        topic="Test Topic",
        total_slides=1,
        aesthetic=aesthetic,
        provider="gemini-flash"
    )
    
    if result:
        print("SUCCESS: Image generated!")
        result.save("integration_test_result.png")
    else:
        print("FAILURE: returned None")

except Exception as e:
    print(f"EXCEPTION: {e}")
    import traceback
    traceback.print_exc()
