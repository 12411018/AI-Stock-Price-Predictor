import {
  calculateVolatility,
  calculateMA,
  calculateRSI,
  calculateVolumeTrend,
  companyProfiles,
} from '../utils/calculations';

export default function AnalysisReport({ isOpen, onClose, data }) {
  if (!data) {
    return (
      <>
        <div
          id="analysis-report"
          className={`analysis-report${isOpen ? ' open' : ''}`}
        >
          <div className="report-close" id="report-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </div>
          <div className="report-header">
            <i className="fas fa-file-alt"></i>
            <h4>Stock Analysis Report</h4>
          </div>
          <div id="stock-badge-container"></div>
          <div className="report-section">
            <div className="report-section-title">
              <i className="fas fa-newspaper"></i> Executive Summary
            </div>
            <div className="report-content">-</div>
          </div>
        </div>
      </>
    );
  }

  const profile = companyProfiles[data.ticker] || {
    name: data.ticker,
    sector: 'Unknown',
    focus: 'business operations',
  };
  const prices = data.historicalPrices;
  const priceChange = (
    ((prices[prices.length - 1] - prices[0]) / prices[0]) *
    100
  ).toFixed(2);
  const volatility = calculateVolatility(prices);
  const avgPrice = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
  const maxPrice = Math.max(...prices).toFixed(2);
  const minPrice = Math.min(...prices).toFixed(2);
  const ma7 = calculateMA(prices, 7);
  const ma21 = calculateMA(prices, 21);
  const currentPrice = prices[prices.length - 1];
  const rsi = calculateRSI(prices, 14);
  const volumeTrend = calculateVolumeTrend(prices);
  const lastPrice = data.historicalPrices[data.historicalPrices.length - 1];
  const predictedPrice = data.predictions[data.predictions.length - 1];
  const predictionChange = (
    ((predictedPrice - lastPrice) / lastPrice) *
    100
  ).toFixed(2);
  const isBullish = data.metrics.trend === 'Bullish';

  let riskLevel = volatility > 3 ? 'HIGH' : volatility > 1.5 ? 'MODERATE' : 'LOW';

  // BUY/SELL signal logic
  const buySignals = [];
  const sellSignals = [];
  if (rsi < 35) buySignals.push(`RSI oversold (${rsi.toFixed(0)} < 35)`);
  if (rsi > 65) sellSignals.push(`RSI overbought (${rsi.toFixed(0)} > 65)`);
  if (ma7 > ma21 && currentPrice > ma7) buySignals.push('Bullish MA crossover + price above MA7');
  if (ma7 < ma21 && currentPrice < ma7) sellSignals.push('Bearish MA crossover + price below MA7');
  if (currentPrice < parseFloat(minPrice) * 1.05) buySignals.push('Near support level (bounce potential)');
  if (currentPrice > parseFloat(maxPrice) * 0.95) sellSignals.push('Near resistance (pullback likely)');
  if (predictionChange > 2) buySignals.push(`AI predicts +${predictionChange}% gain`);
  if (predictionChange < -2) sellSignals.push(`AI predicts ${predictionChange}% loss`);
  if (volumeTrend > 5) buySignals.push('Volume increasing (+' + volumeTrend.toFixed(1) + '%)');
  if (volumeTrend < -5) sellSignals.push('Volume decreasing (' + volumeTrend.toFixed(1) + '%)');

  const recommendation =
    buySignals.length > sellSignals.length
      ? 'BUY'
      : sellSignals.length > buySignals.length
      ? 'SELL'
      : 'HOLD';
  const confidence =
    Math.abs(buySignals.length - sellSignals.length) >= 2 ? 'High' : 'Moderate';

  return (
    <div
      id="analysis-report"
      className={`analysis-report${isOpen ? ' open' : ''}`}
    >
      <div className="report-close" id="report-close" onClick={onClose}>
        <i className="fas fa-times"></i>
      </div>
      <div className="report-header">
        <i className="fas fa-file-alt"></i>
        <h4>Stock Analysis Report</h4>
      </div>

      <div id="stock-badge-container">
        <div className="stock-ticker-badge">
          {data.ticker} - {profile.name}
        </div>
      </div>

      {/* Executive Summary */}
      <div className="report-section">
        <div className="report-section-title">
          <i className="fas fa-newspaper"></i> Executive Summary
        </div>
        <div id="report-summary" className="report-content">
          {profile.name} ({data.ticker}) operates in the {profile.sector} sector
          focusing on {profile.focus}. Over the past {prices.length} trading days,
          the stock has moved {priceChange >= 0 ? 'upward by ' : 'downward by '}
          {Math.abs(priceChange)}%, trading in a range of ${minPrice} to $
          {maxPrice} with an average price of ${avgPrice}.
        </div>
      </div>

      {/* Historical Performance */}
      <div className="report-section">
        <div className="report-section-title">
          <i className="fas fa-history"></i> Historical Performance Analysis
        </div>
        <div id="report-historical" className="report-content">
          The stock's recent performance shows{' '}
          {volatility > 3
            ? 'significant volatility'
            : volatility > 1.5
            ? 'moderate price swings'
            : 'stable trading patterns'}{' '}
          with a {volatility.toFixed(2)}% volatility level. Price momentum has been{' '}
          {priceChange >= 0
            ? 'positive, indicating buyer interest'
            : 'negative, suggesting seller pressure'}
          . The {prices.length}-day moving average shows the stock trading{' '}
          {prices[prices.length - 1] > avgPrice ? 'above average' : 'below average'}.
        </div>
      </div>

      {/* Technical Indicators */}
      <div className="report-section">
        <div className="report-section-title">
          <i className="fas fa-chart-line"></i> Technical Indicators Analysis
        </div>
        <div
          id="report-technical"
          className="report-content"
          dangerouslySetInnerHTML={{
            __html: `
              <strong>📊 Moving Averages (Trend Indicators):</strong><br>
              • 7-day MA = <span class="signal-positive">$${ma7.toFixed(2)}</span><br>
              • 21-day MA = <span class="signal-positive">$${ma21.toFixed(2)}</span><br>
              • Current Price: <strong>$${currentPrice.toFixed(2)}</strong><br><br>
              
              <strong>🔍 Calculation:</strong> MA7 ($${ma7.toFixed(2)}) ${ma7 > ma21 ? '>' : '<'} MA21 ($${ma21.toFixed(2)})<br>
              <strong>📌 Signal:</strong> ${
                ma7 > ma21
                  ? '<span class="signal-positive">✅ BULLISH</span> - Short-term momentum is UP'
                  : '<span class="signal-negative">⚠️ BEARISH</span> - Short-term momentum is DOWN'
              }<br><br>
              
              <strong>📈 RSI (Momentum Strength):</strong><br>
              • RSI Formula: 100 - (100 / (1 + (Avg Gain / Avg Loss)))<br>
              • RSI Value = <strong>${rsi.toFixed(2)}</strong><br>
              • Status: ${
                rsi > 70
                  ? '<span class="signal-negative">🔴 OVERBOUGHT (>70)</span> - Sell pressure likely'
                  : rsi < 30
                  ? '<span class="signal-positive">🟢 OVERSOLD (<30)</span> - Buy opportunity'
                  : '<span class="signal-neutral">🟡 NEUTRAL (30-70)</span> - Balanced market'
              }<br><br>
              
              <strong>📍 Price Positioning:</strong><br>
              • Distance from MA7: ${((currentPrice - ma7) / ma7 * 100).toFixed(2)}% ${currentPrice > ma7 ? '(Above - Strong 💪)' : '(Below - Weak 📉)'}<br>
              • Distance from MA21: ${((currentPrice - ma21) / ma21 * 100).toFixed(2)}% ${currentPrice > ma21 ? '(Above)' : '(Below)'}<br>
              • Support Level: $${minPrice} | Resistance: $${maxPrice}<br>
              • Volume Trend: ${
                volumeTrend > 0
                  ? '<span class="signal-positive">📈 Increasing (+' + volumeTrend.toFixed(1) + '%)</span>'
                  : '<span class="signal-negative">📉 Decreasing (' + volumeTrend.toFixed(1) + '%)</span>'
              }
            `,
          }}
        ></div>
      </div>

      {/* Price Prediction Reasoning */}
      <div className="report-section">
        <div className="report-section-title">
          <i className="fas fa-lightbulb"></i> Price Prediction Reasoning
        </div>
        <div
          id="report-reasoning"
          className="report-content"
          dangerouslySetInnerHTML={{
            __html: `
              <strong>🎯 AI Prediction: <span class="signal-positive">$${predictedPrice.toFixed(2)}</span></strong> (${predictionChange >= 0 ? '+' : ''}${predictionChange}% from current)<br><br>
              
              <strong>🔍 WHY ${isBullish ? 'BULLISH' : 'BEARISH'} Trend?</strong><br>
              ${
                isBullish
                  ? `<span class="signal-positive">✅ Bullish Signals Detected:</span><br>
                   1️⃣ MA7 ($${ma7.toFixed(2)}) > MA21 ($${ma21.toFixed(2)}) = Short-term momentum UP<br>
                   2️⃣ Current price ($${currentPrice.toFixed(2)}) is ${currentPrice > avgPrice ? 'ABOVE' : 'near'} average ($${avgPrice})<br>
                   3️⃣ Price trajectory: ${priceChange >= 0 ? '+' : ''}${priceChange}% ${priceChange >= 0 ? 'gain shows buyers in control' : 'but stabilizing'}<br>
                   4️⃣ RSI (${rsi.toFixed(0)}): ${rsi < 70 ? 'Room to grow, not overbought yet' : 'Strong but near peak'}<br>
                   5️⃣ Volume: ${volumeTrend > 0 ? 'Increasing - confirms uptrend 📈' : 'Stable'}<br>`
                  : `<span class="signal-negative">⚠️ Bearish Signals Detected:</span><br>
                   1️⃣ MA7 ($${ma7.toFixed(2)}) < MA21 ($${ma21.toFixed(2)}) = Short-term momentum DOWN<br>
                   2️⃣ Current price ($${currentPrice.toFixed(2)}) showing weakness vs average ($${avgPrice})<br>
                   3️⃣ Price trajectory: ${priceChange}% decline shows sellers dominating<br>
                   4️⃣ RSI (${rsi.toFixed(0)}): ${rsi > 30 ? 'Downward pressure continues' : 'Oversold - potential bounce ahead'}<br>
                   5️⃣ Volume: ${volumeTrend < 0 ? 'Decreasing - weak hands selling 📉' : 'Mixed'}<br>`
              }<br>
              
              <strong>📊 How Prediction Was Calculated:</strong><br>
              • GRU analyzed 60-day price patterns (60 days × 5 indicators = 300 data points)<br>
              • Features weighted: Close (35%), MA7 (25%), MA21 (20%), RSI (12%), MACD (8%)<br>
              • Model accuracy: ${data.metrics.accuracy}% (Error: ±$${data.metrics.rmse})<br>
              • Formula: Weighted_Sum × Scale_Factor = $${predictedPrice.toFixed(2)}<br>
              • Confidence range: $${(predictedPrice * 0.97).toFixed(2)} - $${(predictedPrice * 1.03).toFixed(2)} (±3%)
            `,
          }}
        ></div>
      </div>

      {/* Risk Assessment */}
      <div className="report-section">
        <div className="report-section-title">
          <i className="fas fa-exclamation-triangle"></i> Risk Assessment
        </div>
        <div
          id="report-risk"
          className="report-content"
          dangerouslySetInnerHTML={{
            __html: `
              <strong>Risk Level: <span class="metric-highlight">${riskLevel}</span></strong><br><br>
              
              <strong>📊 Volatility Analysis:</strong><br>
              • Standard Deviation: ${volatility.toFixed(2)}%<br>
              • Price Range: $${minPrice} - $${maxPrice} (Spread: $${(maxPrice - minPrice).toFixed(2)})<br>
              • Daily swing potential: ±${(volatility / 2).toFixed(2)}%<br>
              • Risk Category: ${riskLevel} ${riskLevel === 'HIGH' ? '(🔴 Large swings expected)' : riskLevel === 'MODERATE' ? '(🟡 Normal fluctuations)' : '(🟢 Stable, predictable)'}<br><br>
              
              <strong>⚠️ Risk Factors:</strong><br>
              • Earnings announcements can cause sudden moves<br>
              • ${profile.sector} sector news affects ${profile.name}<br>
              • Fed policy, inflation data impact stock prices<br>
              • Model error margin: ±$${data.metrics.rmse}<br><br>
              
              <strong>🛡️ Recommended Stop-Loss:</strong><br>
              ${
                riskLevel === 'HIGH'
                  ? '• Tight stop: $' + (currentPrice * 0.95).toFixed(2) + ' (-5% from current)<br>• Position size: Keep small (2-5% of capital)'
                  : riskLevel === 'MODERATE'
                  ? '• Normal stop: $' + (currentPrice * 0.92).toFixed(2) + ' (-8% from current)<br>• Position size: Moderate (5-10% of capital)'
                  : '• Wide stop: $' + (currentPrice * 0.90).toFixed(2) + ' (-10% from current)<br>• Position size: Can be larger (up to 15%)'
              }
            `,
          }}
        ></div>
      </div>

      {/* Short-term Outlook */}
      <div className="report-section">
        <div className="report-section-title">
          <i className="fas fa-telescope"></i> Short-term Outlook
        </div>
        <div
          id="report-outlook"
          className="report-content"
          dangerouslySetInnerHTML={{
            __html: `
              <strong>📊 RECOMMENDATION: <span class="metric-highlight" style="background: ${recommendation === 'BUY' ? 'rgba(0, 255, 136, 0.25)' : recommendation === 'SELL' ? 'rgba(255, 56, 96, 0.25)' : 'rgba(255, 149, 0, 0.25)'}; border-color: ${recommendation === 'BUY' ? 'var(--accent-green)' : recommendation === 'SELL' ? 'var(--accent-red)' : 'var(--accent-orange)'}; color: ${recommendation === 'BUY' ? 'var(--accent-green)' : recommendation === 'SELL' ? 'var(--accent-red)' : 'var(--accent-orange)'}; font-size: 1.2rem;">${recommendation}</span></strong><br>
              <strong>Confidence: ${confidence}</strong> (${buySignals.length + sellSignals.length} signals detected)<br><br>
              
              ${
                recommendation === 'BUY'
                  ? `<strong><span class="signal-positive">🟢 BUY Signals (${buySignals.length}):</span></strong><br>
                   ${buySignals.map((s) => '✓ ' + s).join('<br>')}<br>
                   ${sellSignals.length > 0 ? '<br><strong>⚠️ Warning Signs (' + sellSignals.length + '):</strong><br>' + sellSignals.map((s) => '• ' + s).join('<br>') + '<br>' : ''}<br>
                   <strong>🎯 Action Plan:</strong><br>
                   • <strong>Entry Zone:</strong> $${(currentPrice * 0.99).toFixed(2)} - $${currentPrice.toFixed(2)}<br>
                   • <strong>Target Price:</strong> $${predictedPrice.toFixed(2)} (${predictionChange >= 0 ? '+' : ''}${predictionChange}%)<br>
                   • <strong>Stop Loss:</strong> $${(currentPrice * 0.95).toFixed(2)} (-5%)<br>
                   • <strong>Risk/Reward:</strong> ${(Math.abs(predictionChange) / 5).toFixed(2)}:1<br>
                   • <strong>Time Frame:</strong> ${Math.abs(predictionChange) > 5 ? '1-2 weeks (short-term)' : '2-4 weeks (medium-term)'}<br>
                   • <strong>Position Size:</strong> ${riskLevel === 'HIGH' ? '2-5%' : riskLevel === 'MODERATE' ? '5-10%' : '10-15%'} of portfolio`
                  : recommendation === 'SELL'
                  ? `<strong><span class="signal-negative">🔴 SELL Signals (${sellSignals.length}):</span></strong><br>
                   ${sellSignals.map((s) => '✓ ' + s).join('<br>')}<br>
                   ${buySignals.length > 0 ? '<br><strong>💡 Positive Factors (' + buySignals.length + '):</strong><br>' + buySignals.map((s) => '• ' + s).join('<br>') + '<br>' : ''}<br>
                   <strong>🎯 Action Plan:</strong><br>
                   • <strong>Exit Price:</strong> $${currentPrice.toFixed(2)} or better<br>
                   • <strong>Strategy:</strong> ${Math.abs(predictionChange) > 5 ? 'Sell immediately' : 'Sell on next bounce to MA7'}<br>
                   • <strong>Avoid:</strong> New positions until trend reverses<br>
                   • <strong>Watch for:</strong> MA7 crossing above MA21 (reversal signal)<br>
                   • <strong>Alternative:</strong> If must hold, set stop-loss at $${(currentPrice * 0.92).toFixed(2)} (-8%)`
                  : `<strong><span class="signal-neutral">🟡 HOLD / WAIT (${Math.max(buySignals.length, sellSignals.length)} signals each side)</span></strong><br>
                   <strong>Buy Signals (${buySignals.length}):</strong><br>${buySignals.map((s) => '✓ ' + s).join('<br>')}<br><br>
                   <strong>Sell Signals (${sellSignals.length}):</strong><br>${sellSignals.map((s) => '✓ ' + s).join('<br>')}<br><br>
                   <strong>🎯 Action Plan:</strong><br>
                   • <strong>Wait for clarity</strong> - Mixed signals suggest indecision<br>
                   • <strong>Set alerts:</strong> Buy if drops below $${(currentPrice * 0.97).toFixed(2)}<br>
                   • <strong>Set alerts:</strong> Sell if rises above $${(currentPrice * 1.03).toFixed(2)}<br>
                   • <strong>Monitor:</strong> ${profile.sector} sector news & earnings dates<br>
                   • <strong>Re-evaluate:</strong> In 2-3 trading days`
              }<br><br>
              
              <strong>📍 Key Price Levels:</strong><br>
              • Current: <strong>$${currentPrice.toFixed(2)}</strong><br>
              • AI Target: <span class="signal-positive">$${predictedPrice.toFixed(2)}</span> (${predictionChange >= 0 ? '+' : ''}${predictionChange}%)<br>
              • Support: <span class="signal-positive">$${minPrice}</span> (floor)<br>
              • Resistance: <span class="signal-negative">$${maxPrice}</span> (ceiling)<br>
              • MA7: $${ma7.toFixed(2)} | MA21: $${ma21.toFixed(2)}<br><br>
              
              <strong>ℹ️ Important Notes:</strong><br>
              • This is AI analysis, not financial advice<br>
              • Always do your own research (DYOR)<br>
              • Never invest more than you can afford to lose<br>
              • Past performance doesn't guarantee future results
            `,
          }}
        ></div>
      </div>
    </div>
  );
}
