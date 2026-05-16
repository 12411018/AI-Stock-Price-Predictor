import { useState, useRef, useEffect } from 'react';
import { sampleStocks } from '../utils/calculations';

export default function TickerInput({ ticker, setTicker, onPredict, disabled }) {
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  const handleInputChange = (e) => {
    const query = e.target.value.toUpperCase().trim();
    setTicker(e.target.value);

    if (query.length > 0) {
      const filtered = sampleStocks
        .filter((stock) => stock.startsWith(query))
        .slice(0, 8);
      setSuggestions(filtered);
      setSelectedIndex(-1);
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (stock) => {
    setTicker(stock);
    setSuggestions([]);
  };

  const handleKeyDown = (e) => {
    if (suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          setTicker(suggestions[selectedIndex]);
          setSuggestions([]);
        }
        break;
      case 'Escape':
        setSuggestions([]);
        break;
      default:
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setSuggestions([]);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <>
      <div className="mb-3" style={{ position: 'relative' }}>
        <label htmlFor="ticker" className="form-label">
          <i className="fas fa-search"></i> Stock Ticker
        </label>
        <input
          ref={inputRef}
          type="text"
          className="form-control"
          id="ticker"
          placeholder="Enter stock symbol (e.g., AAPL)"
          autoComplete="off"
          value={ticker}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        {suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="autocomplete-suggestions"
            style={{ display: 'block' }}
          >
            {suggestions.map((stock, index) => (
              <div
                key={stock}
                className={`autocomplete-suggestion${index === selectedIndex ? ' selected' : ''}`}
                onClick={() => handleSuggestionClick(stock)}
              >
                <i className="fas fa-chart-line"></i>
                <span>{stock}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        id="predict"
        className="btn btn-predict mb-3"
        onClick={onPredict}
        disabled={disabled}
      >
        <i className="fas fa-chart-line me-2"></i> Analyze Stock
      </button>
    </>
  );
}
