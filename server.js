const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
require('dotenv').config();

// Global error handlers for production
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Initialize config
let config;
try {
  config = require('./src/config/server');
} catch (error) {
  config = {
    port: process.env.PORT || 8080,
    nodeEnv: process.env.NODE_ENV || 'production',
    corsOptions: { origin: "*", credentials: true },
    socketOptions: { transports: ['websocket', 'polling'] },
    helmetOptions: {
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }
  };
}

// Initialize database
let database;
try {
  const DatabaseInitializer = require('./database/init-database');
  database = new DatabaseInitializer();
} catch (error) {
  console.warn('Database not available, using memory fallback');
  try {
    const MemoryDatabase = require('./database/memory-database');
    database = new MemoryDatabase();
  } catch (memError) {
    database = { isConnected: false, connect: () => Promise.resolve(false) };
  }
}

// Initialize logger
let Logger;
try {
  Logger = require('./src/utils/enhanced-logger');
} catch (error) {
  Logger = class FallbackLogger {
    constructor(name) { this.name = name; }
    static createRequestLogger() { return (req, res, next) => next(); }
    debug(msg) { console.log(`[DEBUG] ${msg}`); }
    info(msg) { console.log(`[INFO] ${msg}`); }
    error(msg) { console.error(`[ERROR] ${msg}`); }
  };
}

// Safe route imports with fallbacks
const safeRequire = (modulePath, fallbackName) => {
  try {
    return require(modulePath);
  } catch (error) {
    console.warn(`${fallbackName} not found, using empty router`);
    return class { getRouter() { return express.Router(); } };
  }
};

const AuthRoutes = safeRequire('./src/auth/routes', 'AuthRoutes');
const ChatRoutes = safeRequire('./src/chat/routes', 'ChatRoutes');
const AIRoutes = safeRequire('./src/ai/routes', 'AIRoutes');
const AidenRoutes = safeRequire('./src/ai/aiden-routes', 'AidenRoutes');
const CorporateRoutes = safeRequire('./src/corporate/routes', 'CorporateRoutes');
const SearchRoutes = safeRequire('./src/search/routes', 'SearchRoutes');
const EnterpriseRoutes = safeRequire('./src/enterprise/routes', 'EnterpriseRoutes');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: config.corsOptions,
  transports: config.socketOptions.transports
});

const logger = new Logger('Server');

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: { error: 'Too many requests, please try again later' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: { error: 'Too many authentication attempts, please try again later' }
});

// Middleware setup
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(helmet(config.helmetOptions));
app.use(compression());
app.use(cors(config.corsOptions));
app.use(generalLimiter);
app.use(Logger.createRequestLogger());

// Uploads directory
if (require('fs').existsSync('uploads')) {
  app.use('/uploads', express.static('uploads'));
}

// Make io available to routes
app.set('io', io);

// API Routes - clean SOLID architecture with rate limiting
app.use('/api/auth', authLimiter, new AuthRoutes(database, logger).getRouter());
app.use('/api/chat', new ChatRoutes(database, logger).getRouter());
app.use('/api/ai', new AIRoutes(database, logger).getRouter());
app.use('/api/aiden', new AidenRoutes(database, logger).getRouter());
app.use('/api/corporate', new CorporateRoutes(database, logger).getRouter());
app.use('/api/search', new SearchRoutes(database, logger).getRouter());
app.use('/api/enterprise', new EnterpriseRoutes(database, logger).getRouter());

// Health endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    ok: true,
    timestamp: new Date().toISOString(),
    database: database.isConnected,
    environment: process.env.NODE_ENV || 'production'
  });
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'ready', timestamp: Date.now() });
});

app.get('/ping', (req, res) => {
  res.json({ pong: true, timestamp: Date.now() });
});

// Socket.io real-time features
io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.id}`);

  socket.on('join-chat', (chatId) => {
    socket.join(`chat-${chatId}`);
    logger.debug(`User ${socket.id} joined chat ${chatId}`);
  });

  socket.on('leave-chat', (chatId) => {
    socket.leave(`chat-${chatId}`);
    logger.debug(`User ${socket.id} left chat ${chatId}`);
  });

  socket.on('typing-start', (data) => {
    socket.to(`chat-${data.chatId}`).emit('user-typing', {
      userId: data.userId,
      username: data.username
    });
  });

  socket.on('typing-stop', (data) => {
    socket.to(`chat-${data.chatId}`).emit('user-stopped-typing', {
      userId: data.userId
    });
  });

  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Server startup
async function startServer() {
  try {
    // Connect to database
    const dbConnected = await database.connect();

    if (dbConnected) {
      logger.info('✅ Database connected successfully');
    } else {
      logger.warn('⚠️ Database connection failed, using fallback');
    }

    // Start server
    const PORT = config.port;
    server.listen(PORT, '0.0.0.0', () => {
      console.log('🚀 Talk pAI server running on 0.0.0.0:' + PORT);
      console.log('🌍 Environment:', config.nodeEnv);
      console.log('💾 Database:', database.isConnected ? 'Connected' : 'Fallback');
      console.log('🎯 Health check: http://0.0.0.0:' + PORT + '/health');
      console.log('🔥 PRODUCTION MESSENGER READY!');
    });

  } catch (error) {
    logger.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('🔐 Server shutdown complete');
    process.exit(0);
  });
});

startServer();