const OpenAI = require('openai');
const Logger = require('../utils/enhanced-logger');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

/**
 * Image Generation Service for AI Assistant
 * Provides image generation capabilities using OpenAI DALL-E
 */
class ImageGenerationService {
  constructor() {
    this.logger = new Logger('ImageGenerationService');
    this.openai = null;
    this.isReady = false;
    this.generationHistory = new Map();
    this.uploadDir = 'uploads/generated-images';
    this.initialize();
  }

  async initialize() {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        this.logger.warn('OPENAI_API_KEY not found - Image generation service will be unavailable');
        return;
      }

      this.openai = new OpenAI({
        apiKey,
        timeout: 120000, // 2 minutes for image generation
        maxRetries: 3
      });

      // Ensure upload directory exists
      await this.ensureUploadDirectory();

      this.isReady = true;
      this.logger.info('Image generation service initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Image generation service', { error: error.message });
      this.isReady = false;
    }
  }

  async ensureUploadDirectory() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      this.logger.warn('Failed to create upload directory', { error: error.message });
    }
  }

  async generateImage(prompt, options = {}) {
    if (!this.isReady) {
      throw new Error('Image generation service is currently unavailable');
    }

    const {
      model = 'dall-e-3',
      size = '1024x1024',
      quality = 'standard',
      style = 'vivid',
      n = 1,
      saveLocally = true,
      enhancePrompt = true
    } = options;

    try {
      // Enhance prompt for better results
      const enhancedPrompt = enhancePrompt ? await this.enhancePrompt(prompt) : prompt;

      this.logger.info('Starting image generation', {
        model,
        size,
        quality,
        promptLength: enhancedPrompt.length
      });

      const requestOptions = {
        model,
        prompt: enhancedPrompt,
        size,
        quality,
        n: Math.min(n, model === 'dall-e-3' ? 1 : 10), // DALL-E 3 only supports n=1
        response_format: 'url'
      };

      // Add style for DALL-E 3
      if (model === 'dall-e-3') {
        requestOptions.style = style;
      }

      const response = await this.openai.images.generate(requestOptions);

      const results = [];

      for (const image of response.data) {
        let localPath = null;

        if (saveLocally) {
          localPath = await this.downloadAndSaveImage(image.url, prompt);
        }

        const result = {
          url: image.url,
          localPath,
          prompt: enhancedPrompt,
          revisedPrompt: image.revised_prompt || enhancedPrompt,
          metadata: {
            model,
            size,
            quality,
            style: model === 'dall-e-3' ? style : undefined,
            timestamp: new Date().toISOString(),
            generationId: this.generateId()
          }
        };

        results.push(result);

        // Store in history
        this.generationHistory.set(result.metadata.generationId, result);
      }

      this.logger.info('Image generation completed', {
        model,
        imagesGenerated: results.length,
        savedLocally: saveLocally
      });

      return results.length === 1 ? results[0] : results;

    } catch (error) {
      this.logger.error('Image generation failed', {
        error: error.message,
        prompt: prompt.substring(0, 100)
      });

      if (error.message.includes('content_policy_violation')) {
        throw new Error('Image prompt violates content policy. Please try a different description.');
      } else if (error.message.includes('rate_limit_exceeded')) {
        throw new Error('Image generation rate limit exceeded. Please try again later.');
      } else {
        throw new Error('Failed to generate image: ' + error.message);
      }
    }
  }

  async enhancePrompt(originalPrompt) {
    try {
      // Use GPT to enhance the prompt for better image generation
      const enhancementResponse = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert at writing prompts for DALL-E image generation. Your task is to enhance user prompts to be more detailed, specific, and likely to produce high-quality images.

Guidelines:
1. Add specific details about style, lighting, composition, and artistic technique
2. Include color information and mood descriptors
3. Specify camera angles, perspectives, or viewpoints when relevant
4. Add quality enhancers like "highly detailed", "professional", "award-winning"
5. Keep the enhanced prompt under 400 characters
6. Maintain the original intent while making it more descriptive

Transform the user's prompt into a detailed, artistic description that will produce an amazing image.`
          },
          {
            role: 'user',
            content: `Original prompt: "${originalPrompt}"\n\nEnhance this prompt for DALL-E image generation:`
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      const enhancedPrompt = enhancementResponse.choices[0].message.content.trim();

      this.logger.debug('Prompt enhanced', {
        original: originalPrompt,
        enhanced: enhancedPrompt
      });

      return enhancedPrompt;

    } catch (error) {
      this.logger.warn('Failed to enhance prompt, using original', { error: error.message });
      return originalPrompt;
    }
  }

  async downloadAndSaveImage(imageUrl, prompt) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      const imageBuffer = Buffer.from(response.data);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safePrompt = prompt.substring(0, 50).replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const filename = `${timestamp}_${safePrompt}.png`;
      const filepath = path.join(this.uploadDir, filename);

      await fs.writeFile(filepath, imageBuffer);

      this.logger.debug('Image saved locally', { filepath, size: imageBuffer.length });

      return filepath;

    } catch (error) {
      this.logger.warn('Failed to save image locally', { error: error.message });
      return null;
    }
  }

  async editImage(originalImagePath, prompt, options = {}) {
    if (!this.isReady) {
      throw new Error('Image generation service is currently unavailable');
    }

    const {
      maskPath = null,
      size = '1024x1024',
      n = 1,
      saveLocally = true
    } = options;

    try {
      // Read the original image
      const imageBuffer = await fs.readFile(originalImagePath);

      let maskBuffer = null;
      if (maskPath) {
        maskBuffer = await fs.readFile(maskPath);
      }

      this.logger.info('Starting image editing', {
        originalImage: originalImagePath,
        hasMask: !!maskPath,
        promptLength: prompt.length
      });

      const requestOptions = {
        image: imageBuffer,
        prompt,
        size,
        n,
        response_format: 'url'
      };

      if (maskBuffer) {
        requestOptions.mask = maskBuffer;
      }

      const response = await this.openai.images.edit(requestOptions);

      const results = [];

      for (const image of response.data) {
        let localPath = null;

        if (saveLocally) {
          localPath = await this.downloadAndSaveImage(image.url, `edited_${prompt}`);
        }

        const result = {
          url: image.url,
          localPath,
          prompt,
          originalImage: originalImagePath,
          maskImage: maskPath,
          metadata: {
            operation: 'edit',
            size,
            timestamp: new Date().toISOString(),
            generationId: this.generateId()
          }
        };

        results.push(result);
        this.generationHistory.set(result.metadata.generationId, result);
      }

      this.logger.info('Image editing completed', {
        imagesGenerated: results.length,
        savedLocally: saveLocally
      });

      return results.length === 1 ? results[0] : results;

    } catch (error) {
      this.logger.error('Image editing failed', {
        error: error.message,
        originalImage: originalImagePath
      });
      throw new Error('Failed to edit image: ' + error.message);
    }
  }

  async createVariations(originalImagePath, options = {}) {
    if (!this.isReady) {
      throw new Error('Image generation service is currently unavailable');
    }

    const {
      size = '1024x1024',
      n = 1,
      saveLocally = true
    } = options;

    try {
      const imageBuffer = await fs.readFile(originalImagePath);

      this.logger.info('Creating image variations', {
        originalImage: originalImagePath,
        variations: n
      });

      const response = await this.openai.images.createVariation({
        image: imageBuffer,
        size,
        n,
        response_format: 'url'
      });

      const results = [];

      for (let i = 0; i < response.data.length; i++) {
        const image = response.data[i];
        let localPath = null;

        if (saveLocally) {
          localPath = await this.downloadAndSaveImage(image.url, `variation_${i + 1}`);
        }

        const result = {
          url: image.url,
          localPath,
          originalImage: originalImagePath,
          variationNumber: i + 1,
          metadata: {
            operation: 'variation',
            size,
            timestamp: new Date().toISOString(),
            generationId: this.generateId()
          }
        };

        results.push(result);
        this.generationHistory.set(result.metadata.generationId, result);
      }

      this.logger.info('Image variations created', {
        variationsGenerated: results.length,
        savedLocally: saveLocally
      });

      return results.length === 1 ? results[0] : results;

    } catch (error) {
      this.logger.error('Image variation creation failed', {
        error: error.message,
        originalImage: originalImagePath
      });
      throw new Error('Failed to create image variations: ' + error.message);
    }
  }

  async generateImageSeries(basePrompt, variations, options = {}) {
    const {
      model = 'dall-e-3',
      size = '1024x1024',
      saveLocally = true
    } = options;

    const results = [];
    const variationPrompts = this.createVariationPrompts(basePrompt, variations);

    this.logger.info('Starting image series generation', {
      basePrompt,
      variationsCount: variationPrompts.length
    });

    for (let i = 0; i < variationPrompts.length; i++) {
      try {
        const result = await this.generateImage(variationPrompts[i], {
          model,
          size,
          saveLocally,
          enhancePrompt: true
        });

        results.push({
          ...result,
          seriesIndex: i,
          variationPrompt: variationPrompts[i]
        });

        // Add delay between requests to avoid rate limiting
        if (i < variationPrompts.length - 1) {
          await this.delay(2000);
        }

      } catch (error) {
        this.logger.warn(`Failed to generate image ${i + 1} in series`, {
          error: error.message,
          prompt: variationPrompts[i]
        });
      }
    }

    this.logger.info('Image series generation completed', {
      totalRequested: variationPrompts.length,
      successful: results.length
    });

    return results;
  }

  createVariationPrompts(basePrompt, variations) {
    const variationTypes = [
      'in photorealistic style',
      'in artistic oil painting style',
      'in watercolor painting style',
      'in digital art style',
      'in cartoon/anime style',
      'in vintage photography style',
      'in minimalist style',
      'in cyberpunk style',
      'in fantasy art style',
      'in abstract art style'
    ];

    const styleVariations = variationTypes.slice(0, variations).map(style =>
      `${basePrompt}, ${style}`
    );

    return styleVariations;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getGenerationHistory(limit = 10) {
    const entries = Array.from(this.generationHistory.entries())
      .sort((a, b) => new Date(b[1].metadata.timestamp) - new Date(a[1].metadata.timestamp))
      .slice(0, limit);

    return entries.map(([id, data]) => ({ id, ...data }));
  }

  getGenerationById(id) {
    return this.generationHistory.get(id);
  }

  clearHistory() {
    this.generationHistory.clear();
    this.logger.info('Generation history cleared');
  }

  async getImageSuggestions(description) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert creative director. Given a basic description, suggest 5 different creative interpretations for image generation. Each suggestion should be detailed and inspiring.'
          },
          {
            role: 'user',
            content: `Create 5 creative image generation suggestions based on: "${description}"`
          }
        ],
        max_tokens: 500,
        temperature: 0.8
      });

      const suggestions = response.choices[0].message.content
        .split('\n')
        .filter(line => line.trim().length > 10)
        .slice(0, 5);

      return suggestions;

    } catch (error) {
      this.logger.warn('Failed to generate suggestions', { error: error.message });
      return [`Create a detailed image of: ${description}`];
    }
  }

  getStatus() {
    return {
      ready: this.isReady,
      modelsAvailable: ['dall-e-2', 'dall-e-3'],
      supportedSizes: {
        'dall-e-2': ['256x256', '512x512', '1024x1024'],
        'dall-e-3': ['1024x1024', '1024x1792', '1792x1024']
      },
      operationsSupported: ['generate', 'edit', 'variations'],
      historyCount: this.generationHistory.size,
      uploadDirectory: this.uploadDir
    };
  }
}

module.exports = ImageGenerationService;