const OpenAI = require('openai');
const Logger = require('../utils/enhanced-logger');
const fs = require('fs').promises;
const path = require('path');
const { Readable } = require('stream');

/**
 * Voice Service for AI Assistant
 * Provides real-time voice conversation capabilities using OpenAI TTS and Whisper
 */
class VoiceService {
  constructor() {
    this.logger = new Logger('VoiceService');
    this.openai = null;
    this.isReady = false;
    this.voiceDir = 'uploads/voice-messages';
    this.activeConversations = new Map();
    this.supportedVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    this.supportedLanguages = ['en', 'uk', 'ru', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko'];
    this.initialize();
  }

  async initialize() {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        this.logger.warn('OPENAI_API_KEY not found - Voice service will be unavailable');
        return;
      }

      this.openai = new OpenAI({
        apiKey,
        timeout: 60000,
        maxRetries: 3
      });

      // Ensure voice directory exists
      await this.ensureVoiceDirectory();

      this.isReady = true;
      this.logger.info('Voice service initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Voice service', { error: error.message });
      this.isReady = false;
    }
  }

  async ensureVoiceDirectory() {
    try {
      await fs.mkdir(this.voiceDir, { recursive: true });
    } catch (error) {
      this.logger.warn('Failed to create voice directory', { error: error.message });
    }
  }

  async textToSpeech(text, options = {}) {
    if (!this.isReady) {
      throw new Error('Voice service is currently unavailable');
    }

    const {
      voice = 'alloy',
      speed = 1.0,
      model = 'tts-1-hd',
      format = 'mp3',
      saveFile = true,
      streaming = false
    } = options;

    try {
      // Validate inputs
      if (!this.supportedVoices.includes(voice)) {
        throw new Error(`Unsupported voice: ${voice}. Available: ${this.supportedVoices.join(', ')}`);
      }

      if (speed < 0.25 || speed > 4.0) {
        throw new Error('Speed must be between 0.25 and 4.0');
      }

      if (text.length > 4096) {
        throw new Error('Text is too long. Maximum 4096 characters.');
      }

      this.logger.info('Starting text-to-speech conversion', {
        voice,
        speed,
        model,
        textLength: text.length
      });

      const response = await this.openai.audio.speech.create({
        model,
        voice,
        input: text,
        speed,
        response_format: format
      });

      if (streaming) {
        // Return stream for real-time playback
        return {
          stream: Readable.fromWeb(response.body),
          metadata: {
            voice,
            speed,
            model,
            format,
            textLength: text.length,
            timestamp: new Date().toISOString()
          }
        };
      }

      // Convert to buffer
      const buffer = Buffer.from(await response.arrayBuffer());

      let filepath = null;
      if (saveFile) {
        filepath = await this.saveAudioFile(buffer, format, `tts_${voice}`);
      }

      this.logger.info('Text-to-speech conversion completed', {
        voice,
        audioSize: buffer.length,
        saved: !!filepath
      });

      return {
        audioBuffer: buffer,
        filepath,
        metadata: {
          voice,
          speed,
          model,
          format,
          textLength: text.length,
          audioSize: buffer.length,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      this.logger.error('Text-to-speech conversion failed', {
        error: error.message,
        text: text.substring(0, 100)
      });
      throw new Error('Failed to convert text to speech: ' + error.message);
    }
  }

  async speechToText(audioInput, options = {}) {
    if (!this.isReady) {
      throw new Error('Voice service is currently unavailable');
    }

    const {
      language = 'en',
      model = 'whisper-1',
      prompt = '',
      temperature = 0.0,
      responseFormat = 'text'
    } = options;

    try {
      let audioBuffer;
      let filename = 'audio.wav';

      if (typeof audioInput === 'string') {
        // File path
        audioBuffer = await fs.readFile(audioInput);
        filename = path.basename(audioInput);
      } else if (Buffer.isBuffer(audioInput)) {
        // Buffer
        audioBuffer = audioInput;
      } else {
        throw new Error('Invalid audio input format');
      }

      this.logger.info('Starting speech-to-text conversion', {
        model,
        language,
        audioSize: audioBuffer.length
      });

      // Create a File-like object from buffer
      const audioFile = new File([audioBuffer], filename, {
        type: this.getAudioMimeType(filename)
      });

      const transcriptionOptions = {
        file: audioFile,
        model,
        language: this.supportedLanguages.includes(language) ? language : 'en',
        response_format: responseFormat,
        temperature
      };

      if (prompt) {
        transcriptionOptions.prompt = prompt;
      }

      const response = await this.openai.audio.transcriptions.create(transcriptionOptions);

      const transcription = typeof response === 'string' ? response : response.text;

      this.logger.info('Speech-to-text conversion completed', {
        model,
        language,
        transcriptionLength: transcription.length
      });

      return {
        text: transcription,
        metadata: {
          model,
          language,
          audioSize: audioBuffer.length,
          responseFormat,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      this.logger.error('Speech-to-text conversion failed', {
        error: error.message
      });
      throw new Error('Failed to convert speech to text: ' + error.message);
    }
  }

  async startVoiceConversation(userId, options = {}) {
    const {
      voice = 'alloy',
      language = 'en',
      conversationId = this.generateConversationId()
    } = options;

    try {
      const conversation = {
        id: conversationId,
        userId,
        voice,
        language,
        isActive: true,
        messages: [],
        startTime: new Date(),
        lastActivity: new Date()
      };

      this.activeConversations.set(conversationId, conversation);

      this.logger.info('Voice conversation started', {
        conversationId,
        userId,
        voice,
        language
      });

      return {
        conversationId,
        status: 'active',
        voice,
        language,
        startTime: conversation.startTime
      };

    } catch (error) {
      this.logger.error('Failed to start voice conversation', {
        error: error.message,
        userId
      });
      throw new Error('Failed to start voice conversation: ' + error.message);
    }
  }

  async processVoiceMessage(conversationId, audioInput, options = {}) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) {
      throw new Error('Voice conversation not found');
    }

    try {
      // Convert speech to text
      const transcription = await this.speechToText(audioInput, {
        language: conversation.language,
        ...options
      });

      // Add user message to conversation
      conversation.messages.push({
        type: 'user',
        content: transcription.text,
        timestamp: new Date(),
        audioProcessed: true
      });

      // Generate AI response (this would integrate with your AI service)
      const aiResponse = await this.generateAIResponse(transcription.text, conversation);

      // Convert AI response to speech
      const ttsResult = await this.textToSpeech(aiResponse, {
        voice: conversation.voice,
        saveFile: true
      });

      // Add AI message to conversation
      conversation.messages.push({
        type: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        audioFile: ttsResult.filepath,
        audioBuffer: ttsResult.audioBuffer
      });

      conversation.lastActivity = new Date();

      this.logger.info('Voice message processed', {
        conversationId,
        transcriptionLength: transcription.text.length,
        responseLength: aiResponse.length
      });

      return {
        transcription: transcription.text,
        response: aiResponse,
        audioResponse: {
          filepath: ttsResult.filepath,
          buffer: ttsResult.audioBuffer
        },
        conversationId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to process voice message', {
        error: error.message,
        conversationId
      });
      throw new Error('Failed to process voice message: ' + error.message);
    }
  }

  async generateAIResponse(userMessage, conversation) {
    // This is a placeholder - integrate with your actual AI service (AidenCompanion)
    try {
      if (this.openai) {
        // Build conversation context
        const messages = [
          {
            role: 'system',
            content: `You are Aiden, a helpful AI assistant having a voice conversation. Keep responses concise and natural for speech (under 200 words). Current language: ${conversation.language}`
          }
        ];

        // Add recent conversation history
        const recentMessages = conversation.messages.slice(-6).map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));

        messages.push(...recentMessages);
        messages.push({ role: 'user', content: userMessage });

        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 300,
          temperature: 0.7
        });

        return response.choices[0].message.content;
      }

      // Fallback response
      return `I heard you say: "${userMessage}". I'm processing your request and will respond shortly.`;

    } catch (error) {
      this.logger.warn('AI response generation failed, using fallback', { error: error.message });
      return "I'm sorry, I'm having trouble processing your request right now. Could you please try again?";
    }
  }

  async endVoiceConversation(conversationId) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) {
      throw new Error('Voice conversation not found');
    }

    conversation.isActive = false;
    conversation.endTime = new Date();

    // Generate conversation summary
    const summary = await this.generateConversationSummary(conversation);

    this.logger.info('Voice conversation ended', {
      conversationId,
      duration: conversation.endTime - conversation.startTime,
      messageCount: conversation.messages.length
    });

    // Remove from active conversations after a delay
    setTimeout(() => {
      this.activeConversations.delete(conversationId);
    }, 60000); // Keep for 1 minute for potential cleanup

    return {
      conversationId,
      status: 'ended',
      duration: conversation.endTime - conversation.startTime,
      messageCount: conversation.messages.length,
      summary
    };
  }

  async generateConversationSummary(conversation) {
    if (!this.openai || conversation.messages.length === 0) {
      return 'Voice conversation completed.';
    }

    try {
      const messagesText = conversation.messages
        .map(msg => `${msg.type}: ${msg.content}`)
        .join('\n');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Summarize this voice conversation in 1-2 sentences, highlighting the main topics discussed.'
          },
          {
            role: 'user',
            content: `Conversation:\n${messagesText}`
          }
        ],
        max_tokens: 100,
        temperature: 0.3
      });

      return response.choices[0].message.content;

    } catch (error) {
      this.logger.warn('Failed to generate conversation summary', { error: error.message });
      return `Voice conversation with ${conversation.messages.length} messages completed.`;
    }
  }

  async saveAudioFile(buffer, format, prefix) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${prefix}_${timestamp}.${format}`;
      const filepath = path.join(this.voiceDir, filename);

      await fs.writeFile(filepath, buffer);

      this.logger.debug('Audio file saved', { filepath, size: buffer.length });

      return filepath;

    } catch (error) {
      this.logger.warn('Failed to save audio file', { error: error.message });
      return null;
    }
  }

  getAudioMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.flac': 'audio/flac',
      '.webm': 'audio/webm',
      '.ogg': 'audio/ogg'
    };
    return mimeTypes[ext] || 'audio/wav';
  }

  generateConversationId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  getActiveConversations(userId = null) {
    const conversations = Array.from(this.activeConversations.values());

    if (userId) {
      return conversations.filter(conv => conv.userId === userId && conv.isActive);
    }

    return conversations.filter(conv => conv.isActive);
  }

  getConversationStatus(conversationId) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) {
      return { status: 'not_found' };
    }

    return {
      status: conversation.isActive ? 'active' : 'ended',
      conversationId,
      userId: conversation.userId,
      voice: conversation.voice,
      language: conversation.language,
      messageCount: conversation.messages.length,
      startTime: conversation.startTime,
      lastActivity: conversation.lastActivity
    };
  }

  async translateSpeech(audioInput, sourceLanguage, targetLanguage, options = {}) {
    try {
      // Convert speech to text in source language
      const transcription = await this.speechToText(audioInput, {
        language: sourceLanguage,
        ...options
      });

      // Translate text
      const translation = await this.translateText(transcription.text, sourceLanguage, targetLanguage);

      // Convert translation to speech
      const ttsResult = await this.textToSpeech(translation, {
        voice: options.voice || 'alloy',
        saveFile: options.saveFile !== false
      });

      return {
        originalText: transcription.text,
        translatedText: translation,
        audioResponse: {
          filepath: ttsResult.filepath,
          buffer: ttsResult.audioBuffer
        },
        sourceLanguage,
        targetLanguage,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Speech translation failed', { error: error.message });
      throw new Error('Failed to translate speech: ' + error.message);
    }
  }

  async translateText(text, sourceLanguage, targetLanguage) {
    if (!this.openai) {
      throw new Error('Translation requires OpenAI API key');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the given text from ${sourceLanguage} to ${targetLanguage}. Return only the translation, no explanations.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: Math.max(text.length * 2, 100),
        temperature: 0.3
      });

      return response.choices[0].message.content;

    } catch (error) {
      this.logger.error('Text translation failed', { error: error.message });
      throw new Error('Failed to translate text: ' + error.message);
    }
  }

  cleanup() {
    // Clean up old conversations and temporary files
    const now = new Date();
    const oldConversations = [];

    this.activeConversations.forEach((conversation, id) => {
      const timeSinceLastActivity = now - conversation.lastActivity;
      if (timeSinceLastActivity > 30 * 60 * 1000) { // 30 minutes
        oldConversations.push(id);
      }
    });

    oldConversations.forEach(id => {
      this.activeConversations.delete(id);
    });

    if (oldConversations.length > 0) {
      this.logger.info('Cleaned up old conversations', { count: oldConversations.length });
    }
  }

  getStatus() {
    return {
      ready: this.isReady,
      supportedVoices: this.supportedVoices,
      supportedLanguages: this.supportedLanguages,
      activeConversations: this.activeConversations.size,
      features: {
        textToSpeech: true,
        speechToText: true,
        realTimeConversation: true,
        voiceTranslation: true,
        streaming: true
      },
      voiceDirectory: this.voiceDir
    };
  }
}

module.exports = VoiceService;