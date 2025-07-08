const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const DERIV_API_TOKEN = process.env.DERIV_API_TOKEN || 'YOUR_DERIV_API_TOKEN';

// EMA calculation
function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  let emaArray = [];
  emaArray[0] = prices[0];
  for (let i = 1; i < prices.length; i++) {
    emaArray[i] = prices[i] * k + emaArray[i - 1] * (1 - k);
  }
  return emaArray;
}

// RSI calculation
function calculateRSI(prices, period) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    let diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Connect to Deriv ticks
function connectToDerivTicks(symbol = 'R_100') {
  const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');

  ws.on('open', () => {
    ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
  });

  let prices = [];

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.tick) {
      const price = msg.tick.ask;
      prices.push(price);
      if (prices.length > 50) prices.shift();

      if (prices.length >= 21) {
        const ema9 = calculateEMA(prices.slice(-21), 9).slice(-1)[0];
        const ema21 = calculateEMA(prices.slice(-21), 21).slice(-1)[0];
        const rsi = calculateRSI(prices.slice(-21), 14);

        let signal = 'none';
        if (ema9 > ema21 && rsi > 50) signal = 'rise';
        else if (ema9 < ema21 && rsi < 50) signal = 'fall';

        const payload = JSON.stringify({
          price,
          ema9,
          ema21,
          rsi,
          signal,
          timestamp: msg.tick.epoch,
        });

        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        });
      }
    }
  });

  ws.on('close', () => setTimeout(() => connectToDerivTicks(symbol), 5000));
  ws.on('error', (err) => console.error('Deriv WS error:', err.message));
}

wss.on('connection', ws => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));
});

connectToDerivTicks();

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
