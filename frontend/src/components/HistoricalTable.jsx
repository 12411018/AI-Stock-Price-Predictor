export default function HistoricalTable({ data }) {
  const rows = data ? data.historicalData : [];

  return (
    <div className="stock-table">
      <h5 className="p-3 mb-0 border-bottom">
        <i className="fas fa-history"></i> Historical Data
      </h5>
      <table className="table table-hover">
        <thead>
          <tr>
            <th>Date</th>
            <th>Open</th>
            <th>Close</th>
            <th>High</th>
            <th>Low</th>
          </tr>
        </thead>
        <tbody id="table-body">
          {rows.map((row, index) => {
            const changeColor =
              row.Close >= row.Open
                ? 'var(--success-color)'
                : 'var(--danger-color)';
            return (
              <tr
                key={index}
                className="animate__animated animate__fadeIn"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <td>{row.date}</td>
                <td>${row.Open.toFixed(2)}</td>
                <td style={{ color: changeColor }}>${row.Close.toFixed(2)}</td>
                <td>${row.High.toFixed(2)}</td>
                <td>${row.Low.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
