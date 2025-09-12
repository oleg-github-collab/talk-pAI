const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'talkpai.db'));

// Enable foreign keys and WAL mode for better concurrency
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Initialize database schema with proper isolation
function initialize() {
  // Users table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      nickname TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      salt TEXT NOT NULL,
      theme TEXT DEFAULT 'auto',
      avatar TEXT DEFAULT '👤',
      notifications BOOLEAN DEFAULT 1,
      last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Messages table with proper indexing
  db.prepare(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL,
      receiver TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      content TEXT NOT NULL,
      reply_to INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      read BOOLEAN DEFAULT 0,
      deleted_for_sender BOOLEAN DEFAULT 0,
      deleted_for_receiver BOOLEAN DEFAULT 0,
      FOREIGN KEY (sender) REFERENCES users(nickname) ON DELETE CASCADE,
      FOREIGN KEY (reply_to) REFERENCES messages(id)
    )
  `).run();

  // Sessions table with expiry
  db.prepare(`
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
  `).run();

  // Contacts table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner TEXT NOT NULL,
      contact TEXT NOT NULL,
      blocked BOOLEAN DEFAULT 0,
      muted BOOLEAN DEFAULT 0,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner) REFERENCES users(nickname) ON DELETE CASCADE,
      FOREIGN KEY (contact) REFERENCES users(nickname) ON DELETE CASCADE,
      UNIQUE(owner, contact)
    )
  `).run();

  // Typing status table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS typing_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL,
      receiver TEXT NOT NULL,
      is_typing BOOLEAN DEFAULT 0,
      last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(sender, receiver)
    )
  `).run();

  // Conversation summaries cache
  db.prepare(`
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
  `).run();

  // Create indexes for performance
  db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver, deleted_for_receiver)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender, deleted_for_sender)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner, blocked)').run();

  // Create pAI assistant user if not exists
  const paiUser = db.prepare('SELECT * FROM users WHERE nickname = ?').get('pAI');
  if (!paiUser) {
    db.prepare(`
      INSERT INTO users (nickname, password, salt, avatar, theme) 
      VALUES ('pAI', 'system', 'system', '🤖', 'auto')
    `).run();
  }

  console.log('✅ Database initialized with isolation features');
  
  // Clean up expired sessions
  cleanupExpiredSessions();
  setInterval(cleanupExpiredSessions, 60 * 60 * 1000); // Run every hour
}

// Clean up expired sessions
function cleanupExpiredSessions() {
  db.prepare(`
    DELETE FROM sessions 
    WHERE expires_at < datetime('now')
  `).run();
  
  // Clean old typing statuses
  db.prepare(`
    DELETE FROM typing_status 
    WHERE datetime(last_update) < datetime('now', '-1 minute')
  `).run();
}

// User operations with data isolation
function createUser(nickname, password, salt, avatar = '👤') {
  const stmt = db.prepare(`
    INSERT INTO users (nickname, password, salt, avatar) 
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(nickname, password, salt, avatar);
}

function getUserByNickname(nickname) {
  const stmt = db.prepare(`
    SELECT nickname, password, salt, theme, avatar, notifications, 
           datetime(last_seen, 'localtime') as last_seen 
    FROM users WHERE nickname = ?
  `);
  return stmt.get(nickname);
}

function updateUserActivity(nickname) {
  const stmt = db.prepare(`
    UPDATE users 
    SET last_login = CURRENT_TIMESTAMP, 
        last_seen = CURRENT_TIMESTAMP 
    WHERE nickname = ?
  `);
  return stmt.run(nickname);
}

function updateUserSettings(nickname, settings) {
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
    const stmt = db.prepare(`
      UPDATE users SET ${updates.join(', ')} WHERE nickname = ?
    `);
    return stmt.run(...values);
  }
}

// Session operations with security
function createSession(nickname, token, deviceInfo = null, ipAddress = null) {
  // Limit sessions per user
  db.prepare(`
    DELETE FROM sessions 
    WHERE nickname = ? 
    AND id NOT IN (
      SELECT id FROM sessions 
      WHERE nickname = ? 
      ORDER BY created_at DESC 
      LIMIT 9
    )
  `).run(nickname, nickname);

  const stmt = db.prepare(`
    INSERT INTO sessions (nickname, token, device_info, ip_address) 
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(nickname, token, deviceInfo, ipAddress);
}

function validateSession(nickname, token) {
  const stmt = db.prepare(`
    SELECT * FROM sessions 
    WHERE nickname = ? AND token = ? 
    AND expires_at > datetime('now')
    AND datetime(last_activity) > datetime('now', '-30 minutes')
  `);
  const session = stmt.get(nickname, token);
  
  if (session) {
    // Update last activity
    db.prepare(`
      UPDATE sessions 
      SET last_activity = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(session.id);
  }
  
  return session;
}

