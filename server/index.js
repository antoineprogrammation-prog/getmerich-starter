const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const donationRoutes = require('./routes/donations');
const { getTotalDonations, getLastDonation } = require('./models/donation');
const { initDB, pool, configSummary } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

app.use(cors());
app.use(express.json());

// Clé publique Stripe + mode
app.get('/api/config', (_req, res) => {
  const pk = process.env.STRIPE_PUBLISHABLE_KEY || '';
  const mode = pk.startsWith('pk_live_') ? 'live' : (pk.startsWith('pk_test_') ? 'test' : 'unknown');
  res.json({ publishableKey: pk, mode });
});

// API dons
app.use('/api', donationRoutes);

// --- Health & Diagnostics DB ---
app.get('/api/health', async (_req, res) => {
  try {
    const now = await pool.query('SELECT NOW()');
    return res.json({
      ok: true,
      now: now.rows[0].now,
      db: { mode: configSummary.mode }
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e && e.message ? e.message : 'Unknown DB error',
      db: configSummary // n’expose pas de secrets, juste la présence des variables
    });
  }
});

// Statique (sert le client)
const clientDir = path.join(__dirname, '../client');
app.use(express.static(clientDir));

// Fallback SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// WebSocket: état initial
io.on('connection', async (socket) => {
  try {
    const total = await getTotalDonations();
    const last = await getLastDonation();
    socket.emit('update', { total, last });
  } catch (e) {
    console.error('WS init error:', e);
  }
});

// Démarrage + init DB
(async () => {
  try {
    await initDB();
    console.log('DB init OK');
  } catch (e) {
    console.error('DB init FAILED:', e.message || e);
  }

  const PORT = 3000; // Domaine Railway configuré sur 3000
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();
