import { useState, useEffect } from 'react';
import '../styles/loading-screen.css';

const LOADING_MESSAGES = [
  'Waking up the creative spirits...',
  'Brewing inspiration...',
  'Connecting to the muse...',
  'Preparing your canvas...',
  'Almost there...',
];

export function LoadingScreen({ status }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [dots, setDots] = useState('');

  // Cycle through messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Get progress percentage
  const getProgress = () => {
    if (!status) return 0;
    let progress = 0;
    if (status.backendReady) progress += 40;
    if (status.vaultChecked) progress += 20;
    if (status.vaultSet) progress += 20;
    if (status.dataLoaded) progress += 20;
    return progress;
  };

  const progress = getProgress();

  return (
    <div className="loading-screen">
      <div className="loading-content">
        {/* Logo */}
        <div className="loading-logo">
          <span className="loading-logo-text">N</span>
        </div>

        {/* App name */}
        <h1 className="loading-title">Narrativ</h1>

        {/* Progress bar */}
        <div className="loading-progress-container">
          <div
            className="loading-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Status message */}
        <p className="loading-message">
          {LOADING_MESSAGES[messageIndex]}{dots}
        </p>

        {/* Debug status (only show in dev) */}
        {status && import.meta.env.DEV && (
          <div className="loading-debug">
            <span className={status.backendReady ? 'ready' : ''}>Backend</span>
            <span className={status.vaultChecked ? 'ready' : ''}>Checked</span>
            <span className={status.vaultSet ? 'ready' : ''}>Synced</span>
            <span className={status.dataLoaded ? 'ready' : ''}>Ready</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoadingScreen;
