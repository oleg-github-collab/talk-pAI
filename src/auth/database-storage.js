const database = require('../database/connection');
const CryptoService = require('../utils/crypto');

class DatabaseStorage {
  async createUser({ nickname, password, salt, avatar }) {
    const result = await database.query(`
      INSERT INTO users (nickname, password_hash, salt, avatar)
      VALUES ($1, $2, $3, $4)
      RETURNING id, nickname, avatar, created_at
    `, [nickname, password, salt, avatar || '👤']);

    return result.rows[0];
  }

  async findUser(nickname) {
    const result = await database.query(`
      SELECT id, nickname, password_hash, salt, avatar, created_at, last_login
      FROM users
      WHERE nickname = $1 AND is_active = true
    `, [nickname]);

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    return {
      id: user.id,
      nickname: user.nickname,
      password: user.password_hash,
      salt: user.salt,
      avatar: user.avatar,
      createdAt: user.created_at,
      lastLogin: user.last_login
    };
  }

  async findUserById(userId) {
    const result = await database.query(`
      SELECT id, nickname, avatar, created_at, last_login
      FROM users
      WHERE id = $1 AND is_active = true
    `, [userId]);

    return result.rows[0] || null;
  }

  async userExists(nickname) {
    const result = await database.query(`
      SELECT 1 FROM users WHERE nickname = $1 AND is_active = true
    `, [nickname]);

    return result.rows.length > 0;
  }

  async updateLastLogin(userId) {
    await database.query(`
      UPDATE users
      SET last_login = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [userId]);
  }

  async createSession(userId, token) {
    // Clean up expired sessions
    await database.query(`
      UPDATE sessions
      SET is_active = false
      WHERE user_id = $1 AND expires_at < CURRENT_TIMESTAMP
    `, [userId]);

    const result = await database.query(`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '30 days')
      RETURNING id, token, created_at, expires_at
    `, [userId, token]);

    return result.rows[0];
  }

  async findSession(userId, token) {
    const result = await database.query(`
      SELECT s.id, s.token, s.created_at, s.expires_at, u.id as user_id, u.nickname
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.user_id = $1 AND s.token = $2
        AND s.is_active = true
        AND s.expires_at > CURRENT_TIMESTAMP
    `, [userId, token]);

    return result.rows[0] || null;
  }

  async findSessionByToken(token) {
    const result = await database.query(`
      SELECT s.id, s.token, s.created_at, s.expires_at, u.id as user_id, u.nickname, u.avatar
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = $1
        AND s.is_active = true
        AND s.expires_at > CURRENT_TIMESTAMP
    `, [token]);

    return result.rows[0] || null;
  }

  async deleteSession(userId, token) {
    const result = await database.query(`
      UPDATE sessions
      SET is_active = false
      WHERE user_id = $1 AND token = $2
      RETURNING id
    `, [userId, token]);

    return result.rows.length > 0;
  }

  async deleteAllUserSessions(userId) {
    await database.query(`
      UPDATE sessions
      SET is_active = false
      WHERE user_id = $1
    `, [userId]);
  }

  async getUserChats(userId) {
    const result = await database.query(`
      SELECT c.id, c.name, c.type, c.created_at, c.updated_at,
             cp.role,
             (SELECT COUNT(*) FROM chat_participants WHERE chat_id = c.id) as participant_count,
             (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
             (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chat_id
      WHERE cp.user_id = $1
      ORDER BY COALESCE(
        (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1),
        c.updated_at
      ) DESC
    `, [userId]);

    return result.rows;
  }

  async getActiveUsers() {
    const result = await database.query(`
      SELECT u.id, u.nickname, u.avatar, u.last_login,
             CASE
               WHEN s.created_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN true
               ELSE false
             END as is_online
      FROM users u
      LEFT JOIN sessions s ON u.id = s.user_id AND s.is_active = true
      WHERE u.is_active = true
      ORDER BY is_online DESC, u.last_login DESC
      LIMIT 50
    `);

    return result.rows;
  }
}

module.exports = DatabaseStorage;