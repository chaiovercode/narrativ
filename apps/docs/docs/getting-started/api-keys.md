---
sidebar_position: 2
---

# Setting Up API Keys

Narrativ uses AI services that require API keys. Your keys are stored securely in the macOS Keychain and never leave your device.

## Required: Google API Key

The Google API key powers both text generation (Gemini) and image generation (Imagen).

### Getting a Google API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key

### Adding to Narrativ

1. Open Narrativ
2. Go to **Settings** (via navbar)
3. In the **API Keys** section, find "Google API Key"
4. Paste your key and click **Save**

:::tip Free Tier
Google AI Studio offers a generous free tier that's sufficient for most personal use. You can generate hundreds of stories per day without paying.
:::

## Optional: Tavily API Key

Tavily provides enhanced research capabilities with deeper, more accurate web searches.

### Getting a Tavily API Key

1. Go to [Tavily](https://tavily.com)
2. Create an account
3. Navigate to API Keys in your dashboard
4. Copy your API key

### Why Use Tavily?

- More thorough research results
- Better fact extraction
- Faster response times

Without Tavily, Narrativ falls back to DuckDuckGo search, which works but may be less comprehensive.

## Optional: FAL API Key

FAL.ai provides additional image generation models (Flux) for different visual styles.

### Getting a FAL API Key

1. Go to [fal.ai](https://fal.ai)
2. Create an account
3. Navigate to API Keys
4. Generate and copy your key

### Why Use FAL?

- Access to Flux image models
- Different aesthetic options
- Alternative when Gemini quota is reached

## Security Notes

- **Keys are encrypted** using macOS Keychain
- **Keys never leave your device** - they're passed directly to AI services
- **No telemetry** - Narrativ doesn't track your usage or keys
- **Environment-based** - Keys are passed to the backend via secure environment variables

## Troubleshooting

### "API Key Invalid" Error

- Double-check you copied the entire key
- Ensure there are no extra spaces
- Verify the key hasn't been revoked in the provider's dashboard

### "Quota Exceeded" Error

- Check your usage limits in the provider's dashboard
- Wait for quota reset (usually daily)
- Consider upgrading your plan for higher limits

### Backend Not Starting

- Ensure Python 3.10+ is installed
- Check Settings > About for backend status
- Try restarting Narrativ