// Message operations with isolation
function createMessage(sender, receiver, type, content, replyTo = null) {
  const stmt = db.prepare(`
    INSERT INTO messages (sender, receiver, type, content, reply_to) 
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(sender, receiver, type, content, replyTo);
  return result.lastInsertRowid;
}

function getMessageById(id) {
  const stmt = db.prepare(`
    SELECT 
      m.id,
      m.sender,
      m.receiver,
      m.type,
      m.content,
      m.reply_to,
      strftime('%H:%M', datetime(m.timestamp, 'localtime')) as timestamp,
      m.read,
      u.avatar as senderAvatar,
      r.content as replyContent,
      r.sender as replySender
    FROM messages m
    LEFT JOIN users u ON m.sender = u.nickname
    LEFT JOIN messages r ON m.reply_to = r.id
    WHERE m.id = ?
  `);
  return stmt.get(id);
}

function getNewMessages(nickname, lastId) {
  const stmt = db.prepare(`
    SELECT 
      m.id,
      m.sender,
      m.receiver,
      m.type,
      m.content,
      m.reply_to,
      strftime('%H:%M', datetime(m.timestamp, 'localtime')) as timestamp,
      m.read,
      u.avatar as senderAvatar
    FROM messages m
    LEFT JOIN users u ON m.sender = u.nickname
    WHERE m.id > ? 
    AND (
      (m.receiver = ? AND m.deleted_for_receiver = 0) OR 
      (m.receiver = 'all' AND m.deleted_for_receiver = 0) OR 
      (m.sender = ? AND m.deleted_for_sender = 0)
    )
    ORDER BY m.id ASC
    LIMIT 100
  `);
  return stmt.all(lastId, nickname, nickname);
}

function getConversationMessages(user, otherUser, lastId = 0) {
  const stmt = db.prepare(`
    SELECT 
      m.id,
      m.sender,
      m.receiver,
      m.type,
      m.content,
      m.reply_to,
      strftime('%H:%M', datetime(m.timestamp, 'localtime')) as timestamp,
      m.read,
      u.avatar as senderAvatar
    FROM messages m
    LEFT JOIN users u ON m.sender = u.nickname
    WHERE m.id > ?
    AND (
      (m.sender = ? AND m.receiver = ? AND m.deleted_for_sender = 0) OR
      (m.sender = ? AND m.receiver = ? AND m.deleted_for_receiver = 0)
    )
    ORDER BY m.id ASC
    LIMIT 100
  `);
  return stmt.all(lastId, user, otherUser, otherUser, user);
}

function getConversationHistory(user, conversation, hours = 24) {
  const query = conversation === 'all' 
    ? `
      SELECT sender, content, datetime(timestamp, 'localtime') as time
      FROM messages 
      WHERE receiver = 'all' 
      AND deleted_for_receiver = 0
      AND datetime(timestamp) > datetime('now', '-${hours} hours')
      ORDER BY timestamp ASC
    `
    : `
      SELECT sender, content, datetime(timestamp, 'localtime') as time
      FROM messages 
      WHERE (
        (sender = ? AND receiver = ?) OR 
        (sender = ? AND receiver = ?)
      )
      AND deleted_for_sender = 0
      AND deleted_for_receiver = 0
      AND datetime(timestamp) > datetime('now', '-${hours} hours')
      ORDER BY timestamp ASC
    `;
    
  const stmt = db.prepare(query);
  return conversation === 'all' 
    ? stmt.all()
    : stmt.all(user, conversation, conversation, user);
}

function markMessageAsRead(messageId) {
  const stmt = db.prepare(`
    UPDATE messages SET read = 1 WHERE id = ?
  `);
  return stmt.run(messageId);
}

function getUnreadCount(nickname) {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count 
    FROM messages 
    WHERE receiver = ? 
    AND read = 0 
    AND deleted_for_receiver = 0
  `);
  return stmt.get(nickname).count;
}

