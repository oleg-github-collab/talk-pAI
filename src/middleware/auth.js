const AuthService = require('../auth/service');

class AuthMiddleware {
  constructor(authService) {
    this.authService = authService;
  }

  authenticate() {
    return async (req, res, next) => {
      try {
        const token = req.headers['authorization']?.split(' ')[1];
        const nickname = req.headers['x-nickname'];

        const user = await this.authService.authenticate(nickname, token);
        req.user = user;
        next();
      } catch (error) {
        console.error('Auth error:', error);
        return res.status(401).json({ error: error.message });
      }
    };
  }
}

module.exports = AuthMiddleware;