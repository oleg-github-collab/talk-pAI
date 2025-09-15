const express = require('express');
const AuthService = require('./service');

class AuthRoutes {
  constructor() {
    this.router = express.Router();
    this.authService = new AuthService();
    this.setupRoutes();
  }

  setupRoutes() {
    this.router.post('/register', this.register.bind(this));
    this.router.post('/login', this.login.bind(this));
  }

  async register(req, res) {
    try {
      const { nickname, password, avatar } = req.body;
      const result = await this.authService.register({ nickname, password, avatar });

      res.json({
        success: true,
        message: 'Registration successful',
        user: result.user,
        demo: true
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async login(req, res) {
    try {
      const { nickname, password } = req.body;
      const result = await this.authService.login({ nickname, password });

      res.json({
        success: true,
        nickname: result.nickname,
        avatar: result.avatar,
        theme: result.theme,
        token: result.token,
        message: '🔐 Welcome back!',
        demo: true
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({ error: error.message });
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AuthRoutes;