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
const ChatRoutes = require('./src/chat/routes');
const AIRoutes = require('./src/ai/routes');
const CorporateRoutes = require('./src/corporate/routes');
const database = require('./src/database/connection');

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
app.use('/uploads', express.static('uploads'));

// Make io available to routes
app.set('io', io);

// Routes
const authRoutes = new AuthRoutes();
const chatRoutes = new ChatRoutes();
const aiRoutes = new AIRoutes();
const corporateRoutes = new CorporateRoutes();
app.use('/api/auth', authRoutes.getRouter());
app.use('/api/chat', chatRoutes.getRouter());
app.use('/api/ai', aiRoutes.getRouter());
app.use('/api/corporate', corporateRoutes.getRouter());

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

  // Join chat room
  socket.on('join_chat', (chatId) => {
    socket.join(`chat_${chatId}`);
    console.log(`User ${socket.id} joined chat ${chatId}`);
  });

  // Leave chat room
  socket.on('leave_chat', (chatId) => {
    socket.leave(`chat_${chatId}`);
    console.log(`User ${socket.id} left chat ${chatId}`);
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    socket.to(`chat_${data.chatId}`).emit('user_typing', {
      userId: data.userId,
      nickname: data.nickname
    });
  });

  socket.on('typing_stop', (data) => {
    socket.to(`chat_${data.chatId}`).emit('user_stopped_typing', {
      userId: data.userId
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database and start server
async function startServer() {
  try {
    // Try to connect to database
    const dbConnected = await database.connect();

    if (dbConnected) {
      console.log('✅ PostgreSQL database connected and ready');
    } else {
      console.log('⚠️  Running with in-memory storage (development mode)');
    }

    server.listen(config.port, () => {
      console.log(`🚀 Talk pAI server running on port ${config.port}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`💾 Database: ${dbConnected ? 'PostgreSQL' : 'In-Memory'}`);
      console.log(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
      console.log('🎯 Production messenger ready!');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');

  // Close database connection
  if (database.isConnected) {
    await database.close();
  }

  server.close(() => {
    console.log('🔐 Server shutdown complete');
    process.exit(0);
  });
});