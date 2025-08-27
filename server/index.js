/* eslint-disable no-console */
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const compression = require('compression');
const cors = require('cors');

// --- Stripe setup ---
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try { stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); }
  catch (e) { console.error('[stripe] init error:', e.message); }
}

try { require('dotenv').config(); } catch (_) {}

const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create HTTP server to attach Socket.io
const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: { origin: '*'}
});

// --- In-memory state (simple, pour repartir)
let totalNet = 7219.53;
let lastDonation = null;

// Healthcheck
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// --- API Stripe + résumé ---
app.get('/api/config', (_req, res) => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
  res.json({ publishableKey });
});

// résumé pour le front (ton main.js le lit en premier)
app.get('/api/summary', (_req, res) => {
  res.json({ totalNet, last: lastDonation });
});

// compat ancien nom si ton front teste d’autres endpoints
app.get('/api/total', (_req, res) => {
  res.json({ total: totalNet, last: lastDonation });
});

// création PaymentIntent (USD, montant en dollars entiers -> cents)
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe non configuré (clé secrète manquante)' });
    const amountDollars = Math.max(1, Math.floor(Number(req.body?.amount || 1)));
    const pseudo = (req.body?.pseudo || 'Anonymous').toString().slice(0, 50);

    const intent = await stripe.paymentIntents.create({
      amount: amountDollars * 100,
      currency: 'usd',
      description: `Donation by ${pseudo}`,
      automatic_payment_methods: { enabled: true }
    });

    return res.json({ clientSecret: intent.client_secret });
  } catch (e) {
    console.error('[stripe] create PI error:', e);
    return res.status(500).json({ error: e.message || 'create-payment-intent failed' });
  }
});

// enregistrement "logique" après confirm côté client (idéalement: webhook)
app.post('/api/donate', async (req, res) => {
  try {
    const amount = Math.max(1, Math.floor(Number(req.body?.amount || 1)));
    const pseudo = (req.body?.pseudo || 'Anonymous').toString().slice(0, 50);

    // NOTE: en prod, vérifier via webhook Stripe que le paiement est bien "succeeded"
    totalNet = Number((totalNet + amount).toFixed(2));
    lastDonation = { pseudo, amount };

    // push live
    io.emit('update', { totalNet, last: lastDonation });

    return res.json({ success: true, totalNet, last: lastDonation });
  } catch (e) {
    console.error('[donate] error:', e);
    return res.status(500).json({ success: false, error: e.message || 'donation failed' });
  }
});

// ---- Static front (Vite build) ----
const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
const indexHtml = path.join(clientDist, 'index.html');

app.get('/', (_req, res, next) => {
  if (fs.existsSync(indexHtml)) return next();
  res
    .status(200)
    .type('text/plain')
    .send('Server OK (root). Mais client/dist manquant (index.html absent). Le build client doit être produit au déploiement.');
});

if (fs.existsSync(indexHtml)) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(indexHtml));
} else {
  app.use((_req, res) => res.status(404).type('text/plain').send('404 – Pas de build front'));
}

const PORT = Number(process.env.PORT) || 8080; // Railway: Target port = 8080
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
});
