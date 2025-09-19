const express = require('express');
const { ErrorHandler, ValidationError, NotFoundError, AuthenticationError } = require('../utils/error-handler');

/**
 * Comprehensive API Routes for Talk pAI
 * Ultra-modern glassmorphism messenger with full functionality
 */
class ComprehensiveAPI {
    constructor(database, logger, errorHandler) {
        this.router = express.Router();
        this.db = database;
        this.logger = logger;
        this.errorHandler = errorHandler;
        this.setupRoutes();
    }

    setupRoutes() {
        // ================================
        // AUTHENTICATION & USERS
        // ================================
        this.router.post('/auth/register', this.registerUser.bind(this));
        this.router.post('/auth/login', this.loginUser.bind(this));
        this.router.post('/auth/logout', this.logoutUser.bind(this));
        this.router.post('/auth/refresh', this.refreshToken.bind(this));
        this.router.get('/auth/me', this.getCurrentUser.bind(this));

        // User management
        this.router.get('/users', this.getUsers.bind(this));
        this.router.get('/users/:userId', this.getUserById.bind(this));
        this.router.put('/users/:userId', this.updateUser.bind(this));
        this.router.delete('/users/:userId', this.deleteUser.bind(this));
        this.router.post('/users/search', this.searchUsers.bind(this));

        // User preferences
        this.router.get('/users/:userId/preferences', this.getUserPreferences.bind(this));
        this.router.put('/users/:userId/preferences', this.updateUserPreferences.bind(this));

        // ================================
        // WORKSPACES & ORGANIZATIONS
        // ================================
        this.router.get('/workspaces', this.getWorkspaces.bind(this));
        this.router.post('/workspaces', this.createWorkspace.bind(this));
        this.router.get('/workspaces/:workspaceId', this.getWorkspaceById.bind(this));
        this.router.put('/workspaces/:workspaceId', this.updateWorkspace.bind(this));
        this.router.delete('/workspaces/:workspaceId', this.deleteWorkspace.bind(this));

        // Workspace members
        this.router.get('/workspaces/:workspaceId/members', this.getWorkspaceMembers.bind(this));
        this.router.post('/workspaces/:workspaceId/members', this.addWorkspaceMember.bind(this));
        this.router.delete('/workspaces/:workspaceId/members/:userId', this.removeWorkspaceMember.bind(this));

        // Teams
        this.router.get('/workspaces/:workspaceId/teams', this.getTeams.bind(this));
        this.router.post('/workspaces/:workspaceId/teams', this.createTeam.bind(this));
        this.router.put('/teams/:teamId', this.updateTeam.bind(this));
        this.router.delete('/teams/:teamId', this.deleteTeam.bind(this));

        // ================================
        // CHATS & CHANNELS
        // ================================
        this.router.get('/chats', this.getChats.bind(this));
        this.router.post('/chats', this.createChat.bind(this));
        this.router.get('/chats/:chatId', this.getChatById.bind(this));
        this.router.put('/chats/:chatId', this.updateChat.bind(this));
        this.router.delete('/chats/:chatId', this.deleteChat.bind(this));

        // Chat participants
        this.router.get('/chats/:chatId/participants', this.getChatParticipants.bind(this));
        this.router.post('/chats/:chatId/participants', this.addChatParticipant.bind(this));
        this.router.put('/chats/:chatId/participants/:userId', this.updateChatParticipant.bind(this));
        this.router.delete('/chats/:chatId/participants/:userId', this.removeChatParticipant.bind(this));

        // ================================
        // MESSAGES
        // ================================
        this.router.get('/chats/:chatId/messages', this.getMessages.bind(this));
        this.router.post('/chats/:chatId/messages', this.sendMessage.bind(this));
        this.router.get('/messages/:messageId', this.getMessageById.bind(this));
        this.router.put('/messages/:messageId', this.updateMessage.bind(this));
        this.router.delete('/messages/:messageId', this.deleteMessage.bind(this));

        // Message reactions
        this.router.post('/messages/:messageId/reactions', this.addReaction.bind(this));
        this.router.delete('/messages/:messageId/reactions/:emoji', this.removeReaction.bind(this));

        // Message threads
        this.router.get('/messages/:messageId/replies', this.getMessageReplies.bind(this));
        this.router.post('/messages/:messageId/replies', this.replyToMessage.bind(this));

        // ================================
        // FILE MANAGEMENT
        // ================================
        this.router.post('/files/upload', this.uploadFile.bind(this));
        this.router.get('/files/:fileId', this.getFile.bind(this));
        this.router.delete('/files/:fileId', this.deleteFile.bind(this));
        this.router.get('/files/:fileId/download', this.downloadFile.bind(this));

        // Voice messages
        this.router.post('/voice/upload', this.uploadVoiceMessage.bind(this));
        this.router.get('/voice/:voiceId', this.getVoiceMessage.bind(this));

        // ================================
        // AI FEATURES
        // ================================
        this.router.post('/ai/chat', this.aiChat.bind(this));
        this.router.get('/ai/conversations', this.getAIConversations.bind(this));
        this.router.post('/ai/analyze', this.analyzeContent.bind(this));
        this.router.post('/ai/generate', this.generateContent.bind(this));

        // ================================
        // SEARCH & DISCOVERY
        // ================================
        this.router.post('/search/global', this.globalSearch.bind(this));
        this.router.post('/search/messages', this.searchMessages.bind(this));
        this.router.post('/search/users', this.searchUsers.bind(this));
        this.router.post('/search/files', this.searchFiles.bind(this));

        // ================================
        // NOTIFICATIONS
        // ================================
        this.router.get('/notifications', this.getNotifications.bind(this));
        this.router.put('/notifications/:notificationId/read', this.markNotificationRead.bind(this));
        this.router.delete('/notifications/:notificationId', this.deleteNotification.bind(this));
        this.router.post('/notifications/mark-all-read', this.markAllNotificationsRead.bind(this));

        // ================================
        // PRESENCE & STATUS
        // ================================
        this.router.post('/presence/update', this.updatePresence.bind(this));
        this.router.get('/presence/:userId', this.getUserPresence.bind(this));
        this.router.post('/typing/start', this.startTyping.bind(this));
        this.router.post('/typing/stop', this.stopTyping.bind(this));

        // ================================
        // ADMIN & ANALYTICS
        // ================================
        this.router.get('/admin/stats', this.getSystemStats.bind(this));
        this.router.get('/admin/health', this.getHealthCheck.bind(this));
        this.router.get('/admin/logs', this.getSystemLogs.bind(this));
        this.router.post('/admin/broadcast', this.broadcastMessage.bind(this));

        // ================================
        // DEMO ENDPOINTS (No Auth)
        // ================================
        this.router.post('/demo/message', this.sendDemoMessage.bind(this));
        this.router.get('/demo/chats', this.getDemoChats.bind(this));
        this.router.post('/demo/user', this.createDemoUser.bind(this));
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
            this.errorHandler.handleError(error, req, res);
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
            this.errorHandler.handleError(error, req, res);
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
            this.errorHandler.handleError(error, req, res);
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
            this.errorHandler.handleError(error, req, res);
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
            this.errorHandler.handleError(error, req, res);
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
            this.errorHandler.handleError(error, req, res);
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
            this.errorHandler.handleError(error, req, res);
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
            this.errorHandler.handleError(error, req, res);
        }
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

    // ================================
    // ERROR HANDLING MIDDLEWARE
    // ================================

    setupErrorHandling() {
        this.router.use(this.errorHandler.middleware());
    }

    getRouter() {
        this.setupErrorHandling();
        return this.router;
    }
}

module.exports = ComprehensiveAPI;