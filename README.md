# Talk pAI 🤖 - AI-Powered Messenger

A modern, mobile-first messenger with integrated GPT-4o AI assistant, real-time messaging, voice notes, and conversation summaries. Built for up to 100 concurrent users with a focus on privacy and simplicity.

## Key Features ✨

- **pAI Assistant** - Personal AI assistant powered by GPT-4o for every user
- **Real-time Messaging** - Instant message delivery with Socket.io
- **Voice Messages** - Record and send audio messages with automatic Google Drive storage
- **AI Summaries** - Get intelligent summaries of long conversations
- **Mobile-First Design** - Optimized for mobile devices with native-like experience
- **Data Isolation** - SQLite with proper user data isolation
- **Hybrid Storage** - Google Drive for audio (via Apps Script) + local storage fallback

## Quick Start 🚀

### Prerequisites

- Node.js 18+
- OpenAI API key (for GPT-4o)
- Google account (for audio storage)
- Railway account (for deployment)

### Local Installation

1. **Clone and install:**
```bash
git clone https://github.com/yourusername/talk-pai.git
cd talk-pai
npm install
```

2. **Run setup wizard:**
```bash
npm run setup
```
This interactive wizard will:
- Configure your OpenAI API key
- Set up Google Apps Script URL
- Generate security keys
- Initialize the database
- Create directories

3. **Start the server:**
```bash
npm start
# Or for development:
npm run dev
```

4. **Access the app:**
Open http://localhost:3000 in your browser

## Google Apps Script Setup 📁

For audio storage via Google Drive:

