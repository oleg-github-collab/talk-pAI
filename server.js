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

const db = require('./database');
const aiAssistant = require('./ai-assistant');

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
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Trust proxy for Railway
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again later.'
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

// Auth middleware
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  const nickname = req.headers['x-nickname'];
  
  if (!token || !nickname) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const session = db.validateSession(nickname, token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  
  req.user = { nickname, token };
  next();
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
    
    // Reserved nickname for AI
    if (nickname.toLowerCase() === 'pai' || nickname.toLowerCase() === 'assistant') {
      return res.status(400).json({ error: 'This nickname is reserved' });
    }
    
    // Check if user exists
    const existingUser = db.getUserByNickname(nickname);
    if (existingUser) {
      return res.status(400).json({ error: 'This nickname is already taken' });
    }
    
    // Create user
    const salt = generateSalt();
    const hashedPassword = hashPassword(password, salt);
    const token = generateToken();
    
    db.createUser(nickname, hashedPassword, salt, avatar || '👤');
    db.createSession(nickname, token);
    
    // Add pAI as default contact
    db.addContact(nickname, 'pAI');
    
    // Send welcome message from pAI
    const welcomeMessage = `Hi ${nickname}! 👋 I'm pAI, your personal AI assistant. I can help you with:
    
📝 Summarizing conversations
💡 Answering questions
🎯 Task management
🌐 Language translation
🎨 Creative ideas
    
Just send me a message anytime! You can also send voice messages - I'll transcribe and respond to them.`;
    
    db.createMessage('pAI', nickname, 'text', welcomeMessage);
    
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
    
    const user = db.getUserByNickname(nickname);
    if (!user) {
      return res.status(401).json({ error: 'Invalid nickname or password' });
    }
    
    const hashedInput = hashPassword(password, user.salt);
    if (hashedInput !== user.password) {
      return res.status(401).json({ error: 'Invalid nickname or password' });
    }
    
    const token = generateToken();
    db.createSession(nickname, token);
    db.updateUserActivity(nickname);
    
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
app.post('/api/messages/send', authenticateToken, async (req, res) => {
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
    
    const messageId = db.createMessage(sender, receiver || 'all', type || 'text', content, replyTo);
    
    // Clear typing status
    db.clearTypingStatus(sender);
    
    // Get message details
    const message = db.getMessageById(messageId);
    
    // Emit via Socket.io for real-time delivery
    if (receiver === 'all') {
      io.to('global').emit('newMessage', message);
    } else {
      io.to(`user:${receiver}`).emit('newMessage', message);
      io.to(`user:${sender}`).emit('newMessage', message);
    }
    
    // Handle AI assistant messages
    if (receiver === 'pAI') {
      aiAssistant.processMessage(sender, content, type).then(aiResponse => {
        if (aiResponse) {
          const aiMessageId = db.createMessage('pAI', sender, 'text', aiResponse);
          const aiMessage = db.getMessageById(aiMessageId);
          io.to(`user:${sender}`).emit('newMessage', aiMessage);
        }
      }).catch(console.error);
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
app.get('/api/messages', authenticateToken, (req, res) => {
  try {
    const { lastId = 0, conversation } = req.query;
    const nickname = req.user.nickname;
    
    const messages = conversation 
      ? db.getConversationMessages(nickname, conversation, parseInt(lastId))
      : db.getNewMessages(nickname, parseInt(lastId));
    
    // Mark messages as read
    messages.forEach(msg => {
      if (msg.receiver === nickname && !msg.read) {
        db.markMessageAsRead(msg.id);
      }
    });
    
    const maxId = messages.length > 0 
      ? Math.max(...messages.map(m => m.id))
      : parseInt(lastId);
    
    res.json({
      success: true,
      messages,
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
    const nickname = req.user.nickname;
    
    // Get messages from the specified timeframe
    const messages = db.getConversationHistory(nickname, conversation, hours);
    
    if (messages.length === 0) {
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
app.get('/api/contacts', authenticateToken, (req, res) => {
  try {
    const nickname = req.user.nickname;
    const contacts = db.getContacts(nickname);
    
    // Add online status
    const contactsWithStatus = contacts.map(contact => ({
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
app.post('/api/contacts/add', authenticateToken, (req, res) => {
  try {
    const { contact } = req.body;
    const owner = req.user.nickname;
    
    if (!contact) {
      return res.status(400).json({ error: 'Contact nickname is required' });
    }
    
    // Check if contact exists
    const contactUser = db.getUserByNickname(contact);
    if (!contactUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if already a contact
    const existingContact = db.getContact(owner, contact);
    if (existingContact) {
      return res.status(400).json({ error: 'Already in contacts' });
    }
    
    db.addContact(owner, contact);
    
    // Notify the contact
    const notificationMsg = `${owner} added you to their contacts! 👋`;
    const msgId = db.createMessage('system', contact, 'text', notificationMsg);
    const message = db.getMessageById(msgId);
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    activeUsers: activeUsers.size
  });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Talk pAI server running on port ${PORT}`);
  console.log(`🤖 AI Assistant: ${process.env.OPENAI_API_KEY ? 'Connected' : 'Not configured'}`);
  console.log(`📁 Audio Upload: ${process.env.GAS_AUDIO_UPLOAD_URL ? 'Connected' : 'Not configured'}`);
  db.initialize();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
