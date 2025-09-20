const express = require('express');
const AIService = require('./service');
const AuthService = require('../auth/service');

class AIRoutes {
  constructor() {
    this.router = express.Router();
    this.aiService = new AIService();
    this.authService = new AuthService();
    this.setupRoutes();
  }

  getRouter() {
    return this.router;
  }

  setupRoutes() {
    // Apply authentication middleware to all routes
    this.router.use(this.authenticate.bind(this));

    // AI Chat
    this.router.post('/chat', this.chatWithAI.bind(this));

    // RSS Feed Management
    this.router.get('/rss/feeds', this.getUserRSSFeeds.bind(this));
    this.router.post('/rss/feeds', this.addRSSFeed.bind(this));
    this.router.delete('/rss/feeds/:feedId', this.removeRSSFeed.bind(this));

    // RSS Summarization
    this.router.post('/rss/summarize', this.summarizeRSSFeed.bind(this));
    this.router.get('/rss/summaries', this.getRSSSummaries.bind(this));
    this.router.get('/rss/digest', this.generateNewsDigest.bind(this));

    // AI Status
    this.router.get('/status', this.getAIStatus.bind(this));

    // Message Suggestions and Tone Analysis
    this.router.post('/suggestions', this.generateMessageSuggestions.bind(this));
    this.router.post('/suggestions/:suggestionId/use', this.markSuggestionUsed.bind(this));
    this.router.post('/analyze/tone', this.analyzeTone.bind(this));

    // External AI Agents (Superadmin only)
    this.router.post('/agents', this.requireSuperAdmin.bind(this), this.registerAIAgent.bind(this));
    this.router.get('/agents', this.getAvailableAgents.bind(this));
    this.router.post('/agents/:agentId/call', this.callExternalAgent.bind(this));
    this.router.patch('/agents/:agentId/status', this.requireSuperAdmin.bind(this), this.updateAgentStatus.bind(this));
  }

