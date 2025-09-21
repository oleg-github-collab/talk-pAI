const express = require('express');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const session = require('express-session');
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config();

// Import our enhanced services
const EnhancedAuthService = require('./src/auth/enhanced-auth-service');
const EnhancedChatService = require('./src/chat/enhanced-chat-service');
const WebRTCCallService = require('./src/webrtc/call-service');
const EnhancedAIService = require('./src/ai/enhanced-ai-service');

// Import routes
const enhancedAuthRoutes = require('./src/auth/enhanced-routes');
const { router: enhancedChatRoutes, setChatService } = require('./src/chat/enhanced-routes');

// Create Express app
const app = express();

// Create HTTP/HTTPS server
let server;
if (process.env.NODE_ENV === 'production' && process.env.SSL_CERT && process.env.SSL_KEY) {
    const options = {
        cert: fs.readFileSync(process.env.SSL_CERT),
        key: fs.readFileSync(process.env.SSL_KEY)
    };
    server = https.createServer(options, app);
    console.log('🔒 HTTPS server configured');
} else {
    server = http.createServer(app);
    console.log('🌐 HTTP server configured');
}

// Create Socket.IO instance
const io = socketIo(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Database connection failed:', err);
        process.exit(1);
    } else {
        console.log('✅ Database connected successfully');
        release();
    }
});

// Initialize services
const chatService = new EnhancedChatService(io);
const callService = new WebRTCCallService(io);
const aiService = new EnhancedAIService();

// Set chat service for routes
setChatService(chatService);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            mediaSrc: ["'self'", "blob:"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration for OAuth
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Rate limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 1000 : 10000, // Limit each IP
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

app.use(globalLimiter);

// API rate limiting (more restrictive)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per windowMs
    message: 'Too many API requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: require('./package.json').version
    });
});

// API status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        server: 'Talk pAI Enhanced Server',
        version: '2.0.0',
        features: [
            'Enhanced Authentication with 2FA',
            'Real-time Chat with WebSocket',
            'WebRTC Voice & Video Calls',
            'AI Assistant (GPT-4)',
            'File Management',
            'Enterprise Features',
            'Progressive Web App'
        ],
        endpoints: {
            auth: '/api/auth',
            chat: '/api/chat',
            ai: '/api/ai',
            files: '/api/files',
            admin: '/api/admin'
        }
    });
});

// Enhanced authentication middleware
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ success: false, message: 'Access token required' });
        }

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from database
        const userResult = await pool.query(
            'SELECT * FROM users WHERE id = $1 AND is_active = true',
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }

        req.user = userResult.rows[0];
        next();

    } catch (error) {
        return res.status(403).json({ success: false, message: 'Invalid token' });
    }
};

// Socket.IO authentication middleware
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const userResult = await pool.query(
            'SELECT * FROM users WHERE id = $1 AND is_active = true',
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            return next(new Error('User not found'));
        }

        socket.userId = decoded.userId;
        socket.user = userResult.rows[0];
        next();

    } catch (error) {
        next(new Error('Authentication error'));
    }
});

// Apply API rate limiting to API routes
app.use('/api', apiLimiter);

// Mount route handlers
app.use('/api/auth', enhancedAuthRoutes);
app.use('/api/chat', enhancedChatRoutes);

// AI endpoints
app.post('/api/ai/chat', authenticateToken, async (req, res) => {
    try {
        const { message, chatId, context } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Message is required'
            });
        }

        const result = await aiService.generateResponse({
            userId: req.user.id,
            message,
            chatId,
            context: {
                ...context,
                timezone: req.headers['x-timezone'] || 'UTC',
                userAgent: req.headers['user-agent']
            }
        });

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

app.post('/api/ai/generate-image', authenticateToken, async (req, res) => {
    try {
        const { prompt, size, quality, style } = req.body;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                message: 'Prompt is required'
            });
        }

        const result = await aiService.generateImage({
            prompt,
            userId: req.user.id,
            size,
            quality,
            style
        });

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