// Typing status operations
function setTypingStatus(sender, receiver, isTyping) {
  const stmt = db.prepare(`
    INSERT INTO typing_status (sender, receiver, is_typing, last_update) 
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(sender, receiver) 
    DO UPDATE SET 
      is_typing = excluded.is_typing,
      last_update = CURRENT_TIMESTAMP
  `);
  return stmt.run(sender, receiver, isTyping ? 1 : 0);
}

function getTypingUsers(receiver, excludeUser) {
  const stmt = db.prepare(`
    SELECT sender 
    FROM typing_status 
    WHERE receiver = ? 
    AND sender != ?
    AND is_typing = 1
    AND datetime(last_update) > datetime('now', '-20 seconds')
  `);
  return stmt.all(receiver, excludeUser).map(row => row.sender);
}

function clearTypingStatus(sender) {
  const stmt = db.prepare(`
    UPDATE typing_status SET is_typing = 0 WHERE sender = ?
  `);
  return stmt.run(sender);
}

// Contact operations with isolation
function addContact(owner, contact) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO contacts (owner, contact) VALUES (?, ?)
  `);
  // Add bidirectional relationship for pAI
  if (contact === 'pAI' || owner === 'pAI') {
    stmt.run(owner, contact);
    stmt.run(contact, owner);
  } else {
    stmt.run(owner, contact);
  }
}

function getContact(owner, contact) {
  const stmt = db.prepare(`
    SELECT * FROM contacts 
    WHERE owner = ? AND contact = ? AND blocked = 0
  `);
  return stmt.get(owner, contact);
}

function getContacts(owner) {
  const stmt = db.prepare(`
    SELECT 
      c.contact as nickname,
      u.avatar,
      u.last_seen,
      c.muted,
      (SELECT COUNT(*) FROM messages 
       WHERE sender = c.contact AND receiver = ? AND read = 0) as unread
    FROM contacts c
    JOIN users u ON c.contact = u.nickname
    WHERE c.owner = ? AND c.blocked = 0
    ORDER BY u.last_seen DESC
  `);
  return stmt.all(owner, owner);
}

function blockContact(owner, contact) {
  const stmt = db.prepare(`
    UPDATE contacts SET blocked = 1 WHERE owner = ? AND contact = ?
  `);
  return stmt.run(owner, contact);
}

// Search operations with privacy
function searchUsers(query, currentUser) {
  const searchQuery = `%${query}%`;
  const stmt = db.prepare(`
    SELECT 
      u.nickname,
      u.avatar,
      CASE WHEN c.contact IS NOT NULL THEN 1 ELSE 0 END as isContact,
      CASE WHEN c.blocked = 1 THEN 1 ELSE 0 END as isBlocked
    FROM users u
    LEFT JOIN contacts c ON c.owner = ? AND c.contact = u.nickname
    WHERE u.nickname LIKE ? 
    AND u.nickname != ?
    AND u.nickname != 'pAI'
    LIMIT 20
  `);
  return stmt.all(currentUser, searchQuery, currentUser);
}

// Summary operations
function saveSummary(user, conversation, summary, messageCount, startDate, endDate) {
  const stmt = db.prepare(`
    INSERT INTO summaries (user, conversation, summary, message_count, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(user, conversation, summary, messageCount, startDate, endDate);
}

function getSummaries(user, conversation = null) {
  const query = conversation
    ? 'SELECT * FROM summaries WHERE user = ? AND conversation = ? ORDER BY created_at DESC LIMIT 10'
    : 'SELECT * FROM summaries WHERE user = ? ORDER BY created_at DESC LIMIT 20';
  
  const stmt = db.prepare(query);
  return conversation ? stmt.all(user, conversation) : stmt.all(user);
}

// Statistics
function getUserStats(nickname) {
  const messagesSent = db.prepare(`
    SELECT COUNT(*) as count FROM messages WHERE sender = ?
  `).get(nickname);
  
  const messagesReceived = db.prepare(`
    SELECT COUNT(*) as count FROM messages WHERE receiver = ?
  `).get(nickname);
  
  const contactCount = db.prepare(`
    SELECT COUNT(*) as count FROM contacts WHERE owner = ? AND blocked = 0
  `).get(nickname);
  
  return {
    sent: messagesSent.count,
    received: messagesReceived.count,
    contacts: contactCount.count
  };
}

// Cleanup
function close() {
  db.close();
  console.log('✅ Database connection closed');
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
  close
};