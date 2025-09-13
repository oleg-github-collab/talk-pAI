const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database instance
const dbPath = path.join(__dirname, process.env.DATABASE_PATH || 'talkpai.db');
const db = new sqlite3.Database(dbPath);

// Promisify database methods for easier use
const runAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const getAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize database schema with proper isolation
async function initialize() {
  try {
    // Enable foreign keys and WAL mode
    await runAsync('PRAGMA foreign_keys = ON');
    await runAsync('PRAGMA journal_mode = WAL');
    
    // Users table
    await runAsync(`
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
    await runAsync(`
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
    await runAsync(`
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
    await runAsync(`
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

    // Typing status table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS typing_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        receiver TEXT NOT NULL,
        is_typing INTEGER DEFAULT 0,
        last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sender, receiver)
      )
    `);

    // Summaries table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user TEXT NOT NULL,
        conversation TEXT NOT NULL,
        summary TEXT NOT NULL,
        message_count INTEGER,
        start_date DATETIME,
        end_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user) REFERENCES users(nickname) ON DELETE CASCADE
      )
    `);

    // News preferences table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS news_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        categories TEXT NOT NULL,
        sources TEXT,
        frequency TEXT DEFAULT 'daily',
        language TEXT DEFAULT 'en',
        max_articles INTEGER DEFAULT 5,
        last_sent DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(nickname) ON DELETE CASCADE,
        UNIQUE(user_id)
      )
    `);

    // Create indexes
    await runAsync('CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver, deleted_for_receiver)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender, deleted_for_sender)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner, blocked)');

    // Create pAI assistant user
    const paiUser = await getAsync('SELECT * FROM users WHERE nickname = ?', ['pAI']);
    if (!paiUser) {
      await runAsync(
        'INSERT INTO users (nickname, password, salt, avatar, theme) VALUES (?, ?, ?, ?, ?)',
        ['pAI', 'system', 'system', '🤖', 'auto']
      );
    }

    // Create Sage news agent user
    const sageUser = await getAsync('SELECT * FROM users WHERE nickname = ?', ['Sage']);
    if (!sageUser) {
      await runAsync(
        'INSERT INTO users (nickname, password, salt, avatar, theme) VALUES (?, ?, ?, ?, ?)',
        ['Sage', 'system', 'system', '📰', 'auto']
      );
    }

    console.log('✅ Database initialized');
    
    // Schedule cleanup
    cleanupExpiredSessions();
    setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
    
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Clean up expired sessions
async function cleanupExpiredSessions() {
  try {
    await runAsync("DELETE FROM sessions WHERE expires_at < datetime('now')");
    await runAsync("DELETE FROM typing_status WHERE datetime(last_update) < datetime('now', '-1 minute')");
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// User operations
function createUser(nickname, password, salt, avatar = '👤') {
  return runAsync(
    'INSERT INTO users (nickname, password, salt, avatar) VALUES (?, ?, ?, ?)',
    [nickname, password, salt, avatar]
  );
}

async function getUserByNickname(nickname) {
  return await getAsync(
    "SELECT nickname, password, salt, theme, avatar, notifications, datetime(last_seen, 'localtime') as last_seen FROM users WHERE nickname = ?",
    [nickname]
  );
}

function updateUserActivity(nickname) {
  return runAsync(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP, last_seen = CURRENT_TIMESTAMP WHERE nickname = ?',
    [nickname]
  );
}

async function updateUserSettings(nickname, settings) {
  const updates = [];
  const values = [];
  
  if (settings.avatar !== undefined) {
    updates.push('avatar = ?');
    values.push(settings.avatar);
  }
  if (settings.theme !== undefined) {
    updates.push('theme = ?');
    values.push(settings.theme);
  }
  if (settings.notifications !== undefined) {
    updates.push('notifications = ?');
    values.push(settings.notifications ? 1 : 0);
  }
  
  if (updates.length > 0) {
    values.push(nickname);
    return await runAsync(
      `UPDATE users SET ${updates.join(', ')} WHERE nickname = ?`,
      values
    );
  }
}

// Session operations
async function createSession(nickname, token, deviceInfo = null, ipAddress = null) {
  // Clean old sessions
  await runAsync(
    `DELETE FROM sessions WHERE nickname = ? AND id NOT IN (
      SELECT id FROM sessions WHERE nickname = ? ORDER BY created_at DESC LIMIT 9
    )`,
    [nickname, nickname]
  );
  
  return await runAsync(
    'INSERT INTO sessions (nickname, token, device_info, ip_address) VALUES (?, ?, ?, ?)',
    [nickname, token, deviceInfo, ipAddress]
  );
}

async function validateSession(nickname, token) {
  const session = await getAsync(
    `SELECT * FROM sessions 
     WHERE nickname = ? AND token = ? 
     AND expires_at > datetime('now')
     AND datetime(last_activity) > datetime('now', '-30 minutes')`,
    [nickname, token]
  );
  
  if (session) {
    await runAsync('UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = ?', [session.id]);
  }
  
  return session;
}

// Message operations
async function createMessage(sender, receiver, type, content, replyTo = null) {
  const result = await runAsync(
    'INSERT INTO messages (sender, receiver, type, content, reply_to) VALUES (?, ?, ?, ?, ?)',
    [sender, receiver, type, content, replyTo]
  );
  return result.lastID;
}

function getMessageById(id) {
  return getAsync(
    `SELECT 
      m.id, m.sender, m.receiver, m.type, m.content, m.reply_to,
      strftime('%H:%M', datetime(m.timestamp, 'localtime')) as timestamp,
      m.read, u.avatar as senderAvatar,
      r.content as replyContent, r.sender as replySender
    FROM messages m
    LEFT JOIN users u ON m.sender = u.nickname
    LEFT JOIN messages r ON m.reply_to = r.id
    WHERE m.id = ?`,
    [id]
  );
}

function getNewMessages(nickname, lastId) {
  return allAsync(
    `SELECT 
      m.id, m.sender, m.receiver, m.type, m.content, m.reply_to,
      strftime('%H:%M', datetime(m.timestamp, 'localtime')) as timestamp,
      m.read, u.avatar as senderAvatar
    FROM messages m
    LEFT JOIN users u ON m.sender = u.nickname
    WHERE m.id > ? 
    AND ((m.receiver = ? AND m.deleted_for_receiver = 0) 
         OR (m.receiver = 'all' AND m.deleted_for_receiver = 0) 
         OR (m.sender = ? AND m.deleted_for_sender = 0))
    ORDER BY m.id ASC
    LIMIT 100`,
    [lastId, nickname, nickname]
  );
}

function getConversationMessages(user, otherUser, lastId = 0) {
  return allAsync(
    `SELECT 
      m.id, m.sender, m.receiver, m.type, m.content, m.reply_to,
      strftime('%H:%M', datetime(m.timestamp, 'localtime')) as timestamp,
      m.read, u.avatar as senderAvatar
    FROM messages m
    LEFT JOIN users u ON m.sender = u.nickname
    WHERE m.id > ?
    AND ((m.sender = ? AND m.receiver = ? AND m.deleted_for_sender = 0) 
         OR (m.sender = ? AND m.receiver = ? AND m.deleted_for_receiver = 0))
    ORDER BY m.id ASC
    LIMIT 100`,
    [lastId, user, otherUser, otherUser, user]
  );
}

function getConversationHistory(user, conversation, hours = 24) {
  if (conversation === 'all') {
    return allAsync(
      `SELECT sender, content, datetime(timestamp, 'localtime') as time
       FROM messages 
       WHERE receiver = 'all' AND deleted_for_receiver = 0
       AND datetime(timestamp) > datetime('now', '-${hours} hours')
       ORDER BY timestamp ASC`
    );
  } else {
    return allAsync(
      `SELECT sender, content, datetime(timestamp, 'localtime') as time
       FROM messages 
       WHERE ((sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?))
       AND deleted_for_sender = 0 AND deleted_for_receiver = 0
       AND datetime(timestamp) > datetime('now', '-${hours} hours')
       ORDER BY timestamp ASC`,
      [user, conversation, conversation, user]
    );
  }
}

function markMessageAsRead(messageId) {
  return runAsync('UPDATE messages SET read = 1 WHERE id = ?', [messageId]);
}

async function getUnreadCount(nickname) {
  const result = await getAsync(
    'SELECT COUNT(*) as count FROM messages WHERE receiver = ? AND read = 0 AND deleted_for_receiver = 0',
    [nickname]
  );
  return result.count;
}

// Typing status
function setTypingStatus(sender, receiver, isTyping) {
  return runAsync(
    `INSERT INTO typing_status (sender, receiver, is_typing, last_update) 
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(sender, receiver) 
     DO UPDATE SET is_typing = excluded.is_typing, last_update = CURRENT_TIMESTAMP`,
    [sender, receiver, isTyping ? 1 : 0]
  );
}

async function getTypingUsers(receiver, excludeUser) {
  const rows = await allAsync(
    `SELECT sender FROM typing_status 
     WHERE receiver = ? AND sender != ? AND is_typing = 1
     AND datetime(last_update) > datetime('now', '-20 seconds')`,
    [receiver, excludeUser]
  );
  return rows.map(row => row.sender);
}

function clearTypingStatus(sender) {
  return runAsync('UPDATE typing_status SET is_typing = 0 WHERE sender = ?', [sender]);
}

// Contact operations
async function addContact(owner, contact) {
  try {
    if (contact === 'pAI' || owner === 'pAI') {
      await runAsync('INSERT OR IGNORE INTO contacts (owner, contact) VALUES (?, ?)', [owner, contact]);
      await runAsync('INSERT OR IGNORE INTO contacts (owner, contact) VALUES (?, ?)', [contact, owner]);
    } else {
      await runAsync('INSERT OR IGNORE INTO contacts (owner, contact) VALUES (?, ?)', [owner, contact]);
    }
  } catch (error) {
    console.error('Add contact error:', error);
  }
}

function getContact(owner, contact) {
  return getAsync(
    'SELECT * FROM contacts WHERE owner = ? AND contact = ? AND blocked = 0',
    [owner, contact]
  );
}

async function getContacts(owner) {
  return await allAsync(
    `SELECT 
      c.contact as nickname, u.avatar, u.last_seen, c.muted,
      (SELECT COUNT(*) FROM messages WHERE sender = c.contact AND receiver = ? AND read = 0) as unread
    FROM contacts c
    JOIN users u ON c.contact = u.nickname
    WHERE c.owner = ? AND c.blocked = 0
    ORDER BY u.last_seen DESC`,
    [owner, owner]
  );
}

function blockContact(owner, contact) {
  return runAsync('UPDATE contacts SET blocked = 1 WHERE owner = ? AND contact = ?', [owner, contact]);
}

// Search operations
function searchUsers(query, currentUser) {
  const searchQuery = `%${query}%`;
  return allAsync(
    `SELECT 
      u.nickname, u.avatar,
      CASE WHEN c.contact IS NOT NULL THEN 1 ELSE 0 END as isContact,
      CASE WHEN c.blocked = 1 THEN 1 ELSE 0 END as isBlocked
    FROM users u
    LEFT JOIN contacts c ON c.owner = ? AND c.contact = u.nickname
    WHERE u.nickname LIKE ? AND u.nickname != ? AND u.nickname != 'pAI'
    LIMIT 20`,
    [currentUser, searchQuery, currentUser]
  );
}

// Summary operations
function saveSummary(user, conversation, summary, messageCount, startDate, endDate) {
  return runAsync(
    'INSERT INTO summaries (user, conversation, summary, message_count, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)',
    [user, conversation, summary, messageCount, startDate, endDate]
  );
}

function getSummaries(user, conversation = null) {
  if (conversation) {
    return allAsync(
      'SELECT * FROM summaries WHERE user = ? AND conversation = ? ORDER BY created_at DESC LIMIT 10',
      [user, conversation]
    );
  } else {
    return allAsync(
      'SELECT * FROM summaries WHERE user = ? ORDER BY created_at DESC LIMIT 20',
      [user]
    );
  }
}

// Statistics
async function getUserStats(nickname) {
  const sent = await getAsync('SELECT COUNT(*) as count FROM messages WHERE sender = ?', [nickname]);
  const received = await getAsync('SELECT COUNT(*) as count FROM messages WHERE receiver = ?', [nickname]);
  const contacts = await getAsync('SELECT COUNT(*) as count FROM contacts WHERE owner = ? AND blocked = 0', [nickname]);
  
  return {
    sent: sent.count,
    received: received.count,
    contacts: contacts.count
  };
}

// News preferences operations
async function setUserNewsPreferences(userId, preferences) {
  return await runAsync(
    `INSERT INTO news_preferences (user_id, categories, sources, frequency, language, max_articles, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       categories = excluded.categories,
       sources = excluded.sources,
       frequency = excluded.frequency,
       language = excluded.language,
       max_articles = excluded.max_articles,
       updated_at = CURRENT_TIMESTAMP`,
    [
      userId,
      JSON.stringify(preferences.categories || ['technology']),
      JSON.stringify(preferences.sources || []),
      preferences.frequency || 'daily',
      preferences.language || 'en',
      preferences.maxArticles || 5
    ]
  );
}

async function getUserNewsPreferences(userId) {
  const prefs = await getAsync(
    'SELECT * FROM news_preferences WHERE user_id = ?',
    [userId]
  );

  if (prefs) {
    return {
      categories: JSON.parse(prefs.categories),
      sources: JSON.parse(prefs.sources || '[]'),
      frequency: prefs.frequency,
      language: prefs.language,
      maxArticles: prefs.max_articles,
      lastSent: new Date(prefs.last_sent)
    };
  }

  return null;
}

async function updateNewsLastSent(userId) {
  return await runAsync(
    'UPDATE news_preferences SET last_sent = CURRENT_TIMESTAMP WHERE user_id = ?',
    [userId]
  );
}

// Close database
function close() {
  db.close((err) => {
    if (err) console.error('Error closing database:', err);
    else console.log('✅ Database connection closed');
  });
}

module.exports = {
  initialize,
  createUser,
  getUserByNickname,
  updateUserActivity,
  updateUserSettings,
  createSession,
  validateSession,
  createMessage,
  getMessageById,
  getNewMessages,
  getConversationMessages,
  getConversationHistory,
  markMessageAsRead,
  getUnreadCount,
  setTypingStatus,
  getTypingUsers,
  clearTypingStatus,
  addContact,
  getContact,
  getContacts,
  blockContact,
  searchUsers,
  saveSummary,
  getSummaries,
  getUserStats,
  setUserNewsPreferences,
  getUserNewsPreferences,
  updateNewsLastSent,
  close
};