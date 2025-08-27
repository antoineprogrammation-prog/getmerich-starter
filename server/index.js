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

// Healthcheck
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// ---- API MINIMALES (stubs sûrs) ----
app.get('/api/stats', (_req, res) => {
  res.json({ goal: 1000000, totalNet: 7219.53, last: null });
});
app.get('/api/config', (_req, res) => {
  // on ne plante pas le front; on renvoie une clé vide si non configurée
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
  res.json({ publishableKey, mode: publishableKey ? 'live' : 'disabled' });
});
app.post('/api/create-payment-intent', (_req, res) => {
  // Stub: explique clairement que Stripe n'est pas encore branché côté serveur
  res.status(503).json({ error: 'Stripe server not configured. Set STRIPE keys on the server to enable payments.' });
});
app.post('/api/donate', (req, res) => {
  // Stub d’enregistrement: renvoie le même total (aucune bdd ici)
  const { pseudo, amount } = req.body || {};
  const last = { pseudo: pseudo || 'Anonymous', amount: Number(amount) || 0 };
  const totalNet = 7219.53; // valeur fixe de base
  res.json({ success: true, totalNet, last });
});

// ---- STATIC (client/dist) ----
const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
const indexHtml = path.join(clientDist, 'index.html');
const hasBuild = fs.existsSync(indexHtml);
console.log('[diag] clientDist =', clientDist);
console.log('[diag] index.html present =', hasBuild);

// Route racine: message clair si le build manque
app.get('/', (_req, res, next) => {
  if (hasBuild) return next();
  res.status(200).type('text/plain').send('Server OK (root). No client build found. (client/dist/index.html missing)');
});

// Sert les fichiers du build
if (hasBuild) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(indexHtml));
} else {
  app.use((_req, res) => res.status(404).type('text/plain').send('404 – No client build'));
}

// ---- START + Socket.IO ----
const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
});

// Socket.IO (même origine)
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });
io.on('connection', (socket) => {
  // envoie un état initial pour que l’UI ne soit pas vide
  socket.emit('update', { totalNet: 7219.53, last: null });
});
