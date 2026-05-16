// Stock Prediction Dashboard - Main JavaScript

// Sample stocks for autocomplete
const sampleStocks = [
    'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NFLX', 'NVDA', 'JPM', 'META', 'AMD',
    'INTC', 'CSCO', 'ORCL', 'IBM', 'UBER', 'LYFT', 'SNAP', 'TWTR', 'SPOT', 'ZM'
];

// Show notification message
function showNotification(message, type = 'success') {
    const notification = $('#notification');
    notification.text(message)
        .removeClass('error-notification success-notification')
        .addClass(`${type}-notification`)
        .fadeIn();

    setTimeout(() => notification.fadeOut(), 3000);
}

// Animate elements on scroll
function animateOnScroll() {
    $('.animate__animated:not(.animate__fadeIn)').each(function() {
        const elementTop = $(this).offset().top;
        const windowHeight = $(window).height();
        const scrollTop = $(window).scrollTop();
        
        if (elementTop < (scrollTop + windowHeight - 100)) {
            $(this).addClass('animate__fadeIn');
        }
    });
}

// Autocomplete search for stock ticker
$('#ticker').on('input', function() {
    const query = $(this).val().toUpperCase().trim();
    if (query.length > 0) {
        const filteredStocks = sampleStocks.filter(stock => 
            stock.startsWith(query)
        ).slice(0, 8);

        if (filteredStocks.length > 0) {
            $('#suggestions').empty().show();
            filteredStocks.forEach(stock => {
                $('#suggestions').append(`
                    <div class="autocomplete-suggestion">
                        <i class="fas fa-chart-line"></i>
                        <span>${stock}</span>
                    </div>
                `);
            });
        } else {
            $('#suggestions').empty().hide();
        }
    } else {
        $('#suggestions').empty().hide();
    }
});

// Handle suggestion click
$(document).on('click', '.autocomplete-suggestion', function() {
    $('#ticker').val($(this).text().trim());
    $('#suggestions').empty().hide();
});

// Hide suggestions when clicking outside
$(document).on('click', function(e) {
    if (!$(e.target).closest('.autocomplete-suggestions, #ticker').length) {
        $('#suggestions').empty().hide();
    }
});

// Main prediction function
$('#predict').click(function() {
    const ticker = $('#ticker').val().trim().toUpperCase();
    if (!ticker) {
        showNotification('Please enter a stock ticker', 'error');
        return;
    }
    if (ticker.length > 10 || !/^[A-Z]+$/.test(ticker)) {
        showNotification('Invalid ticker format. Use letters only (e.g. AAPL)', 'error');
        return;
    }

    $('#predict').prop('disabled', true);
    $('#loading').fadeIn();
    
    const formData = new FormData();
    formData.append('ticker', ticker);
    fetch('/predict', { method: 'POST', body: formData })
    .then(response => {
        if (!response.ok) return response.json().then(err => { throw new Error(err.error || 'Server error'); });
        return response.json();
    })
    .then(json => {
        if (json && json.error) throw new Error(json.error);
        console.log('Backend response:', json);
        try {
            const transformed = {
                ticker: json.ticker || ticker,
                dates: json.dates || [],
                historicalPrices: json.historical_prices || [],
                predictions: json.predictions || [],
                historicalData: json.historical_data || [],
                currentPrice: json.current_price || 0,
                nextDayPrice: json.next_day_price || 0,
                nextDayChangePct: json.next_day_change_pct || 0,
                confidence: json.confidence || { score: 0, label: 'N/A', components: {} },
                indicators: json.indicators || {},
                featureImportance: json.feature_importance || {},
                dataRange: json.data_range || {},
                trainingHistory: json.training_history || { loss: [], val_loss: [], epochs: 0 },
                metricsDollar: json.metrics_dollar || {},
                metricsNorm: json.metrics || {},
                metrics: {
                    mse: json.metrics_dollar?.mse?.toFixed(2) || '0',
                    rmse: json.metrics_dollar?.rmse?.toFixed(2) || '0',
                    mae: json.metrics_dollar?.mae?.toFixed(2) || '0',
                    r2: json.metrics?.r2 || 0,
                    rmse_pct: json.metrics?.rmse_pct || 0,
                    directional_accuracy: json.metrics?.directional_accuracy || 0,
                    accuracy: (100 - (json.metrics?.rmse_pct || 0)).toFixed(2),
                    trend: (json.next_day_change_pct || 0) >= 0 ? 'Bullish' : 'Bearish'
                }
            };
            updateDashboard(transformed);
            generateAndShowExplainer(transformed);
            generateDetailedAnalysis(transformed);
            $('#explainer-toggle').addClass('show');
            $('#report-toggle').addClass('show');
            showNotification(`Successfully analyzed ${ticker} with GRU model` + (json.cached ? ' (cached)' : ''), 'success');
        } catch (error) {
            console.error('Processing error:', error);
            showNotification('Error processing prediction data: ' + error.message, 'error');
        }
    })
    .catch(error => {
        console.error('Fetch error:', error);
        showNotification(error.message || 'Error analyzing stock data', 'error');
    })
    .finally(() => {
        $('#loading').fadeOut();
        $('#predict').prop('disabled', false);
    });
});

