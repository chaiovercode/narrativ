"""
Shared vault path management across services.
"""

from pathlib import Path
from typing import Optional

# Global vault path
_VAULT_PATH: Optional[str] = None


def set_vault_path(path: str) -> None:
    """Set the vault path globally."""
    global _VAULT_PATH
    _VAULT_PATH = path
    print(f"[vault] Path set to: {path}")


def get_vault_path() -> Optional[str]:
    """Get the current vault path."""
    return _VAULT_PATH


def get_vault_file(filename: str) -> Optional[Path]:
    """Get a file path within the vault, or None if vault not set."""
    if not _VAULT_PATH:
        return None
    return Path(_VAULT_PATH) / filename


def ensure_vault_dir(subdir: str) -> Optional[Path]:
    """Ensure a subdirectory exists in the vault, return path or None."""
    if not _VAULT_PATH:
        return None
    path = Path(_VAULT_PATH) / subdir
    path.mkdir(parents=True, exist_ok=True)
    return path
