---
sidebar_position: 1
---

# Installation

Get Narrativ up and running on your Mac in minutes.

## Prerequisites

Before installing Narrativ, ensure you have:

1. **macOS 12 (Monterey)** or later
2. **Python 3.10+** installed
   ```bash
   # Check your Python version
   python3 --version

   # If not installed, get it from python.org or use Homebrew:
   brew install python@3.12
   ```

## Download & Install

### Option 1: Download DMG (Recommended)

1. Go to the [Releases page](https://github.com/chaiovercode/narrativ/releases)
2. Download the latest `Narrativ-x.x.x.dmg` file
3. Open the DMG and drag Narrativ to your Applications folder
4. Launch Narrativ from Applications

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/chaiovercode/narrativ.git
cd narrativ

# Install dependencies
pnpm install

# Install Python dependencies
cd packages/python-backend
pip3 install -r requirements.txt
cd ../..

# Run in development mode
pnpm dev
```

## First Launch

When you first launch Narrativ:

1. **macOS may warn you** about opening an app from an unidentified developer
   - Go to System Preferences > Privacy & Security
   - Click "Open Anyway" next to the Narrativ message

2. **Set up your API keys** in Settings
   - At minimum, you need a Google API key
   - See the [API Keys guide](/docs/getting-started/api-keys) for details

3. **Backend will start automatically**
   - Narrativ runs a Python backend for AI operations
   - Check Settings > About for backend status

## Updating

To update Narrativ:

1. Download the latest DMG from the releases page
2. Quit the current Narrativ app
3. Drag the new version to Applications, replacing the old one
4. Launch the new version

Your settings and generated content are preserved between updates.

## Uninstalling

To completely remove Narrativ:

1. Quit the app
2. Delete from Applications folder
3. Optionally, remove app data:
   ```bash
   rm -rf ~/Library/Application\ Support/com.narrativ.app
   ```
4. Remove API keys from Keychain (optional):
   - Open Keychain Access
   - Search for "com.narrativ"
   - Delete the entries
