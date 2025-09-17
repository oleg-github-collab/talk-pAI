const OpenAI = require('openai');
const RSSParser = require('rss-parser');
const axios = require('axios');
const database = require('../database/optimized-connection');
const Logger = require('../utils/enhanced-logger');
// Create logger instance
const logger = new Logger('AIService');

class AIService {
  constructor() {
    this.openai = null;
    this.rssParser = new RSSParser();
    this.isConfigured = false;
    this.logger = new Logger('AIService');
    this.errorCount = 0;
    this.lastError = null;
    this.rateLimiter = new Map(); // Simple rate limiting
    this.initializeAI();
  }

  initializeAI() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey: apiKey
      });
      this.isConfigured = true;
      console.log('✅ AI service initialized with AI assistant');
    } else {
      console.log('⚠️  OPENAI_API_KEY not found - AI features disabled');
    }
  }

  async chatWithAI(message, context = [], userId = null) {
    if (!this.isConfigured) {
      throw new Error('AI service not configured. Please set OPENAI_API_KEY environment variable.');
    }

    try {
      const systemPrompt = `You are Talk pAI Assistant, an intelligent AI companion in the Talk pAI messenger.
      You can help users with:
      - Answering questions and providing information
      - Summarizing news and RSS feeds
      - Having natural conversations
      - Assisting with various tasks

      Be helpful, friendly, and concise. If users ask about news, offer to summarize their RSS feeds.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...context.slice(-10), // Keep last 10 messages for context
        { role: 'user', content: message }
      ];

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
        user: userId ? `user_${userId}` : undefined
      });

      return {
        message: completion.choices[0].message.content,
        usage: completion.usage
      };
    } catch (error) {
      console.error('AI chat error:', error);
      throw new Error('Failed to process AI request: ' + error.message);
    }
  }

  async summarizeRSSFeed(feedUrl, userId) {
    if (!this.isConfigured) {
      throw new Error('AI service not configured');
    }

    try {
      console.log(`📰 Parsing RSS feed: ${feedUrl}`);
      const feed = await this.rssParser.parseURL(feedUrl);

      const recentItems = feed.items.slice(0, 5); // Get 5 most recent items
      const newsContent = recentItems.map(item =>
        `Title: ${item.title}\nDate: ${item.pubDate}\nContent: ${item.contentSnippet || item.content || item.description || 'No content'}\n---`
      ).join('\n');

      const prompt = `Please provide a concise summary of the following news articles from ${feed.title}.
      Focus on the main points and key information. Group related topics together:

      ${newsContent}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a news summarization assistant. Provide clear, concise summaries of news content.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.3,
        user: userId ? `user_${userId}` : undefined
      });

      // Save RSS summary to database
      if (database.isConnected) {
        await this.saveRSSSummary(userId, feedUrl, feed.title, completion.choices[0].message.content);
      }

      return {
        feedTitle: feed.title,
        summary: completion.choices[0].message.content,
        itemCount: recentItems.length,
        lastUpdated: feed.lastBuildDate || new Date().toISOString()
      };
    } catch (error) {
      console.error('RSS summarization error:', error);
      throw new Error('Failed to summarize RSS feed: ' + error.message);
    }
  }

  async getUserRSSFeeds(userId) {
    if (!database.isConnected) {
      return [];
    }

    try {
      const result = await database.query(
        'SELECT * FROM rss_feeds WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching RSS feeds:', error);
      return [];
    }
  }

  async addRSSFeed(userId, feedUrl, feedTitle = null) {
    if (!database.isConnected) {
      throw new Error('Database not available');
    }

    try {
      // Validate RSS feed first
      const feed = await this.rssParser.parseURL(feedUrl);
      const title = feedTitle || feed.title || 'Unknown Feed';

      const result = await database.query(
        `INSERT INTO rss_feeds (user_id, feed_url, feed_title, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (user_id, feed_url) DO UPDATE SET
         feed_title = EXCLUDED.feed_title,
         is_active = true,
         updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [userId, feedUrl, title]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error adding RSS feed:', error);
      throw new Error('Failed to add RSS feed: ' + error.message);
    }
  }

  async removeRSSFeed(userId, feedId) {
    if (!database.isConnected) {
      throw new Error('Database not available');
    }

    try {
      const result = await database.query(
        'DELETE FROM rss_feeds WHERE id = $1 AND user_id = $2 RETURNING *',
        [feedId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('RSS feed not found or access denied');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error removing RSS feed:', error);
      throw new Error('Failed to remove RSS feed: ' + error.message);
    }
  }

  async saveRSSSummary(userId, feedUrl, feedTitle, summary) {
    if (!database.isConnected) {
      return;
    }

    try {
      await database.query(
        `INSERT INTO rss_summaries (user_id, feed_url, feed_title, summary, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [userId, feedUrl, feedTitle, summary]
      );
    } catch (error) {
      console.error('Error saving RSS summary:', error);
    }
  }

  async getRecentRSSSummaries(userId, limit = 10) {
    if (!database.isConnected) {
      return [];
    }

    try {
      const result = await database.query(
        `SELECT * FROM rss_summaries
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching RSS summaries:', error);
      return [];
    }
  }

  async generateNewsDigest(userId) {
    const userFeeds = await this.getUserRSSFeeds(userId);

    if (userFeeds.length === 0) {
      return {
        success: false,
        message: 'No RSS feeds configured. Add some feeds first!'
      };
    }

    const summaries = [];
    for (const feed of userFeeds.filter(f => f.is_active)) {
      try {
        const summary = await this.summarizeRSSFeed(feed.feed_url, userId);
        summaries.push({
          feedTitle: feed.feed_title,
          feedUrl: feed.feed_url,
          ...summary
        });
      } catch (error) {
        console.error(`Failed to summarize feed ${feed.feed_title}:`, error);
        summaries.push({
          feedTitle: feed.feed_title,
          feedUrl: feed.feed_url,
          error: error.message
        });
      }
    }

    return {
      success: true,
      digest: summaries,
      totalFeeds: userFeeds.length,
      generatedAt: new Date().toISOString()
    };
  }

  isReady() {
    return this.isConfigured;
  }

  // Message Writing Assistance
  async generateMessageSuggestions(originalMessage, context = [], userId = null) {
    if (!this.isConfigured) {
      throw new Error('AI service not configured');
    }

    try {
      const recentMessages = context.slice(-5).map(msg => `${msg.user}: ${msg.content}`).join('\n');

      const suggestions = await Promise.all([
        this.generateSuggestion(originalMessage, 'professional', recentMessages, userId),
        this.generateSuggestion(originalMessage, 'friendly', recentMessages, userId),
        this.generateSuggestion(originalMessage, 'concise', recentMessages, userId),
        this.generateSuggestion(originalMessage, 'detailed', recentMessages, userId)
      ]);

      // Save suggestions to database
      if (database.isConnected && userId) {
        for (const suggestion of suggestions) {
          await this.saveSuggestion(userId, originalMessage, suggestion.message, suggestion.type, context);
        }
      }

      return suggestions;
    } catch (error) {
      console.error('Message suggestions error:', error);
      throw error;
    }
  }

  async generateSuggestion(originalMessage, style, context, userId) {
    const stylePrompts = {
      professional: 'Rewrite this message in a professional, business-appropriate tone while maintaining the core meaning.',
      friendly: 'Rewrite this message in a warm, friendly, and approachable tone.',
      concise: 'Make this message more concise and to-the-point while keeping all important information.',
      detailed: 'Expand this message with more detail and context to make it clearer and more comprehensive.'
    };

    const prompt = `${stylePrompts[style]}

Original message: "${originalMessage}"

Recent conversation context:
${context}

Please provide only the rewritten message without any explanations or quotes.`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a writing assistant that helps improve message communication. Always maintain the original intent while adapting the tone and style as requested.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.7,
      user: userId ? `user_${userId}` : undefined
    });

    return {
      type: style,
      message: completion.choices[0].message.content.trim(),
      confidence: 0.9
    };
  }

  async saveSuggestion(userId, originalMessage, suggestedMessage, suggestionType, context) {
    if (!database.isConnected) return;

    try {
      await database.query(`
        INSERT INTO message_suggestions (user_id, original_message, suggested_message, suggestion_type, context)
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, originalMessage, suggestedMessage, suggestionType, JSON.stringify(context)]);
    } catch (error) {
      console.error('Error saving suggestion:', error);
    }
  }

  async markSuggestionUsed(suggestionId, userId) {
    if (!database.isConnected) return;

    try {
      await database.query(`
        UPDATE message_suggestions
        SET used = true
        WHERE id = $1 AND user_id = $2
      `, [suggestionId, userId]);

      await logger.logAIAction(userId, 'suggestion.used', {
        suggestionId
      });
    } catch (error) {
      console.error('Error marking suggestion as used:', error);
    }
  }

  // External AI Agents Management
  async registerAIAgent({ name, description, endpointUrl, apiKey, capabilities, organizationId, workspaceId, createdBy, settings = {} }) {
    if (!database.isConnected) {
      throw new Error('Database required for AI agent registration');
    }

    try {
      // Test agent connection
      await this.testAgentConnection(endpointUrl, apiKey);

      const result = await database.query(`
        INSERT INTO ai_agents (name, description, endpoint_url, api_key, capabilities, organization_id, workspace_id, created_by, settings)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [name, description, endpointUrl, apiKey, JSON.stringify(capabilities), organizationId, workspaceId, createdBy, JSON.stringify(settings)]);

      await logger.logActivity({
        userId: createdBy,
        action: 'ai_agent.registered',
        resourceType: 'ai_agent',
        resourceId: result.rows[0].id,
        metadata: { agentName: name, endpointUrl }
      });

      return result.rows[0];
    } catch (error) {
      throw new Error('Failed to register AI agent: ' + error.message);
    }
  }

  async testAgentConnection(endpointUrl, apiKey) {
    try {
      const response = await axios.post(`${endpointUrl}/health`, {}, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      return response.status === 200;
    } catch (error) {
      throw new Error(`Agent connection test failed: ${error.message}`);
    }
  }

  async callExternalAgent(agentId, prompt, context = {}, userId = null) {
    if (!database.isConnected) {
      throw new Error('Database required for external agent calls');
    }

    try {
      // Get agent details
      const agentResult = await database.query(`
        SELECT * FROM ai_agents WHERE id = $1 AND is_active = true
      `, [agentId]);

      if (agentResult.rows.length === 0) {
        throw new Error('AI agent not found or inactive');
      }

      const agent = agentResult.rows[0];

      // Call external agent
      const response = await axios.post(`${agent.endpoint_url}/chat`, {
        prompt,
        context,
        user_id: userId
      }, {
        headers: {
          'Authorization': `Bearer ${agent.api_key}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      await logger.logAIAction(userId, 'external_agent.called', {
        agentId,
        agentName: agent.name,
        prompt: prompt.substring(0, 100)
      });

      return {
        response: response.data.response || response.data.message,
        agentName: agent.name,
        capabilities: agent.capabilities
      };
    } catch (error) {
      console.error('External agent call error:', error);
      throw new Error('External agent call failed: ' + error.message);
    }
  }

  async getAvailableAgents(organizationId = null, workspaceId = null) {
    if (!database.isConnected) return [];

    try {
      let query = `
        SELECT id, name, description, capabilities, settings
        FROM ai_agents
        WHERE is_active = true
      `;

      const params = [];
      let paramCount = 0;

      if (workspaceId) {
        query += ` AND (workspace_id = $${++paramCount} OR workspace_id IS NULL)`;
        params.push(workspaceId);
      }

      if (organizationId) {
        query += ` AND (organization_id = $${++paramCount} OR organization_id IS NULL)`;
        params.push(organizationId);
      }

      query += ` ORDER BY name ASC`;

      const result = await database.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting available agents:', error);
      return [];
    }
  }

  async updateAgentStatus(agentId, isActive, userId) {
    if (!database.isConnected) {
      throw new Error('Database required for agent management');
    }

    try {
      const result = await database.query(`
        UPDATE ai_agents
        SET is_active = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [isActive, agentId]);

      if (result.rows.length === 0) {
        throw new Error('AI agent not found');
      }

      await logger.logActivity({
        userId,
        action: `ai_agent.${isActive ? 'activated' : 'deactivated'}`,
        resourceType: 'ai_agent',
        resourceId: agentId,
        metadata: { agentName: result.rows[0].name }
      });

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Tone Analysis and Recommendations
  async analyzeTone(message, conversationHistory = []) {
    if (!this.isConfigured) {
      throw new Error('AI service not configured');
    }

    try {
      const context = conversationHistory.slice(-3).map(msg =>
        `${msg.user}: ${msg.content}`
      ).join('\n');

      const prompt = `Analyze the tone and suggest improvements for this message:

Message: "${message}"

Recent conversation context:
${context}

Please provide:
1. Current tone assessment (professional, casual, formal, friendly, etc.)
2. Emotional tone (positive, neutral, negative, urgent, etc.)
3. Clarity score (1-10)
4. Recommendations for improvement
5. Suggested alternative if needed

Format as JSON with fields: tone, emotion, clarity, recommendations, alternative`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a communication expert that analyzes message tone and provides improvement suggestions. Always respond with valid JSON.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.3
      });

      const analysis = JSON.parse(completion.choices[0].message.content);
      return {
        ...analysis,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Tone analysis error:', error);
      return {
        tone: 'neutral',
        emotion: 'neutral',
        clarity: 7,
        recommendations: ['Message appears clear'],
        alternative: null
      };
    }
  }

  getStatus() {
    return {
      configured: this.isConfigured,
      model: 'gpt-4o-mini',
      features: [
        'chat',
        'rss_summarization',
        'news_digest',
        'message_suggestions',
        'tone_analysis',
        'external_agents'
      ]
    };
  }
}

module.exports = AIService;