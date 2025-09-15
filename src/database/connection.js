const { Pool } = require('pg');

class DatabaseConnection {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const connectionString = process.env.DATABASE_URL;

      if (!connectionString) {
        console.log('⚠️  No DATABASE_URL found, using in-memory storage for development');
        return false;
      }

      this.pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      console.log('✅ PostgreSQL connected successfully');

      // Initialize database schema
      await this.initializeSchema();

      return true;
    } catch (error) {
      console.error('❌ PostgreSQL connection failed:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  async initializeSchema() {
    const client = await this.pool.connect();

    try {
      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          nickname VARCHAR(30) UNIQUE NOT NULL,
          password_hash VARCHAR(128) NOT NULL,
          salt VARCHAR(32) NOT NULL,
          avatar VARCHAR(10) DEFAULT '👤',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP,
          is_active BOOLEAN DEFAULT true
        )
      `);

      // Create sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          token VARCHAR(64) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days',
          is_active BOOLEAN DEFAULT true
        )
      `);

      // Create chats table
      await client.query(`
        CREATE TABLE IF NOT EXISTS chats (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          type VARCHAR(20) DEFAULT 'private',
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create chat_participants table
      await client.query(`
        CREATE TABLE IF NOT EXISTS chat_participants (
          id SERIAL PRIMARY KEY,
          chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          role VARCHAR(20) DEFAULT 'member',
          UNIQUE(chat_id, user_id)
        )
      `);

      // Create messages table
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id),
          content TEXT NOT NULL,
          message_type VARCHAR(20) DEFAULT 'text',
          reply_to INTEGER REFERENCES messages(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_deleted BOOLEAN DEFAULT false
        )
      `);

      // Create RSS feeds table
      await client.query(`
        CREATE TABLE IF NOT EXISTS rss_feeds (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          feed_url TEXT NOT NULL,
          feed_title VARCHAR(255),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, feed_url)
        )
      `);

      // Create RSS summaries table
      await client.query(`
        CREATE TABLE IF NOT EXISTS rss_summaries (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          feed_url TEXT NOT NULL,
          feed_title VARCHAR(255),
          summary TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create AI conversations table for context storage
      await client.query(`
        CREATE TABLE IF NOT EXISTS ai_conversations (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
          user_message TEXT NOT NULL,
          ai_response TEXT NOT NULL,
          context JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Update messages table to support audio and AI messages
      await client.query(`
        ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS file_url TEXT,
        ADD COLUMN IF NOT EXISTS file_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS file_size INTEGER,
        ADD COLUMN IF NOT EXISTS duration INTEGER,
        ADD COLUMN IF NOT EXISTS is_ai_message BOOLEAN DEFAULT false
      `);

      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
        CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON chat_participants(chat_id);
        CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);
        CREATE INDEX IF NOT EXISTS idx_rss_feeds_user_id ON rss_feeds(user_id);
        CREATE INDEX IF NOT EXISTS idx_rss_summaries_user_id ON rss_summaries(user_id);
        CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
        CREATE INDEX IF NOT EXISTS idx_ai_conversations_chat_id ON ai_conversations(chat_id);
      `);

      console.log('✅ Database schema initialized with AI and RSS features');
    } catch (error) {
      console.error('❌ Schema initialization failed:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  async query(text, params) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async transaction(callback) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('🔐 Database connection closed');
    }
  }
}

module.exports = new DatabaseConnection();