# Talk pAI 🚀

**Enterprise AI-Powered Messenger** - Advanced real-time communication platform with intelligent AI companion **Aiden**, built on GPT-4o technology.

![Talk pAI Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ Features

### 🤖 AI Companion - **Aiden**
- **GPT-4o powered** intelligent conversation partner
- **Contextual memory** that remembers your preferences and conversation history
- **Multi-domain expertise** in technology, business, creativity, and more
- **Adaptive communication** style that learns from your interactions
- **Real-time responses** with typing indicators and presence awareness

### 💬 Enterprise Messaging
- **Real-time chat** with WebSocket support
- **Workspaces and Teams** like Slack/Microsoft Teams
- **Channels and Groups** with granular permissions
- **File sharing** and multimedia messages
- **Message reactions** and threaded conversations

### 🔍 Intelligent Search
- **Real-time user search** with instant suggestions
- **Full-text message search** with relevance ranking
- **Smart filtering** by workspace, team, or channel
- **Advanced search operators** for power users

### 📱 Mobile-First Design
- **Responsive UI** that works perfectly on any device
- **Progressive Web App** capabilities
- **Touch-optimized** interface with smooth animations
- **Dark/Light theme** support

### 🏢 Enterprise Features
- **Organization management** with multi-workspace support
- **Role-based permissions** (Owner, Admin, Moderator, Member, Guest)
- **Audit trails** with comprehensive logging
- **Team management** with flexible assignment
- **Integration ready** for external services

### ⚡ Performance & Reliability
- **Optimized database** with PostgreSQL and connection pooling
- **Rate limiting** to prevent abuse
- **Health monitoring** with detailed metrics
- **Graceful error handling** with retry logic

## 🚀 Railway.app Deployment

Talk pAI is optimized for one-click deployment on Railway.app with automatic PostgreSQL integration.

### Quick Deploy

1. **Fork this repository**
2. **Deploy to Railway:**
   - Connect your GitHub repo to Railway
   - Add PostgreSQL service in Railway dashboard
   - Set environment variables:
     ```
     OPENAI_API_KEY=your-openai-api-key
     JWT_SECRET=your-secure-jwt-secret
     ```
3. **Deploy automatically!**

Railway will automatically:
- Set PORT to 8080
- Provide DATABASE_URL for PostgreSQL
- Build and deploy your application
- Create database tables on first run

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | **Yes** | Your OpenAI API key for Aiden |
| `JWT_SECRET` | **Yes** | Secret key for JWT authentication |
| `DATABASE_URL` | Auto | PostgreSQL connection (Railway auto-provides) |
| `LOG_LEVEL` | No | Logging level (default: info) |

## 💻 Local Development

```bash
# Clone repository
git clone https://github.com/your-username/talk-pai.git
cd talk-pai

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your OPENAI_API_KEY

# Start development server
npm run dev
```

## 🤖 Using Aiden AI Companion

Aiden is your intelligent AI companion with advanced conversation capabilities:

### Chat with Aiden
```bash
POST /api/aiden/chat
{
  "message": "Help me debug this JavaScript function",
  "context": {
    "workspace": "development",
    "currentTask": "fixing authentication bug"
  }
}
```

### Get Aiden's Status
```bash
GET /api/aiden/status
```

### View Conversation History
```bash
GET /api/aiden/history?limit=20
```

## 🔧 Key API Endpoints

### Authentication
```bash
POST /api/auth/register  # Register new user
POST /api/auth/login     # Login user
GET  /api/auth/me        # Get current user
```

### Chat & Messaging
```bash
GET  /api/chat/chats     # Get user's chats
POST /api/chat/message   # Send message
GET  /api/chat/messages/:chatId  # Get chat messages
```

### Real-time Search
```bash
GET /api/search/users/suggestions?q=john  # Search users
GET /api/search/messages?q=project        # Search messages
GET /api/search/global?q=meeting          # Global search
```

### Enterprise Features
```bash
GET  /api/enterprise/workspaces           # Get workspaces
POST /api/enterprise/workspaces           # Create workspace
GET  /api/enterprise/workspaces/:id/teams # Get teams
```

## 🎯 Real-time Features

### WebSocket Events
```javascript
// Connect and authenticate
const socket = io();
socket.emit('authenticate', { userId, nickname, token });

// Join chat
socket.emit('join_chat', { chatId, userId });

// Typing indicators
socket.emit('typing_start', { chatId, userId });
socket.emit('typing_stop', { chatId, userId });

// Message reactions
socket.emit('message_reaction', { messageId, chatId, reaction });

// Presence updates
socket.emit('presence_update', { status: 'away', customMessage });
```

## 🏗️ Architecture

```
talk-pai/
├── src/
│   ├── ai/
│   │   ├── aiden-companion.js     # AI Companion core
│   │   ├── aiden-routes.js        # Aiden API endpoints
│   │   └── service.js             # General AI services
│   ├── enterprise/
│   │   ├── workspace-service.js   # Workspace management
│   │   ├── team-service.js        # Team management
│   │   └── permission-service.js  # Access control
│   ├── search/
│   │   └── service.js             # Advanced search
│   ├── database/
│   │   └── optimized-connection.js # PostgreSQL pool
│   └── utils/
│       └── enhanced-logger.js      # Structured logging
├── public/
│   ├── js/
│   │   ├── components.js          # UI components
│   │   └── real-time.js           # WebSocket client
│   └── css/
│       └── mobile-responsive.css  # Mobile-first styles
├── database/
│   └── schema.sql                 # Enterprise database schema
├── server.js                      # Main application
└── nixpacks.toml                  # Railway deployment config
```

## 🔒 Security

- JWT authentication with secure sessions
- Rate limiting on all endpoints
- Input validation and sanitization
- SQL injection protection
- XSS protection with CSP headers
- Bcrypt password hashing

## 📊 Monitoring

- Comprehensive structured logging
- Health checks at `/health` and `/ready`
- Performance monitoring with metrics
- Database connection pool monitoring
- Real-time connection tracking

## 🌟 What Makes Talk pAI Special

1. **Aiden AI Companion** - Not just a chatbot, but an intelligent partner that remembers, learns, and adapts
2. **Enterprise-Ready** - Full workspace, team, and permission management
3. **Mobile-First** - Beautiful, responsive design that works everywhere
4. **Real-time Everything** - Typing indicators, presence, reactions, all in real-time
5. **Intelligent Search** - Find anything, anywhere, with AI-powered relevance
6. **Railway Optimized** - Deploy in minutes, scale automatically

## 🚀 Ready for Production

Talk pAI is production-ready with:
- Optimized database queries and connection pooling
- Comprehensive error handling and recovery
- Structured logging for monitoring and debugging
- Rate limiting and security best practices
- Graceful shutdown and health monitoring
- Scalable architecture with real-time features

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

**Talk pAI** - Where intelligent AI meets enterprise collaboration 🎯