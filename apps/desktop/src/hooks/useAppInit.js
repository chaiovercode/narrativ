import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { checkBackendHealth, setVaultPath as setBackendVaultPath } from '../services/api';

/**
 * Hook for coordinated app initialization.
 * Handles backend connection, vault setup, and initial data loading.
 */
export function useAppInit() {
  const [status, setStatus] = useState({
    backendReady: false,
    vaultChecked: false,
    vaultSet: false,
    dataLoaded: false,
  });

  const [vaultPath, setVaultPath] = useState(null);
  const [vaultName, setVaultName] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  const initAttempts = useRef(0);
  const maxAttempts = 30; // 30 attempts * 200ms = 6 seconds max wait

  // Step 1: Wait for backend to be ready
  const waitForBackend = useCallback(async () => {
    while (initAttempts.current < maxAttempts) {
      try {
        await checkBackendHealth();
        setStatus(prev => ({ ...prev, backendReady: true }));
        return true;
      } catch {
        initAttempts.current++;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    throw new Error('Backend did not start in time');
  }, []);

  // Step 2: Check and load vault
  const checkVault = useCallback(async () => {
    try {
      const path = await invoke('get_vault_path');
      setStatus(prev => ({ ...prev, vaultChecked: true }));

      if (path) {
        setVaultPath(path);
        const name = path.split('/').pop();
        setVaultName(name);
        return path;
      }
      return null;
    } catch (err) {
      console.warn('No vault configured:', err);
      setStatus(prev => ({ ...prev, vaultChecked: true }));
      return null;
    }
  }, []);

  // Step 3: Sync vault path to backend
  const syncVaultToBackend = useCallback(async (path) => {
    if (!path) return false;

    try {
      await setBackendVaultPath(path);
      setStatus(prev => ({ ...prev, vaultSet: true }));
      return true;
    } catch (err) {
      console.warn('Failed to sync vault to backend:', err);
      // Backend might not be fully ready, retry once
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        await setBackendVaultPath(path);
        setStatus(prev => ({ ...prev, vaultSet: true }));
        return true;
      } catch {
        // Continue anyway - will be synced on next API call
        setStatus(prev => ({ ...prev, vaultSet: true }));
        return false;
      }
    }
  }, []);

  // Main initialization flow
  useEffect(() => {
    const init = async () => {
      try {
        // Step 1: Wait for backend
        await waitForBackend();

        // Step 2: Check vault
        const path = await checkVault();

        // Step 3: Sync vault to backend (if we have a path)
        if (path) {
          await syncVaultToBackend(path);
        }

        // Mark data as loaded (individual hooks will load their own data)
        setStatus(prev => ({ ...prev, dataLoaded: true }));

        // Small delay to show the loading animation
        await new Promise(resolve => setTimeout(resolve, 300));

        setIsReady(true);
      } catch (err) {
        console.error('App initialization failed:', err);
        setError(err.message);
        // Still mark as ready so user can see an error
        setIsReady(true);
      }
    };

    init();
  }, [waitForBackend, checkVault, syncVaultToBackend]);

  // Handler for vault selection (used by VaultSetup)
  const handleVaultSelected = useCallback(async (path, name) => {
    setVaultPath(path);
    setVaultName(name);
    try {
      await setBackendVaultPath(path);
      setStatus(prev => ({ ...prev, vaultSet: true }));
    } catch (err) {
      console.warn('Failed to notify backend of vault path:', err);
    }
  }, []);

  return {
    status,
    isReady,
    error,
    vaultPath,
    vaultName,
    setVaultPath,
    setVaultName,
    handleVaultSelected,
  };
}

export default useAppInit;
