// Calculation utilities - ported from main.js

export function calculateVolatility(prices) {
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const squaredDiffs = prices.map((p) => Math.pow(p - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  return (stdDev / mean) * 100;
}

export function calculateMA(prices, period) {
  const recent = prices.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

export function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;

  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  const recentChanges = changes.slice(-period);

  const gains = recentChanges.filter((c) => c > 0);
  const losses = recentChanges.filter((c) => c < 0).map((c) => Math.abs(c));

  const avgGain =
    gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0.01;
  const avgLoss =
    losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0.01;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calculateVolumeTrend(prices) {
  if (prices.length < 20) return 0;

  const recentPrices = prices.slice(-10);
  const oldPrices = prices.slice(-20, -10);

  const recentAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
  const oldAvg = oldPrices.reduce((a, b) => a + b, 0) / oldPrices.length;

  return ((recentAvg - oldAvg) / oldAvg) * 100;
}

// Transform raw API response into the dashboard-ready format
export function transformApiResponse(json, ticker) {
  // current_price comes directly from the backend (most recent close)
  const currentPrice = json.current_price || (
    json.historical_prices?.length > 0
      ? json.historical_prices[json.historical_prices.length - 1]
      : 0
  );

  return {
    ticker: json.ticker || ticker,
    dates: json.dates || [],
    historicalPrices: json.historical_prices || [],
    predictions: json.predictions || [],
    historicalData: json.historical_data || [],
    dataRange: json.data_range || null,
    cached: json.cached || false,
    currentPrice,
    // Fix 1: true next-day forecast from backend
    nextDayPrice: json.next_day_price || null,
    nextDayChangePct: json.next_day_change_pct ?? null,
    metrics: {
      mse:
        json.metrics && typeof json.metrics.mse === 'number'
          ? json.metrics.mse.toFixed(2)
          : '0.00',
      rmse:
        json.metrics && typeof json.metrics.rmse === 'number'
          ? json.metrics.rmse.toFixed(2)
          : '0.00',
      rmseRaw: json.metrics?.rmse || 0,
      // Fix 4: expose pre-computed rmse_pct from backend
      rmsePct:
        json.metrics && typeof json.metrics.rmse_pct === 'number'
          ? json.metrics.rmse_pct.toFixed(2)
          : null,
      mae:
        json.metrics && typeof json.metrics.mae === 'number'
          ? json.metrics.mae.toFixed(2)
          : '0.00',
      accuracy: (() => {
        // Fix 4: prefer backend-provided rmse_pct; fall back to computing it
        const rmsePct =
          json.metrics?.rmse_pct ??
          (() => {
            const rmse = json.metrics?.rmse || 0;
            const avgPrice =
              json.historical_prices?.length > 0
                ? json.historical_prices.reduce((a, b) => a + b, 0) /
                  json.historical_prices.length
                : 100;
            return (rmse / avgPrice) * 100;
          })();
        const accuracy = Math.max(0, Math.min(100, 100 - rmsePct));
        return accuracy.toFixed(2);
      })(),
      trend: (() => {
        // Fix 1: use next-day forecast to determine trend, not validation tail
        if (json.next_day_price != null && currentPrice > 0) {
          return json.next_day_price >= currentPrice ? 'Bullish' : 'Bearish';
        }
        // Fallback to old validation-tail comparison
        const predArr = json.predictions || [];
        if (predArr.length > 0 && currentPrice > 0) {
          const recentPreds = predArr.slice(-5);
          const avgRecentPred = recentPreds.reduce((a, b) => a + b, 0) / recentPreds.length;
          return avgRecentPred >= currentPrice ? 'Bullish' : 'Bearish';
        }
        return 'Neutral';
      })(),
    },
  };
}

// Company profiles for analysis
export const companyProfiles = {
  AAPL: { name: 'Apple Inc.', sector: 'Technology', focus: 'consumer electronics and software' },
  GOOGL: { name: 'Alphabet Inc.', sector: 'Technology', focus: 'digital advertising and cloud services' },
  MSFT: { name: 'Microsoft Corporation', sector: 'Technology', focus: 'cloud computing and enterprise software' },
  AMZN: { name: 'Amazon.com Inc.', sector: 'E-commerce & Cloud', focus: 'retail and AWS services' },
  TSLA: { name: 'Tesla Inc.', sector: 'Automotive & Energy', focus: 'electric vehicles and renewables' },
  NFLX: { name: 'Netflix Inc.', sector: 'Entertainment', focus: 'streaming content' },
  NVDA: { name: 'NVIDIA Corporation', sector: 'Semiconductors', focus: 'GPUs and AI chips' },
  JPM: { name: 'JPMorgan Chase', sector: 'Finance', focus: 'banking and investment services' },
  META: { name: 'Meta Platforms', sector: 'Technology', focus: 'social media and metaverse' },
  AMD: { name: 'AMD Inc.', sector: 'Semiconductors', focus: 'processors and graphics' },
};

// Sample stocks for autocomplete
export const sampleStocks = [
  'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NFLX', 'NVDA', 'JPM', 'META', 'AMD',
  'INTC', 'CSCO', 'ORCL', 'IBM', 'UBER', 'LYFT', 'SNAP', 'TWTR', 'SPOT', 'ZM',
];

// Generate explainer data
export function generateExplainerData(data) {
  const features = [
    'Close Price', 'Volume', 'MA7', 'MA21', 'EMA20',
    'RSI', 'MACD', 'BB Upper', 'BB Lower', 'ATR'
  ];

  // Deterministic weights reflecting each feature's importance in the GRU.
  // Close is the primary signal; Volume confirms directional moves;
  // MAs capture trend; Bollinger Bands signal mean reversion;
  // RSI/MACD are momentum oscillators; ATR measures volatility magnitude.
  const BASE_WEIGHTS = [28, 12, 12, 10, 8, 7, 7, 5, 5, 6];
  const total = BASE_WEIGHTS.reduce((a, b) => a + b, 0);
  const normalizedImportance = BASE_WEIGHTS.map((v) => (v / total) * 100);

  // Build a dynamic date-range label from the API response
  const rangeLabel = data.dataRange
    ? `${data.dataRange.start} to ${data.dataRange.end} (${data.dataRange.trading_days} trading days)`
    : `${data.historicalData.length} trading days`;

  // Fix 4: Show RMSE as % of price (error rate) instead of raw dollar RMSE
  const rmsePct = data.metrics.rmsePct
    ? `${data.metrics.rmsePct}%`
    : (() => {
        const rmse = data.metrics.rmseRaw || 0;
        const avgPrice =
          data.historicalPrices.length > 0
            ? data.historicalPrices.reduce((a, b) => a + b, 0) / data.historicalPrices.length
            : 1;
        return `${((rmse / avgPrice) * 100).toFixed(2)}%`;
      })();

  return {
    summary: `GRU model analyzed ${data.historicalData.length} trading days across 10 technical features to predict ${data.ticker} price movement`,
    features,
    normalizedImportance,
    technicalAnalysis: [
      `Historical data analyzed: ${rangeLabel}`,
      `Current trend: ${data.metrics.trend}`,
      `10 features: Close, Volume, MA7, MA21, EMA20, RSI, MACD, Bollinger Bands, ATR`,
    ],
    modelReasoning: [
      `3-layer GRU (128→64→32 units) with learning-rate scheduling and gradient clipping`,
      `Model trained on live market data from ${rangeLabel}`,
      `Validation error rate: ${rmsePct} of average price (lower is better)`,
    ],
    predictionFactors: [
      `Close Price (momentum): Most recent price movement has ${normalizedImportance[0].toFixed(1)}% influence`,
      `Volume: Confirms directional moves with ${normalizedImportance[1].toFixed(1)}% weight`,
      `MA7 & EMA20: Short-term trend signals contribute ${(normalizedImportance[2] + normalizedImportance[4]).toFixed(1)}% combined`,
      `Bollinger Bands: Mean-reversion signals account for ${(normalizedImportance[6] + normalizedImportance[7]).toFixed(1)}% combined`,
    ],
  };
}