app.post('/api/ai/translate', authenticateToken, async (req, res) => {
    try {
        const { text, targetLanguage, sourceLanguage } = req.body;

        if (!text || !targetLanguage) {
            return res.status(400).json({
                success: false,
                message: 'Text and target language are required'
            });
        }

        const result = await aiService.translateText({
            text,
            targetLanguage,
            sourceLanguage,
            userId: req.user.id
        });

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// File upload endpoint
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Store file info in database
        const result = await pool.query(`
            INSERT INTO files (
                original_name, file_name, file_path, file_size,
                mime_type, uploaded_by, storage_provider
            ) VALUES ($1, $2, $3, $4, $5, $6, 'local')
            RETURNING *
        `, [
            req.file.originalname,
            req.file.filename,
            req.file.path,
            req.file.size,
            req.file.mimetype,
            req.user.id
        ]);

        res.json({
            success: true,
            file: {
                id: result.rows[0].id,
                originalName: req.file.originalname,
                filename: req.file.filename,
                size: req.file.size,
                mimeType: req.file.mimetype,
                url: `/uploads/${req.file.filename}`
            }
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Admin endpoints
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
    try {
        if (!req.user.is_admin) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const stats = await Promise.all([
            pool.query('SELECT COUNT(*) as total_users FROM users WHERE is_active = true'),
            pool.query('SELECT COUNT(*) as total_chats FROM chats WHERE is_active = true'),
            pool.query('SELECT COUNT(*) as total_messages FROM messages WHERE created_at >= NOW() - INTERVAL \'24 hours\''),
            pool.query('SELECT COUNT(*) as active_calls FROM call_logs WHERE status IN (\'initiated\', \'answered\') AND started_at >= NOW() - INTERVAL \'1 hour\'')
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers: parseInt(stats[0].rows[0].total_users),
                totalChats: parseInt(stats[1].rows[0].total_chats),
                messagesLast24h: parseInt(stats[2].rows[0].total_messages),
                activeCalls: parseInt(stats[3].rows[0].active_calls)
            }
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.user.nickname} (${socket.id})`);

    // Send welcome message
    socket.emit('welcome', {
        message: 'Connected to Talk pAI Enhanced Server',
        features: [
            'Real-time messaging',
            'Voice & video calls',
            'AI assistance',
            'File sharing',
            'End-to-end encryption'
        ]
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
        console.log(`❌ User disconnected: ${socket.user.nickname} (${reason})`);
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('❌ Unhandled error:', error);

    if (error.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            message: 'File too large'
        });
    }

    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found'
    });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Process terminated');
        pool.end();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🔄 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Process terminated');
        pool.end();
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`
🚀 Talk pAI Enhanced Server Started Successfully!

🌟 Server Details:
   • Environment: ${process.env.NODE_ENV || 'development'}
   • Address: ${process.env.NODE_ENV === 'production' && process.env.SSL_CERT ? 'https' : 'http'}://${HOST}:${PORT}
   • Database: ${process.env.DATABASE_URL ? 'Connected' : 'Local'}
   • WebRTC: Enabled
   • AI Features: ${process.env.OPENAI_API_KEY ? 'Enabled' : 'Disabled'}

🎯 Key Features:
   ✅ Enhanced Authentication (2FA, OAuth)
   ✅ Real-time Chat & Messaging
   ✅ WebRTC Voice & Video Calls
   ✅ AI Assistant (GPT-4)
   ✅ File Management
   ✅ Enterprise Features
   ✅ Progressive Web App
   ✅ End-to-end Security

📚 API Endpoints:
   • Health: /health
   • Auth: /api/auth/*
   • Chat: /api/chat/*
   • AI: /api/ai/*
   • Admin: /api/admin/*

💬 Ready for connections!
    `);
});

module.exports = { app, server, io };