const fs = require('fs');
const path = require('path');

// Database Initializer with PostgreSQL primary and fallback support
class DatabaseInitializer {
    constructor() {
        this.isConnected = false;
        this.pool = null;
        this.connectionType = 'postgresql';
        this.fallbackDb = null;
        this.connectionRetries = 0;
        this.maxRetries = 5;
        this.reconnectTimer = null;
        this.healthCheckInterval = null;
    }

    async connect() {
        try {
            // Try PostgreSQL first
            if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres')) {
                console.log('🔗 Connecting to PostgreSQL database...');
                await this.connectPostgreSQL();
                console.log(`✅ Database connected successfully (${this.connectionType})`);
                await this.initializeSchema();
                return true;
            } else {
                // Fall back to in-memory database
                console.log('🔗 PostgreSQL not available, using fallback database...');
                await this.connectFallback();
                console.log(`✅ Fallback database connected successfully (${this.connectionType})`);
                return true;
            }
        } catch (error) {
            console.error('❌ PostgreSQL connection failed:', error.message);
            console.log('🔄 Attempting fallback database...');

            try {
                await this.connectFallback();
                console.log(`✅ Fallback database connected successfully (${this.connectionType})`);
                return true;
            } catch (fallbackError) {
                console.error('❌ Fallback database also failed:', fallbackError.message);
                return false;
            }
        }
    }

    async connectPostgreSQL() {
        try {
            const { Pool } = require('pg');

            // Use connection pooling for better performance and reliability
            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                max: 20, // Maximum number of clients in the pool
                idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
                connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection not acquired
                maxUses: 7500, // Close and replace connection after 7500 uses
                application_name: 'talk-pai-messenger'
            });

            // Test connection with retry logic
            let connected = false;
            for (let i = 0; i < this.maxRetries; i++) {
                try {
                    const client = await this.pool.connect();
                    const result = await client.query('SELECT NOW(), version() as pg_version');
                    client.release();

                    console.log('📅 PostgreSQL connected at:', result.rows[0].now);
                    console.log('🔧 PostgreSQL version:', result.rows[0].pg_version.split(' ')[0]);

                    connected = true;
                    break;
                } catch (error) {
                    console.warn(`⚠️ PostgreSQL connection attempt ${i + 1}/${this.maxRetries} failed:`, error.message);
                    if (i < this.maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // Exponential backoff
                    }
                }
            }

            if (!connected) {
                throw new Error('Failed to connect to PostgreSQL after multiple attempts');
            }

            this.isConnected = true;
            this.connectionType = 'postgresql';
            this.connectionRetries = 0;

            // Set up connection monitoring
            this.setupConnectionMonitoring();

            // Handle pool errors
            this.pool.on('error', (err) => {
                console.error('❌ PostgreSQL pool error:', err.message);
                this.handleConnectionError(err);
            });

            this.pool.on('connect', () => {
                console.log('🔗 New PostgreSQL client connected');
            });

        } catch (error) {
            console.error('PostgreSQL connection failed:', error.message);
            throw error;
        }
    }

    setupConnectionMonitoring() {
        // Health check every 30 seconds
        this.healthCheckInterval = setInterval(async () => {
            try {
                const client = await this.pool.connect();
                await client.query('SELECT 1');
                client.release();
            } catch (error) {
                console.warn('⚠️ Database health check failed:', error.message);
                this.handleConnectionError(error);
            }
        }, 30000);
    }

    async handleConnectionError(error) {
        this.connectionRetries++;
        console.error(`❌ Database connection error (${this.connectionRetries}/${this.maxRetries}):`, error.message);

        if (this.connectionRetries >= this.maxRetries) {
            console.error('💥 Maximum connection retries reached, switching to fallback');
            this.isConnected = false;
            await this.connectFallback();
            return;
        }

        // Attempt reconnection
        if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(async () => {
                try {
                    console.log('🔄 Attempting to reconnect to PostgreSQL...');
                    await this.connectPostgreSQL();
                    console.log('✅ Reconnected to PostgreSQL');
                } catch (reconnectError) {
                    console.error('❌ Reconnection failed:', reconnectError.message);
                } finally {
                    this.reconnectTimer = null;
                }
            }, 5000);
        }
    }

    async connectFallback() {
        try {
            const FallbackDatabase = require('./fallback-database');
            this.fallbackDb = new FallbackDatabase();
            await this.fallbackDb.connect();
            this.isConnected = true;
            this.connectionType = 'fallback';
        } catch (error) {
            console.error('Fallback database connection failed:', error.message);
            throw error;
        }
    }

    async initializeSchema() {
        try {
            console.log('🔧 Initializing PostgreSQL database schema...');

            const schemaPath = path.join(__dirname, 'production-schema.sql');

            if (!fs.existsSync(schemaPath)) {
                throw new Error(`PostgreSQL schema file not found: ${schemaPath}`);
            }

            const schema = fs.readFileSync(schemaPath, 'utf8');
            await this.initializePostgreSQLSchema(schema);

            console.log('✅ PostgreSQL database schema initialized successfully');

        } catch (error) {
            console.error('❌ Schema initialization failed:', error.message);
            throw error; // Don't continue with broken schema
        }
    }

    async initializePostgreSQLSchema(schema) {
        let client;
        try {
            // Get a client from the pool
            client = await this.pool.connect();

            // Enable UUID extension first (with retry logic)
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
                    console.log('✅ UUID extension enabled');
                    break;
                } catch (extError) {
                    retryCount++;
                    console.warn(`⚠️ UUID extension attempt ${retryCount} failed:`, extError.message);
                    if (retryCount === maxRetries) {
                        console.log('🔄 Continuing without UUID extension...');
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            // Split and execute statements with better error handling
            const statements = schema
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.match(/^\s*$/));

            console.log(`🔧 Executing ${statements.length} schema statements...`);

            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                try {
                    console.log(`📝 Executing statement ${i + 1}/${statements.length}`);
                    await client.query(statement);
                    console.log(`✅ Statement ${i + 1} completed`);
                } catch (error) {
                    if (error.message.includes('already exists') ||
                        error.message.includes('does not exist') ||
                        error.message.includes('duplicate key')) {
                        console.log(`⚠️ Skipping statement ${i + 1}: ${error.message}`);
                    } else {
                        console.error(`❌ PostgreSQL schema error on statement ${i + 1}:`, error.message);
                        console.error('❌ Statement:', statement.substring(0, 200) + '...');
                        throw error;
                    }
                }
            }

            console.log('✅ All schema statements executed successfully');

        } catch (error) {
            console.error('❌ PostgreSQL schema initialization failed:', error.message);
            throw error;
        } finally {
            if (client) {
                client.release();
            }
        }
    }

    async query(sql, params = []) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        if (this.connectionType === 'fallback') {
            return this.fallbackDb.query(sql, params);
        }

        let client;
        try {
            // Convert ? placeholders to $1, $2, etc. for PostgreSQL
            let pgSql = sql;
            let pgParams = params;

            if (sql.includes('?')) {
                let paramIndex = 1;
                pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
            }

            // Use connection pool
            client = await this.pool.connect();
            const result = await client.query(pgSql, pgParams);
            return result.rows;
        } catch (error) {
            console.error('❌ Query error:', error.message);
            console.error('❌ SQL:', sql.substring(0, 200) + (sql.length > 200 ? '...' : ''));
            console.error('❌ Params:', params);

            // Handle connection errors
            if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
                this.handleConnectionError(error);
            }

            throw error;
        } finally {
            if (client) {
                client.release();
            }
        }
    }

    async close() {
        // Clear monitoring intervals
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.connectionType === 'fallback' && this.fallbackDb) {
            await this.fallbackDb.close();
        } else if (this.pool) {
            await this.pool.end();
        }

        this.isConnected = false;
        this.connectionRetries = 0;
        console.log(`🔐 ${this.connectionType} database connection closed`);
    }

    // Utility methods for common operations
    async getUserByNickname(nickname) {
        if (this.connectionType === 'fallback') {
            return this.fallbackDb.getUserByNickname(nickname);
        }
        const sql = 'SELECT * FROM users WHERE nickname = $1';
        const result = await this.query(sql, [nickname]);
        return result[0] || null;
    }

    async getUserByEmail(email) {
        if (this.connectionType === 'fallback') {
            return this.fallbackDb.getUserByEmail(email);
        }
        const sql = 'SELECT * FROM users WHERE email = $1';
        const result = await this.query(sql, [email]);
        return result[0] || null;
    }

    async createUser(userData) {
        if (this.connectionType === 'fallback') {
            return this.fallbackDb.createUser(userData);
        }

        const {
            nickname,
            email,
            password_hash,
            display_name = nickname,
            bio = 'Hey there! I am using Talk pAI.',
            account_type = 'personal'
        } = userData;

        const sql = `
            INSERT INTO users (nickname, email, password_hash, display_name, bio, account_type)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;

        const params = [nickname, email, password_hash, display_name, bio, account_type];
        const result = await this.query(sql, params);
        return result[0];
    }

    async getMessages(options) {
        if (this.connectionType === 'fallback') {
            return this.fallbackDb.getMessages(options);
        }

        const { chatId, limit = 50, offset = 0, before, after } = options;
        const sql = `
            SELECT m.*, u.nickname as sender_nickname, u.display_name as sender_display_name, u.avatar as sender_avatar
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = $1
            ORDER BY m.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const params = [chatId, limit, offset];
        return await this.query(sql, params);
    }

    async createMessage(messageData) {
        if (this.connectionType === 'fallback') {
            return this.fallbackDb.createMessage(messageData);
        }

        const {
            chat_id,
            sender_id,
            content,
            content_type = 'text',
            reply_to_id = null,
            metadata = '{}'
        } = messageData;

        const sql = `
            INSERT INTO messages (chat_id, sender_id, content, message_type, reply_to_id, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;

        const params = [
            chat_id,
            sender_id,
            content,
            content_type,
            reply_to_id,
            typeof metadata === 'string' ? metadata : JSON.stringify(metadata)
        ];

        const result = await this.query(sql, params);
        return result[0];
    }

    async searchMessages(chatId, searchTerm, limit = 20) {
        const sql = `
            SELECT m.*, u.nickname as sender_nickname, u.display_name as sender_display_name
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = $1 AND m.content ILIKE $2
            ORDER BY m.created_at DESC
            LIMIT $3
        `;

        const params = [chatId, `%${searchTerm}%`, limit];
        return await this.query(sql, params);
    }

    async createChat(chatData) {
        if (this.connectionType === 'fallback') {
            return this.fallbackDb.createChat(chatData);
        }

        const {
            name,
            type = 'private',
            description = '',
            workspace_id = null,
            created_by
        } = chatData;

        const sql = `
            INSERT INTO chats (name, type, description, workspace_id, created_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;

        const params = [name, type, description, workspace_id, created_by];
        const result = await this.query(sql, params);
        return result[0];
    }

    async getChatsByUserId(userId) {
        if (this.connectionType === 'fallback') {
            return this.fallbackDb.getChatsByUserId(userId);
        }

        const sql = `
            SELECT c.*, cp.role, cp.joined_at
            FROM chats c
            JOIN chat_participants cp ON c.id = cp.chat_id
            WHERE cp.user_id = $1
            ORDER BY c.updated_at DESC
        `;

        return await this.query(sql, [userId]);
    }

    async getChats(options = {}) {
        if (this.connectionType === 'fallback') {
            return this.fallbackDb.getChats(options);
        }

        const { userId, workspaceId, type, limit = 50, offset = 0 } = options;
        let sql = 'SELECT * FROM chats WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (type) {
            sql += ` AND type = $${paramIndex++}`;
            params.push(type);
        }

        if (workspaceId) {
            sql += ` AND workspace_id = $${paramIndex++}`;
            params.push(workspaceId);
        }

        sql += ` ORDER BY updated_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        return await this.query(sql, params);
    }

    async addUserToChat(chatId, userId, role = 'member') {
        if (this.connectionType === 'fallback') {
            return this.fallbackDb.addUserToChat(chatId, userId, role);
        }

        const sql = `
            INSERT INTO chat_participants (chat_id, user_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (chat_id, user_id) DO NOTHING
            RETURNING *
        `;

        const params = [chatId, userId, role];
        const result = await this.query(sql, params);
        return result[0];
    }

    async addChatParticipant(chatId, userId, role = 'member') {
        return this.addUserToChat(chatId, userId, role);
    }

    async addChatParticipants(chatId, userIds) {
        if (this.connectionType === 'fallback') {
            return this.fallbackDb.addChatParticipants(chatId, userIds);
        }

        const results = [];
        for (const userId of userIds) {
            const participant = await this.addUserToChat(chatId, userId);
            results.push(participant);
        }
        return results;
    }

    // Enhanced health check method
    async healthCheck() {
        if (this.connectionType === 'fallback') {
            return this.fallbackDb.healthCheck();
        }

        let client;
        try {
            client = await this.pool.connect();
            const result = await client.query('SELECT NOW() as current_time, version() as pg_version');

            // Get pool statistics
            const poolStats = {
                totalCount: this.pool.totalCount,
                idleCount: this.pool.idleCount,
                waitingCount: this.pool.waitingCount
            };

            return {
                connected: true,
                timestamp: result.rows[0].current_time,
                version: result.rows[0].pg_version,
                type: 'postgresql',
                pool: poolStats,
                retries: this.connectionRetries
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                type: 'postgresql',
                retries: this.connectionRetries
            };
        } finally {
            if (client) {
                client.release();
            }
        }
    }

    // Get database statistics
    async getStats() {
        if (this.connectionType === 'fallback') {
            return { type: 'fallback', tables: 0 };
        }

        try {
            const result = await this.query(`
                SELECT
                    schemaname,
                    tablename,
                    attname,
                    n_distinct,
                    null_frac
                FROM pg_stats
                WHERE schemaname = 'public'
                LIMIT 10
            `);

            return {
                type: 'postgresql',
                sampleStats: result.length,
                pool: {
                    total: this.pool.totalCount,
                    idle: this.pool.idleCount,
                    waiting: this.pool.waitingCount
                }
            };
        } catch (error) {
            return {
                type: 'postgresql',
                error: error.message
            };
        }
    }
}

module.exports = DatabaseInitializer;

// Handle graceful shutdown for database connections
process.on('SIGTERM', async () => {
    console.log('🔄 Closing database connections...');
    // Note: Individual instances will handle their own cleanup
});

process.on('SIGINT', async () => {
    console.log('🔄 Closing database connections...');
    // Note: Individual instances will handle their own cleanup
});