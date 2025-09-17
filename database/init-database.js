const fs = require('fs');
const path = require('path');

// Database initialization script
class DatabaseInitializer {
    constructor() {
        this.isConnected = false;
        this.client = null;
        this.connectionType = 'sqlite'; // Default to SQLite for Railway compatibility
    }

    async connect() {
        try {
            // Try PostgreSQL first
            if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres')) {
                console.log('🔗 Attempting PostgreSQL connection...');
                await this.connectPostgreSQL();
            } else {
                // Fallback to SQLite
                console.log('🔗 Using SQLite fallback database...');
                await this.connectSQLite();
            }

            console.log(`✅ Database connected successfully (${this.connectionType})`);
            await this.initializeSchema();
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            return false;
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

    async connectSQLite() {
        try {
            const sqlite3 = require('sqlite3').verbose();

            const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'talkpai.db');

            // Ensure directory exists
            const dbDir = path.dirname(dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            this.client = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    throw err;
                }
            });
            this.isConnected = true;
            this.connectionType = 'sqlite';

            // Enable foreign keys
            this.client.run('PRAGMA foreign_keys = ON');

            console.log('📂 SQLite database initialized at:', dbPath);

        } catch (error) {
            console.error('SQLite connection failed:', error.message);
            throw error;
        }
    }

    async initializeSchema() {
        try {
            console.log('🔧 Initializing database schema...');

            let schemaPath;
            if (this.connectionType === 'postgresql') {
                schemaPath = path.join(__dirname, 'production-schema.sql');
            } else {
                schemaPath = path.join(__dirname, 'sqlite-schema.sql');
            }

            if (!fs.existsSync(schemaPath)) {
                console.warn(`Schema file not found: ${schemaPath}, trying alternative...`);
                schemaPath = path.join(__dirname, 'fixed-schema.sql');
            }

            if (!fs.existsSync(schemaPath)) {
                throw new Error('No schema file found');
            }

            const schema = fs.readFileSync(schemaPath, 'utf8');

            if (this.connectionType === 'postgresql') {
                await this.initializePostgreSQLSchema(schema);
            } else {
                await this.initializeSQLiteSchema(schema);
            }

            console.log('✅ Database schema initialized successfully');

        } catch (error) {
            console.error('❌ Schema initialization failed:', error.message);
            // Don't throw error - continue with empty database
            console.log('⚠️ Continuing with basic database setup...');
        }
    }

    async initializePostgreSQLSchema(schema) {
        try {
            // Enable UUID extension first
            await this.client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

            // Split and execute statements
            const statements = schema
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

            for (const statement of statements) {
                if (statement.includes('uuid_generate_v4()')) {
                    // Convert SQLite UUID function to PostgreSQL
                    const pgStatement = statement.replace(
                        /DEFAULT \(lower\(hex\(randomblob\(4\)\)\).*?\)/g,
                        'DEFAULT uuid_generate_v4()'
                    );
                    await this.client.query(pgStatement);
                } else {
                    await this.client.query(statement);
                }
            }

        } catch (error) {
            if (!error.message.includes('already exists')) {
                console.error('❌ PostgreSQL schema error:', error.message);
            }
        }
    }

    async initializeSQLiteSchema(schema) {
        try {
            // Split and execute statements
            const statements = schema
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

            for (const statement of statements) {
                try {
                    await new Promise((resolve, reject) => {
                        this.client.run(statement, (err) => {
                            if (err && !err.message.includes('already exists')) {
                                console.warn('⚠️ SQLite statement warning:', err.message);
                            }
                            resolve();
                        });
                    });
                } catch (error) {
                    if (!error.message.includes('already exists')) {
                        console.warn('⚠️ SQLite statement warning:', error.message);
                    }
                }
            }

        } catch (error) {
            console.error('❌ SQLite schema error:', error.message);
            throw error;
        }
    }

    async query(sql, params = []) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        try {
            if (this.connectionType === 'postgresql') {
                const result = await this.client.query(sql, params);
                return result.rows;
            } else {
                // SQLite3 (using callback-based API)
                return await new Promise((resolve, reject) => {
                    if (sql.toLowerCase().startsWith('select')) {
                        this.client.all(sql, params, (err, rows) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(rows || []);
                            }
                        });
                    } else {
                        this.client.run(sql, params, function(err) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve({
                                    rowCount: this.changes,
                                    insertId: this.lastID
                                });
                            }
                        });
                    }
                });
            }
        } catch (error) {
            console.error('❌ Query error:', error.message);
            console.error('❌ SQL:', sql);
            throw error;
        }
    }

    async close() {
        if (this.client) {
            if (this.connectionType === 'postgresql') {
                await this.client.end();
            } else {
                await new Promise((resolve) => {
                    this.client.close((err) => {
                        if (err) {
                            console.warn('Database close warning:', err.message);
                        }
                        resolve();
                    });
                });
            }
            this.isConnected = false;
            console.log('🔐 Database connection closed');
        }
    }

    // Utility methods for common operations
    async getUserByNickname(nickname) {
        const sql = 'SELECT * FROM users WHERE nickname = ?';
        const params = this.connectionType === 'postgresql' ? [nickname] : [nickname];
        const result = await this.query(sql, params);
        return result[0] || null;
    }

    async createUser(userData) {
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
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const params = [nickname, email, password_hash, display_name, bio, account_type];
        return await this.query(sql, params);
    }

    async getMessages(chatId, limit = 50, offset = 0) {
        const sql = `
            SELECT m.*, u.nickname as sender_nickname, u.display_name as sender_display_name, u.avatar_url as sender_avatar
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ?
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const params = [chatId, limit, offset];
        return await this.query(sql, params);
    }

    async createMessage(messageData) {
        const {
            chat_id,
            sender_id,
            content,
            message_type = 'text',
            reply_to_id = null,
            metadata = '{}'
        } = messageData;

        const sql = `
            INSERT INTO messages (chat_id, sender_id, content, message_type, reply_to_id, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const params = [chat_id, sender_id, content, message_type, reply_to_id,
                       typeof metadata === 'string' ? metadata : JSON.stringify(metadata)];
        return await this.query(sql, params);
    }

    async searchMessages(chatId, searchTerm, limit = 20) {
        const sql = `
            SELECT m.*, u.nickname as sender_nickname, u.display_name as sender_display_name
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ? AND m.content LIKE ?
            ORDER BY m.created_at DESC
            LIMIT ?
        `;

        const params = [chatId, `%${searchTerm}%`, limit];
        return await this.query(sql, params);
    }
}

module.exports = DatabaseInitializer;