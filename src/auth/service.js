const CryptoService = require('../utils/crypto');
const ValidationService = require('../utils/validator');
const InMemoryStorage = require('./storage');
const DatabaseStorage = require('./database-storage');
const database = require('../database/optimized-connection');

class AuthService {
  constructor(dbConnection, logger) {
    this.database = dbConnection || database;
    this.logger = logger || console;
    this.storage = this.database.isConnected ? new DatabaseStorage(this.database) : new InMemoryStorage();
    this.useDatabase = this.database.isConnected;
  }

  async register({ nickname, password, avatar }) {
    // Validate input
    const validation = ValidationService.validateRegistration({ nickname, password });
    if (!validation.isValid) {
      throw new Error(validation.errors[0]);
    }

    // Check if user exists
    if (await this.storage.userExists(nickname)) {
      throw new Error('This nickname is already taken');
    }

    // Create user
    const salt = CryptoService.generateSalt();
    const hashedPassword = CryptoService.hashPassword(password, salt);
    const token = CryptoService.generateToken();

    const user = await this.storage.createUser({
      nickname,
      password: hashedPassword,
      salt,
      avatar
    });

    // Create session
    if (this.useDatabase) {
      await this.storage.createSession(user.id, token);
    } else {
      await this.storage.createSession(nickname, token);
    }

    return {
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        token
      }
    };
  }

  async login({ nickname, password }) {
    // Validate input
    const validation = ValidationService.validateLogin({ nickname, password });
    if (!validation.isValid) {
      throw new Error(validation.errors[0]);
    }

    // Find user
    const user = await this.storage.findUser(nickname);
    if (!user) {
      throw new Error('Invalid nickname or password');
    }

    // Verify password
    if (!CryptoService.verifyPassword(password, user.password, user.salt)) {
      throw new Error('Invalid nickname or password');
    }

    // Update last login
    if (this.useDatabase) {
      await this.storage.updateLastLogin(user.id);
    }

    // Create session
    const token = CryptoService.generateToken();
    if (this.useDatabase) {
      await this.storage.createSession(user.id, token);
    } else {
      await this.storage.createSession(nickname, token);
    }

    return {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      theme: 'auto',
      token
    };
  }

  async authenticate(token) {
    if (!token) {
      throw new Error('Authentication required');
    }

    if (this.useDatabase) {
      const session = await this.storage.findSessionByToken(token);
      if (!session) {
        throw new Error('Invalid session');
      }
      return {
        id: session.user_id,
        nickname: session.nickname,
        avatar: session.avatar,
        token
      };
    } else {
      // Fallback for in-memory storage
      return { token };
    }
  }

  async logout(token) {
    if (this.useDatabase) {
      const session = await this.storage.findSessionByToken(token);
      if (session) {
        await this.storage.deleteSession(session.user_id, token);
      }
    }
    return { success: true };
  }

  async getUserChats(userId) {
    if (this.useDatabase) {
      return await this.storage.getUserChats(userId);
    }
    return [];
  }

  async getActiveUsers() {
    if (this.useDatabase) {
      return await this.storage.getActiveUsers();
    }
    return [];
  }
}

module.exports = AuthService;