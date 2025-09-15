const crypto = require('crypto');

class CryptoService {
  static generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  static generateSalt() {
    return crypto.randomBytes(16).toString('hex');
  }

  static hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  }

  static verifyPassword(inputPassword, hashedPassword, salt) {
    const hashedInput = this.hashPassword(inputPassword, salt);
    return hashedInput === hashedPassword;
  }
}

module.exports = CryptoService;