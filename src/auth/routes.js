const express = require('express');
const AuthService = require('./service');

class AuthRoutes {
  constructor(database, logger) {
    this.router = express.Router();
    this.database = database;
    this.logger = logger || console;
    this.authService = new AuthService(database, logger);
    this.setupRoutes();
  }

  setupRoutes() {
    this.router.post('/register', this.register.bind(this));
    this.router.post('/login', this.login.bind(this));
    this.router.post('/logout', this.logout.bind(this));
    this.router.get('/me', this.getCurrentUser.bind(this));
    this.router.get('/users', this.getActiveUsers.bind(this));
  }

  getRouter() {
    return this.router;
  }

  async register(req, res) {
    try {
      this.logger.info('Registration attempt', { body: req.body });
      // Support both 'nickname' and 'username' for compatibility
      const nickname = req.body.nickname || req.body.username;
      const { password, avatar } = req.body;

      if (!nickname || !password) {
        this.logger.warn('Registration failed: missing fields', { nickname: !!nickname, password: !!password });
        return res.status(400).json({ error: 'Nickname and password are required' });
      }

      const result = await this.authService.register({ nickname, password, avatar });

      this.logger.info('Registration successful', { nickname });
      res.json({
        success: true,
        message: 'Registration successful',
        user: result.user
      });
    } catch (error) {
      this.logger.error('Registration error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async login(req, res) {
    try {
      this.logger.info('Login attempt', { body: req.body });
      // Support both 'nickname' and 'username' for compatibility
      const nickname = req.body.nickname || req.body.username;
      const { password } = req.body;

      if (!nickname || !password) {
        this.logger.warn('Login failed: missing fields', { nickname: !!nickname, password: !!password });
        return res.status(400).json({ error: 'Nickname and password are required' });
      }

      const result = await this.authService.login({ nickname, password });

      this.logger.info('Login successful', { nickname });
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
      this.logger.error('Login error:', error);
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