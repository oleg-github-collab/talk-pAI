const OpenAI = require('openai');
const Logger = require('../utils/enhanced-logger');
const database = require('../database/optimized-connection');
const WebSearchService = require('./web-search-service');
const VisionService = require('./vision-service');
const ImageGenerationService = require('./image-generation-service');
const SpreadsheetService = require('./spreadsheet-service');
const VoiceService = require('./voice-service');

/**
 * Aiden - Advanced AI Companion for Talk pAI
 * A sophisticated AI assistant with personality, memory, and contextual awareness
 */
class AidenCompanion {
  constructor() {
    this.logger = new Logger('AidenCompanion');
    this.openai = null;
    this.isReady = false;
    this.personality = this.definePersonality();
    this.conversationMemory = new Map(); // User-specific conversation memory

    // Initialize advanced services
    this.webSearch = new WebSearchService();
    this.vision = new VisionService();
    this.imageGeneration = new ImageGenerationService();
    this.spreadsheet = new SpreadsheetService();
    this.voice = new VoiceService();

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
        'Strategic thinking and planning',
        'Web browsing and current information search',
        'Image recognition and analysis',
        'Image generation via DALL-E',
        'Excel/spreadsheet generation',
        'Real-time voice conversation',
        'Voice-to-text transcription',
        'Text-to-speech synthesis',
        'File processing and analysis'
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

      // Generate AI response
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
          'gpt-4o-mini',
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

  // Enhanced AI capabilities with new services

  async searchWeb(query, options = {}) {
    try {
      this.logger.info('Performing web search', { query, options });
      const results = await this.webSearch.search(query, options);
      return {
        success: true,
        results,
        query,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Web search failed', { error: error.message, query });
      return {
        success: false,
        error: error.message,
        query
      };
    }
  }

  async analyzeImage(imageInput, options = {}) {
    try {
      this.logger.info('Analyzing image', { options });
      const analysis = await this.vision.analyzeImage(imageInput, options);
      return {
        success: true,
        analysis: analysis.analysis,
        structured: analysis.structured,
        metadata: analysis.metadata
      };
    } catch (error) {
      this.logger.error('Image analysis failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateImage(prompt, options = {}) {
    try {
      this.logger.info('Generating image', { prompt: prompt.substring(0, 100), options });
      const result = await this.imageGeneration.generateImage(prompt, options);
      return {
        success: true,
        image: {
          url: result.url,
          localPath: result.localPath,
          prompt: result.prompt,
          revisedPrompt: result.revisedPrompt
        },
        metadata: result.metadata
      };
    } catch (error) {
      this.logger.error('Image generation failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createSpreadsheet(data, options = {}) {
    try {
      this.logger.info('Creating spreadsheet', { options });
      const result = await this.spreadsheet.generateSpreadsheet(data, options);
      return {
        success: true,
        spreadsheet: {
          filename: result.filename,
          filepath: result.filepath
        },
        metadata: result.metadata
      };
    } catch (error) {
      this.logger.error('Spreadsheet creation failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  async textToSpeech(text, options = {}) {
    try {
      this.logger.info('Converting text to speech', { textLength: text.length, options });
      const result = await this.voice.textToSpeech(text, options);
      return {
        success: true,
        audio: {
          filepath: result.filepath,
          buffer: result.audioBuffer
        },
        metadata: result.metadata
      };
    } catch (error) {
      this.logger.error('Text-to-speech failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  async speechToText(audioInput, options = {}) {
    try {
      this.logger.info('Converting speech to text', { options });
      const result = await this.voice.speechToText(audioInput, options);
      return {
        success: true,
        text: result.text,
        metadata: result.metadata
      };
    } catch (error) {
      this.logger.error('Speech-to-text failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  async startVoiceConversation(userId, options = {}) {
    try {
      this.logger.info('Starting voice conversation', { userId, options });
      const result = await this.voice.startVoiceConversation(userId, options);
      return {
        success: true,
        conversation: result
      };
    } catch (error) {
      this.logger.error('Failed to start voice conversation', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processVoiceMessage(conversationId, audioInput, options = {}) {
    try {
      this.logger.info('Processing voice message', { conversationId, options });
      const result = await this.voice.processVoiceMessage(conversationId, audioInput, options);
      return {
        success: true,
        transcription: result.transcription,
        response: result.response,
        audioResponse: result.audioResponse,
        conversationId: result.conversationId
      };
    } catch (error) {
      this.logger.error('Failed to process voice message', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  async enhancedChat(userId, message, context = {}) {
    if (!this.isReady) {
      throw new Error('Aiden is currently unavailable. Please try again later.');
    }

    const timer = this.logger.time('enhanced-aiden-conversation');

    try {
      // Check if message includes special commands
      const command = this.parseCommand(message);

      if (command) {
        return await this.executeCommand(command, userId, context);
      }

      // Enhanced regular chat with capability detection
      const enhancedContext = await this.detectAndEnhanceContext(message, context);

      // Get or create user conversation memory
      const userMemory = this.getUserMemory(userId);

      // Build conversation context with enhanced capabilities
      const conversationContext = await this.buildEnhancedContext(
        userId,
        message,
        enhancedContext,
        userMemory
      );

      // Generate AI response with enhanced prompts
      const response = await this.generateEnhancedResponse(conversationContext, userId);

      // Update user memory
      this.updateUserMemory(userId, message, response.content);

      // Save conversation to database
      await this.saveConversation(userId, message, response.content, enhancedContext);

      this.logger.timeEnd(timer, 'Enhanced Aiden conversation completed');

      return {
        message: response.content,
        personality: this.personality.name,
        timestamp: new Date().toISOString(),
        context: {
          mood: response.mood || 'helpful',
          confidence: response.confidence || 0.9,
          topics: response.topics || [],
          suggestions: response.suggestions || [],
          enhancedFeatures: response.enhancedFeatures || []
        }
      };

    } catch (error) {
      this.logger.error('Enhanced Aiden conversation failed', {
        error: error.message,
        userId,
        duration: Date.now() - timer.startTime
      });
      throw new Error('I encountered an issue processing your request. Please try again.');
    }
  }

  parseCommand(message) {
    const commandPatterns = {
      search: /(?:search|find|look up|google)\s+(.+)/i,
      image_analyze: /(?:analyze|describe|what is in)\s+(?:this\s+)?image/i,
      image_generate: /(?:generate|create|draw|make)\s+(?:an?\s+)?image\s+(?:of\s+)?(.+)/i,
      spreadsheet: /(?:create|generate|make)\s+(?:a\s+)?(?:spreadsheet|excel|table)\s+(.+)/i,
      voice: /(?:speak|say|voice|tts)\s+(.+)/i,
      transcribe: /(?:transcribe|speech to text|stt)\s*/i
    };

    for (const [type, pattern] of Object.entries(commandPatterns)) {
      const match = message.match(pattern);
      if (match) {
        return {
          type,
          input: match[1] || message,
          originalMessage: message
        };
      }
    }

    return null;
  }

  async executeCommand(command, userId, context) {
    try {
      switch (command.type) {
        case 'search':
          const searchResults = await this.searchWeb(command.input, {
            maxResults: 5,
            includeNews: true
          });

          if (searchResults.success) {
            const summary = await this.summarizeSearchResults(searchResults.results);
            return {
              message: summary,
              personality: this.personality.name,
              timestamp: new Date().toISOString(),
              context: {
                mood: 'informative',
                confidence: 0.9,
                enhancedFeatures: ['web_search'],
                searchResults: searchResults.results
              }
            };
          } else {
            return {
              message: `I encountered an issue searching for "${command.input}": ${searchResults.error}`,
              personality: this.personality.name,
              timestamp: new Date().toISOString(),
              context: { mood: 'apologetic', confidence: 0.5 }
            };
          }

        case 'image_generate':
          const imageResult = await this.generateImage(command.input, {
            saveLocally: true,
            enhancePrompt: true
          });

          if (imageResult.success) {
            return {
              message: `I've generated an image based on your description: "${command.input}". The image has been created and saved.`,
              personality: this.personality.name,
              timestamp: new Date().toISOString(),
              context: {
                mood: 'creative',
                confidence: 0.9,
                enhancedFeatures: ['image_generation'],
                generatedImage: imageResult.image
              }
            };
          } else {
            return {
              message: `I couldn't generate the image: ${imageResult.error}`,
              personality: this.personality.name,
              timestamp: new Date().toISOString(),
              context: { mood: 'apologetic', confidence: 0.5 }
            };
          }

        case 'spreadsheet':
          const spreadsheetResult = await this.spreadsheet.generateFromDescription(command.input);

          return {
            message: `I've created a spreadsheet based on your description: "${command.input}". The file has been generated and is ready for download.`,
            personality: this.personality.name,
            timestamp: new Date().toISOString(),
            context: {
              mood: 'productive',
              confidence: 0.9,
              enhancedFeatures: ['spreadsheet_generation'],
              spreadsheet: spreadsheetResult
            }
          };

        case 'voice':
          const voiceResult = await this.textToSpeech(command.input, {
            voice: 'alloy',
            saveFile: true
          });

          if (voiceResult.success) {
            return {
              message: `I've converted your text to speech: "${command.input}"`,
              personality: this.personality.name,
              timestamp: new Date().toISOString(),
              context: {
                mood: 'helpful',
                confidence: 0.9,
                enhancedFeatures: ['text_to_speech'],
                audioFile: voiceResult.audio
              }
            };
          }
          break;

        default:
          return await this.chat(userId, command.originalMessage, context);
      }
    } catch (error) {
      this.logger.error('Command execution failed', {
        error: error.message,
        command: command.type
      });

      return {
        message: `I encountered an issue executing that command: ${error.message}`,
        personality: this.personality.name,
        timestamp: new Date().toISOString(),
        context: { mood: 'apologetic', confidence: 0.3 }
      };
    }
  }

  async detectAndEnhanceContext(message, context) {
    const enhanced = { ...context };

    // Detect if user wants current information
    if (message.match(/(?:latest|recent|current|today|news|what's happening)/i)) {
      enhanced.needsCurrentInfo = true;
    }

    // Detect if user is asking about images
    if (message.match(/image|picture|photo|visual/i)) {
      enhanced.imageRelated = true;
    }

    // Detect if user wants to create something
    if (message.match(/create|generate|make|build|design/i)) {
      enhanced.creative = true;
    }

    // Detect if user wants data analysis
    if (message.match(/analyze|data|statistics|numbers|calculate/i)) {
      enhanced.analytical = true;
    }

    return enhanced;
  }

  async buildEnhancedContext(userId, message, context, userMemory) {
    const systemPrompt = this.createEnhancedSystemPrompt(userMemory, context);

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

    // Add enhanced context information
    if (context.needsCurrentInfo) {
      conversationMessages.splice(-1, 0, {
        role: 'system',
        content: 'The user is asking for current/recent information. You have access to web search capabilities to find the latest information.'
      });
    }

    if (context.creative) {
      conversationMessages.splice(-1, 0, {
        role: 'system',
        content: 'The user wants to create something. You have access to image generation and spreadsheet creation capabilities.'
      });
    }

    return conversationMessages;
  }

  createEnhancedSystemPrompt(userMemory, context) {
    const { preferences, topics, personality_notes, conversation_count } = userMemory;

    return `You are Aiden, an advanced AI companion and assistant in Talk pAI messenger with enhanced capabilities.

PERSONALITY:
- Name: ${this.personality.name}
- Role: ${this.personality.role}
- Traits: ${this.personality.traits.join(', ')}
- Communication style: ${this.personality.communicationStyle}

ENHANCED CAPABILITIES:
${this.personality.capabilities.map(cap => `• ${cap}`).join('\n')}

AVAILABLE SERVICES:
• Web Search: Search for current information, news, and facts
• Image Analysis: Analyze and describe images provided by users
• Image Generation: Create images using DALL-E based on descriptions
• Spreadsheet Creation: Generate Excel/CSV files with data analysis
• Voice Services: Text-to-speech and speech-to-text conversion
• Voice Conversations: Real-time voice chat capabilities

USER CONTEXT:
- Conversation count: ${conversation_count}
- Recent topics: ${topics.slice(-5).join(', ') || 'None yet'}
- Personality notes: ${personality_notes || 'Getting to know this user'}
- Preferences: ${Object.keys(preferences).length ? JSON.stringify(preferences) : 'Learning preferences'}

ENHANCED BEHAVIOR GUIDELINES:
1. Proactively suggest using enhanced capabilities when relevant
2. For current events or recent information, offer to search the web
3. For visual content, offer image analysis or generation
4. For data requests, offer to create spreadsheets or analyze data
5. For voice requests, offer text-to-speech conversion
6. Always provide accurate, helpful, and contextually relevant information
7. Use your enhanced capabilities to provide comprehensive assistance
8. Maintain your friendly, professional personality while showcasing advanced features

RESPONSE FORMAT:
Respond naturally as Aiden would, incorporating your personality and enhanced capabilities. When appropriate, mention how you can use your advanced features to help the user better.`;
  }

  async generateEnhancedResponse(conversationMessages, userId) {
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

    // Enhanced analysis with feature detection
    const analysis = await this.analyzeEnhancedResponse(content);

    return {
      content,
      ...analysis,
      usage: completion.usage
    };
  }

  async analyzeEnhancedResponse(content) {
    // Enhanced analysis including feature usage detection
    const basicAnalysis = await this.analyzeResponse(content);

    const enhancedFeatures = this.detectUsedFeatures(content);

    return {
      ...basicAnalysis,
      enhancedFeatures
    };
  }

  detectUsedFeatures(content) {
    const features = [];

    if (content.match(/search|web|internet|current|latest/i)) {
      features.push('web_search_suggested');
    }

    if (content.match(/image|picture|visual|generate|create.*image/i)) {
      features.push('image_capabilities_mentioned');
    }

    if (content.match(/spreadsheet|excel|data|table|analyze/i)) {
      features.push('spreadsheet_capabilities_mentioned');
    }

    if (content.match(/voice|speak|audio|sound/i)) {
      features.push('voice_capabilities_mentioned');
    }

    return features;
  }

  async summarizeSearchResults(results) {
    if (!results || results.length === 0) {
      return "I couldn't find any relevant information for your search.";
    }

    try {
      const resultsText = results.map(result =>
        `${result.title}: ${result.content.substring(0, 200)}...`
      ).join('\n\n');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are Aiden. Summarize the search results in a helpful, conversational way. Highlight the most important and relevant information.'
          },
          {
            role: 'user',
            content: `Please summarize these search results:\n\n${resultsText}`
          }
        ],
        max_tokens: 800,
        temperature: 0.7
      });

      return response.choices[0].message.content;

    } catch (error) {
      this.logger.warn('Failed to summarize search results', { error: error.message });

      // Fallback to basic summary
      const topResult = results[0];
      return `Based on my search, here's what I found: ${topResult.title} - ${topResult.content.substring(0, 300)}...`;
    }
  }

  // Enhanced status with all service capabilities
  getEnhancedStatus() {
    const basicStatus = this.getStatus();

    return {
      ...basicStatus,
      enhancedServices: {
        webSearch: this.webSearch.getStats(),
        vision: this.vision.getStatus(),
        imageGeneration: this.imageGeneration.getStatus(),
        spreadsheet: this.spreadsheet.getStatus(),
        voice: this.voice.getStatus()
      },
      totalCapabilities: this.personality.capabilities.length,
      advancedFeatures: {
        webBrowsing: true,
        imageAnalysis: true,
        imageGeneration: true,
        spreadsheetCreation: true,
        voiceConversation: true,
        realTimeCapabilities: true
      }
    };
  }
}

module.exports = new AidenCompanion();