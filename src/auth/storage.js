/**
 * In-Memory Storage for Auth Service
 * Used as fallback when database is not available
 */
class InMemoryStorage {
  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.tokens = new Map();
  }

  async userExists(nickname) {
    return this.users.has(nickname);
  }

  async createUser({ nickname, password, salt, avatar }) {
    const user = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nickname,
      password,
      salt,
      avatar: avatar || '/avatars/default.jpg',
      created_at: new Date().toISOString(),
      last_login: null
    };

    this.users.set(nickname, user);
    return user;
  }

  async findUser(nickname) {
    return this.users.get(nickname) || null;
  }

  async createSession(identifier, token) {
    const session = {
      id: `session_${Date.now()}`,
      identifier, // nickname for in-memory, user_id for database
      token,
      created_at: new Date().toISOString(),
      last_used: new Date().toISOString()
    };

    this.sessions.set(identifier, session);
    this.tokens.set(token, session);
    return session;
  }

  async findSessionByToken(token) {
    return this.tokens.get(token) || null;
  }

  async deleteSession(identifier, token) {
    this.sessions.delete(identifier);
    this.tokens.delete(token);
  }

  async updateLastLogin(userId) {
    // Find user by ID and update last login
    for (const [nickname, user] of this.users.entries()) {
      if (user.id === userId) {
        user.last_login = new Date().toISOString();
        break;
      }
    }
  }

  async getUserChats(userId) {
    // Return empty array for in-memory storage
    return [];
  }

  async getActiveUsers() {
    return Array.from(this.users.values()).map(user => ({
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      status: 'online' // Default status for in-memory
    }));
  }

  // Clear expired sessions (optional cleanup)
  cleanupExpiredSessions() {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    for (const [token, session] of this.tokens.entries()) {
      const sessionAge = now - new Date(session.created_at).getTime();
      if (sessionAge > maxAge) {
        this.tokens.delete(token);
        this.sessions.delete(session.identifier);
      }
    }
  }
}

module.exports = InMemoryStorage;