// Update dashboard with prediction data
function updateDashboard(data) {
    // Use real next-day forecast from backend
    const cp = data.currentPrice || 0;
    const ndp = data.nextDayPrice || 0;
    const changePct = data.nextDayChangePct || 0;

    $('#current-price').text(`$${cp.toFixed(2)}`);
    $('#predicted-change').html(`${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%<br><small style="font-size:0.6em;opacity:0.7">→ $${ndp.toFixed(2)}</small>`)
        .css('color', changePct >= 0 ? 'var(--success-color)' : 'var(--danger-color)');

    // Real accuracy = 100 - RMSE% (how close predictions are to actual in %)
    if ($('#accuracy').length) {
        const acc = data.metrics.accuracy;
        $('#accuracy').text(`${acc}%`);
    }
    if ($('#mse').length) {
        $('#mse').text(`$${data.metrics.rmse} (±${data.metrics.rmse_pct.toFixed(2)}%)`);
    }
    if ($('#trend').length) {
        const t = data.metrics.trend;
        $('#trend').html(`${t}`)
            .css('color', t === 'Bullish' ? 'var(--success-color)' : 'var(--danger-color)');
    }

    // Update table with last 30 rows (most recent first)
    const recentData = data.historicalData.slice(-30).reverse();
    let tableContent = '';
    recentData.forEach((row, index) => {
        const changeColor = row.Close >= row.Open ? 'var(--success-color)' : 'var(--danger-color)';
        const dateLabel = index === 0 ? ` <span style="font-size:0.6em;color:var(--accent-green);">(Latest)</span>` : '';
        tableContent += `<tr><td>${row.date}${dateLabel}</td><td>$${row.Open.toFixed(2)}</td><td style="color:${changeColor}">$${row.Close.toFixed(2)}</td><td>$${row.High.toFixed(2)}</td><td>$${row.Low.toFixed(2)}</td></tr>`;
    });
    $('#table-body').html(tableContent);

    const layout = {
        template: 'plotly_dark', showlegend: true,
        legend: { orientation: 'h', y: -0.2, font: { color: '#e8e8e8' } },
        margin: { t: 50, b: 50, l: 60, r: 30 },
        xaxis: { title: { text: 'Date', font: { color: '#e8e8e8' } }, gridcolor: '#2a2f3f', color: '#e8e8e8' },
        yaxis: { title: { text: 'Price ($)', font: { color: '#e8e8e8' } }, gridcolor: '#2a2f3f', color: '#e8e8e8' },
        plot_bgcolor: 'rgba(26, 31, 46, 0.7)', paper_bgcolor: 'rgba(26, 31, 46, 0.7)',
        hovermode: 'x unified', font: { color: '#e8e8e8' }
    };

    Plotly.newPlot('line-chart', [{
        x: data.dates, y: data.historicalPrices, mode: 'lines', name: 'Actual', line: { color: '#00d4ff', width: 3 }
    }, {
        x: data.dates.slice(-Math.min(30, data.predictions.length)),
        y: data.predictions.slice(-Math.min(30, data.predictions.length)),
        mode: 'lines+markers', name: 'GRU Predicted',
        line: { color: '#00ff88', width: 3, dash: 'dash' }, marker: { size: 8, symbol: 'diamond', color: '#00ff88' }
    }], { ...layout, title: { text: `${data.ticker} — Actual vs GRU Predicted`, font: { size: 16, color: '#00d4ff' } } }, { responsive: true });

    // Real volume from backend
    const volDates = data.historicalData.slice(-60).map(r => r.date);
    const volValues = data.historicalData.slice(-60).map(r => r.Volume || 0);
    const volColors = data.historicalData.slice(-60).map(r => r.Close >= r.Open ? '#00ff88' : '#ff3860');

    Plotly.newPlot('bar-chart', [{
        x: volDates, y: volValues, type: 'bar', name: 'Volume',
        marker: { color: volColors, opacity: 0.8 }
    }], { ...layout, title: { text: `${data.ticker} Trading Volume (Real)`, font: { size: 16, color: '#00d4ff' } },
        yaxis: { title: { text: 'Volume', font: { color: '#e8e8e8' } }, gridcolor: '#2a2f3f', color: '#e8e8e8' }
    }, { responsive: true });
}

