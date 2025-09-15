const CryptoService = require('../utils/crypto');
const ValidationService = require('../utils/validator');
const InMemoryStorage = require('./storage');

class AuthService {
  constructor() {
    this.storage = new InMemoryStorage();
  }

  async register({ nickname, password, avatar }) {
    // Validate input
    const validation = ValidationService.validateRegistration({ nickname, password });
    if (!validation.isValid) {
      throw new Error(validation.errors[0]);
    }

    // Check if user exists
    if (this.storage.userExists(nickname)) {
      throw new Error('This nickname is already taken');
    }

    // Create user
    const salt = CryptoService.generateSalt();
    const hashedPassword = CryptoService.hashPassword(password, salt);
    const token = CryptoService.generateToken();

    const user = this.storage.createUser({
      nickname,
      password: hashedPassword,
      salt,
      avatar
    });

    // Create session
    this.storage.createSession(nickname, token);

    return {
      user: {
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
    const user = this.storage.findUser(nickname);
    if (!user) {
      throw new Error('Invalid nickname or password');
    }

    // Verify password
    if (!CryptoService.verifyPassword(password, user.password, user.salt)) {
      throw new Error('Invalid nickname or password');
    }

    // Create session
    const token = CryptoService.generateToken();
    this.storage.createSession(nickname, token);

    return {
      nickname: user.nickname,
      avatar: user.avatar,
      theme: 'auto',
      token
    };
  }

  async authenticate(nickname, token) {
    if (!nickname || !token) {
      throw new Error('Authentication required');
    }

    const session = this.storage.findSession(nickname, token);
    if (!session) {
      throw new Error('Invalid session');
    }

    return { nickname, token };
  }
}

module.exports = AuthService;