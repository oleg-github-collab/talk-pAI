const OpenAI = require('openai');
const RSSParser = require('rss-parser');
const database = require('../database/connection');

class AIService {
  constructor() {
    this.openai = null;
    this.rssParser = new RSSParser();
    this.isConfigured = false;
    this.initializeAI();
  }

  initializeAI() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey: apiKey
      });
      this.isConfigured = true;
      console.log('✅ AI service initialized with ChatGPT-4o');
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
        model: 'gpt-4o',
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
        model: 'gpt-4o',
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

  getStatus() {
    return {
      configured: this.isConfigured,
      model: 'gpt-4o',
      features: ['chat', 'rss_summarization', 'news_digest']
    };
  }
}

module.exports = AIService;