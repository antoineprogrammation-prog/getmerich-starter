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

// API
app.use('/api', donationRoutes);

// Statique (sert /client depuis le même service)
const clientDir = path.join(__dirname, '../client');
app.use(express.static(clientDir));

// Fallback pour ton index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// WebSocket : push des valeurs au connect
io.on('connection', async (socket) => {
  try {
    const total = await getTotalDonations();
    const last = await getLastDonation();
    socket.emit('update', { total, last });
  } catch (e) {
    console.error('WS init error:', e);
  }
});

// ✅ On FORCE le port à 3000 (pas de PORT dynamique Railway)
const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
