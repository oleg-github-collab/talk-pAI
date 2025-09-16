const express = require('express');
const SearchService = require('./service');
const authMiddleware = require('../middleware/auth');
const Logger = require('../utils/logger');

class SearchRoutes {
  constructor() {
    this.router = express.Router();
    this.searchService = new SearchService();
    this.logger = new Logger('SearchRoutes');
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Apply authentication to all search routes
    this.router.use(authMiddleware);

    // User search with suggestions
    this.router.get('/users', this.searchUsers.bind(this));
    this.router.get('/users/suggestions', this.getUserSuggestions.bind(this));

    // Message search
    this.router.get('/messages', this.searchMessages.bind(this));

    // Chat/channel search
    this.router.get('/chats', this.searchChats.bind(this));

    // Global search
    this.router.get('/global', this.globalSearch.bind(this));

    // Search analytics (for improving search)
    this.router.post('/analytics', this.logSearchAnalytics.bind(this));
  }

  async searchUsers(req, res) {
    try {
      const { q: query, limit = 10, workspace_id, organization_id, include_inactive } = req.query;

      if (!query || query.trim().length === 0) {
        return res.json([]);
      }

      if (query.length > 100) {
        return res.status(400).json({ error: 'Search query too long' });
      }

      const options = {
        limit: parseInt(limit),
        includeInactive: include_inactive === 'true',
        workspaceId: workspace_id ? parseInt(workspace_id) : null,
        organizationId: organization_id ? parseInt(organization_id) : null
      };

      const users = await this.searchService.searchUsers(
        query.trim(),
        req.user.id,
        options
      );

      this.logger.info('User search completed', {
        userId: req.user.id,
        query: query.trim(),
        resultCount: users.length
      });

      res.json(users);
    } catch (error) {
      this.logger.error('User search failed', {
        error: error.message,
        userId: req.user.id,
        query: req.query.q
      });
      res.status(500).json({ error: 'Search failed' });
    }
  }

  async getUserSuggestions(req, res) {
    try {
      const { q: query, limit = 5 } = req.query;

      if (!query || query.trim().length < 1) {
        return res.json([]);
      }

      if (query.length > 50) {
        return res.status(400).json({ error: 'Query too long for suggestions' });
      }

      const suggestions = await this.searchService.getSuggestions(
        query.trim(),
        req.user.id,
        { limit: parseInt(limit) }
      );

      res.json(suggestions);
    } catch (error) {
      this.logger.error('User suggestions failed', {
        error: error.message,
        userId: req.user.id,
        query: req.query.q
      });
      res.status(500).json({ error: 'Suggestions failed' });
    }
  }

  async searchMessages(req, res) {
    try {
      const {
        q: query,
        chat_id,
        workspace_id,
        message_type,
        limit = 20,
        offset = 0
      } = req.query;

      if (!query || query.trim().length === 0) {
        return res.json({ messages: [], total: 0 });
      }

      if (query.length > 200) {
        return res.status(400).json({ error: 'Search query too long' });
      }

      const options = {
        chatId: chat_id ? parseInt(chat_id) : null,
        workspaceId: workspace_id ? parseInt(workspace_id) : null,
        messageType,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const result = await this.searchService.searchMessages(
        query.trim(),
        req.user.id,
        options
      );

      this.logger.info('Message search completed', {
        userId: req.user.id,
        query: query.trim(),
        resultCount: result.messages ? result.messages.length : result.length
      });

      res.json(result);
    } catch (error) {
      this.logger.error('Message search failed', {
        error: error.message,
        userId: req.user.id,
        query: req.query.q
      });
      res.status(500).json({ error: 'Message search failed' });
    }
  }

  async searchChats(req, res) {
    try {
      const {
        q: query,
        workspace_id,
        include_private = 'true',
        limit = 10
      } = req.query;

      if (!query || query.trim().length === 0) {
        return res.json([]);
      }

      if (query.length > 100) {
        return res.status(400).json({ error: 'Search query too long' });
      }

      const options = {
        workspaceId: workspace_id ? parseInt(workspace_id) : null,
        includePrivate: include_private === 'true',
        limit: parseInt(limit)
      };

      const chats = await this.searchService.searchChats(
        query.trim(),
        req.user.id,
        options
      );

      this.logger.info('Chat search completed', {
        userId: req.user.id,
        query: query.trim(),
        resultCount: chats.length
      });

      res.json(chats);
    } catch (error) {
      this.logger.error('Chat search failed', {
        error: error.message,
        userId: req.user.id,
        query: req.query.q
      });
      res.status(500).json({ error: 'Chat search failed' });
    }
  }

  async globalSearch(req, res) {
    try {
      const { q: query, limit = 20 } = req.query;

      if (!query || query.trim().length === 0) {
        return res.json({
          users: [],
          messages: [],
          chats: [],
          total: { users: 0, messages: 0, chats: 0 }
        });
      }

      if (query.length > 200) {
        return res.status(400).json({ error: 'Search query too long' });
      }

      const results = await this.searchService.globalSearch(
        query.trim(),
        req.user.id,
        { limit: parseInt(limit) }
      );

      this.logger.info('Global search completed', {
        userId: req.user.id,
        query: query.trim(),
        totalResults: Object.values(results.total).reduce((sum, count) => sum + count, 0)
      });

      res.json(results);
    } catch (error) {
      this.logger.error('Global search failed', {
        error: error.message,
        userId: req.user.id,
        query: req.query.q
      });
      res.status(500).json({ error: 'Global search failed' });
    }
  }

  async logSearchAnalytics(req, res) {
    try {
      const { query, results_count, search_type, clicked_result } = req.body;

      if (!query || typeof results_count !== 'number') {
        return res.status(400).json({ error: 'Invalid analytics data' });
      }

      // Log analytics for improving search algorithms
      this.logger.info('Search analytics', {
        userId: req.user.id,
        query: query.trim(),
        resultsCount: results_count,
        searchType: search_type,
        clickedResult: clicked_result,
        timestamp: new Date().toISOString()
      });

      // In production, this could be sent to analytics service
      // await this.analyticsService.logSearch({...})

      res.json({ success: true });
    } catch (error) {
      this.logger.error('Search analytics logging failed', {
        error: error.message,
        userId: req.user.id
      });
      res.status(500).json({ error: 'Analytics logging failed' });
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = SearchRoutes;