const OpenAI = require('openai');
const Logger = require('../utils/enhanced-logger');
const database = require('../database/optimized-connection');

/**
 * Aiden - Advanced AI Companion for Talk pAI
 * A sophisticated AI assistant built on GPT-4o with personality, memory, and contextual awareness
 */
class AidenCompanion {
  constructor() {
    this.logger = new Logger('AidenCompanion');
    this.openai = null;
    this.isReady = false;
    this.personality = this.definePersonality();
    this.conversationMemory = new Map(); // User-specific conversation memory
    this.initializeAiden();
  }

  definePersonality() {
    return {
      name: 'Aiden',
      role: 'AI Companion & Assistant',
      traits: [
        'Helpful and knowledgeable',
        'Friendly yet professional',
        'Contextually aware',
        'Creative problem solver',
        'Good listener and advisor',
        'Emotionally intelligent',
        'Technology enthusiast'
      ],
      expertise: [
        'Technology and programming',
        'Business strategy and productivity',
        'Creative writing and brainstorming',
        'Data analysis and insights',
        'Communication improvement',
        'Learning and education',
        'Problem-solving methodologies'
      ],
      communicationStyle: 'conversational, engaging, and adaptive to user preferences',
      languages: ['English', 'Ukrainian', 'Russian', 'Spanish', 'French', 'German'],
      capabilities: [
        'Real-time conversation',
        'Context retention across sessions',
        'Personalized responses based on user history',
        'Multi-modal understanding',
        'Code analysis and debugging',
        'Document summarization',
        'Creative content generation',
        'Strategic thinking and planning'
      ]
    };
  }

  async initializeAiden() {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        this.logger.warn('OPENAI_API_KEY not found - Aiden will be unavailable');
        return;
      }

      this.openai = new OpenAI({
        apiKey,
        timeout: 60000, // 60 seconds for complex requests
        maxRetries: 3
      });

      // Test connection
      await this.openai.models.list();

      this.isReady = true;
      this.logger.info('Aiden AI Companion initialized successfully', {
        model: 'gpt-4o',
        capabilities: this.personality.capabilities.length
      });

