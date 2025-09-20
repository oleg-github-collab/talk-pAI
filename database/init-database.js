const fs = require('fs');
const path = require('path');

// PostgreSQL Database Initializer - Production Only
class DatabaseInitializer {
    constructor() {
        this.isConnected = false;
        this.pool = null;
        this.connectionType = 'postgresql';
        this.connectionRetries = 0;
        this.maxRetries = 5;
        this.reconnectTimer = null;
        this.healthCheckInterval = null;
    }

    async connect() {
        try {
            console.log('🔗 Connecting to PostgreSQL database...');
            await this.connectPostgreSQL();
            console.log(`✅ Database connected successfully (${this.connectionType})`);
            await this.initializeSchema();
            return true;
        } catch (error) {
            console.error('❌ PostgreSQL connection failed:', error.message);
            throw new Error(`Database connection failed: ${error.message}`);
        }
    }

    async connectPostgreSQL() {
        try {
            const { Pool } = require('pg');

            // Use connection pooling for better performance and reliability
            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: false, // Disable SSL for local PostgreSQL
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 10000,
            });

            // Test the connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            this.isConnected = true;
            this.connectionType = 'postgresql';

            // Set up connection error handling
            this.pool.on('error', (err) => {
                console.error('PostgreSQL pool error:', err);
                this.isConnected = false;
            });

