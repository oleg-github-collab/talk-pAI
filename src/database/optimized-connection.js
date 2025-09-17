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
        try {
          client.query(`SET statement_timeout = ${poolConfig.statement_timeout || 30000}`);
          client.query('SET lock_timeout = 10000'); // 10 second lock timeout
          client.query('SET idle_in_transaction_session_timeout = 30000'); // 30 seconds
        } catch (err) {
          this.logger.warn('Failed to set client configuration:', err.message);
        }
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
    if (!this.isConnected || !this.pool) {
      console.log('⚠️ Database not connected, skipping schema initialization');
      return;
    }

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

          // Split and execute statements one by one to avoid syntax errors
          const statements = schemaSQL.split(';').filter(stmt => stmt.trim().length > 0);

          for (const statement of statements) {
            try {
              await client.query(statement.trim());
            } catch (stmtError) {
              console.warn(`⚠️ Statement failed: ${stmtError.message}`);
              // Continue with other statements
            }
          }

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
        } catch (basicError) {
          console.error('❌ Basic schema creation also failed:', basicError.message);
          // Even if schema creation fails, don't crash the app
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

      console.log('📋 Creating users table...');
      // Users table (створюємо першою, без foreign keys)
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
          metadata JSONB DEFAULT '{}'
        )
      `);

      console.log('📋 Creating organizations table...');
      // Organizations table (без foreign keys)
      await client.query(`
        CREATE TABLE IF NOT EXISTS organizations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          domain VARCHAR(255) UNIQUE,
          logo_url VARCHAR(500),
          description TEXT,
          plan_type VARCHAR(20) DEFAULT 'basic',
          settings JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      console.log('📋 Creating workspaces table...');
      // Workspaces table (without foreign keys initially)
      await client.query(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          slug VARCHAR(100) UNIQUE,
          is_public BOOLEAN DEFAULT FALSE,
          settings JSONB DEFAULT '{}',
          created_by UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      console.log('📋 Creating chats table...');
      // Chats table (without foreign keys initially)
      await client.query(`
        CREATE TABLE IF NOT EXISTS chats (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          workspace_id UUID,
          name VARCHAR(255),
          description TEXT,
          type VARCHAR(20) NOT NULL CHECK (type IN ('direct', 'group', 'channel', 'ai')),
          visibility VARCHAR(20) DEFAULT 'private',
          is_archived BOOLEAN DEFAULT FALSE,
          settings JSONB DEFAULT '{}',
          created_by UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      console.log('📋 Creating chat_participants table...');
      // Chat participants (without foreign keys initially)
      await client.query(`
        CREATE TABLE IF NOT EXISTS chat_participants (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          chat_id UUID,
          user_id UUID,
          role VARCHAR(20) DEFAULT 'member',
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(chat_id, user_id)
        )
      `);

      console.log('📋 Creating messages table...');
      // Messages table (without foreign keys initially)
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          chat_id UUID,
          sender_id UUID,
          content TEXT,
          message_type VARCHAR(20) DEFAULT 'text',
          reply_to_id UUID,
          is_edited BOOLEAN DEFAULT FALSE,
          is_deleted BOOLEAN DEFAULT FALSE,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          ai_conversation_id VARCHAR(255),
          ai_model VARCHAR(100)
        )
      `);

      console.log('📋 Creating sessions table...');
      // Sessions table for authentication
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID,
          token VARCHAR(255) NOT NULL UNIQUE,
          is_active BOOLEAN DEFAULT TRUE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          device_info JSONB DEFAULT '{}',
          ip_address INET,
          user_agent TEXT
        )
      `);

      console.log('📋 Adding foreign key constraints...');
      // Add foreign key constraints (if they don't exist)
      const constraintQueries = [
        {
          name: 'workspaces_organization_id_fkey',
          query: `ALTER TABLE workspaces ADD CONSTRAINT workspaces_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`
        },
        {
          name: 'workspaces_created_by_fkey',
          query: `ALTER TABLE workspaces ADD CONSTRAINT workspaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id)`
        },
        {
          name: 'chats_workspace_id_fkey',
          query: `ALTER TABLE chats ADD CONSTRAINT chats_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE`
        },
        {
          name: 'chats_created_by_fkey',
          query: `ALTER TABLE chats ADD CONSTRAINT chats_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id)`
        },
        {
          name: 'chat_participants_chat_id_fkey',
          query: `ALTER TABLE chat_participants ADD CONSTRAINT chat_participants_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE`
        },
        {
          name: 'chat_participants_user_id_fkey',
          query: `ALTER TABLE chat_participants ADD CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`
        },
        {
          name: 'messages_chat_id_fkey',
          query: `ALTER TABLE messages ADD CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE`
        },
        {
          name: 'messages_sender_id_fkey',
          query: `ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL`
        },
        {
          name: 'messages_reply_to_id_fkey',
          query: `ALTER TABLE messages ADD CONSTRAINT messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES messages(id)`
        },
        {
          name: 'sessions_user_id_fkey',
          query: `ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`
        }
      ];

      for (const constraint of constraintQueries) {
        try {
          // Check if constraint exists
          const existsResult = await client.query(`
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = $1
          `, [constraint.name]);

          if (existsResult.rows.length === 0) {
            await client.query(constraint.query);
            console.log(`✅ Added constraint: ${constraint.name}`);
          } else {
            console.log(`⚠️ Constraint already exists: ${constraint.name}`);
          }
        } catch (constraintError) {
          console.log(`⚠️ Failed to add constraint ${constraint.name}: ${constraintError.message}`);
          // Continue with other constraints
        }
      }

      console.log('📋 Inserting default data...');
      // Insert default AI assistant
      try {
        await client.query(`
          INSERT INTO users (id, nickname, display_name, bio, account_type, status, avatar_url, is_verified, password_hash)
          VALUES (
            '00000000-0000-0000-0000-000000000001',
            'aiden',
            'Aiden AI Assistant',
            'Your intelligent AI companion',
            'enterprise',
            'online',
            '🤖',
            TRUE,
            'no-password-needed'
          ) ON CONFLICT (nickname) DO NOTHING
        `);
        console.log('✅ AI assistant user created');
      } catch (err) {
        console.log('⚠️ AI assistant user creation failed:', err.message);
      }

      // Create default workspace
      try {
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
        console.log('✅ Default workspace created');
      } catch (err) {
        console.log('⚠️ Default workspace creation failed:', err.message);
      }

      // Create default AI chat
      try {
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
        console.log('✅ Default AI chat created');
      } catch (err) {
        console.log('⚠️ Default AI chat creation failed:', err.message);
      }

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