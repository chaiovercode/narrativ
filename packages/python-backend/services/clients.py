"""
AI client initialization - Gemini, fal.ai, Ollama, and Hugging Face
"""

import os
import requests

# Client instances (initialized on startup and can be reloaded)
gemini_client = None
fal_client = None
hf_api_key = None
ollama_available = False
ollama_models = []


def init_clients():
    """Initialize or reinitialize all AI clients based on current environment."""
    global gemini_client, fal_client, hf_api_key

    # Read fresh from environment
    google_key = os.getenv("GOOGLE_API_KEY")
    fal_key = os.getenv("FAL_API_KEY")
    hf_key = os.getenv("HF_API_KEY")

    print(f"[clients] Initializing... GOOGLE: {'SET' if google_key else 'MISSING'}, FAL: {'SET' if fal_key else 'MISSING'}, HF: {'SET' if hf_key else 'MISSING'}")

    # Gemini client
    gemini_client = None
    if google_key:
        try:
            from google import genai
            gemini_client = genai.Client(api_key=google_key)
            print("[clients] Gemini enabled")
        except ImportError:
            print("[clients] google-genai not installed")

    # fal.ai client
    fal_client = None
    if fal_key:
        try:
            import fal_client as fal
            os.environ["FAL_KEY"] = fal_key
            fal_client = fal
            print("[clients] fal.ai enabled")
        except ImportError:
            print("[clients] fal-client not installed")

    # Hugging Face
    if hf_key:
        hf_key = hf_key.strip()
    
    # Check for empty string or too short (invalid) key
    hf_api_key = hf_key if (hf_key and len(hf_key) > 5) else None
    
    if hf_api_key:
        print("[clients] Hugging Face enabled")

    return {
        "gemini": gemini_client is not None,
        "fal": fal_client is not None,
        "huggingface": hf_api_key is not None
    }


# Ollama settings
from config import OLLAMA_URL

def check_ollama():
    """Check if Ollama is running locally"""
    global ollama_available, ollama_models
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=0.5)
        if r.status_code == 200:
            ollama_available = True
            data = r.json()
            ollama_models = [m.get("name", "") for m in data.get("models", [])]
            return True
    except:
        pass
    ollama_available = False
    ollama_models = []
    return False

def get_ollama_models():
    """Get list of available Ollama models"""
    check_ollama()  # Refresh
    return ollama_models

def has_ollama_vision_model():
    """Check if a vision-capable model is available in Ollama"""
    models = get_ollama_models()
    vision_models = ["llava", "moondream", "bakllava", "llava-llama3", "llava-phi3", "qwen-vl", "qwen2-vl", "qwen3-vl"]
    for model in models:
        model_lower = model.lower()
        for vm in vision_models:
            if vm in model_lower:
                return model  # Return the actual model name
    return None

def has_ollama_text_model():
    """Check if a text model is available in Ollama"""
    models = get_ollama_models()
    if not models:
        return None
    # Return first available model, prefer ones good for JSON output
    preferred = ["qwen2.5", "qwen3", "qwen", "deepseek", "llama", "mistral", "phi"]
    for pm in preferred:
        for model in models:
            if pm in model.lower():
                return model
    return models[0] if models else None

# Initialize on module load
init_clients()

# Check Ollama on startup
if check_ollama():
    print("[clients] Ollama enabled (local)")
else:
    print("[clients] Ollama not available")
