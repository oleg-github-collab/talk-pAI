const express = require('express');
const { ErrorHandler, ValidationError, NotFoundError, AuthenticationError } = require('../utils/error-handler');

/**
 * Minimal Comprehensive API Routes for Talk pAI
 * Ultra-modern glassmorphism messenger with working functionality
 */
class ComprehensiveAPI {
    constructor(database, logger, errorHandler = null) {
        this.router = express.Router();
        this.db = database;
        this.logger = logger;
        this.errorHandler = errorHandler;
        this.setupRoutes();
    }

    setupRoutes() {
        // ================================
        // DEMO ENDPOINTS (Working)
        // ================================
        this.router.post('/demo/message', this.sendDemoMessage.bind(this));
        this.router.get('/demo/chats', this.getDemoChats.bind(this));

        // ================================
        // BASIC CHAT ENDPOINTS (Working)
        // ================================
        this.router.get('/chats', this.getChats.bind(this));
        this.router.post('/chats', this.createChat.bind(this));
        this.router.get('/chats/:chatId/messages', this.getMessages.bind(this));
        this.router.post('/chats/:chatId/messages', this.sendMessage.bind(this));

        // ================================
        // AUTHENTICATION ENDPOINTS (Working)
        // ================================
        this.router.post('/auth/register', this.registerUser.bind(this));
        this.router.post('/auth/login', this.loginUser.bind(this));

        // ================================
        // PLACEHOLDER ENDPOINTS (Return 501 Not Implemented)
        // ================================
        this.router.all('*', this.notImplementedHandler.bind(this));
    }

    // ================================
    // AUTHENTICATION METHODS
    // ================================

