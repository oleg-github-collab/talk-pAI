const fs = require('fs').promises;
const crypto = require('crypto');

async function setupProduction() {
  console.log('🚀 Talk pAI Production Setup');

  try {
    // Create necessary directories
    console.log('📁 Creating directories...');
    const dirs = ['public', 'uploads', 'uploads/images', 'uploads/audio', 'backups'];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
      console.log(`✅ Created ${dir}/`);
    }

    console.log('✅ Directories created - database will be initialized on first server start');

    // Create default .env if it doesn't exist (for Railway environment variables)
    const envExists = await fs.access('.env').then(() => true).catch(() => false);

    if (!envExists) {
      console.log('📝 Creating default .env template...');

      const defaultEnv = `# Talk pAI Production Configuration
# Set these environment variables in Railway

# Server Configuration (Railway will set PORT automatically)
NODE_ENV=production

# OpenAI Configuration - REQUIRED
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Google Apps Script for audio storage
GAS_AUDIO_UPLOAD_URL=

# Session Configuration
SESSION_TIMEOUT_MINUTES=30
SESSION_MAX_PER_USER=10

# Rate Limiting
RATE_LIMIT_WINDOW_MINUTES=15
RATE_LIMIT_MAX_REQUESTS=200

# Database Configuration
DATABASE_PATH=./talkpai.db
DATABASE_BACKUP_ENABLED=true
DATABASE_BACKUP_INTERVAL_HOURS=24

# AI Assistant Configuration
AI_MAX_CONTEXT_MESSAGES=10
AI_RESPONSE_MAX_TOKENS=500
AI_TEMPERATURE=0.7
AI_MODEL=gpt-4o

# Security (generate random values for production)
JWT_SECRET=${crypto.randomBytes(32).toString('hex')}
ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}

# Storage Limits
MAX_IMAGE_SIZE_MB=10
MAX_AUDIO_DURATION_SECONDS=120
AUDIO_AUTO_DELETE_HOURS=3

# Feature Flags
ENABLE_VOICE_TRANSCRIPTION=true
ENABLE_AI_SUMMARIES=true
ENABLE_GROUP_CHATS=false
ENABLE_VIDEO_CALLS=false
`;

      await fs.writeFile('.env', defaultEnv);
      console.log('✅ Created .env template');
    }

    console.log('✨ Production setup complete!');
    console.log('🔧 Remember to set environment variables in Railway:');
    console.log('  - OPENAI_API_KEY (required)');
    console.log('  - GAS_AUDIO_UPLOAD_URL (optional)');

  } catch (error) {
    console.error('❌ Production setup failed:', error);
    process.exit(1);
  }
}

// Only run if called directly
if (require.main === module) {
  setupProduction();
}

module.exports = { setupProduction };