// Handle keyboard navigation in suggestions
$('#ticker').on('keydown', function(e) {
    const suggestions = $('.autocomplete-suggestion');
    const current = $('.autocomplete-suggestion.selected');
    
    if (suggestions.length) {
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (current.length === 0) {
                    suggestions.first().addClass('selected');
                } else {
                    current.removeClass('selected')
                        .next('.autocomplete-suggestion')
                        .addClass('selected');
                }
                break;
            
            case 'ArrowUp':
                e.preventDefault();
                if (current.length === 0) {
                    suggestions.last().addClass('selected');
                } else {
                    current.removeClass('selected')
                        .prev('.autocomplete-suggestion')
                        .addClass('selected');
                }
                break;
            
            case 'Enter':
                e.preventDefault();
                if (current.length) {
                    $('#ticker').val(current.text().trim());
                    $('#suggestions').empty().hide();
                }
                break;
            
            case 'Escape':
                $('#suggestions').empty().hide();
                break;
        }
    }
});

// Window resize handler for responsive charts
let resizeTimeout;
$(window).on('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const lineChart = document.getElementById('line-chart');
        const barChart = document.getElementById('bar-chart');
        
        if (lineChart && barChart) {
            Plotly.Plots.resize(lineChart);
            Plotly.Plots.resize(barChart);
        }
    }, 250);
});

// Explainer sidebar handlers
$('#explainer-toggle').click(function() {
    $('#explainer-sidebar').toggleClass('open');
});

$('#explainer-close').click(function() {
    $('#explainer-sidebar').removeClass('open');
});

// Report panel handlers
$('#report-toggle').click(function() {
    $('#analysis-report').toggleClass('open');
});

$('#report-close').click(function() {
    $('#analysis-report').removeClass('open');
});

