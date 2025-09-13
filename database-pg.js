const { Pool } = require('pg');

// PostgreSQL connection pool
let pool;

function createPool() {
  try {
    // Check for any database URL
    const dbUrl = process.env.DATABASE_URL ||
                  process.env.POSTGRES_URL ||
                  process.env.DB_URL ||
                  process.env.POSTGRESQL_URL;

    if (!dbUrl) {
      console.log('⚠️ No database URL found - PostgreSQL pool not created');
      return null;
    }

    const config = {
      connectionString: dbUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    pool = new Pool(config);

    pool.on('error', (err, client) => {
      console.error('Unexpected error on idle client', err);
    });

    console.log('✅ PostgreSQL pool created');
    return pool;
  } catch (error) {
    console.error('❌ PostgreSQL pool creation failed:', error.message);
    throw error;
  }
}

// Initialize pool
createPool();

// Database helper functions
const query = async (text, params = []) => {
  if (!pool) {
    throw new Error('PostgreSQL not initialized - DATABASE_URL required');
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database query error:', error.message);
    console.error('Query:', text);
    console.error('Params:', params);
    throw error;
  }
};

// Initialize database schema
async function initialize() {
  try {
    console.log('🗄️ Initializing PostgreSQL database...');

    // Check for DATABASE_URL (Railway auto-provides this)
    const dbUrl = process.env.DATABASE_URL ||
                  process.env.POSTGRES_URL ||
                  process.env.DB_URL ||
                  process.env.POSTGRESQL_URL;

    if (!dbUrl) {
      console.log('⚠️ No database URL found - database features disabled');
      console.log('💡 Railway will automatically provide DATABASE_URL when PostgreSQL service is added');
      return;
    }

    console.log('✅ Database URL detected:', dbUrl.substring(0, 30) + '...');

    // Test connection first
    try {
      await query('SELECT NOW()');
      console.log('✅ PostgreSQL connection verified');
    } catch (error) {
      console.error('❌ PostgreSQL connection failed:', error.message);
      return;
    }

    // Create extensions (ignore errors if already exist)
    try {
      await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      console.log('✅ UUID extension ready');
    } catch (error) {
      console.warn('⚠️ UUID extension warning:', error.message);
    }

    // Users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        nickname VARCHAR(50) PRIMARY KEY,
        password TEXT NOT NULL,
        salt TEXT NOT NULL,
        theme VARCHAR(20) DEFAULT 'auto',
        avatar VARCHAR(10) DEFAULT '👤',
        notifications BOOLEAN DEFAULT true,
        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Messages table
    await query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender VARCHAR(50) NOT NULL,
        receiver VARCHAR(50) NOT NULL,
        type VARCHAR(20) DEFAULT 'text',
        content TEXT NOT NULL,
        reply_to INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read BOOLEAN DEFAULT false,
        deleted_for_sender BOOLEAN DEFAULT false,
        deleted_for_receiver BOOLEAN DEFAULT false,
        FOREIGN KEY (sender) REFERENCES users(nickname) ON DELETE CASCADE,
        FOREIGN KEY (reply_to) REFERENCES messages(id)
      )
    `);

    // Sessions table
    await query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        nickname VARCHAR(50) NOT NULL,
        token TEXT NOT NULL UNIQUE,
        device_info TEXT,
        ip_address INET,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (nickname) REFERENCES users(nickname) ON DELETE CASCADE
      )
    `);

    // Contacts table
    await query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        owner VARCHAR(50) NOT NULL,
        contact VARCHAR(50) NOT NULL,
        blocked BOOLEAN DEFAULT false,
        muted BOOLEAN DEFAULT false,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner) REFERENCES users(nickname) ON DELETE CASCADE,
        FOREIGN KEY (contact) REFERENCES users(nickname) ON DELETE CASCADE,
        UNIQUE(owner, contact)
      )
    `);

    // Create indexes for better performance
    await query('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender)');
    await query('CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver)');
    await query('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)');
    await query('CREATE INDEX IF NOT EXISTS idx_sessions_nickname ON sessions(nickname)');
    await query('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)');
    await query('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)');

    console.log('✅ PostgreSQL database schema initialized successfully');

    // Verify tables were created
    const tableCheck = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📊 Created tables:', tableCheck.rows.map(r => r.table_name).join(', '));

  } catch (error) {
    console.error('❌ PostgreSQL database initialization failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Database operations
const createUser = async (nickname, password, salt, avatar = '👤') => {
  const result = await query(
    'INSERT INTO users (nickname, password, salt, avatar) VALUES ($1, $2, $3, $4) RETURNING *',
    [nickname, password, salt, avatar]
  );
  return result.rows[0];
};

const getUserByNickname = async (nickname) => {
  const result = await query('SELECT * FROM users WHERE nickname = $1', [nickname]);
  return result.rows[0];
};

const getAllUsers = async () => {
  const result = await query('SELECT nickname, avatar, last_seen, created_at FROM users ORDER BY nickname');
  return result.rows;
};

const updateLastSeen = async (nickname) => {
  const result = await query(
    'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE nickname = $1 RETURNING *',
    [nickname]
  );
  return result.rows[0];
};

const saveMessage = async (sender, receiver, type, content, replyTo = null) => {
  const result = await query(
    'INSERT INTO messages (sender, receiver, type, content, reply_to) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [sender, receiver, type, content, replyTo]
  );
  return result.rows[0];
};

const getMessages = async (user1, user2, limit = 50) => {
  const result = await query(`
    SELECT * FROM messages
    WHERE ((sender = $1 AND receiver = $2) OR (sender = $2 AND receiver = $1))
    AND deleted_for_sender = false AND deleted_for_receiver = false
    ORDER BY timestamp DESC
    LIMIT $3
  `, [user1, user2, limit]);
  return result.rows;
};

const markMessagesAsRead = async (sender, receiver) => {
  const result = await query(
    'UPDATE messages SET read = true WHERE sender = $1 AND receiver = $2 AND read = false RETURNING *',
    [sender, receiver]
  );
  return result.rows;
};

const getUnreadCount = async (receiver) => {
  const result = await query(
    'SELECT COUNT(*) as count FROM messages WHERE receiver = $1 AND read = false',
    [receiver]
  );
  return parseInt(result.rows[0].count);
};

const createSession = async (nickname, token, deviceInfo, ipAddress) => {
  const result = await query(
    'INSERT INTO sessions (nickname, token, device_info, ip_address) VALUES ($1, $2, $3, $4) RETURNING *',
    [nickname, token, deviceInfo, ipAddress]
  );
  return result.rows[0];
};

const getSession = async (token) => {
  const result = await query(
    'SELECT * FROM sessions WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP',
    [token]
  );
  return result.rows[0];
};

const deleteSession = async (token) => {
  const result = await query('DELETE FROM sessions WHERE token = $1 RETURNING *', [token]);
  return result.rows[0];
};

const deleteExpiredSessions = async () => {
  const result = await query('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP RETURNING *');
  return result.rows;
};

const addContact = async (owner, contact) => {
  const result = await query(
    'INSERT INTO contacts (owner, contact) VALUES ($1, $2) ON CONFLICT (owner, contact) DO NOTHING RETURNING *',
    [owner, contact]
  );
  return result.rows[0];
};

const getContacts = async (owner) => {
  const result = await query(`
    SELECT u.nickname, u.avatar, u.last_seen, c.blocked, c.muted
    FROM contacts c
    JOIN users u ON c.contact = u.nickname
    WHERE c.owner = $1
    ORDER BY u.nickname
  `, [owner]);
  return result.rows;
};

// Close pool gracefully
const closePool = async () => {
  if (pool) {
    await pool.end();
    console.log('✅ PostgreSQL pool closed');
  }
};

// Export all functions
module.exports = {
  pool,
  query,
  initialize,
  createUser,
  getUserByNickname,
  getAllUsers,
  updateLastSeen,
  saveMessage,
  getMessages,
  markMessagesAsRead,
  getUnreadCount,
  createSession,
  getSession,
  deleteSession,
  deleteExpiredSessions,
  addContact,
  getContacts,
  closePool
};