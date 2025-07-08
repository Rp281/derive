import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

export default function App() {
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const candleSeriesRef = useRef();
  const [signal, setSignal] = useState('none');
  const ws = useRef(null);
  const [priceData, setPriceData] = useState([]);

  useEffect(() => {
    chartRef.current = createChart(chartContainerRef.current, {
      width: 700,
      height: 300,
      layout: { backgroundColor: '#fff', textColor: '#000' },
      grid: { vertLines: { color: '#eee' }, horzLines: { color: '#eee' } },
      rightPriceScale: { visible: true },
      timeScale: { timeVisible: true, secondsVisible: true },
    });

    candleSeriesRef.current = chartRef.current.addCandlestickSeries();

    ws.current = new WebSocket('ws://localhost:4000');

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const time = data.timestamp;

      setPriceData((prev) => {
        let newData = [...prev];
        if (newData.length === 0 || newData[newData.length - 1].time !== time) {
          newData.push({
            time,
            open: data.price,
            high: data.price,
            low: data.price,
            close: data.price,
          });
        } else {
          const lastCandle = newData[newData.length - 1];
          lastCandle.high = Math.max(lastCandle.high, data.price);
          lastCandle.low = Math.min(lastCandle.low, data.price);
          lastCandle.close = data.price;
        }
        if (newData.length > 100) newData.shift();
        candleSeriesRef.current.setData(newData);
        return newData;
      });

      setSignal(data.signal);
    };

    return () => {
      ws.current.close();
      chartRef.current.remove();
    };
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Deriv Rise/Fall Analysis Tool</h2>
      <div ref={chartContainerRef} />
      <h3>
        Signal:{' '}
        <span style={{ color: signal === 'rise' ? 'green' : signal === 'fall' ? 'red' : 'gray' }}>
          {signal.toUpperCase()}
        </span>
      </h3>
    </div>
  );
}