            this.pool.on('connect', () => {
                this.connectionRetries = 0;
            });

        } catch (error) {
            this.isConnected = false;
            this.connectionRetries++;
            console.error(`PostgreSQL connection attempt ${this.connectionRetries} failed:`, error.message);

            if (this.connectionRetries < this.maxRetries) {
                console.log(`🔄 Retrying in 5 seconds... (${this.connectionRetries}/${this.maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                return await this.connectPostgreSQL();
            } else {
                throw new Error(`Failed to connect after ${this.maxRetries} attempts: ${error.message}`);
            }
        }
    }

    parseSchemaStatements(schema) {
        const statements = [];
        let currentStatement = '';
        let inFunction = false;
        let dollarQuoteDepth = 0;

        const lines = schema.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Skip comments and empty lines when not inside a function
            if (!inFunction && (!trimmedLine || trimmedLine.startsWith('--'))) {
                continue;
            }

            // Check if we're entering a function definition
            if (!inFunction && (trimmedLine.toLowerCase().includes('create') ||
                              currentStatement.toLowerCase().includes('create')) &&
                (trimmedLine.toLowerCase().includes('function') ||
                 currentStatement.toLowerCase().includes('function'))) {
                // Look for the start of function body (AS $$)
                if (line.includes('$$')) {
                    inFunction = true;
                    dollarQuoteDepth = 1;
                }
            }

            // Count $$ pairs in this line
            const dollarMatches = line.match(/\$\$/g);
            if (dollarMatches) {
                if (inFunction) {
                    dollarQuoteDepth += dollarMatches.length;
                } else if (line.includes('$$')) {
                    // Starting a function
                    inFunction = true;
                    dollarQuoteDepth = dollarMatches.length;
                }
            }

            currentStatement += line + '\n';

            // Check for statement end
            if (line.endsWith(';')) {
                if (inFunction) {
                    // Function ends when we have an even number of $$ and the line ends with ;
                    if (dollarQuoteDepth % 2 === 0) {
                        inFunction = false;
                        statements.push(currentStatement.trim());
                        currentStatement = '';
                        dollarQuoteDepth = 0;
                    }
                } else {
                    // Regular statement end
                    statements.push(currentStatement.trim());
                    currentStatement = '';
                }
            }
        }

        // Add any remaining statement
        if (currentStatement.trim()) {
            statements.push(currentStatement.trim());
        }

        return statements.filter(stmt => stmt && !stmt.startsWith('--'));
    }

    async initializeSchema() {
        try {
            console.log('🔧 Initializing PostgreSQL database schema...');

            // Check if schema is already initialized
            const existingTables = await this.query(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'users'
            `);

            if (existingTables.rows.length > 0) {
                console.log('✅ PostgreSQL database schema already exists, skipping initialization');
                return;
            }

            const schemaPath = path.join(__dirname, 'production-schema.sql');
            if (!fs.existsSync(schemaPath)) {
                throw new Error('Database schema file not found');
            }

            console.log('🔧 Installing schema from file...');

            // Execute the entire schema as a single transaction
            const schema = fs.readFileSync(schemaPath, 'utf8');
            await this.query(schema);

            console.log('✅ PostgreSQL database schema initialized successfully');
        } catch (error) {
            console.error('❌ Schema initialization failed:', error.message);
            throw error;
        }
    }

    async query(sql, params = []) {
        if (!this.isConnected || !this.pool) {
            throw new Error('Database not connected');
        }

        try {
            const result = await this.pool.query(sql, params);
            return result;
        } catch (error) {
            console.error('Database query error:', error.message);
            throw error;
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            console.log('✅ Database connection closed');
        }
    }

    // User management methods
    async getUserByNickname(nickname) {
        const result = await this.query('SELECT * FROM users WHERE nickname = $1', [nickname]);
        return result.rows[0] || null;
    }

    async getUserByEmail(email) {
        const result = await this.query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0] || null;
    }

    async createUser(userData) {
        const { nickname, email, password_hash, salt, display_name, bio, avatar } = userData;
        const result = await this.query(
            `INSERT INTO users (nickname, email, password_hash, salt, display_name, bio, avatar)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [nickname, email, password_hash, salt, display_name, bio, avatar]
        );
        return result.rows[0];
    }

    // Session management
    async createSession(sessionData) {
        const { user_id, token, refresh_token, expires_at, user_agent, ip_address } = sessionData;
        const result = await this.query(
            `INSERT INTO sessions (user_id, token, refresh_token, expires_at, user_agent, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [user_id, token, refresh_token, expires_at, user_agent, ip_address]
        );
        return result.rows[0];
    }

    async findSessionByToken(token) {
        const result = await this.query(
            `SELECT s.*, u.nickname, u.avatar
             FROM sessions s
             JOIN users u ON s.user_id = u.id
             WHERE s.token = $1 AND s.is_active = true AND s.expires_at > NOW()`,
            [token]
        );
        return result.rows[0] || null;
    }

    async deleteSession(userId, token) {
        await this.query(
            'UPDATE sessions SET is_active = false WHERE user_id = $1 AND token = $2',
            [userId, token]
        );
    }

    // Chat methods
    async getMessages(options = {}) {
        const { chatId, limit = 50, offset = 0 } = options;
        const result = await this.query(
            `SELECT m.*, u.nickname as sender_nickname, u.avatar as sender_avatar
             FROM messages m
             LEFT JOIN users u ON m.sender_id = u.id
             WHERE m.chat_id = $1 AND m.is_deleted = false
             ORDER BY m.created_at DESC
             LIMIT $2 OFFSET $3`,
            [chatId, limit, offset]
        );
        return result.rows.reverse();
    }

    async createMessage(messageData) {
        const { chat_id, sender_id, content, message_type, metadata } = messageData;
        const result = await this.query(
            `INSERT INTO messages (chat_id, sender_id, content, message_type, metadata)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [chat_id, sender_id, content, message_type || 'text', JSON.stringify(metadata || {})]
        );

        // Update chat last_message_at
        await this.query(
            'UPDATE chats SET last_message_at = NOW() WHERE id = $1',
            [chat_id]
        );

        return result.rows[0];
    }

    async createChat(chatData) {
        const { name, description, type, created_by, avatar } = chatData;
        const result = await this.query(
            `INSERT INTO chats (name, description, type, created_by, avatar)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, description, type || 'private', created_by, avatar]
        );
        return result.rows[0];
    }

    async getChatsByUserId(userId) {
        const result = await this.query(
            `SELECT c.*, cp.role, cp.last_read_at,
                    (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id AND m.created_at > cp.last_read_at) as unread_count,
                    (SELECT content FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message
             FROM chats c
             JOIN chat_participants cp ON c.id = cp.chat_id
             WHERE cp.user_id = $1 AND cp.left_at IS NULL AND c.is_active = true
             ORDER BY c.last_message_at DESC`,
            [userId]
        );
        return result.rows;
    }

    async getChats(options = {}) {
        const { limit = 50, offset = 0, type } = options;
        let query = `SELECT * FROM chats WHERE is_active = true`;
        const params = [];

        if (type) {
            query += ` AND type = $1`;
            params.push(type);
            query += ` ORDER BY last_message_at DESC LIMIT $2 OFFSET $3`;
            params.push(limit, offset);
        } else {
            query += ` ORDER BY last_message_at DESC LIMIT $1 OFFSET $2`;
            params.push(limit, offset);
        }

        const result = await this.query(query, params);
        return result.rows;
    }

    async addUserToChat(chatId, userId, role = 'member') {
        const result = await this.query(
            `INSERT INTO chat_participants (chat_id, user_id, role)
             VALUES ($1, $2, $3)
             ON CONFLICT (chat_id, user_id) DO UPDATE SET left_at = NULL, role = $3
             RETURNING *`,
            [chatId, userId, role]
        );
        return result.rows[0];
    }

    async addChatParticipants(chatId, userIds) {
        const promises = userIds.map(userId => this.addUserToChat(chatId, userId));
        return await Promise.all(promises);
    }

    async getActiveUsers() {
        const result = await this.query(
            `SELECT id, nickname, display_name, avatar, status, last_seen
             FROM users
             WHERE is_active = true
             ORDER BY last_seen DESC
             LIMIT 100`
        );
        return result.rows;
    }

    async getUserChats(userId) {
        return await this.getChatsByUserId(userId);
    }

    async healthCheck() {
        try {
            await this.query('SELECT 1');
            return { status: 'healthy', database: 'postgresql' };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }

    async getStats() {
        try {
            const tables = await this.query(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            `);

            return {
                type: 'postgresql',
                tables: tables.rows.length,
                connected: this.isConnected
            };
        } catch (error) {
            return { type: 'postgresql', error: error.message };
        }
    }
}

module.exports = DatabaseInitializer;