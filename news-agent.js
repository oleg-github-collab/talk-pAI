const OpenAI = require('openai');
const Parser = require('rss-parser');
const axios = require('axios');
require('dotenv').config();

// Initialize OpenAI and RSS parser
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

const parser = new Parser({
  headers: {
    'User-Agent': 'Talk-pAI-NewsBot/1.0 (https://talkpai.com)'
  }
});

// News sources configuration
const NEWS_SOURCES = {
  technology: [
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'Tech' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'Tech' },
    { name: 'Wired', url: 'https://www.wired.com/feed/rss', category: 'Tech' },
    { name: 'Ars Technica', url: 'http://feeds.arstechnica.com/arstechnica/index', category: 'Tech' },
    { name: 'Hacker News', url: 'https://hnrss.org/frontpage', category: 'Tech' }
  ],
  business: [
    { name: 'Reuters Business', url: 'https://www.reuters.com/business/feed/', category: 'Business' },
    { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss', category: 'Business' },
    { name: 'Financial Times', url: 'https://www.ft.com/rss/home/us', category: 'Business' },
    { name: 'Wall Street Journal', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', category: 'Business' }
  ],
  science: [
    { name: 'NASA News', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', category: 'Science' },
    { name: 'Scientific American', url: 'http://rss.sciam.com/ScientificAmerican-Global', category: 'Science' },
    { name: 'New Scientist', url: 'https://www.newscientist.com/feed/home/', category: 'Science' },
    { name: 'Nature', url: 'https://www.nature.com/nature.rss', category: 'Science' }
  ],
  world: [
    { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', category: 'World' },
    { name: 'CNN World', url: 'http://rss.cnn.com/rss/edition.rss', category: 'World' },
    { name: 'Associated Press', url: 'https://storage.googleapis.com/afs-prod/feeds/feeds.xml', category: 'World' },
    { name: 'Reuters World', url: 'https://www.reuters.com/world/feed/', category: 'World' }
  ],
  health: [
    { name: 'WebMD', url: 'https://www.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC', category: 'Health' },
    { name: 'Medical News Today', url: 'https://www.medicalnewstoday.com/feeds/news', category: 'Health' },
    { name: 'Healthline', url: 'https://www.healthline.com/feeds/news', category: 'Health' }
  ],
  entertainment: [
    { name: 'Entertainment Weekly', url: 'https://ew.com/feed/', category: 'Entertainment' },
    { name: 'Variety', url: 'https://variety.com/feed/', category: 'Entertainment' },
    { name: 'The Hollywood Reporter', url: 'https://www.hollywoodreporter.com/feed/', category: 'Entertainment' }
  ]
};

class NewsAgent {
  constructor(database) {
    this.db = database;
    this.name = "Sage"; // The AI agent's clever name
    this.activeSubscriptions = new Map(); // userId -> { categories, frequency, lastSent }
    this.newsCache = new Map(); // category -> { articles, lastFetched }
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes

    // Start the news delivery scheduler
    this.startScheduler();
  }

  // Subscribe user to news categories
  subscribeUser(userId, preferences) {
    this.activeSubscriptions.set(userId, {
      categories: preferences.categories || ['technology'],
      frequency: preferences.frequency || 'daily', // hourly, daily, weekly
      language: preferences.language || 'en',
      maxArticles: preferences.maxArticles || 5,
      lastSent: new Date(),
      sources: preferences.sources || []
    });

    // Save to database
    this.db.setUserNewsPreferences(userId, preferences);

    return {
      success: true,
      message: `🗞️ Sage here! You're now subscribed to ${preferences.categories.join(', ')} news with ${preferences.frequency} updates. I'll keep you informed with the most relevant stories!`
    };
  }

  // Get available news sources
  getAvailableSources() {
    const sources = {};
    Object.entries(NEWS_SOURCES).forEach(([category, sourceList]) => {
      sources[category] = sourceList.map(source => ({
        name: source.name,
        category: source.category,
        id: source.name.toLowerCase().replace(/\s+/g, '_')
      }));
    });
    return sources;
  }

  // Fetch news from RSS feeds
  async fetchNews(category, maxArticles = 10) {
    // Check cache first
    const cached = this.newsCache.get(category);
    if (cached && (Date.now() - cached.lastFetched) < this.cacheTimeout) {
      return cached.articles.slice(0, maxArticles);
    }

    const sources = NEWS_SOURCES[category] || [];
    const articles = [];

    for (const source of sources) {
      try {
        console.log(`📰 Fetching news from ${source.name}...`);
        const feed = await parser.parseURL(source.url);

        feed.items.slice(0, 5).forEach(item => {
          articles.push({
            title: item.title,
            description: item.contentSnippet || item.description,
            link: item.link,
            pubDate: item.pubDate,
            source: source.name,
            category: source.category,
            guid: item.guid || item.link
          });
        });
      } catch (error) {
        console.error(`Failed to fetch from ${source.name}:`, error.message);
      }
    }

    // Sort by date and deduplicate
    const sortedArticles = articles
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .filter((article, index, self) =>
        index === self.findIndex(a => a.guid === article.guid)
      )
      .slice(0, maxArticles);

    // Cache the results
    this.newsCache.set(category, {
      articles: sortedArticles,
      lastFetched: Date.now()
    });

    return sortedArticles;
  }

  // Generate AI summary of news articles
  async generateNewsSummary(articles, userLanguage = 'en', userPreferences = {}) {
    if (!openai) {
      return `📰 Sage here! I've gathered ${articles.length} fresh stories for you:\n\n${articles.map((a, i) => `${i+1}. **${a.title}** (${a.source})\n${a.description || ''}`).join('\n\n')}\n\nChat with me about any of these stories!`;
    }

    const articlesText = articles.map((article, index) =>
      `${index + 1}. [${article.source}] ${article.title}\n${article.description || ''}\n`
    ).join('\n');

    const languageInstruction = userLanguage !== 'en' ?
      `Please respond in ${this.getLanguageName(userLanguage)}.` : '';

    const prompt = `As Sage, a clever and witty AI news assistant, provide a concise and engaging summary of these recent news articles.

${languageInstruction}

News Articles:
${articlesText}

Please:
1. Create an engaging opening greeting as Sage
2. Summarize the key stories with witty commentary
3. Highlight the most important developments
4. Add your clever insights or observations
5. Keep it conversational and informative
6. End with an offer to discuss any story in detail

Format as a friendly chat message, not a formal report. Be clever, insightful, and slightly humorous when appropriate.`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are Sage, a brilliant and witty AI news assistant. You're knowledgeable, slightly sarcastic, and always insightful. You make news engaging and accessible."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.7
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error generating news summary:', error);
      return `📰 Sage here! I've gathered ${articles.length} fresh stories for you, but I'm having a moment with my wit generator. Here are the headlines:\n\n${articles.map((a, i) => `${i+1}. ${a.title} (${a.source})`).join('\n')}\n\nWant me to dive deeper into any of these?`;
    }
  }

  // Process user interaction with news
  async processNewsInteraction(userId, message) {
    const userPrefs = this.activeSubscriptions.get(userId) ||
                     this.db.getUserNewsPreferences(userId);

    if (!userPrefs) {
      return this.generateOnboardingMessage();
    }

    // Check if user wants latest news
    if (this.isNewsRequest(message)) {
      return await this.getLatestNews(userId, userPrefs);
    }

    // Check if user wants to modify preferences
    if (this.isPreferenceChange(message)) {
      return this.handlePreferenceChange(userId, message);
    }

    // Check if user wants to discuss a specific story
    if (this.isStoryDiscussion(message)) {
      return await this.discussStory(message, userPrefs.language);
    }

    // Default AI assistant response
    return null; // Let the main AI assistant handle
  }

  isNewsRequest(message) {
    const keywords = ['news', 'latest', 'update', 'headlines', 'stories', 'what\'s happening', 'brief', 'summary'];
    return keywords.some(keyword => message.toLowerCase().includes(keyword));
  }

  isPreferenceChange(message) {
    const keywords = ['subscribe', 'unsubscribe', 'change', 'frequency', 'categories', 'sources'];
    return keywords.some(keyword => message.toLowerCase().includes(keyword));
  }

  isStoryDiscussion(message) {
    const keywords = ['tell me more', 'explain', 'details', 'what do you think', 'opinion'];
    return keywords.some(keyword => message.toLowerCase().includes(keyword));
  }

  async getLatestNews(userId, userPrefs) {
    const allArticles = [];

    for (const category of userPrefs.categories) {
      const articles = await this.fetchNews(category, 3);
      allArticles.push(...articles);
    }

    // Sort by recency and limit
    const recentArticles = allArticles
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, userPrefs.maxArticles || 5);

    return await this.generateNewsSummary(recentArticles, userPrefs.language, userPrefs);
  }

  async discussStory(message, language = 'en') {
    if (!openai) {
      return "🤔 That's a great question! I'd love to discuss that with you, but I need my AI capabilities configured first. For now, feel free to share your thoughts and I'll do my best to engage!";
    }

    const prompt = `As Sage, provide an insightful analysis or discussion about this topic: "${message}"

    ${language !== 'en' ? `Please respond in ${this.getLanguageName(language)}.` : ''}

    Be knowledgeable, slightly witty, and provide valuable context or perspective.`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are Sage, a brilliant AI news analyst. Provide thoughtful, insightful commentary with a touch of wit."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 600,
        temperature: 0.8
      });

      return completion.choices[0].message.content;
    } catch (error) {
      return "🤔 Interesting question! I'm having a brief moment of contemplation. Could you rephrase that for me?";
    }
  }

  handlePreferenceChange(userId, message) {
    // Parse preference changes from natural language
    // This would be enhanced with more sophisticated NLP
    return "🔧 Sage here! To change your news preferences, let me guide you. What would you like to adjust?\n\n📋 Current options:\n• Categories: " +
           Object.keys(NEWS_SOURCES).join(', ') +
           "\n• Frequency: hourly, daily, weekly\n• Language: en, uk, ru, es, fr, de\n\nJust tell me what you'd like!";
  }

  generateOnboardingMessage() {
    return `👋 Hello! I'm Sage, your personal news assistant. I can keep you updated with the latest stories from hundreds of sources!

🗞️ **Available Categories:**
${Object.keys(NEWS_SOURCES).map(cat => `• ${cat.charAt(0).toUpperCase() + cat.slice(1)}`).join('\n')}

📅 **Update Frequencies:**
• Hourly - Breaking news as it happens
• Daily - Perfect morning briefing
• Weekly - Comprehensive roundup

🌍 **Languages:** English, Ukrainian, Russian, Spanish, French, German

To get started, just say something like:
"Subscribe me to technology and science news daily" or "I want business updates hourly in Ukrainian"

**Coming Soon:** Create your own AI agents for finance, health, productivity, and more! 🚀`;
  }

  // News delivery scheduler
  startScheduler() {
    // Check every 10 minutes for users who need news updates
    setInterval(async () => {
      await this.deliverScheduledNews();
    }, 10 * 60 * 1000);
  }

  async deliverScheduledNews() {
    for (const [userId, prefs] of this.activeSubscriptions) {
      if (this.shouldDeliverNews(prefs)) {
        try {
          const summary = await this.getLatestNews(userId, prefs);

          // Send via the main message system
          const messageId = await this.db.createMessage('Sage', userId, 'text', summary);

          // Update last sent time
          prefs.lastSent = new Date();
          this.activeSubscriptions.set(userId, prefs);

          console.log(`📰 Delivered news to ${userId}`);
        } catch (error) {
          console.error(`Failed to deliver news to ${userId}:`, error);
        }
      }
    }
  }

  shouldDeliverNews(prefs) {
    const now = new Date();
    const lastSent = new Date(prefs.lastSent);
    const timeDiff = now - lastSent;

    switch (prefs.frequency) {
      case 'hourly':
        return timeDiff >= 60 * 60 * 1000; // 1 hour
      case 'daily':
        return timeDiff >= 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return timeDiff >= 7 * 24 * 60 * 60 * 1000; // 7 days
      default:
        return false;
    }
  }

  getLanguageName(code) {
    const languages = {
      'en': 'English',
      'uk': 'Ukrainian',
      'ru': 'Russian',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German'
    };
    return languages[code] || 'English';
  }
}

module.exports = NewsAgent;