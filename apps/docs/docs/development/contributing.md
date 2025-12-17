---
sidebar_position: 1
---

# Contributing

Help make Narrativ better! Here's how to contribute.

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 8+
- Python 3.10+
- Rust (for Tauri development)

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/chaiovercode/narrativ.git
cd narrativ

# Install Node.js dependencies
pnpm install

# Install Python dependencies
cd packages/python-backend
pip3 install -r requirements.txt
cd ../..
```

### Running in Development

```bash
# Start the desktop app (frontend + backend)
pnpm dev

# Or run components separately:

# Frontend only
cd apps/desktop && pnpm dev

# Backend only
cd packages/python-backend && python3 main.py

# Documentation
cd apps/docs && pnpm start
```

## Project Structure

```
narrativ/
├── apps/
│   ├── desktop/              # Tauri + React app
│   │   ├── src/              # React frontend
│   │   └── src-tauri/        # Rust backend
│   └── docs/                 # Docusaurus documentation
├── packages/
│   └── python-backend/       # FastAPI backend
├── package.json              # Root monorepo config
└── pnpm-workspace.yaml
```

## Code Style

### TypeScript/JavaScript

- Use ES6+ features
- Functional components with hooks
- Meaningful variable names
- Comment complex logic

### Python

- Follow PEP 8
- Use type hints
- Docstrings for public functions

### Rust

- Follow Rust conventions
- Use `cargo fmt` before committing
- Handle errors properly

## Making Changes

### 1. Fork and Branch

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/narrativ.git
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Keep changes focused and atomic
- Update tests if applicable
- Update documentation for user-facing changes

### 3. Test Your Changes

```bash
# Run the app
pnpm dev

# Test all functionality you modified
```

### 4. Commit

Use conventional commits:

```bash
git commit -m "feat: add new style extraction feature"
git commit -m "fix: resolve image generation timeout"
git commit -m "docs: update API reference"
```

Prefixes:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Code style (formatting)
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Maintenance

### 5. Push and PR

```bash
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub.

## Areas to Contribute

### Good First Issues

- UI/UX improvements
- Documentation updates
- Bug fixes
- Accessibility improvements

### Larger Projects

- New image providers
- Additional visual styles
- Platform support (Windows, Linux)
- Performance optimizations

## Testing

### Manual Testing

- Test all user flows
- Try edge cases
- Check responsive behavior
- Verify error handling

### Future: Automated Tests

We welcome contributions to add:
- Unit tests (Vitest for frontend, pytest for backend)
- E2E tests (Playwright)
- Integration tests

## Documentation

### Updating Docs

```bash
cd apps/docs
pnpm start  # Live preview at localhost:3000
```

### Writing Guidelines

- Clear, concise language
- Include code examples
- Add screenshots where helpful
- Keep navigation intuitive

## Getting Help

- **Issues**: Report bugs or request features
- **Discussions**: Ask questions, share ideas
- **Discord**: (Coming soon)

## Code of Conduct

- Be respectful and inclusive
- Assume good intentions
- Focus on constructive feedback
- Help others learn

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