// Generate detailed analysis
function generateDetailedAnalysis(data) {
    try {
        console.log('generateDetailedAnalysis called with:', data);
        
        // Company-specific profiles
    const companyProfiles = {
        'AAPL': { name: 'Apple Inc.', sector: 'Technology', focus: 'consumer electronics and software' },
        'GOOGL': { name: 'Alphabet Inc.', sector: 'Technology', focus: 'digital advertising and cloud services' },
        'MSFT': { name: 'Microsoft Corporation', sector: 'Technology', focus: 'cloud computing and enterprise software' },
        'AMZN': { name: 'Amazon.com Inc.', sector: 'E-commerce & Cloud', focus: 'retail and AWS services' },
        'TSLA': { name: 'Tesla Inc.', sector: 'Automotive & Energy', focus: 'electric vehicles and renewables' },
        'NFLX': { name: 'Netflix Inc.', sector: 'Entertainment', focus: 'streaming content' },
        'NVDA': { name: 'NVIDIA Corporation', sector: 'Semiconductors', focus: 'GPUs and AI chips' },
        'JPM': { name: 'JPMorgan Chase', sector: 'Finance', focus: 'banking and investment services' },
        'META': { name: 'Meta Platforms', sector: 'Technology', focus: 'social media and metaverse' },
        'AMD': { name: 'AMD Inc.', sector: 'Semiconductors', focus: 'processors and graphics' }
    };

    const profile = companyProfiles[data.ticker] || { name: data.ticker, sector: 'Unknown', focus: 'business operations' };
    const prices = data.historicalPrices;
    const priceChange = ((prices[prices.length - 1] - prices[0]) / prices[0] * 100).toFixed(2);
    const volatility = calculateVolatility(prices);
    const avgPrice = (prices.reduce((a, b) => a + b) / prices.length).toFixed(2);
    const maxPrice = Math.max(...prices).toFixed(2);
    const minPrice = Math.min(...prices).toFixed(2);

    const summary = `${profile.name} (${data.ticker}) operates in the ${profile.sector} sector focusing on ${profile.focus}. Over the past ${prices.length} trading days, the stock has moved ${priceChange >= 0 ? 'upward by ' : 'downward by '}${Math.abs(priceChange)}%, trading in a range of $${minPrice} to $${maxPrice} with an average price of $${avgPrice}.`;

    const historicalAnalysis = `The stock's recent performance shows ${volatility > 3 ? 'significant volatility' : volatility > 1.5 ? 'moderate price swings' : 'stable trading patterns'} with a ${volatility.toFixed(2)}% volatility level. Price momentum over the month has been ${priceChange >= 0 ? 'positive, indicating buyer interest' : 'negative, suggesting seller pressure'}. The ${prices.length}-day moving average shows the stock trading ${prices[prices.length - 1] > avgPrice ? 'above average' : 'below average'}, which is typical for ${priceChange >= 0 ? 'bullish periods' : 'bearish periods'}.`;

    const ind = data.indicators || {};
    const ma7 = ind.ma7 || calculateMA(prices, 7);
    const ma21 = ind.ma21 || calculateMA(prices, 21);
    const currentPrice = data.currentPrice || prices[prices.length - 1];
    const rsi = ind.rsi || calculateRSI(prices, 14);
    const volumeTrend = calculateVolumeTrend(prices);
    const ema20 = ind.ema20 || 0;
    const macd = ind.macd || 0;
    const bbUpper = ind.bb_upper || 0;
    const bbLower = ind.bb_lower || 0;
    const atr = ind.atr || 0;
    const confLabel = data.confidence?.label || 'N/A';
    const confScore = data.confidence?.score || 0;
    
    // Technical Analysis with REAL calculations shown
    const technicalAnalysis = `
        <strong>📊 Moving Averages (Trend Indicators):</strong><br>
        • 7-day MA = (Last 7 prices sum) ÷ 7 = <span class="signal-positive">$${ma7.toFixed(2)}</span><br>
        • 21-day MA = (Last 21 prices sum) ÷ 21 = <span class="signal-positive">$${ma21.toFixed(2)}</span><br>
        • Current Price: <strong>$${currentPrice.toFixed(2)}</strong><br><br>
        
        <strong>🔍 Calculation:</strong> MA7 ($${ma7.toFixed(2)}) ${ma7 > ma21 ? '>' : '<'} MA21 ($${ma21.toFixed(2)})<br>
        <strong>📌 Signal:</strong> ${ma7 > ma21 ? '<span class="signal-positive">✅ BULLISH</span> - Short-term momentum is UP' : '<span class="signal-negative">⚠️ BEARISH</span> - Short-term momentum is DOWN'}<br><br>
        
        <strong>📈 RSI (Momentum Strength):</strong><br>
        • RSI Formula: 100 - (100 / (1 + (Avg Gain / Avg Loss)))<br>
        • RSI Value = <strong>${rsi.toFixed(2)}</strong><br>
        • Status: ${rsi > 70 ? '<span class="signal-negative">🔴 OVERBOUGHT (>70)</span> - Sell pressure likely' : rsi < 30 ? '<span class="signal-positive">🟢 OVERSOLD (<30)</span> - Buy opportunity' : '<span class="signal-neutral">🟡 NEUTRAL (30-70)</span> - Balanced market'}<br><br>
        
        <strong>📍 Price Positioning:</strong><br>
        • Distance from MA7: ${((currentPrice - ma7) / ma7 * 100).toFixed(2)}% ${currentPrice > ma7 ? '(Above - Strong 💪)' : '(Below - Weak 📉)'}<br>
        • Distance from MA21: ${((currentPrice - ma21) / ma21 * 100).toFixed(2)}% ${currentPrice > ma21 ? '(Above)' : '(Below)'}<br>
        • Support Level: $${minPrice} | Resistance: $${maxPrice}<br>
        • Volume Trend: ${volumeTrend > 0 ? '<span class="signal-positive">📈 Increasing (+' + volumeTrend.toFixed(1) + '%)</span>' : '<span class="signal-negative">📉 Decreasing (' + volumeTrend.toFixed(1) + '%)</span>'}
    `;

    const predictedPrice = data.nextDayPrice || data.predictions[data.predictions.length - 1];
    const predictionChange = data.nextDayChangePct?.toFixed(2) || ((predictedPrice - currentPrice) / currentPrice * 100).toFixed(2);
    const isBullish = data.metrics.trend === 'Bullish';
    const dollarRmse = data.metricsDollar?.rmse || 0;
    const rmsePct = data.metricsNorm?.rmse_pct || 0;
    const dirAcc = data.metricsNorm?.directional_accuracy || 0;
    const r2 = data.metricsNorm?.r2 || 0;
    
    // Top features from backend
    const fi = data.featureImportance || {};
    const topFeatures = Object.entries(fi).sort((a,b) => b[1] - a[1]).slice(0, 5);
    const featuresStr = topFeatures.map(([n, p]) => `${n} (${p.toFixed(1)}%)`).join(', ');
    
    const predictionReasoning = `
        <strong>🎯 Next-Day Forecast: <span class="${predictionChange >= 0 ? 'signal-positive' : 'signal-negative'}">$${predictedPrice.toFixed(2)}</span></strong> (${predictionChange >= 0 ? '+' : ''}${predictionChange}% from $${currentPrice.toFixed(2)})<br><br>
        
        <strong>📊 Model Quality:</strong><br>
        • RMSE = $${dollarRmse.toFixed(2)} (±${rmsePct.toFixed(2)}% of price)<br>
        • Direction accuracy = ${dirAcc.toFixed(1)}% correct up/down calls<br><br>
        
        <strong>🔍 AI PREDICTION RATIONALE (${isBullish ? 'BULLISH' : 'BEARISH'}):</strong><br>
        <br>
        <strong>📊 Individual Indicator Breakdown:</strong><br>
        1️⃣ MA7 ($${ma7.toFixed(2)}) ${ma7 > ma21 ? '>' : '<'} MA21 ($${ma21.toFixed(2)}) 
           👉 ${ma7 > ma21 ? '<span class="signal-positive">Bullish Signal (Momentum UP)</span>' : '<span class="signal-negative">Bearish Signal (Momentum DOWN)</span>'}<br>
        2️⃣ Price ($${currentPrice.toFixed(2)}) ${currentPrice > parseFloat(avgPrice) ? 'ABOVE' : 'BELOW'} average ($${avgPrice}) 
           👉 ${currentPrice > parseFloat(avgPrice) ? '<span class="signal-positive">Bullish Signal</span>' : '<span class="signal-negative">Bearish Signal</span>'}<br>
        3️⃣ RSI (${rsi.toFixed(0)}) 
           👉 ${rsi > 65 ? '<span class="signal-negative">Bearish Signal (Overbought)</span>' : rsi < 35 ? '<span class="signal-positive">Bullish Signal (Oversold)</span>' : '<span style="color:#aaa">Neutral</span>'}<br>
        4️⃣ Bollinger Bands 
           👉 ${currentPrice > bbUpper * 0.98 ? '<span class="signal-negative">Bearish Signal (Near Resistance)</span>' : currentPrice < bbLower * 1.02 ? '<span class="signal-positive">Bullish Signal (Near Support)</span>' : '<span style="color:#aaa">Neutral (Within Bands)</span>'}<br>
        <br>
        <em>Note: The AI's final <strong>${isBullish ? 'BULLISH' : 'BEARISH'}</strong> prediction is a weighted combination of these and other features.</em><br>
        
        <strong>📊 Features Used (by importance):</strong><br>
        • ${featuresStr}<br>
        • GRU analyzed 60-day sequences × 10 features = 600 data points per prediction<br>
        • Confidence range: $${(predictedPrice * (1 - rmsePct/100)).toFixed(2)} – $${(predictedPrice * (1 + rmsePct/100)).toFixed(2)} (±${rmsePct.toFixed(2)}%)
    `;

    let riskLevel = volatility > 3 ? 'HIGH' : volatility > 1.5 ? 'MODERATE' : 'LOW';
    const riskAssessment = `
        <strong>Risk Level: <span class="metric-highlight">${riskLevel}</span></strong><br><br>
        
        <strong>📊 Volatility Analysis:</strong><br>
        • Price Volatility: ${volatility.toFixed(2)}%<br>
        • ATR: $${atr.toFixed(2)} (${(atr / currentPrice * 100).toFixed(2)}% daily range)<br>
        • Price Range: $${minPrice} – $${maxPrice} (Spread: $${(maxPrice - minPrice).toFixed(2)})<br>
        • Bollinger Width: $${(bbUpper - bbLower).toFixed(2)}<br><br>
        
        <strong>⚠️ Risk Factors:</strong><br>
        • Model RMSE: ±$${dollarRmse.toFixed(2)} (${rmsePct.toFixed(2)}%)<br>
        • Direction accuracy: ${dirAcc.toFixed(1)}% (${dirAcc > 55 ? 'above random' : 'near random — caution'})<br>
        • ${profile.sector} sector news affects ${profile.name}<br><br>
        
        <strong>🛡️ Recommended Stop-Loss:</strong><br>
        ${riskLevel === 'HIGH' ? '• Tight stop: $' + (currentPrice * 0.95).toFixed(2) + ' (-5%)<br>• Position: 2-5% of capital' : 
          riskLevel === 'MODERATE' ? '• Normal stop: $' + (currentPrice * 0.92).toFixed(2) + ' (-8%)<br>• Position: 5-10% of capital' : 
          '• Wide stop: $' + (currentPrice * 0.90).toFixed(2) + ' (-10%)<br>• Position: up to 15%'}
    `;

    // Generate BUY/SELL signals based on multiple indicators
    const buySignals = [];
    const sellSignals = [];
    
    // Analyze indicators
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
    
    const recommendation = buySignals.length > sellSignals.length ? 'BUY' : 
                          sellSignals.length > buySignals.length ? 'SELL' : 'HOLD';
    const confidence = Math.abs(buySignals.length - sellSignals.length) >= 2 ? 'High' : 'Moderate';
    
    const outlook = `
        <strong>📊 RECOMMENDATION: <span class="metric-highlight" style="background: ${recommendation === 'BUY' ? 'rgba(0, 255, 136, 0.25)' : recommendation === 'SELL' ? 'rgba(255, 56, 96, 0.25)' : 'rgba(255, 149, 0, 0.25)'}; border-color: ${recommendation === 'BUY' ? 'var(--accent-green)' : recommendation === 'SELL' ? 'var(--accent-red)' : 'var(--accent-orange)'}; color: ${recommendation === 'BUY' ? 'var(--accent-green)' : recommendation === 'SELL' ? 'var(--accent-red)' : 'var(--accent-orange)'}; font-size: 1.2rem;">${recommendation}</span></strong><br>
        <strong>Confidence: ${confidence}</strong> (${buySignals.length + sellSignals.length} signals detected)<br><br>
        
        ${recommendation === 'BUY' ? 
            `<strong><span class="signal-positive">🟢 BUY Signals (${buySignals.length}):</span></strong><br>
             ${buySignals.map(s => '✓ ' + s).join('<br>')}<br>
             ${sellSignals.length > 0 ? '<br><strong>⚠️ Warning Signs (' + sellSignals.length + '):</strong><br>' + sellSignals.map(s => '• ' + s).join('<br>') + '<br>' : ''}<br>
             <strong>🎯 Action Plan:</strong><br>
             • <strong>Entry Zone:</strong> $${(currentPrice * 0.99).toFixed(2)} - $${currentPrice.toFixed(2)}<br>
             • <strong>Target Price:</strong> $${predictedPrice.toFixed(2)} (${predictionChange >= 0 ? '+' : ''}${predictionChange}%)<br>
             • <strong>Stop Loss:</strong> $${(currentPrice * 0.95).toFixed(2)} (-5%)<br>
             • <strong>Risk/Reward:</strong> ${(Math.abs(predictionChange) / 5).toFixed(2)}:1<br>
             • <strong>Time Frame:</strong> ${Math.abs(predictionChange) > 5 ? '1-2 weeks (short-term)' : '2-4 weeks (medium-term)'}<br>
             • <strong>Position Size:</strong> ${riskLevel === 'HIGH' ? '2-5%' : riskLevel === 'MODERATE' ? '5-10%' : '10-15%'} of portfolio` 
            : 
          recommendation === 'SELL' ? 
            `<strong><span class="signal-negative">🔴 SELL Signals (${sellSignals.length}):</span></strong><br>
             ${sellSignals.map(s => '✓ ' + s).join('<br>')}<br>
             ${buySignals.length > 0 ? '<br><strong>💡 Positive Factors (' + buySignals.length + '):</strong><br>' + buySignals.map(s => '• ' + s).join('<br>') + '<br>' : ''}<br>
             <strong>🎯 Action Plan:</strong><br>
             • <strong>Exit Price:</strong> $${currentPrice.toFixed(2)} or better<br>
             • <strong>Strategy:</strong> ${Math.abs(predictionChange) > 5 ? 'Sell immediately' : 'Sell on next bounce to MA7'}<br>
             • <strong>Avoid:</strong> New positions until trend reverses<br>
             • <strong>Watch for:</strong> MA7 crossing above MA21 (reversal signal)<br>
             • <strong>Alternative:</strong> If must hold, set stop-loss at $${(currentPrice * 0.92).toFixed(2)} (-8%)` 
            : 
            `<strong><span class="signal-neutral">🟡 HOLD / WAIT (${Math.max(buySignals.length, sellSignals.length)} signals each side)</span></strong><br>
             <strong>Buy Signals (${buySignals.length}):</strong><br>${buySignals.map(s => '✓ ' + s).join('<br>')}<br><br>
             <strong>Sell Signals (${sellSignals.length}):</strong><br>${sellSignals.map(s => '✓ ' + s).join('<br>')}<br><br>
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
    `;

    $('#stock-badge-container').html(`<div class="stock-ticker-badge">${data.ticker} - ${profile.name}</div>`);
    $('#report-summary').html(summary);
    $('#report-historical').html(historicalAnalysis);
    $('#report-technical').html(technicalAnalysis);
    $('#report-reasoning').html(predictionReasoning);
    $('#report-risk').html(riskAssessment);
    $('#report-outlook').html(outlook);
    } catch (error) {
        console.error('Error in generateDetailedAnalysis:', error);
        showNotification('Error generating analysis report: ' + error.message, 'error');
    }
}

// Calculate volatility
function calculateVolatility(prices) {
    const mean = prices.reduce((a, b) => a + b) / prices.length;
    const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b) / prices.length;
    const stdDev = Math.sqrt(variance);
    return (stdDev / mean * 100);
}

// Calculate moving average
function calculateMA(prices, period) {
    const recent = prices.slice(-period);
    return recent.reduce((a, b) => a + b) / recent.length;
}

// Calculate RSI (Relative Strength Index) - simplified
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;
    
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
        changes.push(prices[i] - prices[i - 1]);
    }
    
    const recentChanges = changes.slice(-period);
    
    const gains = recentChanges.filter(c => c > 0);
    const losses = recentChanges.filter(c => c < 0).map(c => Math.abs(c));
    
    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0.01;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0.01;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// Calculate volume trend
function calculateVolumeTrend(prices) {
    if (prices.length < 20) return 0;
    
    const recentPrices = prices.slice(-10);
    const oldPrices = prices.slice(-20, -10);
    
    const recentAvg = recentPrices.reduce((a, b) => a + b) / recentPrices.length;
    const oldAvg = oldPrices.reduce((a, b) => a + b) / oldPrices.length;
    
    return ((recentAvg - oldAvg) / oldAvg) * 100;
}

// Generate and show explainer — ALL from real backend data
function generateAndShowExplainer(data) {
    const ind = data.indicators || {};
    const fi = data.featureImportance || {};
    const conf = data.confidence || {};
    const mn = data.metricsNorm || {};
    const md = data.metricsDollar || {};
    const th = data.trainingHistory || {};
    const dr = data.dataRange || {};
    const cp = data.currentPrice || 0;
    const ndp = data.nextDayPrice || 0;

    // Summary — real stats
    const summaryText = `3-layer GRU model trained on ${dr.trading_days || '?'} trading days (${dr.start || '?'} → ${dr.end || '?'}). ` +
        `RMSE = ±${(mn.rmse_pct || 0).toFixed(2)}% | ` +
        `Direction accuracy = ${(mn.directional_accuracy || 0).toFixed(1)}% | ` +
        `Trained for ${th.epochs || '?'} epochs with Huber loss + Adam optimizer.`;
    $('#explainer-summary').text(summaryText);

    // Feature importance — real correlation-based values from backend
    const sortedFeatures = Object.entries(fi).sort((a, b) => b[1] - a[1]);
    let featureHtml = '';
    sortedFeatures.forEach(([name, pct]) => {
        featureHtml += `<div class="feature-bar"><div class="feature-name">${name}</div><div class="feature-bar-bg"><div class="feature-bar-fill" style="width:${pct}%">${pct.toFixed(1)}%</div></div></div>`;
    });
    $('#feature-importance-container').html(featureHtml);

    // Technical analysis — real indicator values
    const rsiStatus = (ind.rsi || 50) > 70 ? '🔴 Overbought' : (ind.rsi || 50) < 30 ? '🟢 Oversold' : '🟡 Neutral';
    const maSignal = (ind.ma7 || 0) > (ind.ma21 || 0) ? '✅ Bullish crossover (MA7 > MA21)' : '⚠️ Bearish crossover (MA7 < MA21)';
    const bbPos = cp > (ind.bb_upper || cp) ? 'Above upper band (overbought)' : cp < (ind.bb_lower || cp) ? 'Below lower band (oversold)' : 'Within bands (normal)';
    const technicalItems = [
        `RSI: <strong>${(ind.rsi || 0).toFixed(2)}</strong> — ${rsiStatus}`,
        `MA7: $${(ind.ma7 || 0).toFixed(2)} | MA21: $${(ind.ma21 || 0).toFixed(2)} — ${maSignal}`,
        `EMA20: $${(ind.ema20 || 0).toFixed(2)} | MACD: ${(ind.macd || 0).toFixed(4)}`,
        `Bollinger: $${(ind.bb_lower || 0).toFixed(2)} – $${(ind.bb_upper || 0).toFixed(2)} — ${bbPos}`,
        `ATR (volatility): $${(ind.atr || 0).toFixed(2)} (${((ind.atr || 0) / (cp || 1) * 100).toFixed(2)}% of price)`
    ];
    $('#explainer-technical').html(technicalItems.map(t => `<div class="explainer-item"><i class="fas fa-arrow-right"></i> ${t}</div>`).join(''));

    // Model reasoning — real metrics
    const reasoningItems = [
        `3-layer GRU (128→64→32 units) with BatchNorm + Dropout for regularisation`,
        `Normalized MSE: <strong>${(mn.mse || 0).toFixed(6)}</strong> (scaled 0-1, < 0.01 is good)`,
        `Dollar RMSE: <strong>$${(md.rmse || 0).toFixed(2)}</strong> — avg prediction error`,
        `Direction accuracy: <strong>${(mn.directional_accuracy || 0).toFixed(1)}%</strong> — correct up/down calls`,
        `Training: ${th.epochs || '?'} epochs, final loss: ${th.loss?.length ? th.loss[th.loss.length - 1].toFixed(6) : '?'}`
    ];
    $('#explainer-reasoning').html(reasoningItems.map(t => `<div class="explainer-item"><i class="fas fa-arrow-right"></i> ${t}</div>`).join(''));

    // Prediction factors — confidence breakdown
    const comp = conf.components || {};
    const factorItems = [
        `Next-day forecast: <strong>$${ndp.toFixed(2)}</strong> (${data.nextDayChangePct >= 0 ? '+' : ''}${data.nextDayChangePct.toFixed(2)}% from $${cp.toFixed(2)})`,
        `RMSE% contribution: ${(comp.rmse_contribution || 0).toFixed(0)}/100`,
        `Direction contribution: ${(comp.direction_contribution || 0).toFixed(0)}/100`
    ];
    $('#explainer-factors').html(factorItems.map(t => `<div class="explainer-item"><i class="fas fa-arrow-right"></i> ${t}</div>`).join(''));
}

// Initial animation on page load
$(document).ready(function() {
    animateOnScroll();
    $(window).on('scroll', animateOnScroll);
});
