"""
Unified LLM interface for Gemini and Ollama.
Allows switching between providers without changing service code.
"""

import requests
import json
from config import OLLAMA_URL, OLLAMA_MODEL
from . import clients

# Default provider and model
_current_provider = "gemini"
_current_ollama_model = None  # None = auto-detect

def set_provider(provider: str):
    """Set the current LLM provider"""
    global _current_provider
    if provider in ["gemini", "ollama"]:
        _current_provider = provider

def set_ollama_model(model: str):
    """Set a specific Ollama model to use (empty string = auto-detect)"""
    global _current_ollama_model
    _current_ollama_model = model if model else None

def get_provider() -> str:
    """Get the current LLM provider"""
    return _current_provider

def get_ollama_model() -> str:
    """Get the current Ollama model (auto-detect if not set)"""
    return _current_ollama_model

def generate_text(prompt: str, provider: str = None) -> str:
    """
    Generate text using the specified or current LLM provider.
    Includes fallback: if selected provider unavailable, tries the other.

    Args:
        prompt: The text prompt to send to the LLM
        provider: Optional provider override ("gemini" or "ollama")

    Returns:
        Generated text response
    """
    use_provider = provider or _current_provider

    # Check availability and fall back if needed
    if use_provider == "ollama":
        if clients.check_ollama():
            return _generate_with_ollama(prompt)
        elif clients.gemini_client:
            print("[llm] Ollama not available, falling back to Gemini")
            return _generate_with_gemini(prompt)
        else:
            raise Exception("No LLM provider available. Start Ollama or add Google API key.")
    else:  # gemini
        if clients.gemini_client:
            return _generate_with_gemini(prompt)
        elif clients.check_ollama():
            print("[llm] Gemini not available, falling back to Ollama")
            return _generate_with_ollama(prompt)
        else:
            raise Exception("No LLM provider available. Add Google API key or start Ollama.")

def _generate_with_gemini(prompt: str) -> str:
    """Generate text using Google Gemini"""
    if not clients.gemini_client:
        raise Exception("Gemini client not available. Set GOOGLE_API_KEY.")

    response = clients.gemini_client.models.generate_content(
        model='gemini-2.0-flash',
        contents=prompt
    )
    return response.text.strip()

def _generate_with_ollama(prompt: str) -> str:
    """Generate text using local Ollama"""
    # Re-check availability in case Ollama was started after app launch
    if not clients.check_ollama():
        raise Exception("Ollama not running. Start Ollama first.")

    # Use user-selected model, auto-detect, or fall back to config default
    if _current_ollama_model:
        model = _current_ollama_model
    else:
        model = clients.has_ollama_text_model() or OLLAMA_MODEL
    print(f"[llm] Using Ollama model: {model}")

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False
            },
            timeout=120  # Longer timeout for local inference
        )

        if response.status_code != 200:
            raise Exception(f"Ollama error: {response.status_code}")

        result = response.json()
        return result.get("response", "").strip()

    except requests.exceptions.Timeout:
        raise Exception("Ollama request timed out. Try a smaller model.")
    except requests.exceptions.ConnectionError:
        raise Exception("Cannot connect to Ollama. Is it running?")

def is_provider_available(provider: str) -> bool:
    """Check if a provider is available"""
    if provider == "gemini":
        return clients.gemini_client is not None
    elif provider == "ollama":
        return clients.check_ollama()
    return False

def get_available_providers() -> list:
    """Get list of currently available providers"""
    available = []
    if clients.gemini_client:
        available.append("gemini")
    if clients.check_ollama():
        available.append("ollama")
    return available