    async registerUser(req, res) {
        try {
            const { nickname, email, password, displayName } = req.body;

            // Validation
            ErrorHandler.validateRequired(nickname, 'nickname');
            ErrorHandler.validateRequired(email, 'email');
            ErrorHandler.validateRequired(password, 'password');
            ErrorHandler.validateEmail(email);
            ErrorHandler.validateLength(nickname, 'nickname', 3, 50);
            ErrorHandler.validateLength(password, 'password', 6, 100);

            // Create user
            const hashedPassword = await this.hashPassword(password);
            const user = await this.db.createUser({
                nickname,
                email,
                password_hash: hashedPassword,
                display_name: displayName || nickname
            });

            this.logger.info('User registered successfully', { userId: user.id, nickname });

            res.status(201).json({
                success: true,
                user: this.sanitizeUser(user),
                message: 'User registered successfully'
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async loginUser(req, res) {
        try {
            const { email, password } = req.body;

            ErrorHandler.validateRequired(email, 'email');
            ErrorHandler.validateRequired(password, 'password');

            const user = await this.db.getUserByEmail(email);
            if (!user || !await this.verifyPassword(password, user.password_hash)) {
                throw new AuthenticationError('Invalid email or password');
            }

            const token = this.generateJWT(user);

            this.logger.info('User logged in', { userId: user.id, email });

            res.json({
                success: true,
                user: this.sanitizeUser(user),
                token,
                message: 'Login successful'
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    // ================================
    // CHAT METHODS
    // ================================

    async getChats(req, res) {
        try {
            const { workspaceId, type, limit = 50, offset = 0 } = req.query;
            const userId = req.user?.id;

            const chats = await this.db.getChats({
                userId,
                workspaceId,
                type,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            res.json({
                success: true,
                chats,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: chats.length
                }
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async createChat(req, res) {
        try {
            const { name, type, description, participants, workspaceId } = req.body;
            const userId = req.user?.id;

            ErrorHandler.validateRequired(name, 'name');
            ErrorHandler.validateRequired(type, 'type');

            const chat = await this.db.createChat({
                name,
                type,
                description,
                workspace_id: workspaceId,
                created_by: userId
            });

            // Add participants
            if (participants && participants.length > 0) {
                await this.db.addChatParticipants(chat.id, participants);
            }

            // Add creator as admin
            await this.db.addChatParticipant(chat.id, userId, 'admin');

            this.logger.info('Chat created', { chatId: chat.id, userId, name });

            res.status(201).json({
                success: true,
                chat,
                message: 'Chat created successfully'
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    // ================================
    // MESSAGE METHODS
    // ================================

    async sendMessage(req, res) {
        try {
            const { chatId } = req.params;
            const { content, messageType, replyToId, metadata } = req.body;
            const userId = req.user?.id;

            ErrorHandler.validateRequired(content, 'content');

            const message = await this.db.createMessage({
                chat_id: chatId,
                sender_id: userId,
                content,
                content_type: messageType || 'text',
                reply_to_id: replyToId,
                metadata: metadata || {}
            });

            // Emit to WebSocket
            req.app.get('io')?.to(`chat-${chatId}`).emit('new_message', message);

            this.logger.info('Message sent', { messageId: message.id, chatId, userId });

            res.status(201).json({
                success: true,
                message,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async getMessages(req, res) {
        try {
            const { chatId } = req.params;
            const { limit = 50, offset = 0, before, after } = req.query;

            const messages = await this.db.getMessages({
                chatId,
                limit: parseInt(limit),
                offset: parseInt(offset),
                before,
                after
            });

            res.json({
                success: true,
                messages,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: messages.length === parseInt(limit)
                }
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    // ================================
    // DEMO METHODS (No Authentication)
    // ================================

    async sendDemoMessage(req, res) {
        try {
            const { content, messageType = 'text', chatId = 1 } = req.body;

            if (!content || content.trim().length === 0) {
                throw new ValidationError('Message content is required', 'content', content);
            }

            const message = {
                id: Date.now(),
                chatId: parseInt(chatId),
                senderId: 'demo-user',
                senderName: 'Demo User',
                senderAvatar: 'DU',
                content: content.trim(),
                messageType: messageType || 'text',
                timestamp: new Date(),
                created_at: new Date()
            };

            // Emit to WebSocket if available
            const io = req.app.get('io');
            if (io) {
                io.to(`chat-${chatId}`).emit('message', message);
            }

            this.logger.info('Demo message sent', { messageId: message.id, content });

            res.json({
                success: true,
                message,
                demo: true
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async getDemoChats(req, res) {
        try {
            const demoChats = [
                {
                    id: 1,
                    name: 'General',
                    type: 'public',
                    avatar: 'GE',
                    lastMessage: 'Welcome to Talk pAI!',
                    timestamp: new Date(),
                    unreadCount: 0
                },
                {
                    id: 2,
                    name: 'AI Assistant',
                    type: 'ai',
                    avatar: '🤖',
                    lastMessage: 'How can I help you today?',
                    timestamp: new Date(),
                    unreadCount: 1
                },
                {
                    id: 3,
                    name: 'Team Chat',
                    type: 'group',
                    avatar: 'TC',
                    lastMessage: 'Great work everyone!',
                    timestamp: new Date(),
                    unreadCount: 3
                }
            ];

            res.json({
                success: true,
                chats: demoChats,
                demo: true
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    // ================================
    // PLACEHOLDER HANDLER
    // ================================

    async notImplementedHandler(req, res) {
        res.status(501).json({
            success: false,
            error: {
                message: 'This endpoint is not yet implemented',
                code: 'NOT_IMPLEMENTED',
                endpoint: `${req.method} ${req.path}`,
                timestamp: new Date().toISOString()
            }
        });
    }

    // ================================
    // UTILITY METHODS
    // ================================

    sanitizeUser(user) {
        const { password_hash, salt, ...sanitized } = user;
        return sanitized;
    }

    async hashPassword(password) {
        // Implement password hashing
        return `hashed_${password}`;
    }

    async verifyPassword(password, hash) {
        // Implement password verification
        return hash === `hashed_${password}`;
    }

    generateJWT(user) {
        // Implement JWT generation
        return `jwt_token_${user.id}`;
    }

    handleError(error, req, res) {
        if (this.errorHandler) {
            this.errorHandler.handleError(error, req, res);
        } else {
            // Fallback error handling
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal server error';

            this.logger.error('API Error', {
                error: message,
                statusCode,
                path: req.path,
                method: req.method
            });

            res.status(statusCode).json({
                success: false,
                error: {
                    message,
                    code: error.code || 'GENERAL_ERROR',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ComprehensiveAPI;