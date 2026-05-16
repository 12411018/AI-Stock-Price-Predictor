import { useStockPrediction } from './hooks/useStockPrediction';
import Dashboard from './components/Dashboard';
import ExplainerSidebar from './components/ExplainerSidebar';
import AnalysisReport from './components/AnalysisReport';
import LoadingOverlay from './components/LoadingOverlay';
import Notification from './components/Notification';
import './styles/style.css';

function App() {
  const {
    ticker,
    setTicker,
    loading,
    loadingPhase,
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
  } = useStockPrediction();

  return (
    <>
      <LoadingOverlay visible={loading} phase={loadingPhase} />

      <Dashboard
        ticker={ticker}
        setTicker={setTicker}
        loading={loading}
        predictionData={predictionData}
        onPredict={handlePredict}
      />

      {/* AI Explainer Sidebar */}
      <ExplainerSidebar
        isOpen={showExplainer}
        onClose={closeExplainer}
        explainerData={explainerData}
      />

      {/* Explainer Toggle Button */}
      <button
        id="explainer-toggle"
        className={`explainer-toggle${predictionData ? ' show' : ''}`}
        title="Show AI Explanation"
        onClick={toggleExplainer}
      >
        <i className="fas fa-lightbulb"></i>
      </button>

      {/* Analysis Report Panel */}
      <AnalysisReport
        isOpen={showReport}
        onClose={closeReport}
        data={predictionData}
      />

      {/* Report Toggle Button */}
      <button
        id="report-toggle"
        className={`report-toggle${predictionData ? ' show' : ''}`}
        title="Show Analysis Report"
        onClick={toggleReport}
      >
        <i className="fas fa-file-alt"></i>
      </button>

      <Notification notification={notification} />
    </>
  );
}

export default App;
