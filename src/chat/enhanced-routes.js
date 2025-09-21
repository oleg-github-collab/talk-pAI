const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const authMiddleware = require('../middleware/auth');
const EnhancedChatService = require('./enhanced-chat-service');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/chat');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
        files: 10 // Maximum 10 files per upload
    },
    fileFilter: (req, file, cb) => {
        // Allow all file types for now, but could be restricted
        cb(null, true);
    }
});

// Initialize chat service (will be set by main server)
let chatService = null;

function setChatService(service) {
    chatService = service;
}

// Get user's chats
router.get('/chats', authMiddleware, async (req, res) => {
    try {
        if (!chatService) {
            return res.status(500).json({
                success: false,
                message: 'Chat service not initialized'
            });
        }

        const chats = await chatService.getUserChats(req.user.id);

        res.json({
            success: true,
            chats: chats
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Create new chat
router.post('/chats', authMiddleware, async (req, res) => {
    try {
        if (!chatService) {
            return res.status(500).json({
                success: false,
                message: 'Chat service not initialized'
            });
        }

        const { name, description, type = 'private', participants = [] } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Chat name is required'
            });
        }

        const chat = await chatService.createChat({
            name,
            description,
            type,
            createdBy: req.user.id,
            participants
        });

        res.status(201).json({
            success: true,
            chat: chat
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Get chat details
router.get('/chats/:chatId', authMiddleware, async (req, res) => {
    try {
        if (!chatService) {
            return res.status(500).json({
                success: false,
                message: 'Chat service not initialized'
            });
        }

        const { chatId } = req.params;

        // Verify access
        const hasAccess = await chatService.verifyUserChatAccess(req.user.id, chatId);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to chat'
            });
        }

        const result = await chatService.pool.query(`
            SELECT
                c.*,
                cp.role as user_role,
                cp.is_muted,
                cp.is_pinned,
                cp.last_read_at,
                (
                    SELECT json_agg(
                        json_build_object(
                            'id', u.id,
                            'nickname', u.nickname,
                            'display_name', u.display_name,
                            'avatar', u.avatar,
                            'status', u.status,
                            'role', cp2.role,
                            'joined_at', cp2.joined_at
                        )
                    )
                    FROM chat_participants cp2
                    JOIN users u ON cp2.user_id = u.id
                    WHERE cp2.chat_id = c.id AND cp2.left_at IS NULL
                ) as participants
            FROM chats c
            JOIN chat_participants cp ON c.id = cp.chat_id
            WHERE c.id = $1 AND cp.user_id = $2 AND cp.left_at IS NULL
        `, [chatId, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Chat not found'
            });
        }

        res.json({
            success: true,
            chat: result.rows[0]
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Update chat
router.put('/chats/:chatId', authMiddleware, async (req, res) => {
    try {
        if (!chatService) {
            return res.status(500).json({
                success: false,
                message: 'Chat service not initialized'
            });
        }

        const { chatId } = req.params;
        const { name, description, avatar } = req.body;

        // Verify user has permission to update chat
        const hasPermission = await chatService.verifyUserChatPermission(
            req.user.id,
            chatId,
            'manage_chat'
        );

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'Permission denied'
            });
        }

        const result = await chatService.pool.query(`
            UPDATE chats SET
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                avatar = COALESCE($3, avatar),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
        `, [name, description, avatar, chatId]);

        res.json({
            success: true,
            chat: result.rows[0]
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Get chat messages
router.get('/chats/:chatId/messages', authMiddleware, async (req, res) => {
    try {
        if (!chatService) {
            return res.status(500).json({
                success: false,
                message: 'Chat service not initialized'
            });
        }

        const { chatId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const messages = await chatService.getChatMessages(
            chatId,
            req.user.id,
            parseInt(limit),
            parseInt(offset)
        );

        res.json({
            success: true,
            messages: messages
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Send message with file upload
router.post('/chats/:chatId/messages', authMiddleware, upload.array('files', 10), async (req, res) => {
    try {
        if (!chatService) {
            return res.status(500).json({
                success: false,
                message: 'Chat service not initialized'
            });
        }

        const { chatId } = req.params;
        const { content, messageType = 'text', replyToId } = req.body;

        let message;

        if (req.files && req.files.length > 0) {
            // Handle file uploads
            const fileIds = [];

            for (const file of req.files) {
                // Store file info in database
                const fileResult = await chatService.pool.query(`
                    INSERT INTO files (
                        original_name, file_name, file_path, file_size,
                        mime_type, uploaded_by, storage_provider
                    ) VALUES ($1, $2, $3, $4, $5, $6, 'local')
                    RETURNING id
                `, [
                    file.originalname,
                    file.filename,
                    file.path,
                    file.size,
                    file.mimetype,
                    req.user.id
                ]);

                fileIds.push(fileResult.rows[0].id);
            }

            // Send message with file attachments
            message = await chatService.sendMessage({
                chatId,
                senderId: req.user.id,
                content: content || '',
                messageType: fileIds.length === 1 && req.files[0].mimetype.startsWith('image/') ? 'image' : 'file',
                replyToId,
                metadata: {
                    fileCount: fileIds.length,
                    files: req.files.map((file, index) => ({
                        id: fileIds[index],
                        originalName: file.originalname,
                        size: file.size,
                        mimeType: file.mimetype
                    }))
                }
            });

            // Link files to message
            for (let i = 0; i < fileIds.length; i++) {
                await chatService.pool.query(`
                    INSERT INTO message_attachments (message_id, file_id, attachment_order)
                    VALUES ($1, $2, $3)
                `, [message.id, fileIds[i], i + 1]);
            }

        } else {
            // Regular text message
            if (!content) {
                return res.status(400).json({
                    success: false,
                    message: 'Content is required for text messages'
                });
            }

            message = await chatService.sendMessage({
                chatId,
                senderId: req.user.id,
                content,
                messageType,
                replyToId
            });
        }

        // Broadcast message to chat participants via Socket.IO
        if (chatService.io) {
            chatService.io.to(chatId).emit('new_message', message);
        }

        res.status(201).json({
            success: true,
            message: message
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Add participant to chat
router.post('/chats/:chatId/participants', authMiddleware, async (req, res) => {
    try {
        if (!chatService) {
            return res.status(500).json({
                success: false,
                message: 'Chat service not initialized'
            });
        }

        const { chatId } = req.params;
        const { userId, role = 'member' } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const result = await chatService.addParticipant(chatId, userId, req.user.id, role);

        // Notify chat participants
        if (chatService.io) {
            chatService.io.to(chatId).emit('participant_added', {
                chatId,
                userId,
                addedBy: req.user.id,
                role
            });
        }

        res.json({
            success: true,
            result: result
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Remove participant from chat
router.delete('/chats/:chatId/participants/:userId', authMiddleware, async (req, res) => {
    try {
        if (!chatService) {
            return res.status(500).json({
                success: false,
                message: 'Chat service not initialized'
            });
        }

        const { chatId, userId } = req.params;

        const result = await chatService.removeParticipant(chatId, userId, req.user.id);

        // Notify chat participants
        if (chatService.io) {
            chatService.io.to(chatId).emit('participant_removed', {
                chatId,
                userId,
                removedBy: req.user.id
            });
        }

        res.json({
            success: true,
            result: result
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Update participant role
router.put('/chats/:chatId/participants/:userId', authMiddleware, async (req, res) => {
    try {
        if (!chatService) {
            return res.status(500).json({
                success: false,
                message: 'Chat service not initialized'
            });
        }

        const { chatId, userId } = req.params;
        const { role, permissions } = req.body;

        // Verify user has permission to change roles
        const hasPermission = await chatService.verifyUserChatPermission(
            req.user.id,
            chatId,
            'manage_participants'
        );

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'Permission denied'
            });
        }

        await chatService.pool.query(`
            UPDATE chat_participants SET
                role = COALESCE($1, role),
                permissions = COALESCE($2, permissions),
                updated_at = CURRENT_TIMESTAMP
            WHERE chat_id = $3 AND user_id = $4
        `, [role, JSON.stringify(permissions), chatId, userId]);

        // Notify chat participants
        if (chatService.io) {
            chatService.io.to(chatId).emit('participant_role_updated', {
                chatId,
                userId,
                role,
                permissions,
                updatedBy: req.user.id
            });
        }

        res.json({
            success: true
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Pin/unpin message
router.post('/chats/:chatId/messages/:messageId/pin', authMiddleware, async (req, res) => {
    try {
        if (!chatService) {
            return res.status(500).json({
                success: false,
                message: 'Chat service not initialized'
            });
        }

        const { chatId, messageId } = req.params;
        const { pin = true } = req.body;

        // Verify user has permission to pin messages
        const hasPermission = await chatService.verifyUserChatPermission(
            req.user.id,
            chatId,
            'pin_messages'
        );

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'Permission denied'
            });
        }

        await chatService.pool.query(`
            UPDATE messages SET
                is_pinned = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND chat_id = $3
        `, [pin, messageId, chatId]);

        // Notify chat participants
        if (chatService.io) {
            chatService.io.to(chatId).emit('message_pinned', {
                chatId,
                messageId,
                pinned: pin,
                pinnedBy: req.user.id
            });
        }

        res.json({
            success: true
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Search messages in chat
router.get('/chats/:chatId/search', authMiddleware, async (req, res) => {
    try {
        if (!chatService) {
            return res.status(500).json({
                success: false,
                message: 'Chat service not initialized'
            });
        }

        const { chatId } = req.params;
        const { q: query, limit = 20, offset = 0 } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        // Verify access
        const hasAccess = await chatService.verifyUserChatAccess(req.user.id, chatId);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to chat'
            });
        }

        const result = await chatService.pool.query(`
            SELECT
                m.*,
                u.nickname as sender_nickname,
                u.display_name as sender_display_name,
                u.avatar as sender_avatar,
                ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', $1)) as rank
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = $2
            AND m.is_deleted = false
            AND to_tsvector('english', m.content) @@ plainto_tsquery('english', $1)
            ORDER BY rank DESC, m.created_at DESC
            LIMIT $3 OFFSET $4
        `, [query, chatId, limit, offset]);

        res.json({
            success: true,
            messages: result.rows,
            query: query
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Get chat statistics
router.get('/chats/:chatId/stats', authMiddleware, async (req, res) => {
    try {
        if (!chatService) {
            return res.status(500).json({
                success: false,
                message: 'Chat service not initialized'
            });
        }

        const { chatId } = req.params;

        // Verify access
        const hasAccess = await chatService.verifyUserChatAccess(req.user.id, chatId);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to chat'
            });
        }

        const stats = await chatService.pool.query(`
            SELECT
                COUNT(*) as total_messages,
                COUNT(DISTINCT sender_id) as active_participants,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as messages_24h,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as messages_7d,
                COUNT(*) FILTER (WHERE message_type = 'image') as image_count,
                COUNT(*) FILTER (WHERE message_type = 'file') as file_count
            FROM messages
            WHERE chat_id = $1 AND is_deleted = false
        `, [chatId]);

        const participantStats = await chatService.pool.query(`
            SELECT
                COUNT(*) as total_participants,
                COUNT(*) FILTER (WHERE role = 'owner') as owners,
                COUNT(*) FILTER (WHERE role = 'admin') as admins,
                COUNT(*) FILTER (WHERE role = 'moderator') as moderators,
                COUNT(*) FILTER (WHERE role = 'member') as members
            FROM chat_participants
            WHERE chat_id = $1 AND left_at IS NULL
        `, [chatId]);

        res.json({
            success: true,
            stats: {
                ...stats.rows[0],
                ...participantStats.rows[0]
            }
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Export chat data
router.get('/chats/:chatId/export', authMiddleware, async (req, res) => {
    try {
        if (!chatService) {
            return res.status(500).json({
                success: false,
                message: 'Chat service not initialized'
            });
        }

        const { chatId } = req.params;
        const { format = 'json' } = req.query;

        // Verify user has permission to export
        const hasPermission = await chatService.verifyUserChatPermission(
            req.user.id,
            chatId,
            'export_data'
        );

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'Permission denied'
            });
        }

        const messages = await chatService.getChatMessages(chatId, req.user.id, 10000, 0);

        if (format === 'json') {
            res.json({
                success: true,
                chatId: chatId,
                exportDate: new Date(),
                messageCount: messages.length,
                messages: messages
            });
        } else if (format === 'csv') {
            // Convert to CSV format
            const csv = [
                'Timestamp,Sender,Content,Type',
                ...messages.map(msg =>
                    `"${msg.created_at}","${msg.sender_nickname}","${msg.content || ''}","${msg.message_type}"`
                )
            ].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="chat-${chatId}-export.csv"`);
            res.send(csv);
        } else {
            res.status(400).json({
                success: false,
                message: 'Unsupported export format'
            });
        }

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = { router, setChatService };