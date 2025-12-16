#!/bin/bash
set -e

SOURCE="app-icon.png"
DEST="src-tauri/icons"
ICONSET="src-tauri/icons.iconset"

mkdir -p "$ICONSET"
mkdir -p "$DEST"

# Function to resize
resize() {
    sips -z $1 $1 -s format png "$SOURCE" --out "$ICONSET/icon_$2.png" > /dev/null
}

echo "Generating iconset images..."
resize 16 "16x16"
resize 32 "16x16@2x"
resize 32 "32x32"
resize 64 "32x32@2x"
resize 128 "128x128"
resize 256 "128x128@2x"
resize 256 "256x256"
resize 512 "256x256@2x"
resize 512 "512x512"
resize 1024 "512x512@2x"

echo "Creating icns..."
iconutil -c icns "$ICONSET" -o "$DEST/icon.icns"

echo "Copying PNGs for Tauri config..."
cp "$ICONSET/icon_32x32.png" "$DEST/32x32.png"
cp "$ICONSET/icon_128x128.png" "$DEST/128x128.png"
cp "$ICONSET/icon_128x128@2x.png" "$DEST/128x128@2x.png"

# Basic ICO generation using sips to png (since we can't do real ICO easily without tools)
# But we can try to use python if available, or just copy a png as ico and hope it works (often doesn't)
# Lets try to use python to make a valid ICO
if python3 -c "from PIL import Image" 2>/dev/null; then
    echo "Generating ICO with Python PIL..."
    python3 -c "from PIL import Image; img = Image.open('$SOURCE'); img.save('$DEST/icon.ico', format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])"
else
    echo "PIL not found. creating a fake ico (renamed png) - might fail validation but better than nothing."
    # Most Windows viewers handle PNG in ICO, but build tools might complain.
    # Actually, let's just use the 256x256 png
    cp "$ICONSET/icon_128x128@2x.png" "$DEST/icon.ico"
fi

echo "Cleaning up..."
rm -rf "$ICONSET"

echo "Done."
