const axios = require('axios');
const Logger = require('../utils/enhanced-logger');

/**
 * Web Search Service for AI Assistant
 * Provides real-time web search capabilities using multiple search engines
 */
class WebSearchService {
  constructor() {
    this.logger = new Logger('WebSearchService');
    this.searchEngines = this.initializeSearchEngines();
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  initializeSearchEngines() {
    return {
      // DuckDuckGo Instant Answer API
      duckduckgo: {
        name: 'DuckDuckGo',
        url: 'https://api.duckduckgo.com/',
        method: 'GET',
        params: (query) => ({
          q: query,
          format: 'json',
          no_redirect: '1',
          no_html: '1',
          skip_disambig: '1'
        })
      },

      // Wikipedia API
      wikipedia: {
        name: 'Wikipedia',
        url: 'https://en.wikipedia.org/api/rest_v1/page/summary/',
        method: 'GET',
        format: 'wikipedia'
      },

      // News API (if available)
      newsapi: {
        name: 'NewsAPI',
        url: 'https://newsapi.org/v2/everything',
        method: 'GET',
        requiresKey: true,
        apiKey: process.env.NEWS_API_KEY,
        params: (query) => ({
          q: query,
          sortBy: 'relevancy',
          pageSize: 5,
          language: 'en'
        })
      }
    };
  }

  async search(query, options = {}) {
    try {
      const {
        maxResults = 5,
        sources = ['duckduckgo', 'wikipedia'],
        useCache = true,
        includeNews = false
      } = options;

      // Check cache first
      const cacheKey = `${query}_${sources.join('_')}`;
      if (useCache && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          this.logger.debug('Returning cached search results', { query, sources });
          return cached.results;
        }
        this.cache.delete(cacheKey);
      }

      this.logger.info('Performing web search', { query, sources, maxResults });

      const searchPromises = [];

      // Add requested search engines
      for (const source of sources) {
        if (this.searchEngines[source]) {
          searchPromises.push(this.searchWithEngine(source, query, maxResults));
        }
      }

      // Add news search if requested
      if (includeNews && this.searchEngines.newsapi.apiKey) {
        searchPromises.push(this.searchWithEngine('newsapi', query, maxResults));
      }

      const results = await Promise.allSettled(searchPromises);

      // Combine and format results
      const combinedResults = this.combineResults(results, maxResults);

      // Cache results
      if (useCache) {
        this.cache.set(cacheKey, {
          results: combinedResults,
          timestamp: Date.now()
        });
      }

      this.logger.info('Web search completed', {
        query,
        totalResults: combinedResults.length,
        sources: sources.length
      });

      return combinedResults;

    } catch (error) {
      this.logger.error('Web search failed', {
        error: error.message,
        query
      });
      throw new Error('Web search temporarily unavailable');
    }
  }

  async searchWithEngine(engineName, query, maxResults) {
    const engine = this.searchEngines[engineName];

    try {
      let searchUrl = engine.url;
      let requestConfig = {
        method: engine.method,
        timeout: 10000,
        headers: {
          'User-Agent': 'TalkpAI/1.0 (AI Assistant)',
          'Accept': 'application/json'
        }
      };

      if (engineName === 'duckduckgo') {
        requestConfig.params = engine.params(query);
      } else if (engineName === 'wikipedia') {
        searchUrl += encodeURIComponent(query);
      } else if (engineName === 'newsapi') {
        requestConfig.params = {
          ...engine.params(query),
          apiKey: engine.apiKey
        };
      }

      const response = await axios(searchUrl, requestConfig);

      return this.formatResults(engineName, response.data, query, maxResults);

    } catch (error) {
      this.logger.warn(`Search engine ${engineName} failed`, {
        error: error.message,
        query
      });
      return { source: engineName, results: [], error: error.message };
    }
  }

  formatResults(engineName, data, query, maxResults) {
    const results = [];

    try {
      switch (engineName) {
        case 'duckduckgo':
          // DuckDuckGo instant answer
          if (data.Answer) {
            results.push({
              title: 'DuckDuckGo Answer',
              content: data.Answer,
              url: data.AbstractURL || '',
              source: 'DuckDuckGo',
              type: 'instant_answer',
              relevance: 1.0
            });
          }

          // Abstract
          if (data.Abstract) {
            results.push({
              title: data.Heading || query,
              content: data.Abstract,
              url: data.AbstractURL || '',
              source: 'DuckDuckGo',
              type: 'abstract',
              relevance: 0.9
            });
          }

          // Related topics
          if (data.RelatedTopics && data.RelatedTopics.length > 0) {
            data.RelatedTopics.slice(0, 3).forEach((topic, index) => {
              if (topic.Text) {
                results.push({
                  title: topic.Text.split(' - ')[0] || 'Related Topic',
                  content: topic.Text,
                  url: topic.FirstURL || '',
                  source: 'DuckDuckGo',
                  type: 'related_topic',
                  relevance: 0.7 - (index * 0.1)
                });
              }
            });
          }
          break;

        case 'wikipedia':
          if (data.extract) {
            results.push({
              title: data.title,
              content: data.extract,
              url: data.content_urls?.desktop?.page || '',
              source: 'Wikipedia',
              type: 'encyclopedia',
              relevance: 0.8
            });
          }
          break;

        case 'newsapi':
          if (data.articles && data.articles.length > 0) {
            data.articles.slice(0, maxResults).forEach((article, index) => {
              results.push({
                title: article.title,
                content: article.description || article.content?.substring(0, 200) + '...',
                url: article.url,
                source: article.source?.name || 'News',
                type: 'news',
                relevance: 0.8 - (index * 0.05),
                publishedAt: article.publishedAt
              });
            });
          }
          break;
      }
    } catch (error) {
      this.logger.warn(`Failed to format results for ${engineName}`, {
        error: error.message
      });
    }

    return { source: engineName, results };
  }

  combineResults(searchResults, maxResults) {
    const allResults = [];

    // Collect all successful results
    searchResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.results) {
        allResults.push(...result.value.results);
      }
    });

    // Sort by relevance and remove duplicates
    const uniqueResults = this.removeDuplicates(allResults);
    uniqueResults.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

    return uniqueResults.slice(0, maxResults);
  }

  removeDuplicates(results) {
    const seen = new Set();
    return results.filter(result => {
      const key = result.title?.toLowerCase() + result.content?.substring(0, 100).toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async searchCurrentEvents(query, options = {}) {
    const {
      timeframe = '24h',
      maxResults = 10
    } = options;

    // Add time-specific keywords to the query
    const timeQuery = `${query} ${this.getTimeKeywords(timeframe)}`;

    return await this.search(timeQuery, {
      ...options,
      sources: ['duckduckgo', 'newsapi'],
      includeNews: true,
      maxResults
    });
  }

  getTimeKeywords(timeframe) {
    const now = new Date();

    switch (timeframe) {
      case '1h':
        return 'latest news today';
      case '24h':
        return 'today news recent';
      case '7d':
        return 'this week recent';
      case '30d':
        return 'this month recent';
      default:
        return 'latest recent';
    }
  }

  async searchFactual(query, options = {}) {
    return await this.search(query, {
      ...options,
      sources: ['wikipedia', 'duckduckgo'],
      maxResults: 3
    });
  }

  clearCache() {
    this.cache.clear();
    this.logger.info('Search cache cleared');
  }

  getStats() {
    return {
      cacheSize: this.cache.size,
      availableEngines: Object.keys(this.searchEngines).length,
      activeEngines: Object.values(this.searchEngines).filter(engine =>
        !engine.requiresKey || engine.apiKey
      ).length
    };
  }
}

module.exports = WebSearchService;