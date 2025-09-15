class ValidationService {
  static validateRegistration({ nickname, password }) {
    const errors = [];

    if (!nickname || !password) {
      errors.push('Nickname and password are required');
    }

    if (nickname && (nickname.length < 3 || nickname.length > 30)) {
      errors.push('Nickname must be 3-30 characters');
    }

    if (password && password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateLogin({ nickname, password }) {
    const errors = [];

    if (!nickname || !password) {
      errors.push('Nickname and password are required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = ValidationService;