/* eslint-disable no-console */
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const compression = require('compression');
const cors = require('cors');
try { require('dotenv').config(); } catch (_) {}

// Stripe
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try { stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); }
  catch (e) { console.error('[stripe] init error:', e.message); }
}

// Pixels config (LCG partagé avec le front)
const PX = require('./pixels');

const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP + Socket.io
const server = http.createServer(app);
const io = require('socket.io')(server, { cors: { origin: '*' } });

// État simple (tu brancheras ta DB plus tard)
let totalNet = 7219.54; // ← valeur actuelle visible (pixels = floor(totalNet))
let lastDonation = null;

// Healthcheck
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Expose la config pixels (front lira cette route)
app.get('/api/pixels/config', (_req, res) => res.json(PX));

// Résumé total / compat
app.get('/api/summary', (_req, res) => res.json({ totalNet, last: lastDonation }));
app.get('/api/total',   (_req, res) => res.json({ total: totalNet, last: lastDonation }));

// Stripe publishable key
app.get('/api/config', (_req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '' });
});

// Crée un PaymentIntent (USD)
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe non configuré' });
    const amountDollars = Math.max(1, Math.floor(Number(req.body?.amount || 1)));
    const pseudo = (req.body?.pseudo || 'Anonymous').toString().slice(0, 50);
    const intent = await stripe.paymentIntents.create({
      amount: amountDollars * 100,
      currency: 'usd',
      description: `Donation by ${pseudo}`,
      automatic_payment_methods: { enabled: true }
    });
    res.json({ clientSecret: intent.client_secret });
  } catch (e) {
    console.error('[stripe] PI error:', e);
    res.status(500).json({ error: e.message || 'PI failed' });
  }
});

// Enregistre la donation (en vrai: vérifier via webhook "payment_intent.succeeded")
app.post('/api/donate', async (req, res) => {
  try {
    const amount = Math.max(1, Math.floor(Number(req.body?.amount || 1)));
    const pseudo = (req.body?.pseudo || 'Anonymous').toString().slice(0, 50);

    totalNet = Number((totalNet + amount).toFixed(2));
    lastDonation = { pseudo, amount };

    // Push live pour tous les clients
    io.emit('update', { totalNet, last: lastDonation });

    res.json({ success: true, totalNet, last: lastDonation });
  } catch (e) {
    console.error('[donate] error:', e);
    res.status(500).json({ success: false, error: e.message || 'donation failed' });
  }
});

// ---- Static front (Vite build) ----
const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
const indexHtml  = path.join(clientDist, 'index.html');

app.get('/', (_req, res, next) => {
  if (fs.existsSync(indexHtml)) return next();
  res.status(200).type('text/plain').send('Server OK (root). Build front absent.');
});

if (fs.existsSync(indexHtml)) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(indexHtml));
} else {
  app.use((_req, res) => res.status(404).type('text/plain').send('404 – Pas de build front'));
}

const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => console.log(`[server] listening on http://${HOST}:${PORT}`));
