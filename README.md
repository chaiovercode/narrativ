# Revelio

AI-powered desktop application for creating stunning social media stories and posts.

## Features

- **AI Story Generation**: Research any topic and create beautiful visual stories
- **Multiple Visual Styles**: Cinematic, Vintage, Cyberpunk, Minimalist, Watercolor, and custom styles
- **Secure API Key Storage**: Keys encrypted in macOS Keychain
- **Brand Kit**: Add your logo or text watermark to generated images
- **Local First**: All content generated and stored on your machine

## Requirements

- macOS 12 (Monterey) or later
- Python 3.10+
- Node.js 18+
- pnpm 8+

## Quick Start

```bash
# Install dependencies
pnpm install

# Install Python dependencies
cd packages/python-backend
pip3 install -r requirements.txt
cd ../..

# Run in development mode
pnpm dev
```

## Project Structure

```
revelio/
├── apps/
│   ├── desktop/          # Tauri + React desktop app
│   │   ├── src/          # React frontend
│   │   └── src-tauri/    # Rust backend
│   └── docs/             # Docusaurus documentation
├── packages/
│   └── python-backend/   # FastAPI backend for AI operations
├── package.json
└── pnpm-workspace.yaml
```

## Building

```bash
# Build the desktop app
pnpm build

# Build Tauri app (creates DMG on macOS)
cd apps/desktop
pnpm tauri build
```

## API Keys Required

- **Google API Key** (Required): Get from [Google AI Studio](https://aistudio.google.com/apikey)
- **Tavily API Key** (Optional): Get from [Tavily](https://tavily.com)
- **FAL API Key** (Optional): Get from [fal.ai](https://fal.ai)

## Documentation

Run the documentation site locally:

```bash
cd apps/docs
pnpm start
```

## License

MIT
