# 🚀 Talk pAI - Ultra-Modern Enterprise Messenger

![Talk pAI Logo](https://via.placeholder.com/800x200/6366f1/ffffff?text=Talk%20pAI%20-%20The%20Future%20of%20Messaging)

## ✨ Features

### 🎯 Core Messaging
- **Real-time messaging** with Socket.IO
- **File sharing** with drag & drop support
- **Voice & Video calls** with WebRTC
- **Group chats** and **Direct messages**
- **Message reactions** and **Threading**
- **Search functionality** across chats and messages

### 🤖 AI Integration
- **AI Assistant** for smart responses
- **Smart suggestions** and **Auto-complete**
- **Language translation** and **Sentiment analysis**
- **Content moderation** and **Spam detection**

### 🏢 Enterprise Features
- **Workspaces** and **Teams**
- **Role-based permissions**
- **Corporate directory**
- **Analytics dashboard**
- **Audit logs** and **Compliance**

### 🎨 Modern UI/UX
- **Glassmorphism design** with stunning effects
- **Dark/Light themes** with smooth transitions
- **Mobile-responsive** interface
- **Touch-friendly** controls
- **Accessibility** features

## 🚀 Railway Deployment

### One-Click Deploy
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template-id)

### Manual Deployment

1. **Create Railway Project**
   ```bash
   railway login
   railway init
   ```

2. **Add PostgreSQL Database**
   ```bash
   railway add postgresql
   ```

3. **Set Environment Variables**
   ```bash
   railway variables set NODE_ENV=production
   railway variables set OPENAI_API_KEY=your_openai_key_here
   ```

4. **Deploy**
   ```bash
   railway up
   ```

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | No* | Fallback DB |
| `NODE_ENV` | Environment mode | No | production |
| `PORT` | Server port | No | Auto-assigned |
| `OPENAI_API_KEY` | OpenAI API key for AI features | No | Disabled |

*Railway automatically provides `DATABASE_URL` when PostgreSQL is added.

## 🔧 Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL (optional - fallback DB available)

### Installation
```bash
# Clone repository
git clone https://github.com/your-username/talk-pai.git
cd talk-pai

# Install dependencies
npm install

# Start development server
npm run dev

# Start WebRTC server (optional)
cd webrtc-server
npm install
npm start
```

### Development URLs
- **Main App**: http://localhost:3000
- **WebRTC Server**: http://localhost:3001
- **Health Check**: http://localhost:3000/health
- **API Docs**: http://localhost:3000/api/docs

## 📱 Features Overview

### Authentication System
- ✅ **Login/Register** with validation
- ✅ **Demo login** for testing
- ✅ **Session management** with JWT
- ✅ **Password security** with bcrypt
- ✅ **Logout** functionality

### Messaging Features
- ✅ **Real-time messaging** via Socket.IO
- ✅ **File upload** with drag & drop
- ✅ **Emoji picker** and reactions
- ✅ **Message threading**
- ✅ **Search** across conversations
- ✅ **Message status** (sent/delivered/read)

### Call Features
- ✅ **Voice calls** with WebRTC
- ✅ **Video calls** with camera controls
- ✅ **Screen sharing**
- ✅ **Group calls** support
- ✅ **Call recording** (enterprise)
- ✅ **TURN server** integration

### Mobile Support
- ✅ **Responsive design** for all devices
- ✅ **Touch-friendly** interface
- ✅ **Swipe gestures**
- ✅ **iOS/Android** optimizations
- ✅ **PWA ready** for installation

## 🏗️ Architecture

### Backend Stack
- **Node.js** + **Express** server
- **PostgreSQL** database with fallback
- **Socket.IO** for real-time communication
- **WebRTC** signaling server
- **JWT** authentication

### Frontend Stack
- **Vanilla JavaScript** (ES6+)
- **CSS3** with glassmorphism effects
- **WebRTC** client implementation
- **Service Worker** for PWA

### Database Schema
- **Users** with profiles and settings
- **Workspaces** and **Teams**
- **Chats** and **Messages**
- **Files** and **Voice notes**
- **Calls** and **Participants**

## 🔒 Security Features

- **Rate limiting** to prevent abuse
- **CORS** protection
- **Helmet.js** security headers
- **Input validation** and sanitization
- **SQL injection** prevention
- **XSS protection**

## 📊 Monitoring & Analytics

- **Health checks** for uptime monitoring
- **Performance metrics** tracking
- **Error logging** with stack traces
- **User activity** analytics
- **Resource usage** monitoring

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Wiki](https://github.com/your-username/talk-pai/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-username/talk-pai/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/talk-pai/discussions)

## 🚀 Roadmap

- [ ] **Mobile apps** (React Native)
- [ ] **Desktop apps** (Electron)
- [ ] **API documentation** (Swagger)
- [ ] **Plugin system** for extensions
- [ ] **Advanced analytics** dashboard
- [ ] **Multi-language** support

---

Built with ❤️ for the future of communication.

**Talk pAI** - Where conversations meet artificial intelligence.