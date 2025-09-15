class InMemoryStorage {
  constructor() {
    this.users = new Map();
    this.sessions = new Map();
  }

  // User management
  createUser({ nickname, password, salt, avatar }) {
    if (this.users.has(nickname)) {
      throw new Error('User already exists');
    }

    const user = { nickname, password, salt, avatar: avatar || '👤' };
    this.users.set(nickname, user);
    return user;
  }

  findUser(nickname) {
    return this.users.get(nickname);
  }

  userExists(nickname) {
    return this.users.has(nickname);
  }

  // Session management
  createSession(nickname, token) {
    const sessionKey = `${nickname}:${token}`;
    const session = {
      nickname,
      token,
      createdAt: new Date()
    };
    this.sessions.set(sessionKey, session);
    return session;
  }

  findSession(nickname, token) {
    const sessionKey = `${nickname}:${token}`;
    return this.sessions.get(sessionKey);
  }

  deleteSession(nickname, token) {
    const sessionKey = `${nickname}:${token}`;
    return this.sessions.delete(sessionKey);
  }
}

module.exports = InMemoryStorage;