const fs = require('fs').promises;
const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setup() {
  console.log('\n🤖 Talk pAI Setup Wizard\n');
  console.log('This wizard will help you configure your Talk pAI messenger.\n');

  try {
    // Check if .env exists
    const envExists = await fs.access('.env').then(() => true).catch(() => false);
    
    if (envExists) {
      const overwrite = await question('.env file exists. Overwrite? (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Setup cancelled.');
        process.exit(0);
      }
    }

    console.log('\n📝 Basic Configuration\n');
    
    // Basic config
    const port = await question('Server port (default: 3000): ') || '3000';
    const nodeEnv = await question('Environment (production/development, default: production): ') || 'production';
    
    // OpenAI Configuration
    console.log('\n🤖 OpenAI GPT-4o Configuration\n');
    console.log('To use the AI assistant, you need an OpenAI API key.');
    console.log('Get one at: https://platform.openai.com/api-keys\n');
    
    const openaiKey = await question('OpenAI API Key (required for pAI assistant): ');
    
    if (!openaiKey) {
      console.log('⚠️  Warning: AI assistant will not work without OpenAI API key');
    }
    
    // Google Apps Script Configuration
    console.log('\n📁 Google Apps Script Configuration\n');
    console.log('For audio storage, you need to deploy the AudioStorage.gs script.');
    console.log('Instructions:');
    console.log('1. Go to https://script.google.com');
    console.log('2. Create a new project');
    console.log('3. Copy the AudioStorage.gs code');
    console.log('4. Deploy as Web App with anonymous access');
    console.log('5. Copy the deployment URL\n');
    
    const gasUrl = await question('Google Apps Script URL (optional, for audio storage): ');
    
    if (!gasUrl) {
      console.log('⚠️  Warning: Audio messages will use local storage instead of Google Drive');
    }
    
    // Security
    console.log('\n🔐 Security Configuration\n');
    
    const generateSecret = await question('Generate random secrets automatically? (Y/n): ');
    let jwtSecret, encryptionKey;
    
    if (generateSecret.toLowerCase() !== 'n') {
      jwtSecret = crypto.randomBytes(32).toString('hex');
      encryptionKey = crypto.randomBytes(32).toString('hex');
      console.log('✅ Random secrets generated');
    } else {
      jwtSecret = await question('JWT Secret (32+ characters): ');
      encryptionKey = await question('Encryption Key (32+ characters): ');
    }
    
    // Feature flags
    console.log('\n🚀 Feature Configuration\n');
    
    const enableTranscription = await question('Enable voice transcription? (Y/n): ');
    const enableSummaries = await question('Enable AI conversation summaries? (Y/n): ');
    
    // Create .env file
    const envContent = `# Talk pAI Configuration
# Generated on ${new Date().toISOString()}

# Server Configuration
PORT=${port}
NODE_ENV=${nodeEnv}

# OpenAI Configuration (GPT-4o)
OPENAI_API_KEY=${openaiKey}

# Google Apps Script Audio Upload URL
GAS_AUDIO_UPLOAD_URL=${gasUrl}

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

# Security
JWT_SECRET=${jwtSecret}
ENCRYPTION_KEY=${encryptionKey}

# Storage Limits
MAX_IMAGE_SIZE_MB=10
MAX_AUDIO_DURATION_SECONDS=120
AUDIO_AUTO_DELETE_HOURS=3

# Feature Flags
ENABLE_VOICE_TRANSCRIPTION=${enableTranscription.toLowerCase() !== 'n' ? 'true' : 'false'}
ENABLE_AI_SUMMARIES=${enableSummaries.toLowerCase() !== 'n' ? 'true' : 'false'}
ENABLE_GROUP_CHATS=false
ENABLE_VIDEO_CALLS=false
`;

    await fs.writeFile('.env', envContent);
    console.log('\n✅ Created .env file');

    // Create necessary directories
    console.log('\n📁 Creating directories...\n');
    
    const dirs = ['public', 'uploads', 'uploads/images', 'uploads/audio', 'backups'];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
      console.log(`✅ Created ${dir}/`);
    }

    // Initialize database
    console.log('\n🗄️ Initializing database...\n');
    const db = require('./database-pg');
    db.initialize();
    console.log('✅ Database initialized');

    // Create admin user (optional)
    const createAdmin = await question('\nCreate admin user? (y/N): ');
    
    if (createAdmin.toLowerCase() === 'y') {
      const adminNickname = await question('Admin nickname: ');
      const adminPassword = await question('Admin password: ');
      
      const salt = crypto.randomBytes(16).toString('hex');
      const hashedPassword = crypto.pbkdf2Sync(adminPassword, salt, 100000, 64, 'sha512').toString('hex');
      
      try {
        db.createUser(adminNickname, hashedPassword, salt, '👑');
        console.log('✅ Admin user created');
      } catch (error) {
        console.log('❌ Failed to create admin user:', error.message);
      }
    }

    // Railway deployment info
    console.log('\n🚂 Railway Deployment\n');
    console.log('To deploy on Railway:');
    console.log('1. Push your code to GitHub');
    console.log('2. Connect your repo to Railway');
    console.log('3. Add environment variables from .env');
    console.log('4. Deploy!\n');

    console.log('✨ Setup complete!\n');
    console.log('To start the server locally:');
    console.log('  npm start\n');
    console.log('For development with auto-reload:');
    console.log('  npm run dev\n');

    // Create a setup summary
    const summary = {
      port,
      environment: nodeEnv,
      aiEnabled: !!openaiKey,
      audioStorage: gasUrl ? 'Google Drive' : 'Local',
      features: {
        transcription: enableTranscription.toLowerCase() !== 'n',
        summaries: enableSummaries.toLowerCase() !== 'n'
      },
      setupDate: new Date().toISOString()
    };

    await fs.writeFile('setup-summary.json', JSON.stringify(summary, null, 2));
    console.log('📄 Setup summary saved to setup-summary.json');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run setup
setup();