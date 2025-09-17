const express = require('express');
const AidenCompanion = require('./aiden-companion');
const authMiddleware = require('../middleware/auth');
const Logger = require('../utils/enhanced-logger');
const rateLimit = require('express-rate-limit');

class AidenRoutes {
  constructor() {
    this.router = express.Router();
    this.logger = new Logger('AidenRoutes');
    this.aidenCompanion = AidenCompanion;
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Apply authentication to all Aiden routes
    this.router.use(authMiddleware);

    // Rate limiting for AI conversations
    const aidenRateLimit = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 20, // 20 requests per minute
      message: {
        error: 'Too many requests to Aiden. Please wait a moment.',
        retryAfter: '1 minute'
      },
      standardHeaders: true,
      legacyHeaders: false,
      trustProxy: true,
      keyGenerator: (req) => {
        return req.ip;
      }
    });

    // Chat with Aiden
    this.router.post('/chat', aidenRateLimit, this.chat.bind(this));

    // Get Aiden's status and capabilities
    this.router.get('/status', this.getStatus.bind(this));

    // Get conversation history with Aiden
    this.router.get('/history', this.getHistory.bind(this));

    // Clear conversation memory
    this.router.delete('/memory', this.clearMemory.bind(this));

    // Health check for Aiden
    this.router.get('/health', this.healthCheck.bind(this));

    // Get Aiden's personality info
    this.router.get('/personality', this.getPersonality.bind(this));
  }

  async chat(req, res) {
    try {
      const { message, context = {} } = req.body;
      const userId = req.user.id;

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({
          error: 'Message is required and must be a non-empty string'
        });
      }

      if (message.length > 4000) {
        return res.status(400).json({
          error: 'Message is too long. Please keep it under 4000 characters.'
        });
      }

      this.logger.info('Aiden chat request', {
        userId,
        messageLength: message.length,
        hasContext: Object.keys(context).length > 0
      });

      // Add request context
      const enhancedContext = {
        ...context,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || Math.random().toString(36).substr(2, 9)
      };

      const response = await this.aidenCompanion.chat(userId, message.trim(), enhancedContext);

      this.logger.info('Aiden chat response generated', {
        userId,
        responseLength: response.message.length,
        mood: response.context.mood,
        confidence: response.context.confidence
      });

      res.json({
        success: true,
        aiden: response,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Aiden chat failed', {
        error: error.message,
        userId: req.user?.id,
        messageLength: req.body?.message?.length || 0
      });

      const statusCode = error.message.includes('unavailable') ? 503 : 500;
      res.status(statusCode).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async getStatus(req, res) {
    try {
      const status = this.aidenCompanion.getStatus();

      this.logger.debug('Aiden status requested', {
        userId: req.user.id,
        aidenReady: status.ready
      });

      res.json({
        success: true,
        aiden: status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Failed to get Aiden status', {
        error: error.message,
        userId: req.user.id
      });

      res.status(500).json({
        error: 'Failed to get Aiden status',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getHistory(req, res) {
    try {
      const { limit = 20 } = req.query;
      const userId = req.user.id;

      const limitNum = Math.min(parseInt(limit) || 20, 50); // Max 50 conversations

      const history = await this.aidenCompanion.getUserConversationHistory(userId, limitNum);

      this.logger.debug('Aiden conversation history requested', {
        userId,
        limit: limitNum,
        found: history.length
      });

      res.json({
        success: true,
        history,
        count: history.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Failed to get Aiden history', {
        error: error.message,
        userId: req.user.id
      });

      res.status(500).json({
        error: 'Failed to get conversation history',
        timestamp: new Date().toISOString()
      });
    }
  }

  async clearMemory(req, res) {
    try {
      const userId = req.user.id;

      this.aidenCompanion.clearUserMemory(userId);

      this.logger.info('Aiden memory cleared for user', { userId });

      res.json({
        success: true,
        message: 'Conversation memory cleared',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Failed to clear Aiden memory', {
        error: error.message,
        userId: req.user.id
      });

      res.status(500).json({
        error: 'Failed to clear conversation memory',
        timestamp: new Date().toISOString()
      });
    }
  }

  async healthCheck(req, res) {
    try {
      const health = await this.aidenCompanion.healthCheck();

      this.logger.debug('Aiden health check performed', {
        status: health.status,
        userId: req.user?.id
      });

      const statusCode = health.status === 'healthy' ? 200 : 503;

      res.status(statusCode).json({
        success: health.status === 'healthy',
        health,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Aiden health check failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        health: { status: 'error', message: error.message },
        timestamp: new Date().toISOString()
      });
    }
  }

  async getPersonality(req, res) {
    try {
      const status = this.aidenCompanion.getStatus();

      const personalityInfo = {
        name: status.name,
        description: 'Advanced AI Companion built on GPT-4o',
        capabilities: status.capabilities,
        expertise: status.personality.expertise,
        traits: status.personality.traits,
        languages: status.personality.languages,
        communicationStyle: 'Conversational, helpful, and adaptive',
        version: '2.0.0'
      };

      res.json({
        success: true,
        personality: personalityInfo,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Failed to get Aiden personality info', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to get personality information',
        timestamp: new Date().toISOString()
      });
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AidenRoutes;