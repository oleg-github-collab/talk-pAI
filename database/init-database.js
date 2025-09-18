const fs = require('fs');
const path = require('path');

// Database Initializer with PostgreSQL primary and fallback support
class DatabaseInitializer {
    constructor() {
        this.isConnected = false;
        this.client = null;
        this.connectionType = 'postgresql';
        this.fallbackDb = null;
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
            const { Client } = require('pg');

            this.client = new Client({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });

            await this.client.connect();
            this.isConnected = true;
            this.connectionType = 'postgresql';

            // Test connection
            const result = await this.client.query('SELECT NOW()');
            console.log('📅 PostgreSQL connected at:', result.rows[0].now);

        } catch (error) {
            console.error('PostgreSQL connection failed:', error.message);
            throw error;
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
        try {
            // Enable UUID extension first
            await this.client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
            console.log('✅ UUID extension enabled');

            // Split and execute statements
            const statements = schema
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

            console.log(`🔧 Executing ${statements.length} schema statements...`);

            for (const statement of statements) {
                try {
                    await this.client.query(statement);
                } catch (error) {
                    if (!error.message.includes('already exists')) {
                        console.error('❌ PostgreSQL schema error:', error.message);
                        console.error('❌ Statement:', statement.substring(0, 100) + '...');
                        throw error;
                    } else {
                        console.log('⚠️ Table/index already exists, skipping...');
                    }
                }
            }

            console.log('✅ All schema statements executed successfully');

        } catch (error) {
            console.error('❌ PostgreSQL schema initialization failed:', error.message);
            throw error;
        }
    }

    async query(sql, params = []) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        if (this.connectionType === 'fallback') {
            return this.fallbackDb.query(sql, params);
        }

        try {
            // Convert ? placeholders to $1, $2, etc. for PostgreSQL
            let pgSql = sql;
            let pgParams = params;

            if (sql.includes('?')) {
                let paramIndex = 1;
                pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
            }

            const result = await this.client.query(pgSql, pgParams);
            return result.rows;
        } catch (error) {
            console.error('❌ Query error:', error.message);
            console.error('❌ SQL:', sql);
            console.error('❌ Params:', params);
            throw error;
        }
    }

    async close() {
        if (this.connectionType === 'fallback' && this.fallbackDb) {
            await this.fallbackDb.close();
        } else if (this.client) {
            await this.client.end();
        }
        this.isConnected = false;
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

    // Health check method
    async healthCheck() {
        if (this.connectionType === 'fallback') {
            return this.fallbackDb.healthCheck();
        }

        try {
            const result = await this.client.query('SELECT NOW() as current_time, version() as pg_version');
            return {
                connected: true,
                timestamp: result.rows[0].current_time,
                version: result.rows[0].pg_version,
                type: 'postgresql'
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                type: 'postgresql'
            };
        }
    }
}

module.exports = DatabaseInitializer;