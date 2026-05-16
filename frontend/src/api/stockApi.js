// Stock Prediction API - communicates with Flask backend

const API_BASE = '/api';

export async function predictStock(ticker) {
  const formData = new FormData();
  formData.append('ticker', ticker);

  const response = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Server error' }));
    throw new Error(err.error || 'Server error');
  }

  const json = await response.json();

  if (json && json.error) {
    throw new Error(json.error);
  }

  return json;
}

export async function fetchCacheStatus() {
  try {
    const response = await fetch(`${API_BASE}/cache-status`);
    if (!response.ok) return { cached_tickers: [], as_of: '', count: 0 };
    return await response.json();
  } catch {
    return { cached_tickers: [], as_of: '', count: 0 };
  }
}
