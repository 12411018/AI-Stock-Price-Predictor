export default function ExplainerSidebar({ isOpen, onClose, explainerData }) {
  return (
    <div
      id="explainer-sidebar"
      className={`explainer-sidebar${isOpen ? ' open' : ''}`}
    >
      <div className="explainer-close" id="explainer-close" onClick={onClose}>
        <i className="fas fa-times"></i>
      </div>
      <div className="explainer-header">
        <i className="fas fa-lightbulb"></i>
        <h4>AI Explainer</h4>
      </div>

      {/* Summary */}
      <div className="explainer-section">
        <div className="explainer-section-title">
          <i className="fas fa-brain"></i> Model Summary
        </div>
        <div id="explainer-summary" className="explainer-item">
          {explainerData ? explainerData.summary : '-'}
        </div>
      </div>

      {/* Feature Importance */}
      <div className="explainer-section">
        <div className="explainer-section-title">
          <i className="fas fa-chart-bar"></i> Feature Importance
        </div>
        <div id="feature-importance-container">
          {explainerData &&
            explainerData.features.map((feature, idx) => (
              <div className="feature-bar" key={feature}>
                <div className="feature-name">{feature}</div>
                <div className="feature-bar-bg">
                  <div
                    className="feature-bar-fill"
                    style={{
                      width: `${explainerData.normalizedImportance[idx]}%`,
                    }}
                  >
                    {explainerData.normalizedImportance[idx].toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Technical Analysis */}
      <div className="explainer-section">
        <div className="explainer-section-title">
          <i className="fas fa-magnifying-glass"></i> Technical Analysis
        </div>
        <div id="explainer-technical">
          {explainerData &&
            explainerData.technicalAnalysis.map((item, idx) => (
              <div className="explainer-item" key={idx}>
                <i className="fas fa-arrow-right"></i> {item}
              </div>
            ))}
        </div>
      </div>

      {/* Model Reasoning */}
      <div className="explainer-section">
        <div className="explainer-section-title">
          <i className="fas fa-cogs"></i> Model Reasoning
        </div>
        <div id="explainer-reasoning">
          {explainerData &&
            explainerData.modelReasoning.map((item, idx) => (
              <div className="explainer-item" key={idx}>
                <i className="fas fa-arrow-right"></i> {item}
              </div>
            ))}
        </div>
      </div>

      {/* Prediction Factors */}
      <div className="explainer-section">
        <div className="explainer-section-title">
          <i className="fas fa-key"></i> Key Factors
        </div>
        <div id="explainer-factors">
          {explainerData &&
            explainerData.predictionFactors.map((item, idx) => (
              <div className="explainer-item" key={idx}>
                <i className="fas fa-arrow-right"></i> {item}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
