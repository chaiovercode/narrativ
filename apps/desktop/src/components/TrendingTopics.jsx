import { useState } from 'react';
import '../styles/trending.css';

const CATEGORIES = [
  { id: 'tech', label: 'Tech' },
  { id: 'ai', label: 'AI' },
  { id: 'world', label: 'World' },
  { id: 'politics', label: 'Politics' },
  { id: 'sports', label: 'Sports' },
  { id: 'movies', label: 'Movies' },
  { id: 'business', label: 'Business' },
  { id: 'finance', label: 'Finance' },
  { id: 'science', label: 'Science' },
];

export function TrendingTopics({ onTopicSelect, disabled }) {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [hiddenCategories, setHiddenCategories] = useState([]); // Pre-built categories that have been removed
  const [customTopics, setCustomTopics] = useState([]); // All custom topics created
  const [selectedCustomTopics, setSelectedCustomTopics] = useState([]); // Which custom topics are selected
  const [customInput, setCustomInput] = useState('');
  const [suggestedTopics, setSuggestedTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [topicsError, setTopicsError] = useState(null);

  const updateSuggestion = (categories, customSelected) => {
    if (categories.length === 0 && customSelected.length === 0) {
      setSelectedSuggestion(null);
      setSuggestedTopics([]);
      return;
    }

    const getLabel = (id) => CATEGORIES.find(c => c.id === id)?.label || id;
    const allLabels = [...categories.map(getLabel), ...customSelected];
    const defaultTopic = `Trending ${allLabels.join(' & ')} News`;
    setSelectedSuggestion(defaultTopic);
    setSuggestedTopics([]);
  };

  const handleCategorySelect = (categoryId) => {
    const totalSelected = selectedCategories.length + selectedCustomTopics.length;
    let newCategories;

    if (selectedCategories.includes(categoryId)) {
      newCategories = selectedCategories.filter(c => c !== categoryId);
    } else {
      if (totalSelected >= 3) return;
      newCategories = [...selectedCategories, categoryId];
    }

    setSelectedCategories(newCategories);
    setLoadingTopics(false);
    setTopicsError(null);
    updateSuggestion(newCategories, selectedCustomTopics);
  };

  const handleCustomTopicSelect = (topic) => {
    const totalSelected = selectedCategories.length + selectedCustomTopics.length;
    let newSelectedCustom;

    if (selectedCustomTopics.includes(topic)) {
      // Deselect
      newSelectedCustom = selectedCustomTopics.filter(t => t !== topic);
    } else {
      // Select
      if (totalSelected >= 3) return;
      newSelectedCustom = [...selectedCustomTopics, topic];
    }

    setSelectedCustomTopics(newSelectedCustom);
    updateSuggestion(selectedCategories, newSelectedCustom);
  };

  const handleAddCustomTopic = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (customTopics.includes(trimmed)) return;

    const totalSelected = selectedCategories.length + selectedCustomTopics.length;

    // Add to custom topics list
    const newCustomTopics = [...customTopics, trimmed];
    setCustomTopics(newCustomTopics);
    setCustomInput('');

    // Auto-select if under limit
    if (totalSelected < 3) {
      const newSelectedCustom = [...selectedCustomTopics, trimmed];
      setSelectedCustomTopics(newSelectedCustom);
      updateSuggestion(selectedCategories, newSelectedCustom);
    }
  };

  const handleRemoveCustomTopic = (topic, e) => {
    e.stopPropagation();
    // Remove from both lists
    const newCustomTopics = customTopics.filter(t => t !== topic);
    const newSelectedCustom = selectedCustomTopics.filter(t => t !== topic);

    setCustomTopics(newCustomTopics);
    setSelectedCustomTopics(newSelectedCustom);
    updateSuggestion(selectedCategories, newSelectedCustom);
  };

  const handleRemoveCategory = (categoryId, e) => {
    e.stopPropagation();
    // Hide the category and deselect if selected
    setHiddenCategories([...hiddenCategories, categoryId]);
    const newCategories = selectedCategories.filter(c => c !== categoryId);
    setSelectedCategories(newCategories);
    updateSuggestion(newCategories, selectedCustomTopics);
  };

  const handleFetchTopics = async () => {
    if (selectedCategories.length === 0 && selectedCustomTopics.length === 0) return;

    setLoadingTopics(true);
    setSuggestedTopics([]);
    setTopicsError(null);

    try {
      const allCategories = [...selectedCategories, ...selectedCustomTopics];
      const response = await fetch(`http://localhost:8000/trending_topics?categories=${allCategories.join(',')}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestedTopics(data.topics || []);
      } else {
        setTopicsError('Failed to load topics');
      }
    } catch (err) {
      console.error('Failed to fetch topics:', err);
      setTopicsError('Network error');
    } finally {
      setLoadingTopics(false);
    }
  };

  const handleApplySuggestion = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (selectedSuggestion && selectedSuggestion.startsWith('Trending ') && selectedSuggestion.endsWith(' News')) {
      handleFetchTopics();
      return;
    }

    if (selectedSuggestion) {
      onTopicSelect(selectedSuggestion);
      setSelectedSuggestion(null);
      setLoadingTopics(false);
      setTopicsError(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustomTopic();
    }
  };

  const handleReset = () => {
    setSelectedCategories([]);
    setSelectedCustomTopics([]);
    setSuggestedTopics([]);
    setSelectedSuggestion(null);
    setTopicsError(null);
    setLoadingTopics(false);
  };

  if (disabled) return null;

  const totalSelected = selectedCategories.length + selectedCustomTopics.length;

  return (
    <div className="trending-section">
      <div className="trending-header">
        <label className="input-label" style={{ marginTop: '1rem' }}>Trending Topics</label>
        {(totalSelected > 0 || suggestedTopics.length > 0) && (
          <button type="button" className="trending-reset-btn" onClick={handleReset}>
            Clear
          </button>
        )}
      </div>
      <div className="category-chips">
        {CATEGORIES.filter(cat => !hiddenCategories.includes(cat.id)).map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`category-chip ${selectedCategories.includes(cat.id) ? 'active' : ''}`}
            onClick={() => handleCategorySelect(cat.id)}
          >
            {cat.label}
            <span className="remove-chip" onClick={(e) => handleRemoveCategory(cat.id, e)}>x</span>
          </button>
        ))}
        {customTopics.map((topic) => (
          <button
            key={`custom-${topic}`}
            type="button"
            className={`category-chip custom ${selectedCustomTopics.includes(topic) ? 'active' : ''}`}
            onClick={() => handleCustomTopicSelect(topic)}
          >
            {topic}
            <span className="remove-chip" onClick={(e) => handleRemoveCustomTopic(topic, e)}>x</span>
          </button>
        ))}
      </div>

      <div className="custom-topic-input">
        <input
          type="text"
          placeholder="Add custom topic..."
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          onClick={handleAddCustomTopic}
          disabled={!customInput.trim()}
        >
          Add
        </button>
      </div>

      {loadingTopics && (
        <div className="suggestions-loading">
          <span className="loading-dot"></span>
          <span className="loading-dot"></span>
          <span className="loading-dot"></span>
        </div>
      )}

      {topicsError && (
        <div className="topics-error">{topicsError}</div>
      )}

      {suggestedTopics.length > 0 && (
        <div className="topic-suggestions">
          {suggestedTopics.map((suggestion, idx) => (
            <div
              key={idx}
              className={`topic-suggestion ${selectedSuggestion === suggestion ? 'selected' : ''}`}
              onClick={() => setSelectedSuggestion(suggestion)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className={`apply-suggestion-btn ${!selectedSuggestion ? 'disabled' : ''}`}
        onClick={handleApplySuggestion}
        disabled={!selectedSuggestion}
      >
        {selectedSuggestion && selectedSuggestion.startsWith('Trending ') && selectedSuggestion.endsWith(' News')
          ? 'Find Headlines'
          : selectedSuggestion
            ? `Use Topic: ${selectedSuggestion.length > 25 ? selectedSuggestion.substring(0, 25) + '...' : selectedSuggestion}`
            : 'Select a category first'
        }
      </button>
    </div>
  );
}
