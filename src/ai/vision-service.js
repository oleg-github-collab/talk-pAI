const OpenAI = require('openai');
const Logger = require('../utils/enhanced-logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Vision Service for AI Assistant
 * Provides image recognition, analysis, and understanding capabilities using OpenAI Vision
 */
class VisionService {
  constructor() {
    this.logger = new Logger('VisionService');
    this.openai = null;
    this.isReady = false;
    this.supportedFormats = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
    this.maxFileSize = 20 * 1024 * 1024; // 20MB
    this.initialize();
  }

  async initialize() {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        this.logger.warn('OPENAI_API_KEY not found - Vision service will be unavailable');
        return;
      }

      this.openai = new OpenAI({
        apiKey,
        timeout: 60000,
        maxRetries: 3
      });

      this.isReady = true;
      this.logger.info('Vision service initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Vision service', { error: error.message });
      this.isReady = false;
    }
  }

  async analyzeImage(imageInput, options = {}) {
    if (!this.isReady) {
      throw new Error('Vision service is currently unavailable');
    }

    const {
      prompt = 'Analyze this image and describe what you see in detail.',
      maxTokens = 1000,
      detail = 'auto', // 'low', 'high', 'auto'
      analysisType = 'general' // 'general', 'technical', 'creative', 'accessibility'
    } = options;

    try {
      let imageData;

      // Handle different input types
      if (typeof imageInput === 'string') {
        if (imageInput.startsWith('http')) {
          // URL
          imageData = { type: 'image_url', image_url: { url: imageInput, detail } };
        } else {
          // File path
          imageData = await this.processImageFile(imageInput, detail);
        }
      } else if (Buffer.isBuffer(imageInput)) {
        // Buffer
        imageData = await this.processImageBuffer(imageInput, detail);
      } else {
        throw new Error('Invalid image input format');
      }

      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: this.buildAnalysisPrompt(prompt, analysisType) },
            imageData
          ]
        }
      ];

      this.logger.info('Starting image analysis', { analysisType, detail });

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: maxTokens,
        temperature: 0.3
      });

      const analysis = response.choices[0].message.content;

      // Enhanced analysis with structured data
      const structuredAnalysis = await this.enhanceAnalysis(analysis, analysisType);

      this.logger.info('Image analysis completed', {
        analysisLength: analysis.length,
        tokensUsed: response.usage?.total_tokens
      });

      return {
        analysis,
        structured: structuredAnalysis,
        metadata: {
          model: 'gpt-4o',
          tokensUsed: response.usage?.total_tokens,
          analysisType,
          detail,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      this.logger.error('Image analysis failed', { error: error.message });
      throw new Error('Failed to analyze image: ' + error.message);
    }
  }

  async processImageFile(filePath, detail = 'auto') {
    try {
      // Validate file
      const stats = await fs.stat(filePath);
      if (stats.size > this.maxFileSize) {
        throw new Error(`Image file too large: ${stats.size} bytes (max: ${this.maxFileSize})`);
      }

      const ext = path.extname(filePath).toLowerCase().slice(1);
      if (!this.supportedFormats.includes(ext)) {
        throw new Error(`Unsupported image format: ${ext}`);
      }

      // Read and encode image
      const imageBuffer = await fs.readFile(filePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.getMimeType(ext);

      return {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Image}`,
          detail
        }
      };

    } catch (error) {
      this.logger.error('Failed to process image file', { error: error.message, filePath });
      throw error;
    }
  }

  async processImageBuffer(buffer, detail = 'auto') {
    try {
      if (buffer.length > this.maxFileSize) {
        throw new Error(`Image buffer too large: ${buffer.length} bytes`);
      }

      // Detect image format from buffer
      const format = this.detectImageFormat(buffer);
      if (!format) {
        throw new Error('Unable to detect image format');
      }

      const base64Image = buffer.toString('base64');
      const mimeType = this.getMimeType(format);

      return {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Image}`,
          detail
        }
      };

    } catch (error) {
      this.logger.error('Failed to process image buffer', { error: error.message });
      throw error;
    }
  }

  buildAnalysisPrompt(basePrompt, analysisType) {
    const typeSpecificPrompts = {
      general: `${basePrompt} Please provide a comprehensive description including objects, people, colors, composition, and any text you can see.`,

      technical: `${basePrompt} Focus on technical aspects: image quality, composition techniques, lighting, colors, and any technical elements. If this is a screenshot or technical diagram, explain the technical content.`,

      creative: `${basePrompt} Analyze the creative and artistic elements: style, mood, artistic techniques, color harmony, composition, and emotional impact.`,

      accessibility: `${basePrompt} Provide a detailed description suitable for accessibility purposes. Describe all visual elements in a way that would help someone who cannot see the image understand its content completely.`,

      ocr: `Extract and transcribe all text visible in this image. Organize the text logically and indicate the location/context of each text element.`,

      objects: `Identify and list all objects, people, animals, and items visible in this image. Provide their approximate locations and relationships to each other.`
    };

    return typeSpecificPrompts[analysisType] || typeSpecificPrompts.general;
  }

  async enhanceAnalysis(analysis, analysisType) {
    try {
      // Extract structured information based on analysis type
      const structured = {
        summary: this.extractSummary(analysis),
        tags: this.extractTags(analysis),
        entities: this.extractEntities(analysis),
        sentiment: this.analyzeSentiment(analysis),
        confidence: this.assessConfidence(analysis)
      };

      // Add type-specific structured data
      switch (analysisType) {
        case 'technical':
          structured.technical = this.extractTechnicalInfo(analysis);
          break;
        case 'creative':
          structured.creative = this.extractCreativeElements(analysis);
          break;
        case 'ocr':
          structured.text = this.extractTextContent(analysis);
          break;
        case 'objects':
          structured.objects = this.extractObjectList(analysis);
          break;
      }

      return structured;

    } catch (error) {
      this.logger.warn('Failed to enhance analysis', { error: error.message });
      return { summary: analysis.substring(0, 200) + '...' };
    }
  }

  extractSummary(analysis) {
    // Extract first sentence or first 200 characters as summary
    const sentences = analysis.split(/[.!?]+/);
    const firstSentence = sentences[0]?.trim();

    if (firstSentence && firstSentence.length > 20) {
      return firstSentence + '.';
    }

    return analysis.substring(0, 200) + (analysis.length > 200 ? '...' : '');
  }

  extractTags(analysis) {
    const tagPatterns = [
      /\b(photo|image|picture|screenshot|diagram|chart|graph)\b/gi,
      /\b(indoor|outdoor|landscape|portrait|closeup|wide)\b/gi,
      /\b(bright|dark|colorful|monochrome|vibrant|muted)\b/gi,
      /\b(people|person|man|woman|child|group)\b/gi,
      /\b(car|building|tree|animal|food|technology)\b/gi
    ];

    const tags = new Set();

    tagPatterns.forEach(pattern => {
      const matches = analysis.match(pattern);
      if (matches) {
        matches.forEach(match => tags.add(match.toLowerCase()));
      }
    });

    return Array.from(tags).slice(0, 10);
  }

  extractEntities(analysis) {
    // Simple entity extraction - could be enhanced with NLP
    const entities = {
      people: this.extractPattern(analysis, /\b(man|woman|person|child|people|boy|girl)\b/gi),
      objects: this.extractPattern(analysis, /\b(car|building|tree|house|phone|computer|book)\b/gi),
      colors: this.extractPattern(analysis, /\b(red|blue|green|yellow|black|white|orange|purple|pink|brown)\b/gi),
      locations: this.extractPattern(analysis, /\b(room|street|park|office|home|outdoor|indoor)\b/gi)
    };

    return entities;
  }

  extractPattern(text, pattern) {
    const matches = text.match(pattern);
    return matches ? [...new Set(matches.map(m => m.toLowerCase()))] : [];
  }

  analyzeSentiment(analysis) {
    const positiveWords = ['beautiful', 'amazing', 'excellent', 'good', 'great', 'wonderful', 'pleasant'];
    const negativeWords = ['poor', 'bad', 'ugly', 'terrible', 'awful', 'horrible', 'dark'];

    const lowerAnalysis = analysis.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerAnalysis.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerAnalysis.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  assessConfidence(analysis) {
    const certaintyWords = ['clearly', 'obviously', 'definitely', 'certainly'];
    const uncertaintyWords = ['appears', 'seems', 'possibly', 'might', 'could be'];

    const lowerAnalysis = analysis.toLowerCase();
    const certaintyCount = certaintyWords.filter(word => lowerAnalysis.includes(word)).length;
    const uncertaintyCount = uncertaintyWords.filter(word => lowerAnalysis.includes(word)).length;

    const baseConfidence = 0.7;
    const adjustment = (certaintyCount - uncertaintyCount) * 0.1;

    return Math.max(0.1, Math.min(1.0, baseConfidence + adjustment));
  }

  extractTechnicalInfo(analysis) {
    return {
      quality: this.extractPattern(analysis, /\b(high|low|poor|excellent|good)\s+(quality|resolution)\b/gi),
      composition: this.extractPattern(analysis, /\b(centered|left|right|top|bottom|corner|rule of thirds)\b/gi),
      lighting: this.extractPattern(analysis, /\b(bright|dark|well-lit|shadowy|natural|artificial)\s+(lighting|light)\b/gi)
    };
  }

  extractCreativeElements(analysis) {
    return {
      style: this.extractPattern(analysis, /\b(modern|classic|vintage|contemporary|artistic|minimalist)\b/gi),
      mood: this.extractPattern(analysis, /\b(cheerful|sad|dramatic|peaceful|energetic|calm)\b/gi),
      composition: this.extractPattern(analysis, /\b(balanced|symmetrical|asymmetrical|dynamic|static)\b/gi)
    };
  }

  extractTextContent(analysis) {
    // Extract quoted text and text descriptions
    const quotedText = analysis.match(/"([^"]+)"/g) || [];
    const textMentions = analysis.match(/text[^.]*?["']([^"']+)["']/gi) || [];

    return {
      quoted: quotedText.map(q => q.slice(1, -1)),
      mentioned: textMentions,
      hasText: quotedText.length > 0 || textMentions.length > 0
    };
  }

  extractObjectList(analysis) {
    // Extract object listings
    const objects = [];
    const lines = analysis.split('\n');

    lines.forEach(line => {
      if (line.includes('-') || line.match(/^\d+\./)) {
        const cleaned = line.replace(/^[-\d\.\s]+/, '').trim();
        if (cleaned.length > 3) {
          objects.push(cleaned);
        }
      }
    });

    return objects;
  }

  getMimeType(format) {
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    return mimeTypes[format.toLowerCase()] || 'image/jpeg';
  }

  detectImageFormat(buffer) {
    // Check magic bytes for common image formats
    if (buffer.length < 4) return null;

    const magic = buffer.toString('hex', 0, 4).toUpperCase();

    if (magic.startsWith('FFD8')) return 'jpg';
    if (magic.startsWith('8950')) return 'png';
    if (magic.startsWith('4749')) return 'gif';
    if (magic.startsWith('5249')) return 'webp';

    return null;
  }

  async compareImages(image1, image2, options = {}) {
    if (!this.isReady) {
      throw new Error('Vision service is currently unavailable');
    }

    const { focus = 'general' } = options;

    try {
      const image1Data = typeof image1 === 'string' ?
        await this.processImageFile(image1) :
        await this.processImageBuffer(image1);

      const image2Data = typeof image2 === 'string' ?
        await this.processImageFile(image2) :
        await this.processImageBuffer(image2);

      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Compare these two images and describe the differences and similarities. Focus on: ${focus}`
            },
            image1Data,
            image2Data
          ]
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 1000,
        temperature: 0.3
      });

      return {
        comparison: response.choices[0].message.content,
        metadata: {
          model: 'gpt-4o',
          tokensUsed: response.usage?.total_tokens,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      this.logger.error('Image comparison failed', { error: error.message });
      throw new Error('Failed to compare images: ' + error.message);
    }
  }

  async extractText(imageInput, options = {}) {
    return await this.analyzeImage(imageInput, {
      ...options,
      analysisType: 'ocr',
      prompt: 'Extract all text visible in this image. Transcribe it exactly as it appears, maintaining formatting and organization.'
    });
  }

  async identifyObjects(imageInput, options = {}) {
    return await this.analyzeImage(imageInput, {
      ...options,
      analysisType: 'objects',
      prompt: 'Identify and list all objects, people, and items visible in this image. Provide their locations and describe their relationships.'
    });
  }

  getStatus() {
    return {
      ready: this.isReady,
      supportedFormats: this.supportedFormats,
      maxFileSize: this.maxFileSize,
      model: 'gpt-4o'
    };
  }
}

module.exports = VisionService;