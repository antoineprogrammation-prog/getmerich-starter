// server/index.js
/* eslint-disable no-console */
const path = require('path');
const express = require('express');
const compression = require('compression');
const cors = require('cors');

// Chargement des variables d'env si présentes en local
try {
  require('dotenv').config();
} catch (_) { /* noop */ }

// Import de tes routes/API existantes
// Ajuste ces require si tes modules exportent différemment
const donationsRouter = require('./routes/donations');

const app = express();

// Sécurité de base et perf
app.disable('x-powered-by');
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Optionnel mais utile derrière proxy (Railway)
app.set('trust proxy', 1);

// --- HEALTHCHECK ---
// Railway considérera le service UP si cet endpoint répond rapidement
app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});

// --- API ---
// Monte ton routeur de dons tel qu'il existe déjà
app.use('/api/donations', donationsRouter);

// --- STATIC FRONT (build Vite) ---
const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist, { maxAge: '1h', index: false }));

// Catch-all pour le SPA : renvoie index.html pour toutes les routes non API
app.get('*', (req, res, next) => {
  // Ne pas écraser les 404 d'assets
  if (req.path.startsWith('/api/')) return next();

  const indexFile = path.join(clientDist, 'index.html');
  res.sendFile(indexFile, (err) => {
    if (err) next(err);
  });
});

// --- START SERVER ---
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
});

// Gestion des erreurs non catchées pour éviter les crash silencieux
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException:', err);
});
