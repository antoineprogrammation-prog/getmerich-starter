/* eslint-disable no-console */
const path = require('path');
const express = require('express');
const compression = require('compression');
const cors = require('cors');

try { require('dotenv').config(); } catch (_) {}

const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Healthcheck pour Railway
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Servir le build Vite du client
const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist, { index: false, maxAge: '1h' }));

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Écoute sur PORT/0.0.0.0 (Railway)
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
});
