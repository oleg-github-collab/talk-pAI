const OpenAI = require('openai');
const { Pool } = require('pg');
const crypto = require('crypto');
const axios = require('axios');

class EnhancedAIService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });

        // AI personality and context
        this.aiPersonality = {
            name: 'AIDEN',
            role: 'Advanced AI Assistant',
            personality: 'helpful, intelligent, friendly, and professional',
            capabilities: [
                'text generation and analysis',
                'image generation with DALL-E',
                'code assistance and debugging',
                'language translation',
                'summarization',
                'creative writing',
                'data analysis',
                'web search and research',
                'task planning and organization'
            ]
        };

        // Conversation memory
        this.conversationMemory = new Map(); // userId -> conversation history
        this.userPreferences = new Map(); // userId -> preferences
    }

    // Enhanced chat completion with context awareness
    async generateResponse({ userId, message, chatId, context = {} }) {
        try {
            // Get user conversation history
            const conversationHistory = await this.getConversationHistory(userId, chatId);

            // Get user preferences
            const userPrefs = await this.getUserPreferences(userId);

            // Build system prompt with context
            const systemPrompt = this.buildSystemPrompt(userPrefs, context);

            // Prepare messages array
            const messages = [
                { role: 'system', content: systemPrompt },
                ...conversationHistory,
                { role: 'user', content: message }
            ];

            // Generate response
            const completion = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
                messages: messages,
                max_tokens: 2000,
                temperature: 0.7,
                presence_penalty: 0.1,
                frequency_penalty: 0.1
            });

            const response = completion.choices[0].message.content;

            // Store conversation in memory and database
            await this.storeConversation(userId, chatId, message, response);

            // Analyze sentiment and intent
            const analysis = await this.analyzeMessage(message);

            return {
                response,
                analysis,
                tokensUsed: completion.usage.total_tokens,
                model: completion.model
            };

        } catch (error) {
            throw new Error(`AI response generation failed: ${error.message}`);
        }
    }

    // Image generation with DALL-E
    async generateImage({ prompt, userId, size = '1024x1024', quality = 'standard', style = 'vivid' }) {
        try {
            const response = await this.openai.images.generate({
                model: 'dall-e-3',
                prompt: prompt,
                n: 1,
                size: size,
                quality: quality,
                style: style
            });

            const imageUrl = response.data[0].url;
            const revisedPrompt = response.data[0].revised_prompt;

            // Store image generation request
            await this.storeImageGeneration(userId, prompt, revisedPrompt, imageUrl);

            return {
                imageUrl,
                revisedPrompt,
                originalPrompt: prompt
            };

        } catch (error) {
            throw new Error(`Image generation failed: ${error.message}`);
        }
    }

    // Text-to-speech using OpenAI's TTS
    async generateSpeech({ text, userId, voice = 'alloy', format = 'mp3' }) {
        try {
            const response = await this.openai.audio.speech.create({
                model: 'tts-1',
                voice: voice,
                input: text,
                response_format: format
            });

            // Save audio file
            const filename = `speech-${crypto.randomUUID()}.${format}`;
            const filepath = `uploads/speech/${filename}`;

            const buffer = Buffer.from(await response.arrayBuffer());
            await require('fs').promises.writeFile(filepath, buffer);

            // Store in database
            await this.pool.query(`
                INSERT INTO files (
                    original_name, file_name, file_path, file_size,
                    mime_type, uploaded_by, storage_provider
                ) VALUES ($1, $2, $3, $4, $5, $6, 'local')
            `, [
                `speech-${Date.now()}.${format}`,
                filename,
                filepath,
                buffer.length,
                `audio/${format}`,
                userId
            ]);

            return {
                audioUrl: `/uploads/speech/${filename}`,
                filename,
                duration: Math.ceil(text.length / 150) // Approximate duration
            };

        } catch (error) {
            throw new Error(`Speech generation failed: ${error.message}`);
        }
    }

    // Speech-to-text transcription
    async transcribeAudio({ audioFile, userId, language = 'en' }) {
        try {
            const transcription = await this.openai.audio.transcriptions.create({
                file: audioFile,
                model: 'whisper-1',
                language: language,
                response_format: 'verbose_json'
            });

            // Store transcription
            await this.storeTranscription(userId, transcription);

            return {
                text: transcription.text,
                language: transcription.language,
                duration: transcription.duration,
                segments: transcription.segments
            };

        } catch (error) {
            throw new Error(`Audio transcription failed: ${error.message}`);
        }
    }

    // Language translation
    async translateText({ text, targetLanguage, sourceLanguage = 'auto', userId }) {
        try {
            const prompt = `Translate the following text ${sourceLanguage !== 'auto' ? `from ${sourceLanguage}` : ''} to ${targetLanguage}. Only return the translation, no explanations:\n\n${text}`;

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are a professional translator. Provide accurate translations maintaining the original tone and context.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 1000,
                temperature: 0.1
            });

            const translation = completion.choices[0].message.content;

            // Store translation
            await this.storeTranslation(userId, text, translation, sourceLanguage, targetLanguage);

            return {
                originalText: text,
                translatedText: translation,
                sourceLanguage,
                targetLanguage
            };

        } catch (error) {
            throw new Error(`Translation failed: ${error.message}`);
        }
    }

    // Text summarization
    async summarizeText({ text, userId, length = 'medium', style = 'informative' }) {
        try {
            const lengthMap = {
                short: 'in 1-2 sentences',
                medium: 'in 3-5 sentences',
                long: 'in a detailed paragraph'
            };

            const prompt = `Summarize the following text ${lengthMap[length]} in a ${style} style:\n\n${text}`;

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are an expert at summarizing content while preserving key information and context.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 500,
                temperature: 0.3
            });

            const summary = completion.choices[0].message.content;

            return {
                originalText: text,
                summary,
                length,
                style
            };

        } catch (error) {
            throw new Error(`Summarization failed: ${error.message}`);
        }
    }

    // Sentiment analysis
    async analyzeMessage(message) {
        try {
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'Analyze the sentiment, intent, and key topics of the given message. Return a JSON object with: sentiment (positive/negative/neutral), confidence (0-1), intent (question/request/statement/complaint/compliment), topics (array of key topics), urgency (low/medium/high).'
                    },
                    { role: 'user', content: message }
                ],
                max_tokens: 200,
                temperature: 0.1
            });

            try {
                return JSON.parse(completion.choices[0].message.content);
            } catch {
                // Fallback simple analysis
                return {
                    sentiment: this.simpleAnalyzeSentiment(message),
                    confidence: 0.5,
                    intent: 'statement',
                    topics: [],
                    urgency: 'low'
                };
            }

        } catch (error) {
            console.error('Sentiment analysis failed:', error);
            return {
                sentiment: 'neutral',
                confidence: 0,
                intent: 'statement',
                topics: [],
                urgency: 'low'
            };
        }
    }

    // Code assistance and debugging
    async analyzeCode({ code, language, userId, task = 'analyze' }) {
        try {
            let prompt;

            switch (task) {
                case 'analyze':
                    prompt = `Analyze this ${language} code and provide insights about its functionality, potential improvements, and any issues:\n\n${code}`;
                    break;
                case 'debug':
                    prompt = `Debug this ${language} code and identify potential bugs or errors:\n\n${code}`;
                    break;
                case 'optimize':
                    prompt = `Optimize this ${language} code for better performance and readability:\n\n${code}`;
                    break;
                case 'explain':
                    prompt = `Explain what this ${language} code does in simple terms:\n\n${code}`;
                    break;
                default:
                    prompt = `Help with this ${language} code:\n\n${code}`;
            }

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert programmer with deep knowledge of ${language}. Provide detailed, accurate, and helpful code analysis.`
                    },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 1500,
                temperature: 0.2
            });

            return {
                analysis: completion.choices[0].message.content,
                language,
                task
            };

        } catch (error) {
            throw new Error(`Code analysis failed: ${error.message}`);
        }
    }

    // Web search and research
    async webSearch({ query, userId, maxResults = 5 }) {
        try {
            // Use a web search API (you'd need to implement this with your preferred provider)
            // For now, we'll simulate with AI-powered research

            const prompt = `Research and provide information about: ${query}. Include key facts, recent developments, and reliable sources.`;

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a research assistant. Provide comprehensive, accurate information with source attribution when possible.'
                    },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 1000,
                temperature: 0.3
            });

            return {
                query,
                results: completion.choices[0].message.content,
                timestamp: new Date()
            };

        } catch (error) {
            throw new Error(`Web search failed: ${error.message}`);
        }
    }

    // Creative writing assistance
    async generateCreativeContent({ prompt, type, userId, style = 'creative', length = 'medium' }) {
        try {
            const lengthMap = {
                short: 'brief',
                medium: 'moderate length',
                long: 'detailed and extensive'
            };

            const typePrompts = {
                story: `Write a ${lengthMap[length]} ${style} story based on: ${prompt}`,
                poem: `Write a ${style} poem about: ${prompt}`,
                essay: `Write a ${lengthMap[length]} ${style} essay on: ${prompt}`,
                letter: `Write a ${style} letter about: ${prompt}`,
                script: `Write a ${lengthMap[length]} ${style} script based on: ${prompt}`
            };

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: `You are a talented creative writer specializing in ${type}s. Create engaging, original content that captures the reader's attention.`
                    },
                    { role: 'user', content: typePrompts[type] || prompt }
                ],
                max_tokens: 2000,
                temperature: 0.8
            });

            return {
                content: completion.choices[0].message.content,
                type,
                style,
                length,
                prompt
            };

        } catch (error) {
            throw new Error(`Creative content generation failed: ${error.message}`);
        }
    }

    // Helper methods
    buildSystemPrompt(userPreferences, context) {
        let prompt = `You are ${this.aiPersonality.name}, an ${this.aiPersonality.role}. You are ${this.aiPersonality.personality}.

Your capabilities include:
${this.aiPersonality.capabilities.map(cap => `- ${cap}`).join('\n')}

Current context:
- User timezone: ${context.timezone || 'UTC'}
- Current time: ${new Date().toISOString()}
- Chat type: ${context.chatType || 'private'}
- Language preference: ${userPreferences?.language || 'en'}

Guidelines:
- Be helpful, accurate, and engaging
- Provide detailed explanations when needed
- Ask clarifying questions if the request is unclear
- Respect user privacy and confidentiality
- If you cannot help with something, explain why and suggest alternatives`;

        if (userPreferences?.customInstructions) {
            prompt += `\n\nUser's custom instructions: ${userPreferences.customInstructions}`;
        }

        return prompt;
    }

    async getConversationHistory(userId, chatId, limit = 10) {
        try {
            const result = await this.pool.query(`
                SELECT sender_id, content, message_type, created_at
                FROM messages
                WHERE chat_id = $1 AND is_deleted = false
                ORDER BY created_at DESC
                LIMIT $2
            `, [chatId, limit]);

            return result.rows.reverse().map(msg => ({
                role: msg.sender_id === 'ai_assistant' ? 'assistant' : 'user',
                content: msg.content
            }));

        } catch (error) {
            console.error('Failed to get conversation history:', error);
            return [];
        }
    }

    async getUserPreferences(userId) {
        try {
            const result = await this.pool.query(`
                SELECT language, custom_settings
                FROM user_settings
                WHERE user_id = $1
            `, [userId]);

            if (result.rows.length > 0) {
                return {
                    language: result.rows[0].language,
                    ...result.rows[0].custom_settings
                };
            }

            return {};

        } catch (error) {
            console.error('Failed to get user preferences:', error);
            return {};
        }
    }

    async storeConversation(userId, chatId, userMessage, aiResponse) {
        try {
            // Store in conversation memory
            const conversationKey = `${userId}-${chatId}`;
            if (!this.conversationMemory.has(conversationKey)) {
                this.conversationMemory.set(conversationKey, []);
            }

            const conversation = this.conversationMemory.get(conversationKey);
            conversation.push(
                { role: 'user', content: userMessage, timestamp: new Date() },
                { role: 'assistant', content: aiResponse, timestamp: new Date() }
            );

            // Keep only last 20 messages
            if (conversation.length > 20) {
                conversation.splice(0, conversation.length - 20);
            }

            // Store AI response in database (user message already stored by chat service)
            await this.pool.query(`
                INSERT INTO messages (chat_id, sender_id, content, message_type, metadata)
                VALUES ($1, $2, $3, 'text', $4)
            `, [
                chatId,
                'ai_assistant', // AI user ID
                aiResponse,
                JSON.stringify({
                    ai_generated: true,
                    model: 'gpt-4',
                    timestamp: new Date()
                })
            ]);

        } catch (error) {
            console.error('Failed to store conversation:', error);
        }
    }

    async storeImageGeneration(userId, prompt, revisedPrompt, imageUrl) {
        try {
            await this.pool.query(`
                INSERT INTO ai_generations (
                    user_id, type, prompt, revised_prompt, result_url, metadata
                ) VALUES ($1, 'image', $2, $3, $4, $5)
            `, [
                userId,
                prompt,
                revisedPrompt,
                imageUrl,
                JSON.stringify({ model: 'dall-e-3', timestamp: new Date() })
            ]);

        } catch (error) {
            console.error('Failed to store image generation:', error);
        }
    }

    async storeTranscription(userId, transcription) {
        try {
            await this.pool.query(`
                INSERT INTO ai_transcriptions (
                    user_id, text, language, duration, metadata
                ) VALUES ($1, $2, $3, $4, $5)
            `, [
                userId,
                transcription.text,
                transcription.language,
                transcription.duration,
                JSON.stringify({
                    segments: transcription.segments,
                    model: 'whisper-1',
                    timestamp: new Date()
                })
            ]);

        } catch (error) {
            console.error('Failed to store transcription:', error);
        }
    }

    async storeTranslation(userId, originalText, translatedText, sourceLanguage, targetLanguage) {
        try {
            await this.pool.query(`
                INSERT INTO ai_translations (
                    user_id, original_text, translated_text, source_language, target_language
                ) VALUES ($1, $2, $3, $4, $5)
            `, [userId, originalText, translatedText, sourceLanguage, targetLanguage]);

        } catch (error) {
            console.error('Failed to store translation:', error);
        }
    }

    simpleAnalyzeSentiment(text) {
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'happy', 'pleased'];
        const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'sad', 'angry', 'frustrated', 'disappointed'];

        const words = text.toLowerCase().split(/\s+/);
        let positiveCount = 0;
        let negativeCount = 0;

        words.forEach(word => {
            if (positiveWords.includes(word)) positiveCount++;
            if (negativeWords.includes(word)) negativeCount++;
        });

        if (positiveCount > negativeCount) return 'positive';
        if (negativeCount > positiveCount) return 'negative';
        return 'neutral';
    }

    // Advanced features
    async getAIStatistics(userId) {
        try {
            const result = await this.pool.query(`
                SELECT
                    COUNT(*) as total_interactions,
                    COUNT(DISTINCT DATE(created_at)) as active_days,
                    AVG(CASE WHEN metadata->>'tokens_used' IS NOT NULL THEN (metadata->>'tokens_used')::int ELSE 0 END) as avg_tokens_per_message
                FROM messages
                WHERE sender_id = 'ai_assistant'
                AND chat_id IN (
                    SELECT chat_id FROM chat_participants WHERE user_id = $1
                )
            `, [userId]);

            return result.rows[0];

        } catch (error) {
            console.error('Failed to get AI statistics:', error);
            return {};
        }
    }

    async moderateContent(content) {
        try {
            const moderation = await this.openai.moderations.create({
                input: content
            });

            return {
                flagged: moderation.results[0].flagged,
                categories: moderation.results[0].categories,
                categoryScores: moderation.results[0].category_scores
            };

        } catch (error) {
            console.error('Content moderation failed:', error);
            return { flagged: false, categories: {}, categoryScores: {} };
        }
    }
}

module.exports = EnhancedAIService;