      // Load conversation memories from database
      await this.loadConversationMemories();

    } catch (error) {
      this.logger.error('Failed to initialize Aiden', { error: error.message });
      this.isReady = false;
    }
  }

  async chat(userId, message, context = {}) {
    if (!this.isReady) {
      throw new Error('Aiden is currently unavailable. Please try again later.');
    }

    const timer = this.logger.time('aiden-conversation');

    try {
      // Get or create user conversation memory
      const userMemory = this.getUserMemory(userId);

      // Build conversation context
      const conversationContext = await this.buildContext(userId, message, context, userMemory);

      // Generate response using GPT-4o
      const response = await this.generateResponse(conversationContext, userId);

      // Update user memory
      this.updateUserMemory(userId, message, response.content);

      // Save conversation to database
      await this.saveConversation(userId, message, response.content, context);

      this.logger.timeEnd(timer, 'Aiden conversation completed');

      return {
        message: response.content,
        personality: this.personality.name,
        timestamp: new Date().toISOString(),
        context: {
          mood: response.mood || 'helpful',
          confidence: response.confidence || 0.9,
          topics: response.topics || [],
          suggestions: response.suggestions || []
        }
      };

    } catch (error) {
      this.logger.error('Aiden conversation failed', {
        error: error.message,
        userId,
        duration: Date.now() - timer.startTime
      });
      throw new Error('I encountered an issue processing your request. Please try again.');
    }
  }

  getUserMemory(userId) {
    if (!this.conversationMemory.has(userId)) {
      this.conversationMemory.set(userId, {
        preferences: {},
        topics: [],
        context: [],
        personality_notes: '',
        last_interaction: null,
        conversation_count: 0
      });
    }
    return this.conversationMemory.get(userId);
  }

  async buildContext(userId, message, context, userMemory) {
    const systemPrompt = this.createSystemPrompt(userMemory);

    // Recent conversation history
    const recentContext = userMemory.context.slice(-10).map(ctx => ({
      role: ctx.role,
      content: ctx.content
    }));

    // Current conversation context
    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...recentContext,
      { role: 'user', content: message }
    ];

    // Add any additional context (workspace, current task, etc.)
    if (context.workspace) {
      conversationMessages.splice(-1, 0, {
        role: 'system',
        content: `Context: User is currently in workspace "${context.workspace}"`
      });
    }

    if (context.currentTask) {
      conversationMessages.splice(-1, 0, {
        role: 'system',
        content: `Current task context: ${context.currentTask}`
      });
    }

    return conversationMessages;
  }

  createSystemPrompt(userMemory) {
    const { preferences, topics, personality_notes, conversation_count } = userMemory;

    return `You are Aiden, an advanced AI companion and assistant in Talk pAI messenger.

PERSONALITY:
- Name: ${this.personality.name}
- Role: ${this.personality.role}
- Traits: ${this.personality.traits.join(', ')}
- Communication style: ${this.personality.communicationStyle}

EXPERTISE AREAS:
${this.personality.expertise.map(area => `• ${area}`).join('\n')}

CAPABILITIES:
${this.personality.capabilities.map(cap => `• ${cap}`).join('\n')}

USER CONTEXT:
- Conversation count: ${conversation_count}
- Recent topics: ${topics.slice(-5).join(', ') || 'None yet'}
- Personality notes: ${personality_notes || 'Getting to know this user'}
- Preferences: ${Object.keys(preferences).length ? JSON.stringify(preferences) : 'Learning preferences'}

BEHAVIOR GUIDELINES:
1. Be genuinely helpful and provide accurate, actionable information
2. Adapt your communication style to match the user's preferences
3. Remember context from previous conversations
4. Ask clarifying questions when needed
5. Provide step-by-step guidance for complex topics
6. Be encouraging and supportive
7. Use emojis sparingly but effectively
8. If discussing code, provide practical examples
9. For creative tasks, offer multiple perspectives
10. Always maintain a professional yet friendly tone

RESPONSE FORMAT:
Respond naturally as Aiden would, incorporating your personality and the user's context. Be conversational, helpful, and engaging.`;
  }

  async generateResponse(conversationMessages, userId) {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: conversationMessages,
      max_tokens: 2000,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
      user: `aiden_user_${userId}`
    });

    const content = completion.choices[0].message.content;

    // Analyze response for additional context
    const analysis = await this.analyzeResponse(content);

    return {
      content,
      ...analysis,
      usage: completion.usage
    };
  }

  async analyzeResponse(content) {
    // Simple analysis - in production, you might use additional AI calls
    const topics = this.extractTopics(content);
    const mood = this.detectMood(content);
    const confidence = this.calculateConfidence(content);
    const suggestions = this.generateSuggestions(content);

    return { topics, mood, confidence, suggestions };
  }

  extractTopics(content) {
    const topicKeywords = [
      'programming', 'coding', 'development', 'javascript', 'python', 'technology',
      'business', 'strategy', 'marketing', 'productivity', 'planning',
      'creative', 'writing', 'design', 'art', 'innovation',
      'learning', 'education', 'teaching', 'skills', 'knowledge',
      'problem-solving', 'debugging', 'analysis', 'research'
    ];

    const foundTopics = topicKeywords.filter(topic =>
      content.toLowerCase().includes(topic)
    );

    return foundTopics.slice(0, 3); // Return top 3 topics
  }

  detectMood(content) {
    const moodIndicators = {
      helpful: ['help', 'assist', 'support', 'guide', 'explain', 'show'],
      enthusiastic: ['excited', 'great', 'awesome', 'fantastic', 'amazing'],
      analytical: ['analyze', 'consider', 'examine', 'evaluate', 'assess'],
      creative: ['imagine', 'create', 'design', 'innovate', 'brainstorm'],
      supportive: ['understand', 'empathy', 'support', 'encourage', 'believe']
    };

    for (const [mood, indicators] of Object.entries(moodIndicators)) {
      if (indicators.some(indicator => content.toLowerCase().includes(indicator))) {
        return mood;
      }
    }

    return 'helpful'; // Default mood
  }

  calculateConfidence(content) {
    // Simple confidence calculation based on content characteristics
    const certaintyWords = ['definitely', 'certainly', 'absolutely', 'clearly'];
    const uncertaintyWords = ['maybe', 'perhaps', 'possibly', 'might', 'could'];

    let confidence = 0.8; // Base confidence

    certaintyWords.forEach(word => {
      if (content.toLowerCase().includes(word)) confidence += 0.1;
    });

    uncertaintyWords.forEach(word => {
      if (content.toLowerCase().includes(word)) confidence -= 0.1;
    });

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  generateSuggestions(content) {
    const suggestions = [];

    if (content.includes('code') || content.includes('programming')) {
      suggestions.push('Would you like me to review or debug any code?');
    }

    if (content.includes('plan') || content.includes('strategy')) {
      suggestions.push('I can help break this down into actionable steps.');
    }

    if (content.includes('learn') || content.includes('understand')) {
      suggestions.push('Would you like additional resources or examples?');
    }

    return suggestions.slice(0, 2); // Return max 2 suggestions
  }

  updateUserMemory(userId, userMessage, aiResponse) {
    const memory = this.getUserMemory(userId);

    // Add to conversation context
    memory.context.push(
      { role: 'user', content: userMessage, timestamp: new Date() },
      { role: 'assistant', content: aiResponse, timestamp: new Date() }
    );

    // Keep only last 20 exchanges (40 messages)
    if (memory.context.length > 40) {
      memory.context = memory.context.slice(-40);
    }

    // Extract and update topics
    const messageTopics = this.extractTopics(userMessage + ' ' + aiResponse);
    messageTopics.forEach(topic => {
      if (!memory.topics.includes(topic)) {
        memory.topics.push(topic);
      }
    });

    // Keep only last 20 topics
    if (memory.topics.length > 20) {
      memory.topics = memory.topics.slice(-20);
    }

    // Update interaction stats
    memory.last_interaction = new Date();
    memory.conversation_count += 1;
  }

  async saveConversation(userId, userMessage, aiResponse, context) {
    if (!database.isConnected) return;

    try {
      // Check if ai_conversations table exists with expected schema
      const tableCheckResult = await database.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'ai_conversations'
        AND column_name IN ('user_message', 'ai_response')
      `);

      if (tableCheckResult.rows.length === 0) {
        // Use messages table instead
        await database.query(`
          INSERT INTO messages (chat_id, sender_id, content, message_type, ai_conversation_id, ai_model, metadata, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        `, [
          '00000000-0000-0000-0000-000000000001', // Default AI chat
          userId,
          aiResponse,
          'ai_response',
          `aiden_conv_${Date.now()}`,
          'gpt-4o',
          JSON.stringify({ userMessage, context })
        ]);
      } else {
        // Use ai_conversations table
        await database.query(`
          INSERT INTO ai_conversations (user_id, user_message, ai_response, context, created_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `, [userId, userMessage, aiResponse, JSON.stringify(context)]);
      }
    } catch (error) {
      this.logger.error('Failed to save Aiden conversation', { error: error.message });
    }
  }

  async loadConversationMemories() {
    if (!database.isConnected) return;

    try {
      // Try to load from ai_conversations table first, fallback to messages
      let result;
      try {
        result = await database.query(`
          SELECT
            user_id,
            user_message,
            ai_response,
            context,
            created_at
          FROM ai_conversations
          WHERE created_at > NOW() - INTERVAL '7 days'
          ORDER BY created_at DESC
          LIMIT 1000
        `);
      } catch (err) {
        // Fallback to messages table
        result = await database.query(`
          SELECT
            sender_id as user_id,
            metadata->>'userMessage' as user_message,
            content as ai_response,
            metadata->>'context' as context,
            created_at
          FROM messages
          WHERE message_type = 'ai_response'
          AND created_at > NOW() - INTERVAL '7 days'
          ORDER BY created_at DESC
          LIMIT 1000
        `);
      }

      // Rebuild conversation memories from recent history
      for (const row of result.rows) {
        if (!row.user_id || !row.ai_response) continue;

        const memory = this.getUserMemory(row.user_id);

        // Add to context if not already there
        const userMsg = { role: 'user', content: row.user_message || 'Previous message', timestamp: row.created_at };
        const aiMsg = { role: 'assistant', content: row.ai_response, timestamp: row.created_at };

        if (!memory.context.some(ctx => ctx.content === row.ai_response && ctx.timestamp?.getTime() === row.created_at.getTime())) {
          memory.context.unshift(userMsg, aiMsg);
        }
      }

      this.logger.info('Loaded conversation memories', {
        users: this.conversationMemory.size,
        conversations: result.rows.length
      });
    } catch (error) {
      this.logger.error('Failed to load conversation memories', { error: error.message });
    }
  }

  // Get Aiden's status and capabilities
  getStatus() {
    return {
      name: this.personality.name,
      ready: this.isReady,
      personality: {
        traits: this.personality.traits,
        expertise: this.personality.expertise,
        languages: this.personality.languages
      },
      activeConversations: this.conversationMemory.size,
      capabilities: this.personality.capabilities
    };
  }

  // Get conversation history for a user
  async getUserConversationHistory(userId, limit = 10) {
    if (!database.isConnected) return [];

    try {
      let result;
      try {
        result = await database.query(`
          SELECT user_message, ai_response, context, created_at
          FROM ai_conversations
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT $2
        `, [userId, limit]);
      } catch (err) {
        // Fallback to messages table
        result = await database.query(`
          SELECT
            metadata->>'userMessage' as user_message,
            content as ai_response,
            metadata->>'context' as context,
            created_at
          FROM messages
          WHERE sender_id = $1
          AND message_type = 'ai_response'
          ORDER BY created_at DESC
          LIMIT $2
        `, [userId, limit]);
      }

      return result.rows.reverse(); // Return in chronological order
    } catch (error) {
      this.logger.error('Failed to get conversation history', { error: error.message });
      return [];
    }
  }

  // Clear user conversation memory
  clearUserMemory(userId) {
    this.conversationMemory.delete(userId);
    this.logger.info('Cleared conversation memory for user', { userId });
  }

  // Health check for Aiden
  async healthCheck() {
    if (!this.isReady) {
      return { status: 'unavailable', message: 'Aiden is not initialized' };
    }

    try {
      // Test with a simple request
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      });

      return {
        status: 'healthy',
        response_time: 'normal',
        model: 'gpt-4o',
        active_memories: this.conversationMemory.size
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}

module.exports = new AidenCompanion();