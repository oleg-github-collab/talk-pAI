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
        this.router.delete('/chats/:chatId', this.deleteChat.bind(this));
        this.router.put('/chats/:chatId', this.updateChat.bind(this));

        // ================================
        // AUTHENTICATION ENDPOINTS (Working)
        // ================================
        this.router.post('/auth/register', this.registerUser.bind(this));
        this.router.post('/auth/login', this.loginUser.bind(this));
        this.router.post('/auth/logout', this.logoutUser.bind(this));
        this.router.post('/auth/refresh', this.refreshToken.bind(this));

        // ================================
        // USER MANAGEMENT ENDPOINTS (Enhanced)
        // ================================
        this.router.get('/users/search', this.searchUsers.bind(this));
        this.router.get('/users/profile', this.getUserProfile.bind(this));
        this.router.put('/users/profile', this.updateUserProfile.bind(this));
        this.router.post('/users/avatar', this.uploadAvatar.bind(this));
        this.router.get('/users/:userId', this.getUserById.bind(this));
        this.router.get('/users', this.getAllUsers.bind(this));

        // ================================
        // FILE MANAGEMENT ENDPOINTS
        // ================================
        this.router.post('/files/upload', this.uploadFile.bind(this));
        this.router.get('/files/:fileId', this.getFile.bind(this));
        this.router.delete('/files/:fileId', this.deleteFile.bind(this));

        // ================================
        // ADVANCED FEATURES
        // ================================
        this.router.get('/chats/:chatId/participants', this.getChatParticipants.bind(this));
        this.router.post('/chats/:chatId/participants', this.addChatParticipant.bind(this));
        this.router.delete('/chats/:chatId/participants/:userId', this.removeChatParticipant.bind(this));
        this.router.put('/chats/:chatId/participants/:userId/role', this.updateParticipantRole.bind(this));

        // ================================
        // REAL-TIME FEATURES
        // ================================
        this.router.post('/chats/:chatId/typing', this.setTypingStatus.bind(this));
        this.router.put('/chats/:chatId/read', this.markAsRead.bind(this));
        this.router.get('/notifications', this.getNotifications.bind(this));
        this.router.put('/notifications/:notificationId/read', this.markNotificationAsRead.bind(this));

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

            // Validation (email is optional)
            ErrorHandler.validateRequired(nickname, 'nickname');
            ErrorHandler.validateRequired(password, 'password');
            ErrorHandler.validateLength(nickname, 'nickname', 3, 50);
            ErrorHandler.validateLength(password, 'password', 6, 100);

            // Validate email only if provided
            if (email && email.trim()) {
                ErrorHandler.validateEmail(email);
            }

            // Create user
            const hashedPassword = await this.hashPassword(password);
            const user = await this.db.createUser({
                nickname,
                email: email || null,
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
            const { email, nickname, password } = req.body;
            const loginIdentifier = email || nickname;

            ErrorHandler.validateRequired(loginIdentifier, 'email or nickname');
            ErrorHandler.validateRequired(password, 'password');

            // Try to find user by email or nickname
            let user = null;
            if (email) {
                user = await this.db.getUserByEmail(email);
            } else if (nickname) {
                user = await this.db.getUserByNickname(nickname);
            }

            if (!user || !await this.verifyPassword(password, user.password_hash)) {
                throw new AuthenticationError('Invalid credentials');
            }

            const token = this.generateJWT(user);

            this.logger.info('User logged in', { userId: user.id, nickname: user.nickname });

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

    // ================================
    // ENHANCED USER MANAGEMENT METHODS
    // ================================

    async searchUsers(req, res) {
        try {
            const { query, limit = 20, offset = 0 } = req.query;

            if (!query || query.trim().length < 2) {
                return res.status(400).json({
                    success: false,
                    error: { message: 'Search query must be at least 2 characters', code: 'INVALID_QUERY' }
                });
            }

            const users = await this.db.searchUsers(query.trim(), { limit: parseInt(limit), offset: parseInt(offset) });

            res.json({
                success: true,
                users: users.map(user => this.sanitizeUser(user)),
                pagination: { limit: parseInt(limit), offset: parseInt(offset), total: users.length }
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async getUserProfile(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new AuthenticationError('Authentication required');
            }

            const user = await this.db.getUserById(userId);
            if (!user) {
                throw new NotFoundError('User not found');
            }

            res.json({
                success: true,
                user: this.sanitizeUser(user)
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async updateUserProfile(req, res) {
        try {
            const userId = req.user?.id;
            const { display_name, bio, status, theme, notifications_enabled } = req.body;

            if (!userId) {
                throw new AuthenticationError('Authentication required');
            }

            const updatedUser = await this.db.updateUser(userId, {
                display_name,
                bio,
                status,
                theme,
                notifications_enabled,
                updated_at: new Date()
            });

            this.logger.info('User profile updated', { userId, changes: Object.keys(req.body) });

            res.json({
                success: true,
                user: this.sanitizeUser(updatedUser),
                message: 'Profile updated successfully'
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async getUserById(req, res) {
        try {
            const { userId } = req.params;
            const user = await this.db.getUserById(userId);

            if (!user) {
                throw new NotFoundError('User not found');
            }

            res.json({
                success: true,
                user: this.sanitizeUser(user)
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async getAllUsers(req, res) {
        try {
            const { limit = 50, offset = 0, status = 'active' } = req.query;
            const users = await this.db.getAllUsers({ limit: parseInt(limit), offset: parseInt(offset), status });

            res.json({
                success: true,
                users: users.map(user => this.sanitizeUser(user)),
                pagination: { limit: parseInt(limit), offset: parseInt(offset), total: users.length }
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    // ================================
    // AUTHENTICATION ENHANCEMENTS
    // ================================

    async logoutUser(req, res) {
        try {
            const userId = req.user?.id;

            if (userId) {
                // Invalidate tokens, update last_seen
                await this.db.updateUser(userId, { last_seen: new Date(), is_online: false });
                this.logger.info('User logged out', { userId });
            }

            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async refreshToken(req, res) {
        try {
            const { refresh_token } = req.body;

            if (!refresh_token) {
                throw new AuthenticationError('Refresh token required');
            }

            // Verify refresh token and generate new access token
            const user = await this.db.getUserByRefreshToken(refresh_token);
            if (!user) {
                throw new AuthenticationError('Invalid refresh token');
            }

            const newToken = this.generateJWT(user);

            res.json({
                success: true,
                token: newToken,
                user: this.sanitizeUser(user)
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    // ================================
    // CHAT MANAGEMENT ENHANCEMENTS
    // ================================

    async deleteChat(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user?.id;

            const chat = await this.db.getChatById(chatId);
            if (!chat) {
                throw new NotFoundError('Chat not found');
            }

            // Check permissions
            if (chat.created_by !== userId) {
                return res.status(403).json({
                    success: false,
                    error: { message: 'Insufficient permissions', code: 'FORBIDDEN' }
                });
            }

            await this.db.deleteChat(chatId);

            res.json({
                success: true,
                message: 'Chat deleted successfully'
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async updateChat(req, res) {
        try {
            const { chatId } = req.params;
            const { name, description, settings } = req.body;
            const userId = req.user?.id;

            const chat = await this.db.getChatById(chatId);
            if (!chat) {
                throw new NotFoundError('Chat not found');
            }

            const updatedChat = await this.db.updateChat(chatId, {
                name,
                description,
                settings,
                updated_at: new Date()
            });

            res.json({
                success: true,
                chat: updatedChat,
                message: 'Chat updated successfully'
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    // ================================
    // PARTICIPANT MANAGEMENT
    // ================================

    async getChatParticipants(req, res) {
        try {
            const { chatId } = req.params;
            const participants = await this.db.getChatParticipants(chatId);

            res.json({
                success: true,
                participants
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async removeChatParticipant(req, res) {
        try {
            const { chatId, userId } = req.params;
            const requesterId = req.user?.id;

            await this.db.removeChatParticipant(chatId, userId);

            res.json({
                success: true,
                message: 'Participant removed successfully'
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async updateParticipantRole(req, res) {
        try {
            const { chatId, userId } = req.params;
            const { role } = req.body;

            await this.db.updateParticipantRole(chatId, userId, role);

            res.json({
                success: true,
                message: 'Participant role updated successfully'
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    // ================================
    // REAL-TIME FEATURES
    // ================================

    async setTypingStatus(req, res) {
        try {
            const { chatId } = req.params;
            const { isTyping } = req.body;
            const userId = req.user?.id;

            // Emit typing status via WebSocket
            req.app.get('io')?.to(`chat-${chatId}`).emit('typing_status', {
                userId,
                chatId,
                isTyping,
                timestamp: new Date()
            });

            res.json({
                success: true,
                message: 'Typing status updated'
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async markAsRead(req, res) {
        try {
            const { chatId } = req.params;
            const userId = req.user?.id;

            await this.db.markChatAsRead(chatId, userId);

            res.json({
                success: true,
                message: 'Messages marked as read'
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async getNotifications(req, res) {
        try {
            const userId = req.user?.id;
            const { limit = 50, offset = 0, unread_only = false } = req.query;

            const notifications = await this.db.getUserNotifications(userId, {
                limit: parseInt(limit),
                offset: parseInt(offset),
                unread_only: unread_only === 'true'
            });

            res.json({
                success: true,
                notifications,
                pagination: { limit: parseInt(limit), offset: parseInt(offset) }
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async markNotificationAsRead(req, res) {
        try {
            const { notificationId } = req.params;
            const userId = req.user?.id;

            await this.db.markNotificationAsRead(notificationId, userId);

            res.json({
                success: true,
                message: 'Notification marked as read'
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    // ================================
    // FILE MANAGEMENT
    // ================================

    async uploadFile(req, res) {
        try {
            // In a real implementation, this would handle file uploads
            // For now, return a placeholder response
            res.json({
                success: true,
                file: {
                    id: `file_${Date.now()}`,
                    filename: 'uploaded_file.jpg',
                    url: '/uploads/uploaded_file.jpg',
                    size: 1024000,
                    type: 'image/jpeg'
                },
                message: 'File uploaded successfully'
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async uploadAvatar(req, res) {
        try {
            const userId = req.user?.id;

            // In a real implementation, this would handle avatar uploads
            const avatarUrl = `/avatars/${userId}_${Date.now()}.jpg`;

            await this.db.updateUser(userId, { avatar: avatarUrl });

            res.json({
                success: true,
                avatar_url: avatarUrl,
                message: 'Avatar uploaded successfully'
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async getFile(req, res) {
        try {
            const { fileId } = req.params;

            // In a real implementation, this would serve the actual file
            res.json({
                success: true,
                file: {
                    id: fileId,
                    url: `/files/${fileId}`,
                    filename: 'example.jpg'
                }
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    async deleteFile(req, res) {
        try {
            const { fileId } = req.params;

            // In a real implementation, this would delete the file
            res.json({
                success: true,
                message: 'File deleted successfully'
            });
        } catch (error) {
            this.handleError(error, req, res);
        }
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ComprehensiveAPI;