const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

// ✅ CRITICAL: Define PORT — Railway injects it via process.env.PORT
const PORT = process.env.PORT || 3000; // Development default port

// Initialize only writable directories in /tmp for Railway
const fs = require('fs');

function initializeDirectories() {
  try {
    // Use /tmp for writable directories on Railway
    const tmpDir = process.env.NODE_ENV === 'production' ? '/tmp' : '.';
    const dirs = [
      path.join(tmpDir, 'uploads'),
      path.join(tmpDir, 'uploads/images'),
      path.join(tmpDir, 'uploads/audio')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    });

    // Set upload paths for later use
    global.UPLOAD_DIR = path.join(tmpDir, 'uploads');
    global.UPLOAD_IMAGES_DIR = path.join(tmpDir, 'uploads/images');
    global.UPLOAD_AUDIO_DIR = path.join(tmpDir, 'uploads/audio');

  } catch (error) {
    console.warn('⚠️ Could not create directories:', error.message);
    // Fallback: use /tmp directly if mkdir fails
    global.UPLOAD_DIR = '/tmp';
    global.UPLOAD_IMAGES_DIR = '/tmp';
    global.UPLOAD_AUDIO_DIR = '/tmp';
  }
}

initializeDirectories();

const db = require('./database-pg');
const aiAssistant = require('./ai-assistant');
const NewsAgent = require('./news-agent');

// Initialize news agent
const newsAgent = new NewsAgent(db);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Initialize OpenAI
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

// Middleware
// Production-ready security configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
// Static files with caching headers for production
app.use(express.static('public', {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : '0',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Cache static assets aggressively in production
    if (process.env.NODE_ENV === 'production') {
      if (path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        res.set('Cache-Control', 'public, max-age=31536000'); // 1 year
      } else if (path.match(/\.html$/)) {
        res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
      }
    }
  }
}));
// Serve uploads from the correct directory
app.use('/uploads', express.static(global.UPLOAD_DIR));

// Trust proxy for Railway
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

// Production-grade rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Message sending rate limiting
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit to 30 messages per minute
  message: { error: 'Too many messages, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// Socket.io connection management
const socketUsers = new Map();
const activeUsers = new Set();

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  socket.on('authenticate', async (data) => {
    if (data.nickname && data.token) {
      const session = db.validateSession(data.nickname, data.token);
      if (session) {
        socketUsers.set(socket.id, data.nickname);
        activeUsers.add(data.nickname);
        socket.join(`user:${data.nickname}`);
        socket.join('global');
        socket.emit('authenticated', { success: true });
        
        // Update online status
        db.updateUserActivity(data.nickname);
        io.emit('userOnline', { nickname: data.nickname });
        
        // Send unread message count
        const unreadCount = db.getUnreadCount(data.nickname);
        socket.emit('unreadCount', unreadCount);
      } else {
        socket.emit('authenticated', { success: false, error: 'Invalid session' });
      }
    }
  });

  socket.on('typing', (data) => {
    const nickname = socketUsers.get(socket.id);
    if (nickname && data.receiver) {
      db.setTypingStatus(nickname, data.receiver, data.isTyping);
      
      if (data.receiver === 'all') {
        socket.broadcast.to('global').emit('userTyping', {
          sender: nickname,
          receiver: 'all',
          isTyping: data.isTyping
        });
      } else {
        socket.to(`user:${data.receiver}`).emit('userTyping', {
          sender: nickname,
          receiver: data.receiver,
          isTyping: data.isTyping
        });
      }
    }
  });

  socket.on('voiceCall', (data) => {
    const nickname = socketUsers.get(socket.id);
    if (nickname && data.receiver && data.signal) {
      socket.to(`user:${data.receiver}`).emit('incomingCall', {
        caller: nickname,
        signal: data.signal
      });
    }
  });

  socket.on('disconnect', () => {
    const nickname = socketUsers.get(socket.id);
    if (nickname) {
      db.clearTypingStatus(nickname);
      socketUsers.delete(socket.id);
      
      // Check if user has other connections
      let hasOtherConnections = false;
      for (const [_, user] of socketUsers) {
        if (user === nickname) {
          hasOtherConnections = true;
          break;
        }
      }
      
      if (!hasOtherConnections) {
        activeUsers.delete(nickname);
        io.emit('userOffline', { nickname });
      }
    }
  });
});

// Helper functions
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

// In-memory storage for demo when no database
const memoryUsers = new Map();
const memorySessions = new Map();

// Auth middleware
async function authenticateToken(req, res, next) {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    const nickname = req.headers['x-nickname'];

    if (!token || !nickname) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if database is available
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.DB_URL && !process.env.POSTGRESQL_URL) {
      // Use memory storage for demo
      const sessionKey = `${nickname}:${token}`;
      if (!memorySessions.has(sessionKey)) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }

      req.user = { nickname, token };
      next();
      return;
    }

    const session = await db.validateSession(nickname, token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.user = { nickname, token };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

// API Routes

// Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nickname, password, avatar } = req.body;

    if (!nickname || !password) {
      return res.status(400).json({ error: 'Nickname and password are required' });
    }
    
    if (nickname.length < 3 || nickname.length > 30) {
      return res.status(400).json({ error: 'Nickname must be 3-30 characters' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Reserved nicknames for AI agents
    const reservedNames = ['pai', 'assistant', 'sage', 'bot', 'system', 'admin'];
    if (reservedNames.includes(nickname.toLowerCase())) {
      return res.status(400).json({ error: 'This nickname is reserved' });
    }
    
    // Check if database is available
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.DB_URL && !process.env.POSTGRESQL_URL) {
      // Use memory storage for demo
      if (memoryUsers.has(nickname)) {
        return res.status(400).json({ error: 'This nickname is already taken' });
      }

      const salt = generateSalt();
      const hashedPassword = hashPassword(password, salt);
      const token = generateToken();

      // Store user in memory
      memoryUsers.set(nickname, {
        nickname,
        password: hashedPassword,
        salt,
        avatar: avatar || '👤'
      });

      // Create session
      const sessionKey = `${nickname}:${token}`;
      memorySessions.set(sessionKey, {
        nickname,
        token,
        createdAt: new Date()
      });

      return res.json({
        success: true,
        message: 'Registration successful',
        user: { nickname, avatar: avatar || '👤', token },
        demo: true
      });
    }

    // Database version
    const existingUser = await db.getUserByNickname(nickname);
    if (existingUser) {
      return res.status(400).json({ error: 'This nickname is already taken' });
    }

    // Create user
    const salt = generateSalt();
    const hashedPassword = hashPassword(password, salt);
    const token = generateToken();

    await db.createUser(nickname, hashedPassword, salt, avatar || '👤');
    await db.createSession(nickname, token, req.get('User-Agent'), req.ip);

    // Add pAI and Sage as default contacts
    await db.addContact(nickname, 'pAI');
    await db.addContact(nickname, 'Sage');
    
    // Send welcome messages from pAI and Sage
    const paiWelcomeMessage = `Hi ${nickname}! 👋 I'm pAI, your personal AI assistant. I can help you with:

📝 Summarizing conversations
💡 Answering questions
🎯 Task management
🌐 Language translation
🎨 Creative ideas

🔮 **Coming Soon:** Create your own custom AI agents for specialized tasks!

Just send me a message anytime! You can also send voice messages - I'll transcribe and respond to them.`;

    const sageWelcomeMessage = `📰 Hello ${nickname}! I'm Sage, your intelligent news assistant.

I can provide you with personalized news briefings from hundreds of trusted sources. Just tell me what interests you:

📱 Technology • 💼 Business • 🌍 World News
🧬 Science • ⚕️ Health • 🎬 Entertainment

Say something like "Subscribe me to daily tech news" or "Give me the latest headlines" to get started!

🗞️ Stay informed, stay ahead. Let's make news personal.`;

    await db.createMessage('pAI', nickname, 'text', paiWelcomeMessage);
    await db.createMessage('Sage', nickname, 'text', sageWelcomeMessage);
    
    res.json({
      success: true,
      nickname,
      avatar: avatar || '👤',
      theme: 'auto',
      token,
      message: '🎉 Welcome to Talk pAI!'
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { nickname, password } = req.body;

    if (!nickname || !password) {
      return res.status(400).json({ error: 'Nickname and password are required' });
    }

    // Check if database is available
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.DB_URL && !process.env.POSTGRESQL_URL) {
      // Use memory storage for demo
      const user = memoryUsers.get(nickname);
      if (!user) {
        return res.status(401).json({ error: 'Invalid nickname or password' });
      }

      const hashedInput = hashPassword(password, user.salt);
      if (hashedInput !== user.password) {
        return res.status(401).json({ error: 'Invalid nickname or password' });
      }

      const token = generateToken();
      const sessionKey = `${nickname}:${token}`;
      memorySessions.set(sessionKey, {
        nickname,
        token,
        createdAt: new Date()
      });

      return res.json({
        success: true,
        nickname: user.nickname,
        avatar: user.avatar || '👤',
        theme: 'auto',
        token,
        message: '🔐 Welcome back!',
        demo: true
      });
    }

    // Database version
    const user = await db.getUserByNickname(nickname);
    if (!user) {
      return res.status(401).json({ error: 'Invalid nickname or password' });
    }

    const hashedInput = hashPassword(password, user.salt);
    if (hashedInput !== user.password) {
      return res.status(401).json({ error: 'Invalid nickname or password' });
    }

    const token = generateToken();
    await db.createSession(nickname, token, req.get('User-Agent'), req.ip);
    await db.updateLastSeen(nickname);

    res.json({
      success: true,
      nickname: user.nickname,
      avatar: user.avatar || '👤',
      theme: user.theme || 'auto',
      token,
      message: '🔐 Welcome back!'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Keep alive
app.post('/api/auth/keepalive', authenticateToken, (req, res) => {
  try {
    const { nickname } = req.user;
    const newToken = generateToken();
    
    db.createSession(nickname, newToken);
    db.updateUserActivity(nickname);
    
    res.json({
      success: true,
      renewed: true,
      token: newToken
    });
  } catch (error) {
    console.error('Keep alive error:', error);
    res.status(500).json({ error: 'Session renewal failed' });
  }
});

// Send message
app.post('/api/messages/send', messageLimiter, authenticateToken, async (req, res) => {
  try {
    const { receiver, type, content, replyTo } = req.body;
    const sender = req.user.nickname;
    
    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    // Check if user has permission to send to receiver
    if (receiver !== 'all' && receiver !== 'pAI') {
      const contact = db.getContact(sender, receiver);
      if (!contact) {
        return res.status(403).json({ error: 'You can only message your contacts' });
      }
    }
    
    let messageId;
    let message;

    // Check if database is available
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.DB_URL && !process.env.POSTGRESQL_URL) {
      // Demo mode - create a mock message
      messageId = Date.now();
      message = {
        id: messageId,
        sender,
        receiver: receiver || 'all',
        type: type || 'text',
        content,
        timestamp: new Date().toISOString(),
        read: false,
        reply_to: replyTo
      };
    } else {
      try {
        messageId = await db.createMessage(sender, receiver || 'all', type || 'text', content, replyTo);
      } catch (dbError) {
        console.error('Error creating message:', dbError);
        return res.status(500).json({ error: 'Failed to create message' });
      }
    }
    
    // Clear typing status
    db.clearTypingStatus(sender);
    
    // Get message details (if not already created in demo mode)
    if (!message) {
      try {
        message = await db.getMessageById(messageId);
      } catch (dbError) {
        console.error('Error retrieving message:', dbError);
        return res.status(500).json({ error: 'Failed to retrieve message' });
      }
    }
    
    // Emit via Socket.io for real-time delivery
    if (receiver === 'all') {
      io.to('global').emit('newMessage', message);
    } else {
      io.to(`user:${receiver}`).emit('newMessage', message);
      io.to(`user:${sender}`).emit('newMessage', message);
    }
    
    // Handle AI assistant messages
    if (receiver === 'pAI') {
      // Show AI typing indicator
      io.to(`user:${sender}`).emit('userTyping', {
        sender: 'pAI',
        receiver: sender,
        isTyping: true
      });

      aiAssistant.processMessage(sender, content, type).then(async aiResponse => {
        // Hide AI typing indicator
        io.to(`user:${sender}`).emit('userTyping', {
          sender: 'pAI',
          receiver: sender,
          isTyping: false
        });

        if (aiResponse) {
          try {
            const aiMessageId = await db.createMessage('pAI', sender, 'text', aiResponse);
            const aiMessage = await db.getMessageById(aiMessageId);
            if (aiMessage) {
              io.to(`user:${sender}`).emit('newMessage', aiMessage);
            }
          } catch (dbError) {
            console.error('Error saving AI message:', dbError);
          }
        }
      }).catch(error => {
        console.error('AI Assistant error:', error);
        // Hide AI typing indicator on error
        io.to(`user:${sender}`).emit('userTyping', {
          sender: 'pAI',
          receiver: sender,
          isTyping: false
        });
      });
    }

    // Handle Sage news agent messages
    if (receiver === 'Sage') {
      // Show Sage typing indicator
      io.to(`user:${sender}`).emit('userTyping', {
        sender: 'Sage',
        receiver: sender,
        isTyping: true
      });

      newsAgent.processNewsInteraction(sender, content).then(async newsResponse => {
        // Hide Sage typing indicator
        io.to(`user:${sender}`).emit('userTyping', {
          sender: 'Sage',
          receiver: sender,
          isTyping: false
        });

        if (newsResponse) {
          try {
            const newsMessageId = await db.createMessage('Sage', sender, 'text', newsResponse);
            const newsMessage = await db.getMessageById(newsMessageId);
            if (newsMessage) {
              io.to(`user:${sender}`).emit('newMessage', newsMessage);
            }
          } catch (dbError) {
            console.error('Error saving Sage message:', dbError);
          }
        }
      }).catch(error => {
        console.error('Sage News Agent error:', error);
        // Hide Sage typing indicator on error
        io.to(`user:${sender}`).emit('userTyping', {
          sender: 'Sage',
          receiver: sender,
          isTyping: false
        });
      });
    }
    
    res.json({
      success: true,
      id: messageId,
      timestamp: message.timestamp
    });
    
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get messages
app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { lastId = 0, conversation } = req.query;
    const nickname = req.user?.nickname;

    if (!nickname) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    let messages;

    // Check if database is available
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.DB_URL && !process.env.POSTGRESQL_URL) {
      // Return empty messages for demo mode
      messages = [];
    } else {
      try {
        messages = conversation
          ? await db.getConversationMessages(nickname, conversation, parseInt(lastId))
          : await db.getNewMessages(nickname, parseInt(lastId));
      } catch (dbError) {
        console.error('Database query error in /api/messages:', dbError);
        return res.status(500).json({ error: 'Database error' });
      }
    }

    // Ensure messages is an array and mark messages as read
    const messageArray = Array.isArray(messages) ? messages : [];
    for (const msg of messageArray) {
      if (msg.receiver === nickname && !msg.read) {
        // Skip marking as read in demo mode
        if (process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DB_URL || process.env.POSTGRESQL_URL) {
          try {
            await db.markMessageAsRead(msg.id);
          } catch (markError) {
            console.error('Error marking message as read:', markError);
            // Continue processing other messages
          }
        }
      }
    }

    const maxId = messageArray.length > 0
      ? Math.max(...messageArray.map(m => m.id))
      : parseInt(lastId);
    
    res.json({
      success: true,
      messages: messageArray,
      lastId: maxId
    });
    
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

// Summarize conversation
app.post('/api/messages/summarize', authenticateToken, async (req, res) => {
  try {
    const { conversation, hours = 24 } = req.body;
    const nickname = req.user?.nickname;

    if (!nickname || !conversation) {
      return res.status(400).json({ error: 'Nickname and conversation are required' });
    }
    
    // Get messages from the specified timeframe
    let messages;
    try {
      messages = await db.getConversationHistory(nickname, conversation, hours);
    } catch (dbError) {
      console.error('Database error in summarize:', dbError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!messages || messages.length === 0) {
      return res.json({ 
        success: true, 
        summary: 'No messages found in the specified timeframe.' 
      });
    }
    
    // Use AI to summarize
    const summary = await aiAssistant.summarizeConversation(messages);
    
    res.json({
      success: true,
      summary,
      messageCount: messages.length
    });
    
  } catch (error) {
    console.error('Summarize error:', error);
    res.status(500).json({ error: 'Failed to summarize conversation' });
  }
});

// Get typing users
app.get('/api/typing', authenticateToken, (req, res) => {
  try {
    const { receiver = 'all' } = req.query;
    const nickname = req.user.nickname;
    
    const typingUsers = db.getTypingUsers(receiver, nickname);
    
    res.json({
      success: true,
      typing: typingUsers
    });
    
  } catch (error) {
    console.error('Get typing error:', error);
    res.status(500).json({ error: 'Failed to get typing status' });
  }
});

// Get contacts
app.get('/api/contacts', authenticateToken, async (req, res) => {
  try {
    const nickname = req.user.nickname;

    // Check if database is available
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.DB_URL && !process.env.POSTGRESQL_URL) {
      // Return default contacts when database is not available
      const defaultContacts = [
        {
          nickname: 'pAI',
          avatar: '🤖',
          display_name: 'pAI Assistant',
          custom_name: null,
          group_name: 'AI Assistants',
          blocked: false,
          muted: false,
          favorite: true,
          last_seen: new Date(),
          online: true
        },
        {
          nickname: 'Sage',
          avatar: '📰',
          display_name: 'Sage News Agent',
          custom_name: null,
          group_name: 'AI Assistants',
          blocked: false,
          muted: false,
          favorite: true,
          last_seen: new Date(),
          online: true
        }
      ];

      return res.json({
        success: true,
        contacts: defaultContacts
      });
    }

    const contacts = await db.getContacts(nickname);

    // Ensure contacts is an array
    const contactsArray = Array.isArray(contacts) ? contacts : [];

    // Add online status
    const contactsWithStatus = contactsArray.map(contact => ({
      ...contact,
      online: activeUsers.has(contact.nickname),
      lastSeen: contact.lastSeen
    }));

    res.json({
      success: true,
      contacts: contactsWithStatus
    });

  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to get contacts' });
  }
});

// Search users
app.get('/api/users/search', authenticateToken, (req, res) => {
  try {
    const { query } = req.query;
    const currentUser = req.user.nickname;
    
    if (!query || query.length < 2) {
      return res.json({ success: true, users: [] });
    }
    
    const users = db.searchUsers(query, currentUser);
    
    // Add online status
    const usersWithStatus = users.map(user => ({
      ...user,
      online: activeUsers.has(user.nickname)
    }));
    
    res.json({
      success: true,
      users: usersWithStatus
    });
    
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Add contact
app.post('/api/contacts/add', authenticateToken, async (req, res) => {
  try {
    const { contact, customName, groupName } = req.body;
    const owner = req.user.nickname;

    if (!contact) {
      return res.status(400).json({ error: 'Contact nickname is required' });
    }

    // Check if contact exists
    const contactUser = await db.getUserByNickname(contact);
    if (!contactUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already a contact
    const existingContact = await db.getContact(owner, contact);
    if (existingContact) {
      return res.status(400).json({ error: 'Already in contacts' });
    }

    await db.addContact(owner, contact, customName || null, groupName || 'General');
    
    // Notify the contact
    const notificationMsg = `${owner} added you to their contacts! 👋`;
    const msgId = await db.createMessage('system', contact, 'text', notificationMsg);
    const message = await db.getMessageById(msgId);
    io.to(`user:${contact}`).emit('newMessage', message);
    
    res.json({
      success: true,
      message: `✅ ${contact} added to contacts!`
    });
    
  } catch (error) {
    console.error('Add contact error:', error);
    res.status(500).json({ error: 'Failed to add contact' });
  }
});

// Upload audio to Google Apps Script
app.post('/api/upload/audio', authenticateToken, async (req, res) => {
  try {
    const { audioData } = req.body;
    const nickname = req.user.nickname;
    
    if (!audioData) {
      return res.status(400).json({ error: 'No audio data provided' });
    }
    
    // Send to Google Apps Script endpoint
    const gasUrl = process.env.GAS_AUDIO_UPLOAD_URL;
    if (!gasUrl) {
      return res.status(500).json({ error: 'Audio upload service not configured' });
    }
    
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioData,
        nickname,
        timestamp: Date.now()
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to upload audio');
    }
    
    const result = await response.json();
    
    res.json({
      success: true,
      url: result.url
    });
    
  } catch (error) {
    console.error('Upload audio error:', error);
    res.status(500).json({ error: 'Failed to upload audio' });
  }
});

// Upload image (local storage)
app.post('/api/upload/image', authenticateToken, async (req, res) => {
  try {
    const { imageData } = req.body;
    const nickname = req.user.nickname;
    
    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }
    
    // Extract base64 data
    const base64Data = imageData.split(',')[1];
    if (!base64Data) {
      return res.status(400).json({ error: 'Invalid image format' });
    }
    
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Check file size (10MB limit)
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large (max 10MB)' });
    }
    
    // Save locally
    const fs = require('fs').promises;
    const filename = `${nickname}_${Date.now()}.jpg`;
    const filepath = path.join(__dirname, 'uploads', 'images', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, buffer);
    
    res.json({
      success: true,
      url: `/uploads/images/${filename}`
    });
    
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Transcribe audio
app.post('/api/transcribe', authenticateToken, async (req, res) => {
  try {
    const { audioUrl } = req.body;
    
    if (!audioUrl) {
      return res.status(400).json({ error: 'Audio URL required' });
    }
    
    // Download audio from URL
    const audioResponse = await fetch(audioUrl);
    const audioBuffer = await audioResponse.arrayBuffer();
    
    if (!openai) {
      return res.status(503).json({ error: 'Transcription service unavailable - OpenAI API not configured' });
    }

    // Use OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' }),
      model: 'whisper-1',
      language: 'en'
    });
    
    res.json({
      success: true,
      text: transcription.text
    });
    
  } catch (error) {
    console.error('Transcribe error:', error);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

// Update user settings
app.put('/api/users/settings', authenticateToken, async (req, res) => {
  try {
    const { avatar, theme, notifications } = req.body;
    const nickname = req.user.nickname;

    db.updateUserSettings(nickname, { avatar, theme, notifications });

    res.json({
      success: true,
      message: 'Settings updated'
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// News API Routes

// Get news sources
app.get('/api/news/sources', authenticateToken, (req, res) => {
  try {
    const sources = newsAgent.getAvailableSources();
    res.json({
      success: true,
      sources
    });
  } catch (error) {
    console.error('Get news sources error:', error);
    res.status(500).json({ error: 'Failed to get news sources' });
  }
});

// Subscribe to news
app.post('/api/news/subscribe', authenticateToken, async (req, res) => {
  try {
    const { categories, frequency, language, maxArticles, sources } = req.body;
    const nickname = req.user.nickname;

    const preferences = {
      categories: categories || ['technology'],
      frequency: frequency || 'daily',
      language: language || 'en',
      maxArticles: maxArticles || 5,
      sources: sources || []
    };

    const result = newsAgent.subscribeUser(nickname, preferences);

    res.json(result);
  } catch (error) {
    console.error('News subscription error:', error);
    res.status(500).json({ error: 'Failed to subscribe to news' });
  }
});

// Get user news preferences
app.get('/api/news/preferences', authenticateToken, async (req, res) => {
  try {
    const nickname = req.user.nickname;
    const preferences = db.getUserNewsPreferences(nickname);

    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('Get news preferences error:', error);
    res.status(500).json({ error: 'Failed to get news preferences' });
  }
});

// Get latest news
app.get('/api/news/latest', authenticateToken, async (req, res) => {
  try {
    const { category, limit = 5 } = req.query;
    const nickname = req.user.nickname;

    let categories = ['technology']; // default
    if (category) {
      categories = [category];
    } else {
      const userPrefs = db.getUserNewsPreferences(nickname);
      if (userPrefs && userPrefs.categories) {
        categories = userPrefs.categories;
      }
    }

    const allArticles = [];
    for (const cat of categories) {
      const articles = await newsAgent.fetchNews(cat, 3);
      allArticles.push(...articles);
    }

    // Sort by date and limit
    const recentArticles = allArticles
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      articles: recentArticles,
      count: recentArticles.length
    });
  } catch (error) {
    console.error('Get latest news error:', error);
    res.status(500).json({ error: 'Failed to get latest news' });
  }
});

// Get news summary
app.get('/api/news/summary', authenticateToken, async (req, res) => {
  try {
    const { category, limit = 5 } = req.query;
    const nickname = req.user.nickname;

    let categories = ['technology']; // default
    if (category) {
      categories = [category];
    } else {
      const userPrefs = db.getUserNewsPreferences(nickname);
      if (userPrefs && userPrefs.categories) {
        categories = userPrefs.categories;
      }
    }

    const allArticles = [];
    for (const cat of categories) {
      const articles = await newsAgent.fetchNews(cat, 3);
      allArticles.push(...articles);
    }

    const recentArticles = allArticles
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, parseInt(limit));

    const userPrefs = db.getUserNewsPreferences(nickname) || { language: 'en' };
    const summary = await newsAgent.generateNewsSummary(recentArticles, userPrefs.language, userPrefs);

    res.json({
      success: true,
      summary,
      articleCount: recentArticles.length
    });
  } catch (error) {
    console.error('Get news summary error:', error);
    res.status(500).json({ error: 'Failed to generate news summary' });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  console.log('✅ Health check called');

  let dbStatus = 'unknown';
  try {
    if (process.env.DATABASE_URL && pool) {
      await db.query('SELECT 1');
      dbStatus = 'connected';
    } else {
      dbStatus = 'not_configured';
    }
  } catch (error) {
    dbStatus = 'error';
  }

  res.status(200).json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    activeUsers: activeUsers.size,
    memory: process.memoryUsage(),
    database: dbStatus,
    version: require('./package.json').version
  });
});

// Ready check for Railway
app.get('/ready', (req, res) => {
  console.log('🚀 Ready check called');
  res.status(200).json({
    status: 'ready',
    port: PORT,
    timestamp: Date.now()
  });
});

// Update contact info
app.put('/api/contacts/:contact', authenticateToken, async (req, res) => {
  try {
    const { contact } = req.params;
    const { customName, groupName, favorite } = req.body;
    const owner = req.user.nickname;

    const result = await db.updateContactInfo(owner, contact, customName, groupName, favorite);

    if (!result) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({
      success: true,
      contact: result
    });

  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// Get contact groups
app.get('/api/contacts/groups', authenticateToken, async (req, res) => {
  try {
    const owner = req.user.nickname;
    const groups = await db.getContactGroups(owner);

    res.json({
      success: true,
      groups
    });

  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to get contact groups' });
  }
});

// Get contacts by group
app.get('/api/contacts/groups/:groupName', authenticateToken, async (req, res) => {
  try {
    const { groupName } = req.params;
    const owner = req.user.nickname;

    const contacts = await db.getContactsByGroup(owner, decodeURIComponent(groupName));

    res.json({
      success: true,
      contacts,
      groupName
    });

  } catch (error) {
    console.error('Get contacts by group error:', error);
    res.status(500).json({ error: 'Failed to get contacts by group' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server - Railway expects only PORT, no host binding
// === ПОТУЖНІ API ENDPOINTS ДЛЯ УПРАВЛІННЯ КОНТАКТАМИ ===

// Update contact with advanced features
app.put('/api/contacts/update', authenticateToken, async (req, res) => {
  try {
    const owner = req.user.nickname;
    const { contact, customName, groupName, favorite } = req.body;

    if (!contact) {
      return res.status(400).json({ error: 'Contact nickname is required' });
    }

    // Check if we have database available
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.DB_URL && !process.env.POSTGRESQL_URL) {
      return res.json({ success: true, message: 'Contact updated (demo mode)' });
    }

    const updatedContact = await db.updateContactInfo(owner, contact, customName, groupName, favorite);

    if (updatedContact) {
      res.json({
        success: true,
        message: `Updated contact ${customName || contact}`,
        contact: updatedContact
      });
    } else {
      res.status(404).json({ error: 'Contact not found' });
    }
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// Remove contact
app.delete('/api/contacts/remove', authenticateToken, async (req, res) => {
  try {
    const owner = req.user.nickname;
    const { contact } = req.body;

    if (!contact) {
      return res.status(400).json({ error: 'Contact nickname is required' });
    }

    // Check if we have database available
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.DB_URL && !process.env.POSTGRESQL_URL) {
      return res.json({ success: true, message: 'Contact removed (demo mode)' });
    }

    const result = await db.query(
      'DELETE FROM contacts WHERE owner = $1 AND contact = $2',
      [owner, contact]
    );

    res.json({
      success: true,
      message: `Removed contact ${contact}`
    });
  } catch (error) {
    console.error('Remove contact error:', error);
    res.status(500).json({ error: 'Failed to remove contact' });
  }
});

// Get contacts by group
app.get('/api/contacts/groups/:groupName', authenticateToken, async (req, res) => {
  try {
    const owner = req.user.nickname;
    const { groupName } = req.params;

    // Check if we have database available
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.DB_URL && !process.env.POSTGRESQL_URL) {
      const defaultContacts = [
        { nickname: 'pAI', avatar: '🤖', display_name: 'pAI Assistant', group_name: 'Favorites', favorite: true },
        { nickname: 'Sage', avatar: '📰', display_name: 'Sage News Agent', group_name: 'Work', favorite: false }
      ].filter(c => c.group_name === groupName);

      return res.json({ success: true, contacts: defaultContacts });
    }

    const contacts = await db.getContactsByGroup(owner, groupName);

    res.json({
      success: true,
      contacts: contacts || []
    });
  } catch (error) {
    console.error('Get contacts by group error:', error);
    res.status(500).json({ error: 'Failed to get contacts by group' });
  }
});

// Get all contact groups
app.get('/api/contacts/groups', authenticateToken, async (req, res) => {
  try {
    const owner = req.user.nickname;

    // Check if we have database available
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.DB_URL && !process.env.POSTGRESQL_URL) {
      return res.json({
        success: true,
        groups: [
          { group_name: 'Favorites', count: 1 },
          { group_name: 'Work', count: 1 },
          { group_name: 'General', count: 0 }
        ]
      });
    }

    const groups = await db.getContactGroups(owner);

    res.json({
      success: true,
      groups: groups || []
    });
  } catch (error) {
    console.error('Get contact groups error:', error);
    res.status(500).json({ error: 'Failed to get contact groups' });
  }
});

// Export contacts
app.get('/api/contacts/export', authenticateToken, async (req, res) => {
  try {
    const owner = req.user.nickname;

    // Check if we have database available
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.DB_URL && !process.env.POSTGRESQL_URL) {
      const exportData = {
        contacts: [
          { nickname: 'pAI', avatar: '🤖', display_name: 'pAI Assistant', group_name: 'Favorites' },
          { nickname: 'Sage', avatar: '📰', display_name: 'Sage News Agent', group_name: 'Work' }
        ],
        groups: ['Favorites', 'Work', 'General'],
        exportDate: new Date().toISOString(),
        version: '2.0'
      };

      res.setHeader('Content-Disposition', `attachment; filename="talk-pai-contacts-${new Date().toISOString().split('T')[0]}.json"`);
      res.setHeader('Content-Type', 'application/json');
      return res.json(exportData);
    }

    const contacts = await db.getContacts(owner);
    const groups = await db.getContactGroups(owner);

    const exportData = {
      contacts: contacts || [],
      groups: (groups || []).map(g => g.group_name),
      exportDate: new Date().toISOString(),
      version: '2.0'
    };

    res.setHeader('Content-Disposition', `attachment; filename="talk-pai-contacts-${new Date().toISOString().split('T')[0]}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exportData);
  } catch (error) {
    console.error('Export contacts error:', error);
    res.status(500).json({ error: 'Failed to export contacts' });
  }
});

// Search contacts with advanced filtering
app.get('/api/contacts/search', authenticateToken, async (req, res) => {
  try {
    const owner = req.user.nickname;
    const { q: query, group, favorite } = req.query;

    // Check if we have database available
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.DB_URL && !process.env.POSTGRESQL_URL) {
      let contacts = [
        { nickname: 'pAI', avatar: '🤖', display_name: 'pAI Assistant', group_name: 'Favorites', favorite: true },
        { nickname: 'Sage', avatar: '📰', display_name: 'Sage News Agent', group_name: 'Work', favorite: false }
      ];

      // Filter by query
      if (query) {
        contacts = contacts.filter(c =>
          c.nickname.toLowerCase().includes(query.toLowerCase()) ||
          c.display_name.toLowerCase().includes(query.toLowerCase()) ||
          c.group_name.toLowerCase().includes(query.toLowerCase())
        );
      }

      // Filter by group
      if (group) {
        contacts = contacts.filter(c => c.group_name === group);
      }

      // Filter by favorite
      if (favorite === 'true') {
        contacts = contacts.filter(c => c.favorite);
      }

      return res.json({ success: true, contacts });
    }

    // Build dynamic query based on filters
    let queryText = `
      SELECT u.nickname, u.avatar, u.last_seen,
             c.custom_name, c.group_name, c.blocked, c.muted, c.favorite,
             COALESCE(c.custom_name, u.nickname) as display_name
      FROM contacts c
      JOIN users u ON c.contact = u.nickname
      WHERE c.owner = $1
    `;

    const queryParams = [owner];
    let paramIndex = 2;

    // Add search filter
    if (query) {
      queryText += ` AND (u.nickname ILIKE $${paramIndex} OR c.custom_name ILIKE $${paramIndex} OR c.group_name ILIKE $${paramIndex})`;
      queryParams.push(`%${query}%`);
      paramIndex++;
    }

    // Add group filter
    if (group) {
      queryText += ` AND c.group_name = $${paramIndex}`;
      queryParams.push(group);
      paramIndex++;
    }

    // Add favorite filter
    if (favorite === 'true') {
      queryText += ' AND c.favorite = true';
    }

    queryText += ' ORDER BY c.favorite DESC, display_name';

    const result = await db.query(queryText, queryParams);

    res.json({
      success: true,
      contacts: result.rows || []
    });
  } catch (error) {
    console.error('Search contacts error:', error);
    res.status(500).json({ error: 'Failed to search contacts' });
  }
});

server.listen(PORT, async () => {
  console.log(`🚀 Talk pAI server running on port ${PORT}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
  console.log(`🤖 AI Assistant: ${process.env.OPENAI_API_KEY ? 'Connected' : 'Not configured'}`);
  console.log(`📁 Audio Upload: ${process.env.GAS_AUDIO_UPLOAD_URL ? 'Connected' : 'Not configured'}`);

  // Initialize database after server is ready
  try {
    await db.initialize();
    console.log('🗄️ Database ready');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    db.close();
    process.exit(0);
  });
});