export default function StockMetrics({ data }) {
  if (!data) {
    return (
      <div className="stock-metrics mb-3">
        <div className="stats-card">
          <div className="metric-value" id="current-price">-</div>
          <div className="metric-label">Current Price</div>
        </div>
        <div className="stats-card">
          <div className="metric-value" id="next-day-price">-</div>
          <div className="metric-label">Next Day Forecast</div>
        </div>
        <div className="stats-card">
          <div className="metric-value" id="predicted-change">-</div>
          <div className="metric-label">Expected Change</div>
        </div>
      </div>
    );
  }

  const currentPrice = data.currentPrice || 0;

  // Fix 1: Use the true next-day forecast from the backend.
  // nextDayChangePct is computed server-side by feeding the last 60 real days
  // into the trained GRU — it is a genuine forward prediction, not a
  // validation-set reconstruction error vs today's price.
  const nextDayPrice   = data.nextDayPrice   ?? null;
  const rawChangePct   = data.nextDayChangePct ?? null;
  const priceChange    = rawChangePct !== null ? Number(rawChangePct).toFixed(2) : null;
  const changeColor    = priceChange !== null
    ? (Number(priceChange) >= 0 ? 'var(--success-color)' : 'var(--danger-color)')
    : 'inherit';

  return (
    <div className="stock-metrics mb-3">
      <div className="stats-card">
        <div className="metric-value" id="current-price">
          ${currentPrice.toFixed(2)}
        </div>
        <div className="metric-label">Current Price</div>
      </div>

      {nextDayPrice !== null && (
        <div className="stats-card">
          <div className="metric-value" id="next-day-price">
            ${nextDayPrice.toFixed(2)}
          </div>
          <div className="metric-label">Next Day Forecast</div>
        </div>
      )}

      <div className="stats-card">
        <div
          className="metric-value"
          id="predicted-change"
          style={{
            color: changeColor,
            background: 'none',
            WebkitBackgroundClip: 'unset',
            WebkitTextFillColor: changeColor,
            backgroundClip: 'unset',
          }}
        >
          {priceChange !== null ? `${priceChange}%` : '—'}
        </div>
        <div className="metric-label">Expected Change</div>
      </div>
    </div>
  );
}
