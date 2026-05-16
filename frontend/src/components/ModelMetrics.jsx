export default function ModelMetrics({ data }) {
  if (!data) {
    return (
      <div className="row mt-3">
        <div className="col-md-4">
          <div className="stats-card">
            <div className="metric-value" id="accuracy">-</div>
            <div className="metric-label">Model Accuracy</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stats-card">
            <div className="metric-value" id="mse">-</div>
            <div className="metric-label">Mean Square Error</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stats-card">
            <div className="metric-value" id="trend">-</div>
            <div className="metric-label">Trend Direction</div>
          </div>
        </div>
      </div>
    );
  }

  const trendColor =
    data.metrics.trend === 'Bullish'
      ? 'var(--success-color)'
      : 'var(--danger-color)';

  return (
    <div className="row mt-3">
      <div className="col-md-4">
        <div className="stats-card">
          <div className="metric-value" id="accuracy">
            {data.metrics.accuracy}%
          </div>
          <div className="metric-label">Model Accuracy</div>
        </div>
      </div>
      <div className="col-md-4">
        <div className="stats-card">
          <div className="metric-value" id="mse">
            {data.metrics.mse}
          </div>
          <div className="metric-label">Mean Square Error</div>
        </div>
      </div>
      <div className="col-md-4">
        <div className="stats-card">
          <div
            className="metric-value"
            id="trend"
            style={{
              color: trendColor,
              background: 'none',
              WebkitBackgroundClip: 'unset',
              WebkitTextFillColor: trendColor,
              backgroundClip: 'unset',
            }}
          >
            {data.metrics.trend}
          </div>
          <div className="metric-label">Trend Direction</div>
        </div>
      </div>
    </div>
  );
}
