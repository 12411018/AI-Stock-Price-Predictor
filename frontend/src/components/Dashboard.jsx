import TickerInput from './TickerInput';
import StockMetrics from './StockMetrics';
import HistoricalTable from './HistoricalTable';
import ChartPanel from './ChartPanel';
import ModelMetrics from './ModelMetrics';

export default function Dashboard({
  ticker,
  setTicker,
  loading,
  predictionData,
  onPredict,
}) {
  return (
    <div className="container dashboard-container animate__animated animate__fadeIn">
      <h1 className="dashboard-title">Stock Analysis &amp; Prediction Dashboard</h1>

      <div className="row">
        <div className="col-lg-3">
          <div className="input-section animate__animated animate__fadeInLeft">
            <TickerInput
              ticker={ticker}
              setTicker={setTicker}
              onPredict={onPredict}
              disabled={loading}
            />

            <StockMetrics data={predictionData} />
            <HistoricalTable data={predictionData} />
          </div>
        </div>

        <div className="col-lg-9">
          <ChartPanel data={predictionData} />
          <ModelMetrics data={predictionData} />
        </div>
      </div>
    </div>
  );
}
