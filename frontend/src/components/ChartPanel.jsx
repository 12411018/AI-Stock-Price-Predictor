import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';

const darkLayout = {
  template: 'plotly_dark',
  showlegend: true,
  legend: {
    orientation: 'h',
    y: -0.2,
    font: { color: '#e8e8e8' },
  },
  margin: { t: 50, b: 50, l: 60, r: 30 },
  xaxis: {
    title: { text: 'Date', font: { color: '#e8e8e8' } },
    gridcolor: '#2a2f3f',
    color: '#e8e8e8',
  },
  yaxis: {
    title: { text: 'Price ($)', font: { color: '#e8e8e8' } },
    gridcolor: '#2a2f3f',
    color: '#e8e8e8',
  },
  plot_bgcolor: 'rgba(26, 31, 46, 0.7)',
  paper_bgcolor: 'rgba(26, 31, 46, 0.7)',
  hovermode: 'x unified',
  font: { color: '#e8e8e8' },
  autosize: true,
};

const plotConfig = { responsive: true, displayModeBar: false };

export default function ChartPanel({ data }) {
  const lineRef = useRef(null);
  const barRef = useRef(null);

  useEffect(() => {
    if (!data || !lineRef.current || !barRef.current) return;

    // --- Line chart ---
    const lineData = [
      {
        x: data.dates,
        y: data.historicalPrices,
        mode: 'lines',
        name: 'Historical',
        line: { color: '#00d4ff', width: 3 },
      },
      {
        x: data.dates.slice(-Math.min(30, data.predictions.length)),
        y: data.predictions.slice(-Math.min(30, data.predictions.length)),
        mode: 'lines+markers',
        name: 'Predictions',
        line: { color: '#00ff88', width: 3, dash: 'dash' },
        marker: { size: 8, symbol: 'diamond', color: '#00ff88' },
      },
    ];

    const lineLayout = {
      ...darkLayout,
      title: {
        text: `${data.ticker} Stock Price Analysis`,
        font: { size: 18, color: '#00d4ff' },
      },
    };

    Plotly.newPlot(lineRef.current, lineData, lineLayout, plotConfig);

    // --- Volume bar chart ---
    const volumeData = data.historicalPrices.map((price) =>
      Math.floor(price * (1000 + Math.random() * 500))
    );

    const barChartData = [
      {
        x: data.dates,
        y: volumeData,
        type: 'bar',
        name: 'Volume',
        marker: {
          color: volumeData.map((_, i) =>
            data.historicalPrices[i] > (data.historicalPrices[i - 1] || 0)
              ? '#00ff88'
              : '#ff3860'
          ),
          opacity: 0.8,
        },
      },
    ];

    const barLayout = {
      ...darkLayout,
      title: {
        text: `${data.ticker} Trading Volume`,
        font: { size: 18, color: '#00d4ff' },
      },
      yaxis: {
        title: { text: 'Volume', font: { color: '#e8e8e8' } },
        gridcolor: '#2a2f3f',
        color: '#e8e8e8',
      },
    };

    Plotly.newPlot(barRef.current, barChartData, barLayout, plotConfig);

    // Cleanup on unmount / data change
    const lineEl = lineRef.current;
    const barEl = barRef.current;
    return () => {
      if (lineEl) Plotly.purge(lineEl);
      if (barEl) Plotly.purge(barEl);
    };
  }, [data]);

  return (
    <>
      <div className="chart-container animate__animated animate__fadeInRight">
        <div ref={lineRef} id="line-chart" style={{ width: '100%', height: '100%' }} />
      </div>
      <div className="chart-container animate__animated animate__fadeInRight">
        <div ref={barRef} id="bar-chart" style={{ width: '100%', height: '100%' }} />
      </div>
    </>
  );
}
