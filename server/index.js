// server/index.js
/* eslint-disable no-console */
const path = require('path');
const express = require('express');
const compression = require('compression');
const cors = require('cors');

try { require('dotenv').config(); } catch (_) {}

const donationsRouter = require('./routes/donations');

const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

// Healthcheck
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// API
app.use('/api/donations', donationsRouter);

// Static (build Vite)
const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist, { maxAge: '1h', index: false }));

// SPA fallback (sauf API)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => err && next(err));
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
});

process.on('unhandledRejection', (r) => console.error('[server] unhandledRejection:', r));
process.on('uncaughtException', (e) => console.error('[server] uncaughtException:', e));
