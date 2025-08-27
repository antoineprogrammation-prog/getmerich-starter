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

// --- Healthcheck (pour Railway)
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// --- Emplacement du build Vite
const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
const indexHtml = path.join(clientDist, 'index.html');
const hasBuild = fs.existsSync(indexHtml);

// --- Log clair au démarrage
console.log('[diag] clientDist =', clientDist);
console.log('[diag] index.html present =', hasBuild);

// --- Route racine DIAG : répond toujours, même si le front manque
app.get('/', (_req, res, next) => {
  if (hasBuild) return next(); // on laissera le static servir index.html
  res
    .status(200)
    .type('text/plain')
    .send(
      'Server OK (root). Mais client/dist manquant : aucun index.html trouvé.\n' +
      '→ Le build Vite ne s’est pas exécuté ou Root Directory n’inclut pas /client.\n'
    );
});

// --- Static (front) uniquement si build présent
if (hasBuild) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  // Catch-all SPA
  app.get('*', (req, res) => res.sendFile(indexHtml));
} else {
  // Si pas de build, on laisse les autres routes répondre 404 proprement
  app.use((_req, res) => {
    res
      .status(404)
      .type('text/plain')
      .send('404 – Pas de build front (client/dist/index.html introuvable)');
  });
}

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
});
