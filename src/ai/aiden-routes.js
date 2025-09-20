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

  getRouter() {
    return this.router;
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

    // Enhanced chat with advanced capabilities
    this.router.post('/enhanced-chat', aidenRateLimit, this.enhancedChat.bind(this));

    // Get Aiden's status and capabilities
    this.router.get('/status', this.getStatus.bind(this));

    // Get enhanced status with all services
    this.router.get('/enhanced-status', this.getEnhancedStatus.bind(this));

    // Get conversation history with Aiden
    this.router.get('/history', this.getHistory.bind(this));

    // Clear conversation memory
    this.router.delete('/memory', this.clearMemory.bind(this));

    // Health check for Aiden
    this.router.get('/health', this.healthCheck.bind(this));

    // Get Aiden's personality info
    this.router.get('/personality', this.getPersonality.bind(this));

    // Advanced AI capabilities
    this.router.post('/search', aidenRateLimit, this.webSearch.bind(this));
    this.router.post('/analyze-image', aidenRateLimit, this.analyzeImage.bind(this));
    this.router.post('/generate-image', aidenRateLimit, this.generateImage.bind(this));
    this.router.post('/create-spreadsheet', aidenRateLimit, this.createSpreadsheet.bind(this));
    this.router.post('/text-to-speech', aidenRateLimit, this.textToSpeech.bind(this));
    this.router.post('/speech-to-text', aidenRateLimit, this.speechToText.bind(this));

    // Voice conversation endpoints
    this.router.post('/voice/start', aidenRateLimit, this.startVoiceConversation.bind(this));
    this.router.post('/voice/:conversationId/message', aidenRateLimit, this.processVoiceMessage.bind(this));
    this.router.delete('/voice/:conversationId', this.endVoiceConversation.bind(this));
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
        description: 'Advanced AI Assistant with multiple capabilities',
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

  async enhancedChat(req, res) {
    try {
      const { message, context = {} } = req.body;
      const userId = req.user.id;

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({
          error: 'Message is required and must be a non-empty string'
        });
      }

      this.logger.info('Enhanced Aiden chat request', {
        userId,
        messageLength: message.length,
        hasContext: Object.keys(context).length > 0
      });

      const response = await this.aidenCompanion.enhancedChat(userId, message.trim(), context);

      res.json({
        success: true,
        aiden: response,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Enhanced Aiden chat failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async getEnhancedStatus(req, res) {
    try {
      const status = this.aidenCompanion.getEnhancedStatus();

      res.json({
        success: true,
        aiden: status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Failed to get enhanced Aiden status', {
        error: error.message
      });

      res.status(500).json({
        error: 'Failed to get enhanced status',
        timestamp: new Date().toISOString()
      });
    }
  }

  async webSearch(req, res) {
    try {
      const { query, options = {} } = req.body;
      const userId = req.user.id;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({
          error: 'Search query is required'
        });
      }

      this.logger.info('Web search request', { userId, query });

      const result = await this.aidenCompanion.searchWeb(query, options);

      res.json({
        success: true,
        search: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Web search failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async analyzeImage(req, res) {
    try {
      const { imageUrl, imagePath, options = {} } = req.body;
      const userId = req.user.id;

      if (!imageUrl && !imagePath && !req.file) {
        return res.status(400).json({
          error: 'Image URL, path, or file upload is required'
        });
      }

      this.logger.info('Image analysis request', { userId, hasFile: !!req.file });

      const imageInput = req.file ? req.file.path : (imageUrl || imagePath);
      const result = await this.aidenCompanion.analyzeImage(imageInput, options);

      res.json({
        success: true,
        analysis: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Image analysis failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async generateImage(req, res) {
    try {
      const { prompt, options = {} } = req.body;
      const userId = req.user.id;

      if (!prompt || prompt.trim().length === 0) {
        return res.status(400).json({
          error: 'Image prompt is required'
        });
      }

      this.logger.info('Image generation request', {
        userId,
        promptLength: prompt.length
      });

      const result = await this.aidenCompanion.generateImage(prompt, {
        ...options,
        saveLocally: true
      });

      res.json({
        success: true,
        image: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Image generation failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async createSpreadsheet(req, res) {
    try {
      const { data, description, options = {} } = req.body;
      const userId = req.user.id;

      if (!data && !description) {
        return res.status(400).json({
          error: 'Data or description is required for spreadsheet creation'
        });
      }

      this.logger.info('Spreadsheet creation request', { userId, hasData: !!data });

      let result;
      if (description && !data) {
        // Generate from description
        result = await this.aidenCompanion.spreadsheet.generateFromDescription(description, options);
      } else {
        // Generate from data
        result = await this.aidenCompanion.createSpreadsheet(data, options);
      }

      res.json({
        success: true,
        spreadsheet: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Spreadsheet creation failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async textToSpeech(req, res) {
    try {
      const { text, options = {} } = req.body;
      const userId = req.user.id;

      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          error: 'Text is required for speech synthesis'
        });
      }

      this.logger.info('Text-to-speech request', {
        userId,
        textLength: text.length
      });

      const result = await this.aidenCompanion.textToSpeech(text, {
        ...options,
        saveFile: true
      });

      res.json({
        success: true,
        audio: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Text-to-speech failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async speechToText(req, res) {
    try {
      const { audioUrl, audioPath, options = {} } = req.body;
      const userId = req.user.id;

      if (!audioUrl && !audioPath && !req.file) {
        return res.status(400).json({
          error: 'Audio URL, path, or file upload is required'
        });
      }

      this.logger.info('Speech-to-text request', { userId, hasFile: !!req.file });

      const audioInput = req.file ? req.file.buffer : (audioUrl || audioPath);
      const result = await this.aidenCompanion.speechToText(audioInput, options);

      res.json({
        success: true,
        transcription: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Speech-to-text failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async startVoiceConversation(req, res) {
    try {
      const { options = {} } = req.body;
      const userId = req.user.id;

      this.logger.info('Starting voice conversation', { userId });

      const result = await this.aidenCompanion.startVoiceConversation(userId, options);

      res.json({
        success: true,
        conversation: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Failed to start voice conversation', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async processVoiceMessage(req, res) {
    try {
      const { conversationId } = req.params;
      const { audioUrl, audioPath, options = {} } = req.body;
      const userId = req.user.id;

      if (!audioUrl && !audioPath && !req.file) {
        return res.status(400).json({
          error: 'Audio URL, path, or file upload is required'
        });
      }

      this.logger.info('Processing voice message', { userId, conversationId });

      const audioInput = req.file ? req.file.buffer : (audioUrl || audioPath);
      const result = await this.aidenCompanion.processVoiceMessage(conversationId, audioInput, options);

      res.json({
        success: true,
        message: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Failed to process voice message', {
        error: error.message,
        userId: req.user?.id,
        conversationId: req.params.conversationId
      });

      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async endVoiceConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user.id;

      this.logger.info('Ending voice conversation', { userId, conversationId });

      const result = await this.aidenCompanion.voice.endVoiceConversation(conversationId);

      res.json({
        success: true,
        conversation: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Failed to end voice conversation', {
        error: error.message,
        userId: req.user?.id,
        conversationId: req.params.conversationId
      });

      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AidenRoutes;