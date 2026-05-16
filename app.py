from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import numpy as np 
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import GRU, Dense, Input, Dropout, BatchNormalization
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.regularizers import l1_l2
from sklearn.model_selection import train_test_split
import joblib
import datetime
import os

app = Flask(__name__) 
CORS(app)


_prediction_cache = {}


def _get_yesterday():
    """Return yesterday's date as a string (YYYY-MM-DD)."""
    return (datetime.date.today() - datetime.timedelta(days=1)).strftime("%Y-%m-%d")


def _evict_stale_cache():
    """Remove cache entries whose date suffix does not match yesterday."""
    yesterday = _get_yesterday()
    stale_keys = [k for k in _prediction_cache if not k.endswith(yesterday)]
    for k in stale_keys:
        del _prediction_cache[k]


def prepare_data(ticker):
    """Download 2 years of data and prepare features with RETURNS-based target."""
    yesterday = _get_yesterday()
    # 2-year window: ~500 trading days, enough for good patterns
    start_date = (datetime.date.today() - datetime.timedelta(days=2*365)).strftime("%Y-%m-%d")
    data = yf.download(ticker, start=start_date, end=yesterday, multi_level_index=False)

    if isinstance(data.columns, pd.MultiIndex):
        data.columns = [col[0] for col in data.columns]
    if data.empty:
        raise ValueError(f"No data found for {ticker}")

    close_series = data['Close'].squeeze()

    # ── Technical indicators ───────────────────────────────────────────────
    data['MA7']    = close_series.rolling(window=7).mean()
    data['MA21']   = close_series.rolling(window=21).mean()
    data['EMA20']  = close_series.ewm(span=20, adjust=False).mean()
    data['RSI']    = calculate_rsi(close_series)
    data['MACD']   = calculate_macd(close_series)
    bb_upper, bb_lower = calculate_bollinger_bands(close_series)
    data['BB_Upper'] = bb_upper
    data['BB_Lower'] = bb_lower
    data['ATR'] = calculate_atr(data)
    data['Volume'] = pd.to_numeric(data['Volume'], errors='coerce')

   
    data['Return'] = close_series.pct_change() * 100  # daily % change

    # Relative features (scale-invariant)
    data['Price_vs_MA7']  = (close_series / data['MA7'] - 1) * 100
    data['Price_vs_MA21'] = (close_series / data['MA21'] - 1) * 100
    data['BB_Width']      = ((data['BB_Upper'] - data['BB_Lower']) / close_series) * 100
    data['ATR_Pct']       = (data['ATR'] / close_series) * 100

    data = data.dropna()

    # Features: all scale-invariant / normalizable
    feature_cols = ['Return', 'RSI', 'MACD', 'Price_vs_MA7', 'Price_vs_MA21',
                    'BB_Width', 'ATR_Pct']
    features = data[feature_cols].values  # 7 features

    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(features)

    X, y = create_sequences(scaled_data, seq_length=60)

    # Chronological split
    split = int(len(X) * 0.8)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]

    return X_train, X_val, y_train, y_val, scaler, data

def calculate_rsi(prices, period=14):
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def calculate_macd(prices, slow=26, fast=12, signal=9):
    exp1 = prices.ewm(span=fast, adjust=False).mean()
    exp2 = prices.ewm(span=slow, adjust=False).mean()
    macd = exp1 - exp2
    signal_line = macd.ewm(span=signal, adjust=False).mean()
    return macd - signal_line

def calculate_bollinger_bands(prices, window=20):
    """Return (upper_band, lower_band) as pandas Series."""
    ma  = prices.rolling(window=window).mean()
    std = prices.rolling(window=window).std()
    return ma + 2 * std, ma - 2 * std

def calculate_atr(data, period=14):
    """Average True Range — measures market volatility."""
    high  = data['High'].squeeze()
    low   = data['Low'].squeeze()
    close = data['Close'].squeeze()
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low  - prev_close).abs()
    ], axis=1).max(axis=1)
    return tr.rolling(window=period).mean()

def create_sequences(data, seq_length=60):
    """Vectorised sequence builder — avoids slow Python loop."""
    n = len(data) - seq_length
    X = np.array([data[i:i + seq_length] for i in range(n)])
    y = data[seq_length:, 0]          # Close column (index 0)
    return X, y

