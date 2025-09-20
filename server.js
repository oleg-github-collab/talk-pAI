const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
require('dotenv').config();

// Enhanced global error handlers with retry logic
let serverCrashCount = 0;
const MAX_CRASHES = 3;
const CRASH_RESET_TIME = 5 * 60 * 1000; // 5 minutes

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);

  serverCrashCount++;
  if (serverCrashCount >= MAX_CRASHES) {
    console.error('❌ Maximum crashes reached, exiting...');
    process.exit(1);
  }

  console.log(`⚠️ Crash count: ${serverCrashCount}/${MAX_CRASHES}, attempting recovery...`);
  setTimeout(() => { serverCrashCount = 0; }, CRASH_RESET_TIME);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Stack:', reason?.stack || 'No stack trace available');

  // Don't exit on unhandled rejections, just log them
  console.log('⚠️ Continuing server operation despite rejection...');
});

// Memory monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };

  // Alert if memory usage is too high
  if (memUsageMB.heapUsed > 500) {
    console.warn('⚠️ High memory usage detected:', memUsageMB);
  }
}, 60000); // Check every minute

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

// Initialize production-grade logging and error handling
let logger, errorHandler;
try {
  const { ProductionLogger, FallbackLogger } = require('./src/utils/production-logger');

  logger = new ProductionLogger({
    appName: 'TalkPAI',
    logLevel: process.env.LOG_LEVEL || 'info',
    enableFile: process.env.ENABLE_FILE_LOGGING !== 'false',
    enableConsole: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5
  });

  // Enhanced error handler
  errorHandler = {
    middleware: () => (err, req, res, next) => {
      logger.error('Express error middleware', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
      });

      res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
      });
    }
  };

  logger.info('🚀 Production logging system initialized');

  // Log system info on startup
  logger.info('System Information', {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    environment: process.env.NODE_ENV || 'production'
  });

} catch (error) {
  console.warn('⚠️ Production logger failed, using fallback:', error.message);
  const { FallbackLogger } = require('./src/utils/production-logger');
  logger = new FallbackLogger('TalkPAI');
  errorHandler = null;
}

// Initialize PostgreSQL database
let database;
try {
  const DatabaseInitializer = require('./database/init-database');
  database = new DatabaseInitializer();
} catch (error) {
  console.error('❌ Failed to initialize PostgreSQL database:', error.message);
  console.error('💡 Make sure your DATABASE_URL environment variable is set with your Railway PostgreSQL connection string');
  process.exit(1);
}

// Initialize fallback logger class
let FallbackLogger;
try {
  FallbackLogger = require('./src/utils/enhanced-logger');
} catch (error) {
  FallbackLogger = class FallbackLogger {
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
const EnhancedRoutes = safeRequire('./src/routes/enhanced-api', 'EnhancedRoutes');
const ContactsAPI = safeRequire('./src/routes/contacts-api', 'ContactsAPI');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: config.corsOptions,
  transports: config.socketOptions.transports
});

const serverLogger = new FallbackLogger('Server');

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

// Rate limiting with proper proxy configuration
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
  trustProxy: true,
  keyGenerator: (req) => {
    return req.ip;
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Increased limit for Railway
  message: { error: 'Too many authentication attempts, please try again later' },
  trustProxy: true,
  keyGenerator: (req) => {
    return req.ip;
  }
});

// Middleware setup
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(helmet(config.helmetOptions));
app.use(compression());
app.use(cors(config.corsOptions));
app.use(generalLimiter);

// Advanced request logging
if (logger && logger.createRequestLogger) {
  app.use(logger.createRequestLogger());
} else if (serverLogger) {
  app.use(serverLogger.createRequestLogger());
}

// Uploads directory
if (require('fs').existsSync('uploads')) {
  app.use('/uploads', express.static('uploads'));
}

// Make io available to routes
app.set('io', io);

// API Routes - clean SOLID architecture with rate limiting
app.use('/api/auth', authLimiter, new AuthRoutes(database, logger || serverLogger).getRouter());
app.use('/api/chat', new ChatRoutes(database, logger || serverLogger).getRouter());
app.use('/api/ai', new AIRoutes(database, logger || serverLogger).getRouter());
app.use('/api/aiden', new AidenRoutes(database, logger || serverLogger).getRouter());
app.use('/api/corporate', new CorporateRoutes(database, logger || serverLogger).getRouter());

