const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Create database instance with proper error handling
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'talkpai.db');
let db;

function createDatabase() {
  try {
    // Ensure the directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(dbPath);
    console.log('✅ Database connected to:', dbPath);
  } catch (error) {
    console.error('❌ Database creation failed:', error.message);
    // Fallback to memory database for Railway
    console.log('🔄 Using in-memory database as fallback...');
    db = new Database(':memory:');
  }
}

// Initialize database connection
createDatabase();

// Better-sqlite3 uses synchronous methods
const runSync = (sql, params = []) => {
  try {
    if (params.length > 0) {
      return db.prepare(sql).run(params);
    }
    return db.prepare(sql).run();
  } catch (error) {
    console.error('Database run error:', error.message);
    throw error;
  }
};

const getSync = (sql, params = []) => {
  try {
    if (params.length > 0) {
      return db.prepare(sql).get(params);
    }
    return db.prepare(sql).get();
  } catch (error) {
    console.error('Database get error:', error.message);
    throw error;
  }
};

const allSync = (sql, params = []) => {
  try {
    if (params.length > 0) {
      return db.prepare(sql).all(params);
    }
    return db.prepare(sql).all();
  } catch (error) {
    console.error('Database all error:', error.message);
    throw error;
  }
};

// Initialize database schema
function initialize() {
  try {
    // Enable foreign keys and optimize settings
    runSync('PRAGMA foreign_keys = ON');
    runSync('PRAGMA journal_mode = WAL');
    runSync('PRAGMA synchronous = NORMAL');
    runSync('PRAGMA temp_store = memory');
    runSync('PRAGMA mmap_size = 268435456'); // 256MB

    // Users table
    runSync(`
      CREATE TABLE IF NOT EXISTS users (
        nickname TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        salt TEXT NOT NULL,
        theme TEXT DEFAULT 'auto',
        avatar TEXT DEFAULT '👤',
        notifications INTEGER DEFAULT 1,
        last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Messages table
    runSync(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        receiver TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        content TEXT NOT NULL,
        reply_to INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        read INTEGER DEFAULT 0,
        deleted_for_sender INTEGER DEFAULT 0,
        deleted_for_receiver INTEGER DEFAULT 0,
        FOREIGN KEY (sender) REFERENCES users(nickname) ON DELETE CASCADE,
        FOREIGN KEY (reply_to) REFERENCES messages(id)
      )
    `);

    // Sessions table
    runSync(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        device_info TEXT,
        ip_address TEXT,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME DEFAULT (datetime('now', '+7 days')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (nickname) REFERENCES users(nickname) ON DELETE CASCADE
      )
    `);

    // Contacts table
    runSync(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner TEXT NOT NULL,
        contact TEXT NOT NULL,
        blocked INTEGER DEFAULT 0,
        muted INTEGER DEFAULT 0,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner) REFERENCES users(nickname) ON DELETE CASCADE,
        FOREIGN KEY (contact) REFERENCES users(nickname) ON DELETE CASCADE,
        UNIQUE(owner, contact)
      )
    `);

    // Create indexes for better performance
    runSync('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender)');
    runSync('CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver)');
    runSync('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)');
    runSync('CREATE INDEX IF NOT EXISTS idx_sessions_nickname ON sessions(nickname)');
    runSync('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)');

    console.log('✅ Database schema initialized successfully');

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
}

// Database operations
const createUser = (nickname, password, salt, avatar = '👤') => {
  return runSync(
    'INSERT INTO users (nickname, password, salt, avatar) VALUES (?, ?, ?, ?)',
    [nickname, password, salt, avatar]
  );
};

const getUserByNickname = (nickname) => {
  return getSync('SELECT * FROM users WHERE nickname = ?', [nickname]);
};

const getAllUsers = () => {
  return allSync('SELECT nickname, avatar, last_seen, created_at FROM users ORDER BY nickname');
};

const updateLastSeen = (nickname) => {
  return runSync(
    'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE nickname = ?',
    [nickname]
  );
};

const saveMessage = (sender, receiver, type, content, replyTo = null) => {
  return runSync(
    'INSERT INTO messages (sender, receiver, type, content, reply_to) VALUES (?, ?, ?, ?, ?)',
    [sender, receiver, type, content, replyTo]
  );
};

const getMessages = (user1, user2, limit = 50) => {
  return allSync(`
    SELECT * FROM messages
    WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
    AND deleted_for_sender = 0 AND deleted_for_receiver = 0
    ORDER BY timestamp DESC
    LIMIT ?
  `, [user1, user2, user2, user1, limit]);
};

const markMessagesAsRead = (sender, receiver) => {
  return runSync(
    'UPDATE messages SET read = 1 WHERE sender = ? AND receiver = ? AND read = 0',
    [sender, receiver]
  );
};

const getUnreadCount = (receiver) => {
  const result = getSync(
    'SELECT COUNT(*) as count FROM messages WHERE receiver = ? AND read = 0',
    [receiver]
  );
  return result ? result.count : 0;
};

const createSession = (nickname, token, deviceInfo, ipAddress) => {
  return runSync(
    'INSERT INTO sessions (nickname, token, device_info, ip_address) VALUES (?, ?, ?, ?)',
    [nickname, token, deviceInfo, ipAddress]
  );
};

const getSession = (token) => {
  return getSync(
    'SELECT * FROM sessions WHERE token = ? AND expires_at > datetime("now")',
    [token]
  );
};

const deleteSession = (token) => {
  return runSync('DELETE FROM sessions WHERE token = ?', [token]);
};

const deleteExpiredSessions = () => {
  return runSync('DELETE FROM sessions WHERE expires_at <= datetime("now")');
};

const addContact = (owner, contact) => {
  return runSync(
    'INSERT OR IGNORE INTO contacts (owner, contact) VALUES (?, ?)',
    [owner, contact]
  );
};

const getContacts = (owner) => {
  return allSync(`
    SELECT u.nickname, u.avatar, u.last_seen, c.blocked, c.muted
    FROM contacts c
    JOIN users u ON c.contact = u.nickname
    WHERE c.owner = ?
    ORDER BY u.nickname
  `, [owner]);
};

// Export all functions
module.exports = {
  db,
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
  runSync,
  getSync,
  allSync
};