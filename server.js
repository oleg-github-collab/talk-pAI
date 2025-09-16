const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
require('dotenv').config();

// Safe module imports with error handling
let config, database, Logger;
let AuthRoutes, ChatRoutes, AIRoutes, AidenRoutes, CorporateRoutes, SearchRoutes, EnterpriseRoutes;

try {
  config = require('./src/config/server');
} catch (error) {
  console.warn('Config module not found, using defaults');
  config = {
    port: process.env.PORT || 8080,
    nodeEnv: process.env.NODE_ENV || 'production',
    corsOptions: { origin: "*", credentials: true },
    socketOptions: { transports: ['websocket', 'polling'] },
    helmetOptions: { contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }
  };
}

try {
  database = require('./src/database/optimized-connection');
} catch (error) {
  console.warn('Database module not found, using fallback');
  database = { isConnected: false, connect: () => Promise.resolve(false) };
}

try {
  Logger = require('./src/utils/enhanced-logger');
} catch (error) {
  console.warn('Logger module not found, using console fallback');
  Logger = class FallbackLogger {
    constructor(name) { this.name = name; }
    static createRequestLogger() { return (req, res, next) => next(); }
    debug() {}
    info() {}
    error() {}
  };
}

// Safe route imports
const safeRequire = (modulePath, fallbackName) => {
  try {
    return require(modulePath);
  } catch (error) {
    console.warn(`${fallbackName} module not found, skipping`);
    return class { getRouter() { return express.Router(); } };
  }
};

AuthRoutes = safeRequire('./src/auth/routes', 'AuthRoutes');
ChatRoutes = safeRequire('./src/chat/routes', 'ChatRoutes');
AIRoutes = safeRequire('./src/ai/routes', 'AIRoutes');
AidenRoutes = safeRequire('./src/ai/aiden-routes', 'AidenRoutes');
CorporateRoutes = safeRequire('./src/corporate/routes', 'CorporateRoutes');
SearchRoutes = safeRequire('./src/search/routes', 'SearchRoutes');
EnterpriseRoutes = safeRequire('./src/enterprise/routes', 'EnterpriseRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: config.corsOptions,
  transports: config.socketOptions.transports
});

// Initialize logger
const logger = new Logger('Server');

// Basic middleware - always works
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Safe middleware with fallbacks
try {
  app.use(helmet(config.helmetOptions));
  app.use(compression());
  app.use(cors());
  app.use(Logger.createRequestLogger());
  if (require('fs').existsSync('uploads')) {
    app.use('/uploads', express.static('uploads'));
  }
} catch (error) {
  console.warn('Some middleware failed to load, continuing with basic setup');
}

// Make io available to routes
app.set('io', io);

// Safe route initialization
try {
  const authRoutes = new AuthRoutes();
  const chatRoutes = new ChatRoutes();
  const aiRoutes = new AIRoutes();
  const aidenRoutes = new AidenRoutes();
  const corporateRoutes = new CorporateRoutes();
  const searchRoutes = new SearchRoutes();
  const enterpriseRoutes = new EnterpriseRoutes();

  app.use('/api/auth', authRoutes.getRouter());
  app.use('/api/chat', chatRoutes.getRouter());
  app.use('/api/ai', aiRoutes.getRouter());
  app.use('/api/aiden', aidenRoutes.getRouter());
  app.use('/api/corporate', corporateRoutes.getRouter());
  app.use('/api/search', searchRoutes.getRouter());
  app.use('/api/enterprise', enterpriseRoutes.getRouter());
} catch (error) {
  console.warn('Some routes failed to initialize:', error.message);
}

