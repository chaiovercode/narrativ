import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to check availability of all AI providers
 * Returns status for LLM, Vision (style extraction), and Image generation
 */
export function useProviders() {
  // Start with a "checking" state so messages show immediately
  const [providers, setProviders] = useState({
    llm: {
      gemini: { available: false, message: 'Checking...' },
      ollama: { available: false, message: 'Checking...' }
    },
    vision: {
      gemini: { available: false, message: 'Checking...' },
      ollama: { available: false, message: 'Checking...' }
    },
    image: {
      fal: { available: false, message: 'Checking...' },
      gemini: { available: false, message: 'Checking...' },
      huggingface: { available: false, message: 'Checking...' }
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProviders = useCallback(async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/check_providers');
      if (response.ok) {
        const data = await response.json();
        console.log('[useProviders] Fetched provider status:', JSON.stringify(data.image, null, 2));
        setProviders(data);
        setError(null);
      } else {
        setError('Failed to fetch provider status');
      }
    } catch (err) {
      setError('Backend not available');
      setProviders(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
    // Refresh every 30 seconds
    const interval = setInterval(fetchProviders, 30000);

    // Listen for API key changes to refresh immediately
    const handleApiKeysChanged = () => {
      console.log('[useProviders] API keys changed, refreshing...');
      fetchProviders();
    };
    window.addEventListener('api-keys-changed', handleApiKeysChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener('api-keys-changed', handleApiKeysChanged);
    };
  }, [fetchProviders]);

  // Helper functions
  const hasLlmProvider = useCallback(() => {
    if (!providers) return false;
    return providers.llm?.gemini?.available || providers.llm?.ollama?.available;
  }, [providers]);

  const hasVisionProvider = useCallback(() => {
    if (!providers) return false;
    return providers.vision?.gemini?.available || providers.vision?.ollama?.available;
  }, [providers]);

  const hasImageProvider = useCallback(() => {
    if (!providers) return false;
    return providers.image?.fal?.available ||
      providers.image?.gemini?.available ||
      providers.image?.huggingface?.available;
  }, [providers]);

  const getLlmMessage = useCallback((selectedProvider) => {
    if (!providers) return null;
    const llm = providers.llm?.[selectedProvider];
    if (llm?.available) return null;
    return llm?.message || `${selectedProvider} not available`;
  }, [providers]);

  const getVisionMessage = useCallback(() => {
    if (!providers) return 'Checking providers...';
    if (providers.vision?.gemini?.available) return null;
    if (providers.vision?.ollama?.available) return null;

    // Neither available - provide helpful message
    const messages = [];
    if (providers.vision?.gemini?.message) messages.push(providers.vision.gemini.message);
    if (providers.vision?.ollama?.message) messages.push(providers.vision.ollama.message);
    return messages.join(' OR ');
  }, [providers]);

  const getImageMessage = useCallback((selectedProvider) => {
    if (!providers) return null;
    const img = providers.image?.[selectedProvider];
    if (img?.available) return null;
    return img?.message || `${selectedProvider} not available`;
  }, [providers]);

  return {
    providers,
    loading,
    error,
    refresh: fetchProviders,
    hasLlmProvider,
    hasVisionProvider,
    hasImageProvider,
    getLlmMessage,
    getVisionMessage,
    getImageMessage,
  };
}

export default useProviders;
