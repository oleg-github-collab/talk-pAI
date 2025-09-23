const express = require('express');
const { randomUUID } = require('crypto');

class MessagingAPI {
    constructor(database, logger) {
        this.db = database;
        this.logger = logger;
        this.router = express.Router();
        this.setupRoutes();
    }

    getRouter() {
        return this.router;
    }

    setupRoutes() {
        // Get chats for authenticated user
        this.router.get('/chats', this.getChats.bind(this));

        // Create a new chat
        this.router.post('/chats', this.createChat.bind(this));

        // Get messages for a specific chat
        this.router.get('/chats/:chatId/messages', this.getMessages.bind(this));

        // Send a message to a chat
        this.router.post('/chats/:chatId/messages', this.sendMessage.bind(this));

        // Delete a chat
        this.router.delete('/chats/:chatId', this.deleteChat.bind(this));

        // Demo endpoints for immediate functionality
        this.router.post('/demo/message', this.sendDemoMessage.bind(this));
        this.router.get('/demo/chats', this.getDemoChats.bind(this));
    }

    // Middleware to extract user from JWT token
    async getUserFromToken(req) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return null;
            }

            const token = authHeader.substring(7);
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

            const result = await this.db.query(
                'SELECT id, nickname, display_name, avatar FROM users WHERE id = $1 AND is_active = true',
                [decoded.userId]
            );

            return result.rows[0] || null;
        } catch (error) {
            return null;
        }
    }

    async getChats(req, res) {
        try {
            const user = await this.getUserFromToken(req);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            // For now, return demo chats until we implement proper chat management
            const demoChats = [
                {
                    id: 1,
                    name: 'General Chat',
                    type: 'group',
                    lastMessage: 'Welcome to Talk pAI!',
                    lastMessageTime: new Date(),
                    unreadCount: 0,
                    participants: ['You', 'Demo User'],
                    avatar: '💬'
                },
                {
                    id: 2,
                    name: 'AI Assistant',
                    type: 'ai',
                    lastMessage: 'How can I help you today?',
                    lastMessageTime: new Date(),
                    unreadCount: 1,
                    participants: ['You', 'AI Assistant'],
                    avatar: '🤖'
                }
            ];

            res.json({
                success: true,
                chats: demoChats
            });

        } catch (error) {
            this.logger.error('Get chats error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get chats'
            });
        }
    }

    async createChat(req, res) {
        try {
            const user = await this.getUserFromToken(req);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const { name, type = 'group', description, participants = [] } = req.body;

            if (!name || name.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Chat name is required'
                });
            }

            // Create chat in database
            const chatId = randomUUID();
            const result = await this.db.query(`
                INSERT INTO chats (
                    id, name, type, description, created_by, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING *
            `, [chatId, name.trim(), type, description, user.id]);

            const chat = result.rows[0];

            // Add creator as admin participant
            await this.db.query(`
                INSERT INTO chat_participants (chat_id, user_id, role, joined_at)
                VALUES ($1, $2, 'admin', CURRENT_TIMESTAMP)
            `, [chatId, user.id]);

            // Add other participants as members
            for (const participantId of participants) {
                if (participantId !== user.id) {
                    await this.db.query(`
                        INSERT INTO chat_participants (chat_id, user_id, role, joined_at)
                        VALUES ($1, $2, 'member', CURRENT_TIMESTAMP)
                    `, [chatId, participantId]);
                }
            }

            this.logger.info('Chat created', { chatId, userId: user.id, name });

            res.status(201).json({
                success: true,
                chat: {
                    id: chat.id,
                    name: chat.name,
                    type: chat.type,
                    description: chat.description,
                    createdAt: chat.created_at,
                    createdBy: user.nickname
                },
                message: 'Chat created successfully'
            });

        } catch (error) {
            this.logger.error('Create chat error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create chat'
            });
        }
    }

    async getMessages(req, res) {
        try {
            const user = await this.getUserFromToken(req);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const { chatId } = req.params;
            const { limit = 50, offset = 0 } = req.query;

            // Check if user has access to this chat
            const participantCheck = await this.db.query(`
                SELECT 1 FROM chat_participants
                WHERE chat_id = $1 AND user_id = $2
            `, [chatId, user.id]);

            if (participantCheck.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to this chat'
                });
            }

            // Get messages
            const result = await this.db.query(`
                SELECT
                    m.id,
                    m.content,
                    m.message_type,
                    m.created_at,
                    u.id as sender_id,
                    u.nickname as sender_nickname,
                    u.display_name as sender_name,
                    u.avatar as sender_avatar
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.chat_id = $1
                ORDER BY m.created_at DESC
                LIMIT $2 OFFSET $3
            `, [chatId, parseInt(limit), parseInt(offset)]);

            const messages = result.rows.map(msg => ({
                id: msg.id,
                content: msg.content,
                messageType: msg.message_type,
                timestamp: msg.created_at,
                senderId: msg.sender_id,
                senderName: msg.sender_name || msg.sender_nickname,
                senderAvatar: msg.sender_avatar || msg.sender_nickname.charAt(0).toUpperCase()
            })).reverse(); // Reverse to get chronological order

            res.json({
                success: true,
                messages,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: result.rows.length === parseInt(limit)
                }
            });

        } catch (error) {
            this.logger.error('Get messages error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get messages'
            });
        }
    }

    async sendMessage(req, res) {
        try {
            const user = await this.getUserFromToken(req);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const { chatId } = req.params;
            const { content, messageType = 'text', attachments = [] } = req.body;

            if (!content || content.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Message content is required'
                });
            }

            // Check if user has access to this chat
            const participantCheck = await this.db.query(`
                SELECT 1 FROM chat_participants
                WHERE chat_id = $1 AND user_id = $2
            `, [chatId, user.id]);

            if (participantCheck.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to this chat'
                });
            }

            // Create message
            const messageId = randomUUID();
            const result = await this.db.query(`
                INSERT INTO messages (
                    id, chat_id, sender_id, content, message_type, created_at
                ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                RETURNING *
            `, [messageId, chatId, user.id, content.trim(), messageType]);

            const message = result.rows[0];

            // Update chat's last activity
            await this.db.query(`
                UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = $1
            `, [chatId]);

            const messageResponse = {
                id: message.id,
                chatId: message.chat_id,
                content: message.content,
                messageType: message.message_type,
                timestamp: message.created_at,
                senderId: user.id,
                senderName: user.display_name || user.nickname,
                senderAvatar: user.avatar || user.nickname.charAt(0).toUpperCase()
            };

            // Emit to WebSocket if available
            try {
                const io = req.app.get('io');
                if (io) {
                    io.to(`chat-${chatId}`).emit('message', messageResponse);
                }
            } catch (socketError) {
                this.logger.warn('WebSocket emit failed:', socketError.message);
            }

            this.logger.info('Message sent', { messageId, chatId, userId: user.id });

            res.status(201).json({
                success: true,
                message: messageResponse
            });

        } catch (error) {
            this.logger.error('Send message error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send message'
            });
        }
    }

    async deleteChat(req, res) {
        try {
            const user = await this.getUserFromToken(req);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const { chatId } = req.params;

            // Check if user is admin of this chat
            const adminCheck = await this.db.query(`
                SELECT 1 FROM chat_participants
                WHERE chat_id = $1 AND user_id = $2 AND role = 'admin'
            `, [chatId, user.id]);

            if (adminCheck.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Only chat admins can delete chats'
                });
            }

            // Delete chat (cascade will handle messages and participants)
            await this.db.query('DELETE FROM chats WHERE id = $1', [chatId]);

            this.logger.info('Chat deleted', { chatId, userId: user.id });

            res.json({
                success: true,
                message: 'Chat deleted successfully'
            });

        } catch (error) {
            this.logger.error('Delete chat error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete chat'
            });
        }
    }

    // Demo methods for immediate functionality
    async sendDemoMessage(req, res) {
        try {
            const { content, messageType = 'text', chatId = 1 } = req.body;

            if (!content || content.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Message content is required'
                });
            }

            const message = {
                id: Date.now(),
                chatId: parseInt(chatId),
                senderId: 'demo-user',
                senderName: 'Demo User',
                senderAvatar: 'DU',
                content: content.trim(),
                messageType: messageType || 'text',
                timestamp: new Date()
            };

            // Emit to WebSocket if available
            try {
                const io = req.app.get('io');
                if (io) {
                    io.to(`chat-${chatId}`).emit('message', message);
                }
            } catch (socketError) {
                this.logger.warn('WebSocket emit failed:', socketError.message);
            }

            this.logger.info('Demo message sent', { messageId: message.id, content });

            res.json({
                success: true,
                message,
                demo: true
            });

        } catch (error) {
            this.logger.error('Send demo message error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send message'
            });
        }
    }

    async getDemoChats(req, res) {
        try {
            const demoChats = [
                {
                    id: 1,
                    name: 'General Chat',
                    type: 'group',
                    lastMessage: 'Welcome to Talk pAI!',
                    lastMessageTime: new Date(),
                    unreadCount: 0,
                    participants: ['Demo User'],
                    avatar: '💬'
                },
                {
                    id: 2,
                    name: 'AI Assistant',
                    type: 'ai',
                    lastMessage: 'How can I help you today?',
                    lastMessageTime: new Date(),
                    unreadCount: 1,
                    participants: ['AI Assistant'],
                    avatar: '🤖'
                }
            ];

            res.json({
                success: true,
                chats: demoChats
            });

        } catch (error) {
            this.logger.error('Get demo chats error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get chats'
            });
        }
    }
}

module.exports = MessagingAPI;
