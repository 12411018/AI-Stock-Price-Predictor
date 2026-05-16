export default function LoadingOverlay({ visible, phase }) {
  return (
    <div id="loading" style={{ display: visible ? 'block' : 'none' }}>
      <div className="loader">
        <i className="fas fa-spinner"></i>
        <p>{phase || 'Analyzing stock data...'}</p>
      </div>
    </div>
  );
}
