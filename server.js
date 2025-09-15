const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
require('dotenv').config();

// Import modules
const config = require('./src/config/server');
const AuthRoutes = require('./src/auth/routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: config.corsOptions,
  transports: config.socketOptions.transports
});

// Middleware
app.use(helmet(config.helmetOptions));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Routes
const authRoutes = new AuthRoutes();
app.use('/api/auth', authRoutes.getRouter());

// Health check
app.get('/health', async (req, res) => {
  console.log('✅ Health check called');
  res.status(200).json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// Ready check for Railway
app.get('/ready', (req, res) => {
  console.log('🚀 Ready check called');
  res.status(200).json({
    status: 'ready',
    port: config.port.toString(),
    timestamp: Date.now()
  });
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
server.listen(config.port, () => {
  console.log(`🚀 Talk pAI server running on port ${config.port}`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
  console.log(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
  console.log('🎯 All systems ready for Railway deployment!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});