// Comprehensive API v2 with advanced features
try {
  const ComprehensiveAPI = require('./src/routes/comprehensive-api-minimal');
  const comprehensiveAPI = new ComprehensiveAPI(database, logger || serverLogger, errorHandler);
  app.use('/api/v2', comprehensiveAPI.getRouter());
  (logger || serverLogger).info('✨ Comprehensive API v2 routes initialized');
} catch (error) {
  (logger || serverLogger).warn('⚠️ Comprehensive API not available:', error.message);
}
app.use('/api/search', new SearchRoutes(database, logger || serverLogger).getRouter());
app.use('/api/enterprise', new EnterpriseRoutes(database, logger || serverLogger).getRouter());
app.use('/api/enhanced', new EnhancedRoutes(database, logger || serverLogger).getRouter());
app.use('/api/contacts', new ContactsAPI(database, logger || serverLogger).getRouter());

// Global error handling middleware (must be last)
if (errorHandler) {
  app.use(errorHandler.middleware());
}

// Main route - serve the ultra-modern glassmorphism messenger
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Enhanced health endpoints with comprehensive monitoring
app.get('/health', async (req, res) => {
  try {
    const healthData = {
      status: 'healthy',
      ok: true,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        connected: database.isConnected,
        type: database.connectionType
      }
    };

    // Get detailed database health if available
    if (database.healthCheck) {
      try {
        const dbHealth = await database.healthCheck();
        healthData.database = { ...healthData.database, ...dbHealth };
      } catch (dbError) {
        healthData.database.error = dbError.message;
        healthData.database.connected = false;
      }
    }

    // Add system stats
    healthData.system = {
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid
    };

    res.json(healthData);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      ok: false,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

app.get('/healthz', (req, res) => {
  res.json({
    status: 'ready',
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

app.get('/ping', (req, res) => {
  res.json({
    pong: true,
    timestamp: Date.now(),
    server: 'talk-pai'
  });
});

// Database-specific health endpoint
app.get('/health/database', async (req, res) => {
  try {
    if (database.healthCheck) {
      const dbHealth = await database.healthCheck();
      res.json(dbHealth);
    } else {
      res.json({
        connected: database.isConnected,
        type: database.connectionType,
        message: 'Basic health check only'
      });
    }
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// System metrics endpoint
app.get('/health/metrics', (req, res) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      external: Math.round(memUsage.external / 1024 / 1024) + 'MB'
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    process: {
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version
    }
  });
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

  // Enhanced real-time features
  socket.on('message-reaction', (data) => {
    socket.to(`chat-${data.chatId}`).emit('reaction-added', data);
  });

  socket.on('message-read', (data) => {
    socket.to(`chat-${data.chatId}`).emit('message-read', data);
  });

  socket.on('voice-recording-start', (data) => {
    socket.to(`chat-${data.chatId}`).emit('user-recording', {
      userId: data.userId,
      username: data.username
    });
  });

  socket.on('voice-recording-stop', (data) => {
    socket.to(`chat-${data.chatId}`).emit('user-stopped-recording', {
      userId: data.userId
    });
  });

  socket.on('user-status-change', (data) => {
    socket.broadcast.emit('user-status-updated', data);
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

// Enhanced server startup with comprehensive validation
async function startServer() {
  let retryCount = 0;
  const maxRetries = 5;
  const retryDelay = 2000;

  while (retryCount < maxRetries) {
    try {
      console.log(`🔄 Starting server attempt ${retryCount + 1}/${maxRetries}...`);

      // Pre-startup validation
      await validateEnvironment();

      // Connect to database with retry logic
      const dbConnected = await connectDatabaseWithRetry();

      if (dbConnected) {
        logger.info('✅ Database connected successfully');
        await validateDatabaseSchema();
      } else {
        logger.warn('⚠️ Database connection failed, using fallback');
      }

      // Validate critical directories
      await ensureCriticalDirectories();

      // Start server with enhanced error handling
      const PORT = config.port;
      await new Promise((resolve, reject) => {
        const serverInstance = server.listen(PORT, '0.0.0.0', () => {
          console.log('🚀 Talk pAI server running on 0.0.0.0:' + PORT);
          console.log('🌍 Environment:', config.nodeEnv);
          console.log('💾 Database:', database.isConnected ? 'Connected' : 'Fallback');
          console.log('🎯 Health check: http://0.0.0.0:' + PORT + '/health');
          console.log('🔥 PRODUCTION MESSENGER READY!');

          // Post-startup validation
          setTimeout(() => validateServerHealth(PORT), 3000);
          resolve();
        });

        serverInstance.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`⚠️ Port ${PORT} is busy, trying ${PORT + 1}...`);
            config.port = PORT + 1;
            reject(new Error(`Port ${PORT} in use`));
          } else {
            reject(err);
          }
        });
      });

      // If we get here, startup was successful
      break;

    } catch (error) {
      retryCount++;
      logger.error(`❌ Server startup attempt ${retryCount} failed:`, error.message);

      if (retryCount >= maxRetries) {
        logger.error(`❌ Failed to start server after ${maxRetries} attempts`);
        process.exit(1);
      }

      console.log(`⏳ Retrying in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

// Environment validation
async function validateEnvironment() {
  console.log('🔍 Validating environment...');

  const required = ['NODE_ENV'];
  const missing = required.filter(env => !process.env[env]);

  if (missing.length > 0) {
    console.warn('⚠️ Missing environment variables:', missing.join(', '));
  }

  // Set defaults for missing variables
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
  if (!process.env.PORT) process.env.PORT = '8080';

  console.log('✅ Environment validation complete');
}

// Database connection with retry
async function connectDatabaseWithRetry() {
  const maxDbRetries = 3;
  let dbRetryCount = 0;

  while (dbRetryCount < maxDbRetries) {
    try {
      const connected = await database.connect();
      if (connected) return true;

      dbRetryCount++;
      if (dbRetryCount < maxDbRetries) {
        console.log(`⏳ Database retry ${dbRetryCount}/${maxDbRetries} in 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      dbRetryCount++;
      console.error(`❌ Database connection attempt ${dbRetryCount} failed:`, error.message);

      if (dbRetryCount < maxDbRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  return false;
}

// Database schema validation
async function validateDatabaseSchema() {
  try {
    if (database.connectionType === 'postgresql') {
      const result = await database.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\'');
      console.log(`✅ Database schema validation: ${result.length} tables found`);
    }
  } catch (error) {
    console.warn('⚠️ Schema validation failed:', error.message);
  }
}

// Ensure critical directories exist
async function ensureCriticalDirectories() {
  const fs = require('fs').promises;
  const directories = ['uploads', 'logs'];

  for (const dir of directories) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  }
}

// Post-startup health validation
async function validateServerHealth(port) {
  try {
    const http = require('http');
    const options = {
      hostname: '127.0.0.1',
      port: port,
      path: '/health',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Server health check passed');
      } else {
        console.warn(`⚠️ Health check returned status: ${res.statusCode}`);
      }
    });

    req.on('error', (err) => {
      console.warn('⚠️ Health check failed:', err.message);
    });

    req.setTimeout(5000, () => {
      console.warn('⚠️ Health check timed out');
      req.destroy();
    });

    req.end();
  } catch (error) {
    console.warn('⚠️ Could not perform health check:', error.message);
  }
}

// Enhanced graceful shutdown with cleanup
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    console.log('⚠️ Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  console.log(`\n${signal} received, initiating graceful shutdown...`);

  // Set a timeout for forced shutdown
  const forceShutdownTimer = setTimeout(() => {
    console.error('❌ Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 30000); // 30 seconds max

  try {
    // Stop accepting new connections
    server.close(async () => {
      console.log('🔐 Server stopped accepting new connections');

      try {
        // Close database connections
        if (database && database.close) {
          await database.close();
          console.log('💾 Database connections closed');
        }

        // Close Socket.IO connections
        if (io) {
          io.close();
          console.log('🔌 Socket.IO connections closed');
        }

        clearTimeout(forceShutdownTimer);
        console.log('✅ Graceful shutdown complete');
        process.exit(0);

      } catch (error) {
        console.error('❌ Error during shutdown cleanup:', error.message);
        clearTimeout(forceShutdownTimer);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
    clearTimeout(forceShutdownTimer);
    process.exit(1);
  }
};

// Handle various shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

// Handle worker process messages (for PM2 or similar)
process.on('message', (msg) => {
  if (msg === 'shutdown') {
    gracefulShutdown('IPC:shutdown');
  }
});

startServer();