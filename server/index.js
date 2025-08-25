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

// Statique: sert le dossier client/ depuis le même service (même URL)
const clientDir = path.join(__dirname, '../client');
app.use(express.static(clientDir));

// Fallback SPA/HTML
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// WebSocket: push initial
io.on('connection', async (socket) => {
  try {
    const total = await getTotalDonations();
    const last = await getLastDonation();
    socket.emit('update', { total, last });
  } catch (e) {
    console.error('WS init error:', e);
  }
});

// Sanity endpoint
app.get('/', (_req, res) => res.send('Server running'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
