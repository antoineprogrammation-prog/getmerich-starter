/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
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

app.get('/healthz', (_req, res) => res.status(200).send('ok'));

const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
const indexHtml = path.join(clientDist, 'index.html');
const hasBuild = fs.existsSync(indexHtml);

console.log('[diag] clientDist =', clientDist);
console.log('[diag] index.html present =', hasBuild);

// Route racine: si pas de build, message clair
app.get('/', (_req, res, next) => {
  if (hasBuild) return next();
  res
    .status(200)
    .type('text/plain')
    .send('Server OK (root). Mais client/dist manquant (index.html absent).');
});

// Static si build présent
if (hasBuild) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(indexHtml));
} else {
  app.use((_req, res) => res.status(404).type('text/plain').send('404 – Pas de build front'));
}

const PORT = Number(process.env.PORT) || 8080; // 8080 attendu par Railway (déjà configuré)
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
});