1. **Go to** [script.google.com](https://script.google.com)

2. **Create new project** and paste the `AudioStorage.gs` code

3. **Deploy as Web App:**
   - Execute as: Me
   - Who has access: Anyone, even anonymous
   - Click Deploy

4. **Copy the Web App URL** and add to your `.env`:
```env
GAS_AUDIO_UPLOAD_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

5. **Set up automatic cleanup:**
   - In Apps Script editor, run `setupCleanupTrigger()`
   - This will delete audio files after 3 hours automatically

## Railway Deployment 🚂

### One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/talk-pai)

### Manual Deploy

1. **Push to GitHub:**
```bash
git add .
git commit -m "Initial Talk pAI deployment"
git push origin main
```

2. **In Railway Dashboard:**
   - New Project → Deploy from GitHub
   - Select your repository
   - Railway auto-detects Node.js

3. **Add Environment Variables:**
   
   Go to Variables tab and add:
   ```
   OPENAI_API_KEY=sk-...
   GAS_AUDIO_UPLOAD_URL=https://script.google.com/...
   JWT_SECRET=<generate-random-32-char>
   ENCRYPTION_KEY=<generate-random-32-char>
   ```

4. **Deploy:**
   - Railway builds and deploys automatically
   - Get your public URL from Settings

## Configuration ⚙️

### Essential Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o | Yes |
| `GAS_AUDIO_UPLOAD_URL` | Google Apps Script URL | No (uses local storage) |
| `JWT_SECRET` | Session security key | Yes |
| `ENCRYPTION_KEY` | Data encryption key | Yes |
| `PORT` | Server port | No (default: 3000) |

### Feature Flags

| Flag | Description | Default |
|------|-------------|---------|
| `ENABLE_VOICE_TRANSCRIPTION` | Transcribe voice messages | true |
| `ENABLE_AI_SUMMARIES` | AI conversation summaries | true |
| `ENABLE_GROUP_CHATS` | Group chat support | false |

## API Documentation 📚

### Authentication

**Register:**
```http
POST /api/auth/register
{
  "nickname": "user123",
  "password": "securepass",
  "avatar": "🦊"
}
```

**Login:**
```http
POST /api/auth/login
{
  "nickname": "user123",
  "password": "securepass"
}
```

### Messaging

**Send Message:**
```http
POST /api/messages/send
Authorization: Bearer <token>
{
  "receiver": "pAI",
  "type": "text",
  "content": "Hello AI!"
}
```

**Get AI Summary:**
```http
POST /api/messages/summarize
{
  "conversation": "pAI",
  "hours": 24
}
```

## pAI Assistant Commands 🤖

Users can interact with pAI using these commands:

- `/help` - Show available commands
- `/summarize [hours] [chat]` - Summarize conversations
- `/translate [text]` - Translate text
- Just chat naturally for general assistance!

## Security Features 🔒

- **Password Hashing** - PBKDF2 with salt
- **Session Tokens** - Secure random tokens with expiry
- **Rate Limiting** - Prevent abuse and spam
- **Data Isolation** - Users can only access their own data
- **Input Validation** - All inputs sanitized
- **HTTPS Ready** - SSL support for production

## Mobile Experience 📱

Optimized for mobile devices with:
- Touch-optimized UI
- Safe area support (iPhone notch)
- Gesture controls
- Voice recording
- Push notifications ready
- Offline message queue
- Progressive Web App ready

## Database Schema 🗄️

SQLite database with these main tables:
- `users` - User accounts and settings
- `messages` - All messages with isolation
- `sessions` - Active user sessions
- `contacts` - User connections
- `summaries` - Cached AI summaries

## Performance Optimization ⚡

- **Connection pooling** for database
- **Message pagination** (100 per load)
- **Lazy loading** for images
- **Compression** enabled
- **CDN ready** for static assets
- **WebSocket** for real-time updates
- **Indexed database** queries

## Monitoring 📊

Monitor your deployment:

```javascript
// Health check endpoint
GET /health

// Returns:
{
  "status": "healthy",
  "uptime": 3600,
  "activeUsers": 42
}
```

## Scaling Considerations 📈

Current setup handles ~100 concurrent users. To scale:

1. **Database**: Migrate to PostgreSQL
2. **Cache**: Add Redis for sessions
3. **Media**: Use CDN for images
4. **WebSockets**: Add Socket.io Redis adapter
5. **Workers**: Use PM2 cluster mode

## Troubleshooting 🔧

### AI Assistant Not Working
- Check `OPENAI_API_KEY` is valid
- Verify GPT-4o access on your OpenAI account
- Check API quota/billing

### Audio Upload Fails
- Verify Google Apps Script is deployed
- Check URL in `GAS_AUDIO_UPLOAD_URL`
- Test script directly via browser

### Railway Deploy Issues
- Ensure all environment variables are set
- Check build logs in Railway dashboard
- Verify Node.js version >= 18

### Database Locked
- Stop all server instances
- Delete `.db-wal` and `.db-shm` files
- Restart server

## Development 💻

### Project Structure
```
talk-pai/
├── server.js          # Main server
├── database.js        # SQLite operations
├── ai-assistant.js    # GPT-4o integration
├── AudioStorage.gs    # Google Apps Script
├── public/
│   └── index.html    # Mobile-first UI
├── uploads/          # Local media storage
├── railway.json      # Railway config
└── .env             # Environment config
```

### Testing Locally
```bash
# Development mode with auto-reload
npm run dev

# Test AI features
curl -X POST http://localhost:3000/api/messages/send \
  -H "Authorization: Bearer <token>" \
  -d '{"receiver": "pAI", "content": "Hello"}'
```

## Contributing 🤝

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## Cost Estimation 💰

For 100 users:
- **Railway**: ~$5-10/month
- **OpenAI GPT-4o**: ~$20-50/month (depends on usage)
- **Google Drive**: Free (15GB included)
- **Total**: ~$25-60/month

## Security Notes 🔐

- Never commit `.env` file
- Rotate JWT secrets regularly
- Use HTTPS in production
- Enable rate limiting
- Regular security updates
- Audit npm packages

## License 📄

MIT License - See LICENSE file

## Support 💬

- Issues: GitHub Issues
- Discussion: GitHub Discussions
- Email: support@talkpai.app

## Roadmap 🗺️

- [ ] End-to-end encryption
- [ ] Group chats
- [ ] Video calls
- [ ] File sharing
- [ ] Message reactions
- [ ] Custom AI personalities
- [ ] Multi-language support
- [ ] Desktop app

---

**Built with ❤️ for the future of AI-powered communication**