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

# Build single executable with UPX compression
pyinstaller \
    --onefile \
    --name narrativ-backend \
    --strip \
    --noupx \
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
    --hidden-import=services.image \
    --hidden-import=services.styles \
    --hidden-import=services.brand \
    --hidden-import=services.boards \
    --hidden-import=services.notes \
    --hidden-import=services.trending \
    --hidden-import=services.rss \
    --hidden-import=services.clients \
    --hidden-import=services.llm \
    --hidden-import=services.consistency \
    --hidden-import=services.aesthetic \
    --hidden-import=services.caption \
    --hidden-import=services.text_to_slides \
    --hidden-import=utils \
    --hidden-import=utils.vault \
    --hidden-import=utils.text \
    --hidden-import=utils.cache \
    --hidden-import=utils.search \
    --hidden-import=utils.json_utils \
    --hidden-import=duckduckgo_search \
    --hidden-import=huggingface_hub \
    --add-data "services:services" \
    --add-data "utils:utils" \
    --add-data "config.py:." \
    --add-data "data:data" \
    --exclude-module tkinter \
    --exclude-module matplotlib \
    --exclude-module scipy \
    --exclude-module pandas \
    --exclude-module numpy.testing \
    --exclude-module numpy.distutils \
    --exclude-module numpy.f2py \
    --exclude-module PIL.ImageQt \
    --exclude-module PIL.ImageTk \
    --exclude-module unittest \
    --exclude-module pytest \
    --exclude-module setuptools \
    --exclude-module pip \
    --exclude-module wheel \
    --exclude-module pkg_resources \
    --exclude-module distutils \
    --exclude-module lib2to3 \
    --exclude-module email.test \
    --exclude-module test \
    --exclude-module xmlrpc \
    --exclude-module pydoc \
    --exclude-module doctest \
    --exclude-module torch \
    --exclude-module torchvision \
    --exclude-module torchaudio \
    --exclude-module pyarrow \
    --exclude-module zmq \
    --exclude-module IPython \
    --exclude-module jupyter \
    --exclude-module notebook \
    --exclude-module jedi \
    --exclude-module parso \
    --exclude-module sympy \
    --exclude-module nltk \
    --exclude-module networkx \
    --exclude-module pygments \
    --exclude-module lxml \
    --exclude-module numpy \
    --exclude-module cv2 \
    --exclude-module sklearn \
    --exclude-module transformers \
    --exclude-module tensorflow \
    --exclude-module keras \
    --exclude-module boto3 \
    --exclude-module botocore \
    --exclude-module awscli \
    --exclude-module azure \
    --exclude-module google.cloud \
    --noconfirm \
    --clean \
    main.py

echo ""
echo "=== Compressing with UPX ==="
upx --best --lzma dist/narrativ-backend || echo "UPX compression skipped (may not work on arm64)"

echo ""
echo "=== Build Complete ==="
echo "Executable: dist/narrativ-backend"
echo "Size: $(du -h dist/narrativ-backend | cut -f1)"
