// server/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const Stripe = require('stripe');
const { Pool } = require('pg');
const path = require('path');
const { Server } = require('socket.io');
const { GRID, TOTAL, firstN } = require('./pixels');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// ------ DB ------
let pool;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });
} else {
  pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    database: process.env.DB_NAME || 'getmerich',
  });
}

// Helpers net = montant réellement reçu (si tu as déjà intégré les frais ailleurs, garde identique)
function toCents(amount) { return Math.max(1, Math.round(Number(amount) * 100)); }
function fromCents(cents) { return Number(cents) / 100; }

// ------ Stripe ------
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

app.get('/api/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null
  });
});

app.post('/api/create-payment-intent', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
    const { amount, pseudo } = req.body;
    const amountCents = toCents(amount);

    const pi = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata: { pseudo: String(pseudo || 'Anonymous') },
      automatic_payment_methods: { enabled: true },
    });
    res.json({ clientSecret: pi.client_secret });
  } catch (e) {
    res.status(500).json({ error: e.message || 'PI failed' });
  }
});

// ------ Donations ------
app.post('/api/donate', async (req, res) => {
  try {
    const { pseudo, amount } = req.body;
    const name = (pseudo || 'Anonymous').slice(0, 50);
    const amt = Math.max(1, Math.floor(Number(amount) || 1));

    // Insert
    await pool.query(
      'INSERT INTO donations (pseudo, amount) VALUES ($1, $2)',
      [name, amt]
    );

    // Summary
    const totalRow = await pool.query('SELECT COALESCE(SUM(amount),0) AS total FROM donations');
    const total = Number(totalRow.rows[0].total) || 0;

    const lastRow = await pool.query(
      'SELECT pseudo, amount, created_at FROM donations ORDER BY created_at DESC LIMIT 1'
    );
    const last = lastRow.rows[0] || null;

    // Broadcast live to all sockets
    io.emit('update', { totalNet: total, last });

    res.json({ success: true, totalNet: total, last });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || 'DB error' });
  }
});

// ------ Summary ------
app.get('/api/summary', async (req, res) => {
  try {
    const totalRow = await pool.query('SELECT COALESCE(SUM(amount),0) AS total FROM donations');
    const total = Number(totalRow.rows[0].total) || 0;

    const lastRow = await pool.query(
      'SELECT pseudo, amount, created_at FROM donations ORDER BY created_at DESC LIMIT 1'
    );
    const last = lastRow.rows[0] || null;

    res.json({ ok: true, totalNet: total, last, grid: GRID, totalPixels: TOTAL });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'DB error' });
  }
});

// ------ Pixels (nouveau) ------
// Renvoie les indices à révéler pour N dollars nets (N = floor(totalNet))
// GET /api/pixels?count=7219  → [i0, i1, ...]
app.get('/api/pixels', (req, res) => {
  const count = Math.max(0, Math.min(TOTAL, parseInt(req.query.count || '0', 10)));
  const indices = firstN(count);
  res.json({ count, indices, grid: GRID });
});

// ------ Static client (si tu serves depuis server/public) ------
// (Si tu as le client servi par un autre service, tu peux supprimer ce bloc)
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir));
app.get('*', (req, res) => res.sendFile(path.join(clientDir, 'index.html')));

// ------ WebSocket ------
io.on('connection', () => { /* no-op */ });

// ------ Start ------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server running on :' + PORT);
});
