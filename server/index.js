const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const donationRoutes = require('./routes/donations');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.set('io', io);

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', donationRoutes);

// Test route
app.get('/', (req,res)=>res.send('Server running'));

// WebSocket
io.on('connection', (socket) => {
  console.log('Client connected');
});

// Port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
