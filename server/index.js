const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const donationRoutes = require('./routes/donations');
const { getTotalDonations, getLastDonation } = require('./models/donation');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

app.use(cors());
app.use(express.json());

// --- Config: expose la clé publique et le "mode" (test ou live) au front ---
app.get('/api/config', (_req, res) => {
  const pk = process.env.STRIPE_PUBLISHABLE_KEY || '';
  const mode = pk.startsWith('pk_live_') ? 'live' : (pk.startsWith('pk_test_') ? 'test' : 'unknown');
  res.json({ publishableKey: pk, mode });
});

// --- API dons / Stripe ---
app.use('/api', donationRoutes);

// --- Statique (sert /client depuis le même service) ---
const clientDir = path.join(__dirname, '../client');
app.use(express.static(clientDir));

// --- Fallback (SPA/HTML) ---
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// --- WebSocket: état initial ---
io.on('connection', async (socket) => {
  try {
    const total = await getTotalDonations();
    const last = await getLastDonation();
    socket.emit('update', { total, last });
  } catch (e) {
    console.error('WS init error:', e);
  }
});

// --- Port fixe 3000 (ton domaine Railway est déjà configuré sur 3000) ---
const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