// Simple health check - minimal dependencies
app.get('/health', (req, res) => {
  try {
    res.status(200).json({
      status: 'healthy',
      timestamp: Date.now(),
      uptime: process.uptime(),
      version: '2.0.0',
      port: process.env.PORT || 8080
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Ready check for Railway - simplified
app.get('/ready', (req, res) => {
  try {
    res.status(200).json({
      status: 'ready',
      timestamp: Date.now(),
      port: process.env.PORT || 8080
    });
  } catch (error) {
    res.status(500).json({
      status: 'not ready',
      error: error.message
    });
  }
});

// Root endpoint for basic connectivity test
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Talk pAI Server is running',
    version: '2.0.0',
    timestamp: Date.now()
  });
});

// Enhanced Socket.io connection with comprehensive real-time features
io.on('connection', (socket) => {
  logger.info('User connected', { socketId: socket.id });

  let currentUser = null;
  let currentChats = new Set();
  let typingTimeouts = new Map();

  // User authentication
  socket.on('authenticate', (data) => {
    try {
      const { userId, nickname, token } = data;
      // TODO: Verify token in production

      currentUser = { id: userId, nickname, socketId: socket.id };
      socket.join(`user_${userId}`);

      logger.debug('User authenticated', { userId, nickname, socketId: socket.id });

      // Notify user of successful authentication
      socket.emit('authenticated', {
        success: true,
        user: { id: userId, nickname }
      });

      // Broadcast user online status
      socket.broadcast.emit('user_online', {
        userId,
        nickname,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Socket authentication failed', { error: error.message });
      socket.emit('auth_error', { error: 'Authentication failed' });
    }
  });

  // Join chat room with enhanced features
  socket.on('join_chat', (data) => {
    try {
      const { chatId, userId } = data;
      const roomName = `chat_${chatId}`;

      socket.join(roomName);
      currentChats.add(chatId);

      logger.debug('User joined chat', { userId, chatId, socketId: socket.id });

      // Notify other participants
      socket.to(roomName).emit('user_joined_chat', {
        userId,
        nickname: currentUser?.nickname,
        chatId,
        timestamp: new Date().toISOString()
      });

      // Send join confirmation
      socket.emit('chat_joined', {
        chatId,
        participants: socket.adapter.rooms.get(roomName)?.size || 1,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Join chat failed', { error: error.message });
      socket.emit('join_chat_error', { error: 'Failed to join chat' });
    }
  });

  // Leave chat room
  socket.on('leave_chat', (data) => {
    try {
      const { chatId, userId } = data;
      const roomName = `chat_${chatId}`;

      socket.leave(roomName);
      currentChats.delete(chatId);

      // Clear any typing indicators for this chat
      if (typingTimeouts.has(chatId)) {
        clearTimeout(typingTimeouts.get(chatId));
        typingTimeouts.delete(chatId);
      }

      logger.debug('User left chat', { userId, chatId, socketId: socket.id });

      // Notify other participants
      socket.to(roomName).emit('user_left_chat', {
        userId,
        nickname: currentUser?.nickname,
        chatId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Leave chat failed', { error: error.message });
    }
  });

  // Enhanced typing indicators with auto-stop
  socket.on('typing_start', (data) => {
    try {
      const { chatId, userId, nickname } = data;
      const roomName = `chat_${chatId}`;

      // Clear existing timeout for this chat
      if (typingTimeouts.has(chatId)) {
        clearTimeout(typingTimeouts.get(chatId));
      }

      // Broadcast typing start
      socket.to(roomName).emit('user_typing', {
        userId,
        nickname: nickname || currentUser?.nickname,
        chatId,
        timestamp: new Date().toISOString()
      });

      // Auto-stop typing after 3 seconds of inactivity
      const timeout = setTimeout(() => {
        socket.to(roomName).emit('user_stopped_typing', {
          userId,
          chatId,
          timestamp: new Date().toISOString()
        });
        typingTimeouts.delete(chatId);
      }, 3000);

      typingTimeouts.set(chatId, timeout);

    } catch (error) {
      logger.error('Typing start failed', { error: error.message });
    }
  });

  socket.on('typing_stop', (data) => {
    try {
      const { chatId, userId } = data;
      const roomName = `chat_${chatId}`;

      // Clear timeout
      if (typingTimeouts.has(chatId)) {
        clearTimeout(typingTimeouts.get(chatId));
        typingTimeouts.delete(chatId);
      }

      // Broadcast typing stop
      socket.to(roomName).emit('user_stopped_typing', {
        userId,
        chatId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Typing stop failed', { error: error.message });
    }
  });

  // Message reactions in real-time
  socket.on('message_reaction', (data) => {
    try {
      const { messageId, chatId, reaction, userId } = data;
      const roomName = `chat_${chatId}`;

      // Broadcast reaction to all chat participants
      socket.to(roomName).emit('message_reaction_added', {
        messageId,
        chatId,
        reaction,
        userId,
        nickname: currentUser?.nickname,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Message reaction failed', { error: error.message });
    }
  });

  // Real-time message status updates
  socket.on('message_read', (data) => {
    try {
      const { messageId, chatId, userId } = data;
      const roomName = `chat_${chatId}`;

      // Notify message sender about read status
      socket.to(roomName).emit('message_read_status', {
        messageId,
        chatId,
        readBy: userId,
        nickname: currentUser?.nickname,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Message read status failed', { error: error.message });
    }
  });

  // User presence updates
  socket.on('presence_update', (data) => {
    try {
      const { status, customMessage } = data; // online, away, busy, offline

      if (currentUser) {
        // Update user status in all their chats
        currentChats.forEach(chatId => {
          socket.to(`chat_${chatId}`).emit('user_presence_changed', {
            userId: currentUser.id,
            nickname: currentUser.nickname,
            status,
            customMessage,
            timestamp: new Date().toISOString()
          });
        });
      }

    } catch (error) {
      logger.error('Presence update failed', { error: error.message });
    }
  });

  // Handle disconnection with cleanup
  socket.on('disconnect', (reason) => {
    logger.info('User disconnected', {
      socketId: socket.id,
      userId: currentUser?.id,
      reason,
      connectedTime: socket.conn.server.engine.generateId
    });

    // Clear all typing timeouts
    typingTimeouts.forEach(timeout => clearTimeout(timeout));
    typingTimeouts.clear();

    // Notify all chats about user going offline
    if (currentUser) {
      currentChats.forEach(chatId => {
        socket.to(`chat_${chatId}`).emit('user_offline', {
          userId: currentUser.id,
          nickname: currentUser.nickname,
          chatId,
          timestamp: new Date().toISOString(),
          reason
        });
      });

      // Broadcast general offline status
      socket.broadcast.emit('user_offline', {
        userId: currentUser.id,
        nickname: currentUser.nickname,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Error handling
  socket.on('error', (error) => {
    logger.error('Socket error', {
      error: error.message,
      socketId: socket.id,
      userId: currentUser?.id
    });
  });
});

// Basic API status endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Talk pAI API is running',
    version: '2.0.0',
    endpoints: ['/health', '/ready', '/api/auth', '/api/chat', '/api/ai', '/api/aiden'],
    timestamp: Date.now()
  });
});

// Serve frontend - catch all other routes
app.get('*', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } catch (error) {
    res.status(500).json({ error: 'Frontend not available', message: error.message });
  }
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