  async authenticate(req, res, next) {
    try {
      const token = req.headers['authorization']?.split(' ')[1];
      const user = await this.authService.authenticate(token);
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ error: error.message });
    }
  }

  async chatWithAI(req, res) {
    try {
      const { message, context } = req.body;
      const userId = req.user.id;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required' });
      }

      if (!this.aiService.isReady()) {
        return res.status(503).json({
          error: 'AI service not available. Please configure OPENAI_API_KEY.'
        });
      }

      const response = await this.aiService.chatWithAI(
        message.trim(),
        context || [],
        userId
      );

      // Emit to Socket.io for real-time AI responses
      const io = req.app.get('io');
      if (io) {
        io.emit('ai_response', {
          userId,
          message: response.message,
          originalMessage: message,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        response: response.message,
        usage: response.usage
      });
    } catch (error) {
      console.error('AI chat error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getUserRSSFeeds(req, res) {
    try {
      const userId = req.user.id;
      const feeds = await this.aiService.getUserRSSFeeds(userId);

      res.json({
        success: true,
        feeds
      });
    } catch (error) {
      console.error('Get RSS feeds error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async addRSSFeed(req, res) {
    try {
      const { feedUrl, feedTitle } = req.body;
      const userId = req.user.id;

      if (!feedUrl || feedUrl.trim().length === 0) {
        return res.status(400).json({ error: 'Feed URL is required' });
      }

      // Validate URL format
      try {
        new URL(feedUrl);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      const feed = await this.aiService.addRSSFeed(
        userId,
        feedUrl.trim(),
        feedTitle?.trim()
      );

      res.json({
        success: true,
        feed,
        message: 'RSS feed added successfully'
      });
    } catch (error) {
      console.error('Add RSS feed error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async removeRSSFeed(req, res) {
    try {
      const { feedId } = req.params;
      const userId = req.user.id;

      const feed = await this.aiService.removeRSSFeed(userId, parseInt(feedId));

      res.json({
        success: true,
        feed,
        message: 'RSS feed removed successfully'
      });
    } catch (error) {
      console.error('Remove RSS feed error:', error);
      res.status(403).json({ error: error.message });
    }
  }

  async summarizeRSSFeed(req, res) {
    try {
      const { feedUrl } = req.body;
      const userId = req.user.id;

      if (!feedUrl) {
        return res.status(400).json({ error: 'Feed URL is required' });
      }

      if (!this.aiService.isReady()) {
        return res.status(503).json({
          error: 'AI service not available. Please configure OPENAI_API_KEY.'
        });
      }

      const summary = await this.aiService.summarizeRSSFeed(feedUrl, userId);

      res.json({
        success: true,
        summary
      });
    } catch (error) {
      console.error('RSS summarization error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getRSSSummaries(req, res) {
    try {
      const userId = req.user.id;
      const { limit } = req.query;

      const summaries = await this.aiService.getRecentRSSSummaries(
        userId,
        parseInt(limit) || 10
      );

      res.json({
        success: true,
        summaries
      });
    } catch (error) {
      console.error('Get RSS summaries error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async generateNewsDigest(req, res) {
    try {
      const userId = req.user.id;

      if (!this.aiService.isReady()) {
        return res.status(503).json({
          error: 'AI service not available. Please configure OPENAI_API_KEY.'
        });
      }

      const digest = await this.aiService.generateNewsDigest(userId);

      // Emit to Socket.io for real-time digest updates
      const io = req.app.get('io');
      if (io && digest.success) {
        io.to(`user_${userId}`).emit('news_digest', {
          userId,
          digest: digest.digest,
          timestamp: digest.generatedAt
        });
      }

      res.json(digest);
    } catch (error) {
      console.error('Generate news digest error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getAIStatus(req, res) {
    try {
      const status = this.aiService.getStatus();

      res.json({
        success: true,
        status
      });
    } catch (error) {
      console.error('Get AI status error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async generateMessageSuggestions(req, res) {
    try {
      const { message, context } = req.body;
      const userId = req.user.id;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required' });
      }

      if (!this.aiService.isReady()) {
        return res.status(503).json({
          error: 'AI service not available. Please configure OPENAI_API_KEY.'
        });
      }

      const suggestions = await this.aiService.generateMessageSuggestions(
        message.trim(),
        context || [],
        userId
      );

      res.json({
        success: true,
        suggestions
      });
    } catch (error) {
      console.error('Generate message suggestions error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async markSuggestionUsed(req, res) {
    try {
      const { suggestionId } = req.params;
      const userId = req.user.id;

      const result = await this.aiService.markSuggestionUsed(
        parseInt(suggestionId),
        userId
      );

      res.json({
        success: true,
        result
      });
    } catch (error) {
      console.error('Mark suggestion used error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async analyzeTone(req, res) {
    try {
      const { message, context } = req.body;
      const userId = req.user.id;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required' });
      }

      if (!this.aiService.isReady()) {
        return res.status(503).json({
          error: 'AI service not available. Please configure OPENAI_API_KEY.'
        });
      }

      const analysis = await this.aiService.analyzeTone(
        message.trim(),
        context || [],
        userId
      );

      res.json({
        success: true,
        analysis
      });
    } catch (error) {
      console.error('Analyze tone error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async requireSuperAdmin(req, res, next) {
    try {
      const user = req.user;

      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({
          error: 'Superadmin access required'
        });
      }

      next();
    } catch (error) {
      console.error('Superadmin check error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async registerAIAgent(req, res) {
    try {
      const { name, description, endpoint, authentication, settings } = req.body;
      const userId = req.user.id;

      if (!name || !endpoint) {
        return res.status(400).json({
          error: 'Agent name and endpoint are required'
        });
      }

      // Validate endpoint URL
      try {
        new URL(endpoint);
      } catch {
        return res.status(400).json({ error: 'Invalid endpoint URL format' });
      }

      const agent = await this.aiService.registerAIAgent({
        name: name.trim(),
        description: description?.trim(),
        endpoint: endpoint.trim(),
        authentication: authentication || {},
        settings: settings || {},
        registeredBy: userId
      });

      res.json({
        success: true,
        agent,
        message: 'AI agent registered successfully'
      });
    } catch (error) {
      console.error('Register AI agent error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async getAvailableAgents(req, res) {
    try {
      const { includeInactive } = req.query;

      const agents = await this.aiService.getAvailableAgents(
        includeInactive === 'true'
      );

      res.json({
        success: true,
        agents
      });
    } catch (error) {
      console.error('Get available agents error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async callExternalAgent(req, res) {
    try {
      const { agentId } = req.params;
      const { message, context, parameters } = req.body;
      const userId = req.user.id;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const response = await this.aiService.callExternalAgent(
        parseInt(agentId),
        {
          message: message.trim(),
          context: context || [],
          parameters: parameters || {},
          userId
        }
      );

      res.json({
        success: true,
        response
      });
    } catch (error) {
      console.error('Call external agent error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateAgentStatus(req, res) {
    try {
      const { agentId } = req.params;
      const { status, settings } = req.body;
      const userId = req.user.id;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const validStatuses = ['active', 'inactive', 'maintenance'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid status. Must be: active, inactive, or maintenance'
        });
      }

      const agent = await this.aiService.updateAgentStatus(
        parseInt(agentId),
        status,
        settings || {},
        userId
      );

      res.json({
        success: true,
        agent,
        message: 'Agent status updated successfully'
      });
    } catch (error) {
      console.error('Update agent status error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AIRoutes;