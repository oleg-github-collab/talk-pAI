# 🚀 Talk pAI - AI-Powered Messenger

Real-time messenger with GPT-4o integration, built for Railway deployment.

## ⚡ Quick Deploy

1. **Railway Setup:**
   - Connect this repo to Railway
   - Add PostgreSQL service (auto-provides DATABASE_URL)
   - Set environment variable: `OPENAI_API_KEY`

2. **Deploy:**
   - Railway auto-builds and deploys
   - Database tables created automatically
   - Ready to use!

## 🎯 Features

- 💬 Real-time messaging with Socket.io
- 🤖 GPT-4o AI assistant integration
- 📊 PostgreSQL database with full schema
- 🌙 Dark/Light theme support
- 📱 Mobile-responsive PWA design
- 🔐 JWT authentication
- 📁 File upload support

## 🔧 Environment Variables

```env
# Railway auto-provides:
DATABASE_URL=postgresql://...
PORT=8080
NODE_ENV=production

# You must set:
OPENAI_API_KEY=your_openai_key

# Optional:
GAS_AUDIO_UPLOAD_URL=your_google_script_url
```

## 🏗️ Architecture

- **Backend:** Node.js + Express + Socket.io
- **Database:** PostgreSQL with connection pooling
- **AI:** OpenAI GPT-4o API
- **Frontend:** Vanilla JS with modern CSS
- **Deployment:** Railway (no Docker needed)

## 📊 Database Schema

Auto-created tables:
- `users` - User accounts and profiles
- `messages` - Chat messages with threading
- `sessions` - JWT session management
- `contacts` - User contact lists

Ready for production! 🎉