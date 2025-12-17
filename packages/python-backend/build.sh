#!/bin/bash
# Build Narrativ Backend as standalone executable

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Building Narrativ Backend ==="

# Clean previous builds
rm -rf build dist

# Install dependencies if needed
pip3 install -r requirements.txt --quiet
pip3 install pyinstaller --quiet

# Build single executable
pyinstaller \
    --onefile \
    --name narrativ-backend \
    --hidden-import=uvicorn.logging \
    --hidden-import=uvicorn.loops \
    --hidden-import=uvicorn.loops.auto \
    --hidden-import=uvicorn.protocols \
    --hidden-import=uvicorn.protocols.http \
    --hidden-import=uvicorn.protocols.http.auto \
    --hidden-import=uvicorn.protocols.websockets \
    --hidden-import=uvicorn.protocols.websockets.auto \
    --hidden-import=uvicorn.lifespan \
    --hidden-import=uvicorn.lifespan.on \
    --hidden-import=uvicorn.lifespan.off \
    --hidden-import=google.genai \
    --hidden-import=PIL \
    --hidden-import=PIL.Image \
    --hidden-import=feedparser \
    --hidden-import=pydantic \
    --hidden-import=multipart \
    --hidden-import=dotenv \
    --hidden-import=services \
    --hidden-import=services.research \
    --hidden-import=services.image_gen \
    --hidden-import=services.styles \
    --hidden-import=services.brand \
    --hidden-import=services.boards \
    --hidden-import=services.notes \
    --hidden-import=services.trending \
    --hidden-import=services.rss \
    --add-data "services:services" \
    --add-data "config.py:." \
    --add-data "data:data" \
    --exclude-module tkinter \
    --exclude-module matplotlib \
    --exclude-module scipy \
    --exclude-module pandas \
    --noconfirm \
    --clean \
    main.py

echo ""
echo "=== Build Complete ==="
echo "Executable: dist/narrativ-backend"
echo "Size: $(du -h dist/narrativ-backend | cut -f1)"