def build_and_train_model(X_train, X_val, y_train, y_val):
    """Lightweight 3-layer GRU — optimised for speed on CPU."""
    model = Sequential([
        Input(shape=(X_train.shape[1], X_train.shape[2])),

        GRU(64, return_sequences=True,
            kernel_regularizer=l1_l2(l1=1e-5, l2=1e-4)),
        BatchNormalization(),
        Dropout(0.15),

        GRU(32, return_sequences=False,
            kernel_regularizer=l1_l2(l1=1e-5, l2=1e-4)),
        BatchNormalization(),
        Dropout(0.15),

        Dense(32, activation='relu'),
        Dense(16, activation='relu'),
        Dense(1)
    ])

    optimizer = Adam(learning_rate=0.001, clipnorm=1.0)
    model.compile(optimizer=optimizer, loss='huber')

    callbacks = [
        EarlyStopping(
            monitor='val_loss',
            patience=8,
            restore_best_weights=True,
            mode='min'
        ),
        ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=3,
            min_lr=1e-6,
            verbose=0
        ),
    ]

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=50,
        batch_size=32,
        callbacks=callbacks,
        verbose=0
    )

    return model, history

def calculate_metrics(y_true, y_pred):
    mse = np.mean((y_true - y_pred) ** 2)
    rmse = np.sqrt(mse)
    mae = np.mean(np.abs(y_true - y_pred))

    # R² score: 1.0 = perfect, 0.0 = predicts the mean, <0 = worse than mean
    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    r2 = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0.0

    # Directional accuracy: % of steps where predicted direction matches actual
    if len(y_true) > 1:
        actual_dir = np.diff(y_true) >= 0
        pred_dir = np.diff(y_pred) >= 0
        directional_accuracy = float(np.mean(actual_dir == pred_dir) * 100)
    else:
        directional_accuracy = 0.0

    return {
        'mse': mse,
        'rmse': rmse,
        'mae': mae,
        'r2': r2,
        'directional_accuracy': directional_accuracy
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/yfinance-data', methods=['GET'])
def yfinance_data():
    ticker = (request.args.get('ticker') or '').strip().upper()
    start = request.args.get('start') or '2020-01-01'
    end = request.args.get('end')
    interval = request.args.get('interval') or '1d'

    if not ticker:
        return jsonify({'error': 'ticker query parameter is required'}), 400

    if len(ticker) > 10 or not ticker.isalpha():
        return jsonify({'error': f'Invalid ticker symbol: {ticker}'}), 400

    try:
        data = yf.download(ticker, start=start, end=end, interval=interval, multi_level_index=False)

        if data.empty:
            return jsonify({'error': f'No data found for {ticker} with given filters'}), 404

        # Flatten multi-index columns if yfinance returns them for compatibility.
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = [
                '_'.join(str(part) for part in col if part is not None and str(part) != '')
                for col in data.columns
            ]

        data = data.reset_index()
        data['Date'] = data['Date'].dt.strftime('%Y-%m-%d')

        return jsonify({
            'ticker': ticker,
            'count': len(data),
            'columns': data.columns.tolist(),
            'data': data.to_dict(orient='records')
        })
    except Exception as e:
        return jsonify({'error': f'Failed to fetch yfinance data for {ticker}: {str(e)}'}), 500

@app.route('/predict', methods=['POST'])
def predict():
    # Accept both form and JSON bodies
    data_json = request.get_json(silent=True) or {}
    ticker = (request.form.get('ticker') or data_json.get('ticker') or '').strip().upper()
    
    # Validate ticker
    if not ticker:
        return jsonify({'error': 'Ticker symbol is required'}), 400
    
    if len(ticker) > 10 or not ticker.isalpha():
        return jsonify({'error': f'Invalid ticker symbol: {ticker}'}), 400
    
    # ── Check cache first ────────────────────────────────────────────────
    _evict_stale_cache()
    yesterday = _get_yesterday()
    cache_key = f"{ticker}_{yesterday}"

    if cache_key in _prediction_cache:
        return jsonify(_prediction_cache[cache_key])
    
    try:
        # Prepare data with train/validation split
        X_train, X_val, y_train, y_val, scaler, historical_data = prepare_data(ticker)

        # Derive feature count dynamically
        n_features = X_train.shape[2]  # currently 7

        if len(X_train) < 10:
            return jsonify({'error': f'Insufficient data for {ticker}. Need at least 100 trading days.'}), 400
        
        MODEL_PATH  = f'model_{ticker}.keras'
        SCALER_PATH = f'scaler_{ticker}.joblib'
        if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
            model  = load_model(MODEL_PATH)
            scaler = joblib.load(SCALER_PATH)
            class _FakeHistory:
                def __init__(self, d): self.history = d
            history = _FakeHistory({'loss': [0.0], 'val_loss': [0.0]})
        else:
            model, history = build_and_train_model(X_train, X_val, y_train, y_val)
            model.save(MODEL_PATH)
            joblib.dump(scaler, SCALER_PATH)
        
        # Make predictions on validation set
        val_predictions = model.predict(X_val, verbose=0)

        # Normalized metrics (scaled 0-1 space)
        normalized_metrics = calculate_metrics(y_val, val_predictions.flatten())
        
        # ── Convert predicted returns back to % returns ──────────────────────
        dummy_pred = np.zeros((len(val_predictions), n_features))
        dummy_pred[:, 0] = val_predictions.flatten()
        pred_returns = scaler.inverse_transform(dummy_pred)[:, 0]  # predicted daily % returns

        dummy_actual = np.zeros((len(y_val), n_features))
        dummy_actual[:, 0] = y_val
        actual_returns = scaler.inverse_transform(dummy_actual)[:, 0]  # actual daily % returns

        # ── Returns-level metrics (what the model ACTUALLY predicts) ─────────
        returns_metrics = calculate_metrics(actual_returns, pred_returns)

        # ── Convert to 1-step-ahead dollar prices for chart ──────────────────
        # Each predicted price = yesterday's ACTUAL close × (1 + predicted_return).
        # This avoids cumulative error drift that ruins the chart.
        val_start_idx = len(historical_data) - len(val_predictions)
        actual_closes = [float(np.squeeze(historical_data['Close'].iloc[i]))
                         for i in range(val_start_idx, len(historical_data))]

        val_predictions_real = []
        for i in range(len(pred_returns)):
            prev_close = float(np.squeeze(
                historical_data['Close'].iloc[val_start_idx + i - 1])) if i > 0 \
                else float(np.squeeze(historical_data['Close'].iloc[val_start_idx - 1]))
            val_predictions_real.append(prev_close * (1 + pred_returns[i] / 100))
        val_predictions_real = np.array(val_predictions_real)
        y_val_real = np.array(actual_closes)

        dollar_metrics = calculate_metrics(y_val_real, val_predictions_real)
        
        # Dates for validation period
        dates = historical_data.index[-len(val_predictions):]
        data_start = historical_data.index[0].strftime('%Y-%m-%d')
        data_end = historical_data.index[-1].strftime('%Y-%m-%d')
        
        current_price = float(np.squeeze(historical_data['Close'].iloc[-1]))

        # ── Next-day forecast ────────────────────────────────────────────────
        feature_cols = ['Return', 'RSI', 'MACD', 'Price_vs_MA7', 'Price_vs_MA21',
                        'BB_Width', 'ATR_Pct']
        features_full = historical_data[feature_cols].values
        scaled_full  = scaler.transform(features_full)
        last_seq     = scaled_full[-60:].reshape(1, 60, n_features)
        next_day_scaled = model.predict(last_seq, verbose=0)
        dummy_next = np.zeros((1, n_features))
        dummy_next[0, 0] = float(next_day_scaled[0, 0])
        predicted_return = float(scaler.inverse_transform(dummy_next)[0, 0])  # % return
        next_day_price = current_price * (1 + predicted_return / 100)
        next_day_change_pct = predicted_return
        
        # ── Compute real technical indicators (latest values) ──────────────
        last_close = float(np.squeeze(historical_data['Close'].iloc[-1]))
        indicators = {
            'ma7':  float(np.squeeze(historical_data['MA7'].iloc[-1])),
            'ma21': float(np.squeeze(historical_data['MA21'].iloc[-1])),
            'ema20': float(np.squeeze(historical_data['EMA20'].iloc[-1])),
            'rsi':  float(np.squeeze(historical_data['RSI'].iloc[-1])),
            'macd': float(np.squeeze(historical_data['MACD'].iloc[-1])),
            'bb_upper': float(np.squeeze(historical_data['BB_Upper'].iloc[-1])),
            'bb_lower': float(np.squeeze(historical_data['BB_Lower'].iloc[-1])),
            'atr':  float(np.squeeze(historical_data['ATR'].iloc[-1])),
        }

        # ── Prediction confidence scoring ──────────────────────────────────
        # Use RETURNS-level metrics (not cumulative price) for confidence,
        # because that's what the model actually predicts day-to-day.
        rmse_pct = float(returns_metrics['rmse'])  # already in % units
        r2 = float(returns_metrics['r2'])
        dir_acc = float(returns_metrics['directional_accuracy'])

        # Confidence = weighted blend of R², RMSE%, directional accuracy
        conf_r2   = max(0, min(100, r2 * 100))          # 0-100
        conf_rmse = max(0, min(100, 100 - rmse_pct * 5)) # penalise high RMSE%
        conf_dir  = dir_acc                               # already 0-100
        confidence_score = round(conf_r2 * 0.40 + conf_rmse * 0.30 + conf_dir * 0.30, 2)

        if confidence_score >= 75:
            confidence_label = 'HIGH'
        elif confidence_score >= 50:
            confidence_label = 'MODERATE'
        else:
            confidence_label = 'LOW'

        # ── Feature importance via correlation analysis ─────────────────────
        feature_names = ['Return', 'RSI', 'MACD', 'Price_vs_MA7', 'Price_vs_MA21',
                         'BB_Width', 'ATR_Pct']
        # Use absolute correlation of each feature with the target as a proxy
        feature_corrs = []
        target_col = scaled_full[-len(y_val):, 0]  # scaled close prices for val
        for fi in range(n_features):
            feat_col = scaled_full[-len(y_val):, fi]
            corr = abs(float(np.corrcoef(feat_col, target_col)[0, 1]))
            feature_corrs.append(corr if not np.isnan(corr) else 0.0)
        total_corr = sum(feature_corrs) or 1.0
        feature_importance = {name: round(c / total_corr * 100, 2)
                              for name, c in zip(feature_names, feature_corrs)}

        # Prepare response data
        # Use ACTUAL close prices for chart (not reconstructed from returns)
        actual_close_val = [float(np.squeeze(historical_data['Close'].iloc[i]))
                            for i in range(val_start_idx, len(historical_data))]
        response_data = {
            'ticker': ticker,
            'predictions': val_predictions_real.tolist(),
            'historical_prices': actual_close_val,
            'current_price': current_price,
            'next_day_price': next_day_price,
            'next_day_change_pct': round(next_day_change_pct, 4),
            'dates': [date.strftime('%Y-%m-%d') for date in dates],
            'data_range': {
                'start': data_start,
                'end': data_end,
                'trading_days': len(historical_data),
            },
            'cached': False,
            'metrics': {
                # Returns-level metrics (what the model actually predicts)
                'mse': float(returns_metrics['mse']),
                'rmse': float(returns_metrics['rmse']),  # in % return units
                'mae': float(returns_metrics['mae']),
                'r2': round(r2, 6),
                'directional_accuracy': round(dir_acc, 2),
                'rmse_pct': round(rmse_pct, 4),  # same as rmse (already %)
            },
            'metrics_dollar': {
                # Dollar-equivalent: RMSE% of current price
                'mse': float((rmse_pct / 100 * current_price) ** 2),
                'rmse': round(rmse_pct / 100 * current_price, 2),
                'mae': round(float(returns_metrics['mae']) / 100 * current_price, 2),
                'r2': round(r2, 6),
                'directional_accuracy': round(dir_acc, 2),
            },
            'confidence': {
                'score': confidence_score,
                'label': confidence_label,
                'components': {
                    'r2_contribution': round(conf_r2, 2),
                    'rmse_contribution': round(conf_rmse, 2),
                    'direction_contribution': round(conf_dir, 2),
                }
            },
            'indicators': indicators,
            'feature_importance': feature_importance,
            'historical_data': [
                {
                    'date': date.strftime('%Y-%m-%d'),
                    'Open': float(np.squeeze(row['Open'])),
                    'Close': float(np.squeeze(row['Close'])),
                    'High': float(np.squeeze(row['High'])),
                    'Low': float(np.squeeze(row['Low'])),
                    'Volume': int(np.squeeze(row['Volume'])),
                }
                for date, row in historical_data.tail(250).iterrows()  # last ~1 year
            ],
            'training_history': {
                'loss': [float(x) for x in history.history['loss']],
                'val_loss': [float(x) for x in history.history['val_loss']],
                'epochs': len(history.history['loss']),
            }
        }

        # ── Store in cache ───────────────────────────────────────────────
        cached_copy = dict(response_data)
        cached_copy['cached'] = True
        _prediction_cache[cache_key] = cached_copy
        
        return jsonify(response_data)
    
    except Exception as e:
        error_msg = str(e)
        # Provide helpful error messages
        if 'No data found' in error_msg or 'No timezone found' in error_msg:
            return jsonify({'error': f'Stock ticker "{ticker}" not found or has no data. Please check the symbol.'}), 404
        elif 'download' in error_msg.lower():
            return jsonify({'error': f'Failed to download data for {ticker}. Check your internet connection.'}), 500
        else:
            return jsonify({'error': f'Error processing {ticker}: {error_msg}'}), 500


@app.route('/cache-status', methods=['GET'])
def cache_status():
    """Return which tickers are currently cached (instant responses)."""
    yesterday = _get_yesterday()
    cached_tickers = [k.split("_")[0] for k in _prediction_cache if k.endswith(yesterday)]
    return jsonify({
        'cached_tickers': cached_tickers,
        'as_of': yesterday,
        'count': len(cached_tickers)
    })


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)  
