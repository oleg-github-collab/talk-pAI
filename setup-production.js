const fs = require('fs').promises;
const crypto = require('crypto');

async function setupProduction() {
  console.log('🚀 Talk pAI Production Setup (PostgreSQL)');

  try {
    console.log('✅ Production setup running...');
    console.log('📊 PostgreSQL database will be initialized on first server start');
    console.log('📁 Upload directories will be created in /tmp automatically');

    // Create default .env if it doesn't exist (for Railway environment variables)
    const envExists = await fs.access('.env').then(() => true).catch(() => false);

    if (!envExists) {
      console.log('📝 Creating default .env template...');

      const defaultEnv = `# Talk pAI Configuration
NODE_ENV=production

# PostgreSQL Database - Railway auto-provides DATABASE_URL
# DATABASE_URL=postgresql://user:pass@host:port/db

# REQUIRED: OpenAI API Key
OPENAI_API_KEY=your_openai_key_here

# OPTIONAL: Google Apps Script for audio storage
# GAS_AUDIO_UPLOAD_URL=your_google_script_url

# Auto-generated security keys
JWT_SECRET=${crypto.randomBytes(32).toString('hex')}
ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}
`;

      await fs.writeFile('.env', defaultEnv);
      console.log('✅ Created .env template');
    }

    console.log('✨ Production setup complete!');
    console.log('🔧 Set these in Railway:');
    console.log('  ✅ Add PostgreSQL service → DATABASE_URL auto-provided');
    console.log('  ⚠️  Set OPENAI_API_KEY manually (required)');
    console.log('  📁 GAS_AUDIO_UPLOAD_URL (optional)');

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