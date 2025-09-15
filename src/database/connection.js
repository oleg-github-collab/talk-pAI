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

      // Create organizations table for corporate teams
      await client.query(`
        CREATE TABLE IF NOT EXISTS organizations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(100) UNIQUE NOT NULL,
          description TEXT,
          logo_url TEXT,
          settings JSONB DEFAULT '{}',
          plan VARCHAR(50) DEFAULT 'free',
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create workspaces table (like Slack workspaces)
      await client.query(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id SERIAL PRIMARY KEY,
          organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(100) NOT NULL,
          description TEXT,
          settings JSONB DEFAULT '{}',
          is_public BOOLEAN DEFAULT false,
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(organization_id, slug)
        )
      `);

      // Update chats table to support channels and workspace integration
      await client.query(`
        ALTER TABLE chats
        ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id),
        ADD COLUMN IF NOT EXISTS channel_type VARCHAR(50) DEFAULT 'chat',
        ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'
      `);

      // Create teams table for organized groups within workspaces
      await client.query(`
        CREATE TABLE IF NOT EXISTS teams (
          id SERIAL PRIMARY KEY,
          workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          color VARCHAR(7) DEFAULT '#6366f1',
          settings JSONB DEFAULT '{}',
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create workspace members table
      await client.query(`
        CREATE TABLE IF NOT EXISTS workspace_members (
          id SERIAL PRIMARY KEY,
          workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(50) DEFAULT 'member',
          team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
          status VARCHAR(50) DEFAULT 'active',
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          invited_by INTEGER REFERENCES users(id),
          UNIQUE(workspace_id, user_id)
        )
      `);

      // Create AI agents table for external business agents
      await client.query(`
        CREATE TABLE IF NOT EXISTS ai_agents (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          endpoint_url TEXT NOT NULL,
          api_key VARCHAR(255),
          capabilities JSONB DEFAULT '[]',
          is_active BOOLEAN DEFAULT true,
          created_by INTEGER REFERENCES users(id),
          organization_id INTEGER REFERENCES organizations(id),
          workspace_id INTEGER REFERENCES workspaces(id),
          settings JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create user roles table for fine-grained permissions
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_roles (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(50) NOT NULL,
          scope VARCHAR(50) NOT NULL,
          scope_id INTEGER,
          granted_by INTEGER REFERENCES users(id),
          granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP,
          UNIQUE(user_id, role, scope, scope_id)
        )
      `);

      // Create message suggestions table for AI writing assistance
      await client.query(`
        CREATE TABLE IF NOT EXISTS message_suggestions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          original_message TEXT NOT NULL,
          suggested_message TEXT NOT NULL,
          suggestion_type VARCHAR(50) NOT NULL,
          context JSONB,
          used BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create activity logs table for comprehensive logging
      await client.query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(50),
          resource_id INTEGER,
          metadata JSONB,
          ip_address INET,
          user_agent TEXT,
          workspace_id INTEGER REFERENCES workspaces(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Update users table with enhanced corporate features
      await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS title VARCHAR(255),
        ADD COLUMN IF NOT EXISTS department VARCHAR(255),
        ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
        ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC',
        ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT false
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
        CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON messages(chat_id) WHERE (SELECT workspace_id FROM chats WHERE chats.id = messages.chat_id) IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON chat_participants(chat_id);
        CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);
        CREATE INDEX IF NOT EXISTS idx_rss_feeds_user_id ON rss_feeds(user_id);
        CREATE INDEX IF NOT EXISTS idx_rss_summaries_user_id ON rss_summaries(user_id);
        CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
        CREATE INDEX IF NOT EXISTS idx_ai_conversations_chat_id ON ai_conversations(chat_id);

        -- New corporate indexes
        CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
        CREATE INDEX IF NOT EXISTS idx_workspaces_org_id ON workspaces(organization_id);
        CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(organization_id, slug);
        CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_workspace_members_team ON workspace_members(team_id);
        CREATE INDEX IF NOT EXISTS idx_teams_workspace ON teams(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_chats_workspace ON chats(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_chats_type ON chats(channel_type);
        CREATE INDEX IF NOT EXISTS idx_ai_agents_workspace ON ai_agents(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_ai_agents_org ON ai_agents(organization_id);
        CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_roles_scope ON user_roles(scope, scope_id);
        CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace ON activity_logs(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_message_suggestions_user ON message_suggestions(user_id);
        CREATE INDEX IF NOT EXISTS idx_users_superadmin ON users(is_superadmin);
        CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
        CREATE INDEX IF NOT EXISTS idx_users_nickname_search ON users USING gin(to_tsvector('english', nickname));
        CREATE INDEX IF NOT EXISTS idx_users_full_name_search ON users USING gin(to_tsvector('english', full_name));
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