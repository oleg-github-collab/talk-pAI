const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const Logger = require('../utils/enhanced-logger');

class OptimizedDatabaseConnection {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.logger = new Logger('Database');
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 1000; // ms
    this.healthCheckInterval = null;
  }

  async connect() {
    try {
      const connectionString = process.env.DATABASE_URL;

      if (!connectionString) {
        this.logger.warn('No DATABASE_URL found, using in-memory storage for development');
        return false;
      }

      const poolConfig = {
        connectionString,
        // SSL configuration for production
        ssl: process.env.NODE_ENV === 'production' ? {
          rejectUnauthorized: false,
          sslmode: 'require'
        } : false,

        // Optimized pool settings
        max: parseInt(process.env.DB_POOL_MAX) || 25, // Maximum pool size
        min: parseInt(process.env.DB_POOL_MIN) || 5,  // Minimum pool size
        idleTimeoutMillis: 30000,     // Close idle connections after 30s
        connectionTimeoutMillis: 5000, // Timeout when acquiring connection
        acquireTimeoutMillis: 60000,   // Max time to acquire connection

        // Query timeout
        query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000,

        // Statement timeout (PostgreSQL)
        statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000,

        // Application name for monitoring
        application_name: `talk-pai-${process.env.NODE_ENV || 'development'}`,

        // Keep connections alive
        keepAlive: true,
        keepAliveInitialDelayMillis: 0,
      };

      this.pool = new Pool(poolConfig);

      // Pool error handling
      this.pool.on('error', (err) => {
        this.logger.error('Database pool error', { error: err.message });
        this.isConnected = false;
      });

      this.pool.on('connect', (client) => {
        this.logger.debug('New database client connected');

        // Set up client-specific configurations
        client.query('SET statement_timeout = $1', [poolConfig.statement_timeout]);
        client.query('SET lock_timeout = 10000'); // 10 second lock timeout
        client.query('SET idle_in_transaction_session_timeout = 30000'); // 30 seconds
      });

      this.pool.on('acquire', () => {
        this.logger.debug('Client acquired from pool');
      });

      this.pool.on('remove', () => {
        this.logger.debug('Client removed from pool');
      });

      // Test connection with detailed error handling
      const testTimer = this.logger.time('database-connection-test');
      const client = await this.pool.connect();

      try {
        // Test query with version info
        const result = await client.query('SELECT version(), now() as current_time');
        this.logger.info('Database connection established', {
          version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1],
          time: result.rows[0].current_time
        });

        this.logger.timeEnd(testTimer, 'Database connection test completed');
      } finally {
        client.release();
      }

      this.isConnected = true;
      this.connectionRetries = 0;

      // Start health monitoring
      this.startHealthCheck();

      // Initialize schema
      await this.initializeSchema();

      return true;
    } catch (error) {
      this.logger.error('PostgreSQL connection failed', {
        error: error.message,
        code: error.code,
        retries: this.connectionRetries
      });

      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        this.logger.info(`Retrying connection in ${this.retryDelay}ms (attempt ${this.connectionRetries}/${this.maxRetries})`);

        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect(); // Recursive retry
      }

      this.isConnected = false;
      return false;
    }
  }

  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Health check every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        const client = await this.pool.connect();
        await client.query('SELECT 1');
        client.release();

        if (!this.isConnected) {
          this.logger.info('Database connection restored');
          this.isConnected = true;
        }
      } catch (error) {
        if (this.isConnected) {
          this.logger.error('Database health check failed', { error: error.message });
          this.isConnected = false;
        }
      }
    }, 30000);
  }

  async initializeSchema() {
    try {
      console.log('🔗 Attempting database schema initialization...');

      // Check if production schema file exists
      const schemaPath = path.join(__dirname, '../../database/production-schema.sql');

      try {
        await fs.access(schemaPath);
        console.log('📄 Production schema file found');

        const client = await this.pool.connect();

        try {
          // Read and execute production schema
          const schemaSQL = await fs.readFile(schemaPath, 'utf8');
          await client.query(schemaSQL);
          console.log('✅ Production database schema initialized successfully');
        } catch (error) {
          console.warn('⚠️ Production schema initialization failed, using basic schema:', error.message);

          // Fallback to basic schema
          await this.createBasicSchema(client);
        } finally {
          client.release();
        }
      } catch (error) {
        console.log('⚠️ Production schema file not found, creating basic schema');

        const client = await this.pool.connect();
        try {
          await this.createBasicSchema(client);
        } finally {
          client.release();
        }
      }
    } catch (error) {
      console.error('🚨 Schema initialization failed:', error.message);
      // Don't throw error - let app continue with existing schema
    }

    console.log('✅ Database initialization completed');
  }

  async createBasicSchema(client) {
    try {
      // Enable UUID extension
      await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

      // Users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          nickname VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          display_name VARCHAR(100),
          bio TEXT,
          avatar_url VARCHAR(500),
          status VARCHAR(20) DEFAULT 'offline',
          account_type VARCHAR(20) DEFAULT 'personal',
          is_verified BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE,
          last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          notifications_enabled BOOLEAN DEFAULT TRUE,
          dark_mode BOOLEAN DEFAULT FALSE,
          metadata JSONB DEFAULT '{}'::jsonb
        )
      `);

      // Organizations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS organizations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          domain VARCHAR(255) UNIQUE,
          logo_url VARCHAR(500),
          description TEXT,
          plan_type VARCHAR(20) DEFAULT 'basic',
          settings JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Workspaces table
      await client.query(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          slug VARCHAR(100) UNIQUE,
          is_public BOOLEAN DEFAULT FALSE,
          settings JSONB DEFAULT '{}'::jsonb,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Chats table
      await client.query(`
        CREATE TABLE IF NOT EXISTS chats (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
          name VARCHAR(255),
          description TEXT,
          type VARCHAR(20) NOT NULL CHECK (type IN ('direct', 'group', 'channel', 'ai')),
          visibility VARCHAR(20) DEFAULT 'private',
          is_archived BOOLEAN DEFAULT FALSE,
          settings JSONB DEFAULT '{}'::jsonb,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Chat participants
      await client.query(`
        CREATE TABLE IF NOT EXISTS chat_participants (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(20) DEFAULT 'member',
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(chat_id, user_id)
        )
      `);

      // Messages table
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
          sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
          content TEXT,
          message_type VARCHAR(20) DEFAULT 'text',
          reply_to_id UUID REFERENCES messages(id),
          is_edited BOOLEAN DEFAULT FALSE,
          is_deleted BOOLEAN DEFAULT FALSE,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          ai_conversation_id VARCHAR(255),
          ai_model VARCHAR(100)
        )
      `);

      // Insert default AI assistant
      await client.query(`
        INSERT INTO users (id, nickname, display_name, bio, account_type, status, avatar_url, is_verified)
        VALUES (
          '00000000-0000-0000-0000-000000000001',
          'aiden',
          'Aiden AI Assistant',
          'Your intelligent AI companion',
          'enterprise',
          'online',
          '🤖',
          TRUE
        ) ON CONFLICT (nickname) DO NOTHING
      `);

      // Create default workspace
      await client.query(`
        INSERT INTO workspaces (id, name, slug, description, is_public)
        VALUES (
          '00000000-0000-0000-0000-000000000001',
          'General Workspace',
          'general',
          'Default workspace for all users',
          TRUE
        ) ON CONFLICT (slug) DO NOTHING
      `);

      // Create default AI chat
      await client.query(`
        INSERT INTO chats (id, workspace_id, name, type, visibility, created_by)
        VALUES (
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000001',
          'AI Assistant',
          'ai',
          'public',
          '00000000-0000-0000-0000-000000000001'
        ) ON CONFLICT (id) DO NOTHING
      `);

      console.log('✅ Basic database schema created successfully');
    } catch (error) {
      console.error('❌ Basic schema creation failed:', error.message);
      throw error;
    }
  }

  async query(text, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const queryTimer = this.logger.time('database-query');
    const client = await this.pool.connect();

    try {
      const result = await client.query(text, params);

      this.logger.timeEnd(queryTimer, 'Database query executed');
      this.logger.logQuery(text, params, queryTimer.duration);

      return result;
    } catch (error) {
      this.logger.error('Database query failed', {
        error: error.message,
        query: text.replace(/\s+/g, ' ').trim().substring(0, 200),
        params: params.length
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async transaction(callback) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const transactionTimer = this.logger.time('database-transaction');
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');

      this.logger.timeEnd(transactionTimer, 'Database transaction completed');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Database transaction failed', {
        error: error.message,
        duration: Date.now() - transactionTimer.startTime
      });
      throw error;
    } finally {
      client.release();
    }
  }

  // Prepared statement support for better performance
  async preparedQuery(name, text, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const client = await this.pool.connect();
    try {
      // Prepare statement if not already prepared
      await client.query({ name, text, values: params });
      return await client.query({ name, values: params });
    } catch (error) {
      this.logger.error('Prepared query failed', { error: error.message, name });
      throw error;
    } finally {
      client.release();
    }
  }

  // Get pool statistics
  getPoolStats() {
    if (!this.pool) return null;

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      isConnected: this.isConnected
    };
  }

  // Get connection info for monitoring
  async getConnectionInfo() {
    if (!this.isConnected) return null;

    try {
      const result = await this.query(`
        SELECT
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          max(now() - query_start) as longest_query,
          max(now() - state_change) as longest_idle
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);

      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to get connection info', { error: error.message });
      return null;
    }
  }

  async close() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.pool) {
      const closeTimer = this.logger.time('database-close');
      await this.pool.end();
      this.isConnected = false;
      this.logger.timeEnd(closeTimer, 'Database connection closed');
    }
  }
}

module.exports = new OptimizedDatabaseConnection();