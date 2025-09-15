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
    this.router.post('/logout', this.logout.bind(this));
    this.router.get('/me', this.getCurrentUser.bind(this));
    this.router.get('/users', this.getActiveUsers.bind(this));
  }

  async register(req, res) {
    try {
      const { nickname, password, avatar } = req.body;
      const result = await this.authService.register({ nickname, password, avatar });

      res.json({
        success: true,
        message: 'Registration successful',
        user: result.user
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
        id: result.id,
        nickname: result.nickname,
        avatar: result.avatar,
        theme: result.theme,
        token: result.token,
        message: '🔐 Welcome back!'
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({ error: error.message });
    }
  }

  async logout(req, res) {
    try {
      const token = req.headers['authorization']?.split(' ')[1];
      await this.authService.logout(token);

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async getCurrentUser(req, res) {
    try {
      const token = req.headers['authorization']?.split(' ')[1];
      const user = await this.authService.authenticate(token);

      res.json({
        success: true,
        user
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(401).json({ error: error.message });
    }
  }

  async getActiveUsers(req, res) {
    try {
      const users = await this.authService.getActiveUsers();

      res.json({
        success: true,
        users
      });
    } catch (error) {
      console.error('Get active users error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AuthRoutes;