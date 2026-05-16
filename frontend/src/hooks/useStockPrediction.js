import { useState, useCallback, useEffect, useRef } from 'react';
import { predictStock, fetchCacheStatus } from '../api/stockApi';
import { transformApiResponse, generateExplainerData } from '../utils/calculations';

// Loading-phase messages shown to the user while the model trains
const LOADING_PHASES = [
  { message: 'Downloading live market data…', delay: 0 },
  { message: 'Computing technical indicators…', delay: 3000 },
  { message: 'Training GRU model on live data…', delay: 7000 },
  { message: 'Generating predictions…', delay: 12000 },
];

export function useStockPrediction() {
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('');
  const [error, setError] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [explainerData, setExplainerData] = useState(null);
  const [showExplainer, setShowExplainer] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [notification, setNotification] = useState(null);
  const [cachedTickers, setCachedTickers] = useState([]);

  // Keep a ref so we can clear phase timers on completion
  const phaseTimers = useRef([]);

  // Fetch cached tickers on mount so we can skip loading phases for cached ones
  useEffect(() => {
    fetchCacheStatus().then((status) => {
      setCachedTickers(status.cached_tickers || []);
    });
  }, []);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const clearPhaseTimers = useCallback(() => {
    phaseTimers.current.forEach(clearTimeout);
    phaseTimers.current = [];
  }, []);

  const startPhaseTimers = useCallback(() => {
    clearPhaseTimers();
    LOADING_PHASES.forEach(({ message, delay }) => {
      const id = setTimeout(() => setLoadingPhase(message), delay);
      phaseTimers.current.push(id);
    });
  }, [clearPhaseTimers]);

  const handlePredict = useCallback(async () => {
    const cleanTicker = ticker.trim().toUpperCase();
    if (!cleanTicker) {
      showNotification('Please enter a stock ticker', 'error');
      return;
    }

    setLoading(true);
    setError(null);

    // If ticker is already cached the response is near-instant — show a simple message
    const isCached = cachedTickers.includes(cleanTicker);
    if (isCached) {
      setLoadingPhase('Loading cached prediction…');
    } else {
      startPhaseTimers();
    }

    try {
      const json = await predictStock(cleanTicker);
      const transformed = transformApiResponse(json, cleanTicker);
      setPredictionData(transformed);

      const explainer = generateExplainerData(transformed);
      setExplainerData(explainer);

      // After a successful fresh prediction, add this ticker to the cached list
      if (!isCached) {
        setCachedTickers((prev) => [...new Set([...prev, cleanTicker])]);
      }

      showNotification(`Successfully analyzed ${cleanTicker} with GRU model`, 'success');
    } catch (err) {
      console.error('Prediction error:', err);
      setError(err.message);
      showNotification(err.message || 'Error analyzing stock data', 'error');
    } finally {
      clearPhaseTimers();
      setLoading(false);
      setLoadingPhase('');
    }
  }, [ticker, showNotification, cachedTickers, startPhaseTimers, clearPhaseTimers]);

  const toggleExplainer = useCallback(() => {
    setShowExplainer((prev) => !prev);
  }, []);

  const toggleReport = useCallback(() => {
    setShowReport((prev) => !prev);
  }, []);

  const closeExplainer = useCallback(() => {
    setShowExplainer(false);
  }, []);

  const closeReport = useCallback(() => {
    setShowReport(false);
  }, []);

  return {
    ticker,
    setTicker,
    loading,
    loadingPhase,
    error,
    predictionData,
    explainerData,
    showExplainer,
    showReport,
    notification,
    handlePredict,
    toggleExplainer,
    toggleReport,
    closeExplainer,
    closeReport,
  };
}
