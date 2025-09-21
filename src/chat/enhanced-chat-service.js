const { Pool } = require('pg');
const crypto = require('crypto');
const EventEmitter = require('events');

class EnhancedChatService extends EventEmitter {
    constructor(io) {
        super();
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        this.io = io;
        this.activeUsers = new Map(); // userId -> { socketId, status, lastSeen }
        this.typingUsers = new Map(); // chatId -> Set of userIds
        this.setupSocketHandlers();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('User connected:', socket.id);

            // User authentication and status
            socket.on('authenticate', async (data) => {
                try {
                    const { userId, token } = data;

                    // Verify token and get user
                    const user = await this.verifySocketToken(token);
                    if (!user || user.id !== userId) {
                        socket.emit('auth_error', { message: 'Invalid authentication' });
                        return;
                    }

                    // Store user connection
                    socket.userId = userId;
                    this.activeUsers.set(userId, {
                        socketId: socket.id,
                        status: 'online',
                        lastSeen: new Date()
                    });

                    // Join user to their chat rooms
                    await this.joinUserChats(socket, userId);

                    // Update user status in database
                    await this.updateUserStatus(userId, 'online');

                    // Notify contacts of online status
                    await this.broadcastStatusUpdate(userId, 'online');

                    socket.emit('authenticated', { success: true });

                } catch (error) {
                    socket.emit('auth_error', { message: error.message });
                }
            });

            // Join specific chat
            socket.on('join_chat', async (data) => {
                try {
                    const { chatId } = data;
                    if (!socket.userId) return;

                    const hasAccess = await this.verifyUserChatAccess(socket.userId, chatId);
                    if (!hasAccess) {
                        socket.emit('error', { message: 'Access denied to chat' });
                        return;
                    }

                    socket.join(chatId);
                    socket.emit('joined_chat', { chatId, success: true });

                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });

            // Leave chat
            socket.on('leave_chat', (data) => {
                const { chatId } = data;
                socket.leave(chatId);
                socket.emit('left_chat', { chatId, success: true });
            });

            // Send message
            socket.on('send_message', async (data) => {
                try {
                    if (!socket.userId) return;

                    const message = await this.sendMessage({
                        chatId: data.chatId,
                        senderId: socket.userId,
                        content: data.content,
                        messageType: data.messageType || 'text',
                        replyToId: data.replyToId,
                        metadata: data.metadata
                    });

                    // Broadcast to chat participants
                    this.io.to(data.chatId).emit('new_message', message);

                    // Send delivery confirmation to sender
                    socket.emit('message_sent', {
                        tempId: data.tempId,
                        message: message
                    });

                } catch (error) {
                    socket.emit('message_error', {
                        tempId: data.tempId,
                        error: error.message
                    });
                }
            });

            // Edit message
            socket.on('edit_message', async (data) => {
                try {
                    if (!socket.userId) return;

                    const message = await this.editMessage(
                        data.messageId,
                        socket.userId,
                        data.content
                    );

                    this.io.to(message.chat_id).emit('message_edited', message);

                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });

            // Delete message
            socket.on('delete_message', async (data) => {
                try {
                    if (!socket.userId) return;

                    const result = await this.deleteMessage(data.messageId, socket.userId);

                    this.io.to(result.chatId).emit('message_deleted', {
                        messageId: data.messageId,
                        chatId: result.chatId
                    });

                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });

            // Typing indicators
            socket.on('typing_start', async (data) => {
                if (!socket.userId) return;

                const { chatId } = data;
                if (!this.typingUsers.has(chatId)) {
                    this.typingUsers.set(chatId, new Set());
                }

                this.typingUsers.get(chatId).add(socket.userId);

                socket.to(chatId).emit('user_typing', {
                    userId: socket.userId,
                    chatId: chatId
                });
            });

            socket.on('typing_stop', async (data) => {
                if (!socket.userId) return;

                const { chatId } = data;
                if (this.typingUsers.has(chatId)) {
                    this.typingUsers.get(chatId).delete(socket.userId);
                }

                socket.to(chatId).emit('user_stopped_typing', {
                    userId: socket.userId,
                    chatId: chatId
                });
            });

            // Message reactions
            socket.on('add_reaction', async (data) => {
                try {
                    if (!socket.userId) return;

                    const reaction = await this.addMessageReaction(
                        data.messageId,
                        socket.userId,
                        data.reaction
                    );

                    this.io.to(reaction.chatId).emit('reaction_added', reaction);

                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });

            socket.on('remove_reaction', async (data) => {
                try {
                    if (!socket.userId) return;

                    const result = await this.removeMessageReaction(
                        data.messageId,
                        socket.userId,
                        data.reaction
                    );

                    this.io.to(result.chatId).emit('reaction_removed', {
                        messageId: data.messageId,
                        userId: socket.userId,
                        reaction: data.reaction
                    });

                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });

            // Read receipts
            socket.on('mark_read', async (data) => {
                try {
                    if (!socket.userId) return;

                    await this.markMessagesAsRead(data.chatId, socket.userId);

                    socket.to(data.chatId).emit('messages_read', {
                        chatId: data.chatId,
                        userId: socket.userId,
                        timestamp: new Date()
                    });

                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });

            // Disconnect handling
            socket.on('disconnect', async () => {
                if (socket.userId) {
                    console.log('User disconnected:', socket.userId);

                    // Remove from active users
                    this.activeUsers.delete(socket.userId);

                    // Clean up typing indicators
                    for (const [chatId, typingSet] of this.typingUsers.entries()) {
                        if (typingSet.has(socket.userId)) {
                            typingSet.delete(socket.userId);
                            socket.to(chatId).emit('user_stopped_typing', {
                                userId: socket.userId,
                                chatId: chatId
                            });
                        }
                    }

                    // Update status to offline after delay
                    setTimeout(async () => {
                        if (!this.activeUsers.has(socket.userId)) {
                            await this.updateUserStatus(socket.userId, 'offline');
                            await this.broadcastStatusUpdate(socket.userId, 'offline');
                        }
                    }, 30000); // 30 second grace period
                }
            });
        });
    }

    // Core messaging functions
    async sendMessage({ chatId, senderId, content, messageType = 'text', replyToId = null, metadata = {} }) {
        try {
            // Verify user has access to chat
            const hasAccess = await this.verifyUserChatAccess(senderId, chatId);
            if (!hasAccess) {
                throw new Error('Access denied to chat');
            }

            // Insert message
            const result = await this.pool.query(`
                INSERT INTO messages (chat_id, sender_id, content, message_type, reply_to_id, metadata)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [chatId, senderId, content, messageType, replyToId, JSON.stringify(metadata)]);

            const message = result.rows[0];

            // Update chat's last message timestamp
            await this.pool.query(`
                UPDATE chats SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1
            `, [chatId]);

            // Get sender info and reply info if exists
            const enrichedMessage = await this.enrichMessage(message);

            // Create notifications for participants
            await this.createMessageNotifications(chatId, senderId, message.id);

            return enrichedMessage;

        } catch (error) {
            throw new Error(`Failed to send message: ${error.message}`);
        }
    }

    async editMessage(messageId, userId, newContent) {
        try {
            // Verify user owns the message
            const messageResult = await this.pool.query(
                'SELECT * FROM messages WHERE id = $1 AND sender_id = $2',
                [messageId, userId]
            );

            if (messageResult.rows.length === 0) {
                throw new Error('Message not found or access denied');
            }

            // Update message
            const result = await this.pool.query(`
                UPDATE messages SET
                    content = $1,
                    is_edited = true,
                    edit_count = edit_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2 AND sender_id = $3
                RETURNING *
            `, [newContent, messageId, userId]);

            return await this.enrichMessage(result.rows[0]);

        } catch (error) {
            throw new Error(`Failed to edit message: ${error.message}`);
        }
    }

    async deleteMessage(messageId, userId) {
        try {
            // Get message to verify ownership and get chat ID
            const messageResult = await this.pool.query(
                'SELECT chat_id FROM messages WHERE id = $1 AND sender_id = $2',
                [messageId, userId]
            );

            if (messageResult.rows.length === 0) {
                throw new Error('Message not found or access denied');
            }

            const chatId = messageResult.rows[0].chat_id;

            // Soft delete the message
            await this.pool.query(`
                UPDATE messages SET
                    is_deleted = true,
                    content = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [messageId]);

            return { messageId, chatId };

        } catch (error) {
            throw new Error(`Failed to delete message: ${error.message}`);
        }
    }

    // Chat management
    async createChat({ name, description, type = 'private', createdBy, participants = [] }) {
        try {
            // Create chat
            const chatResult = await this.pool.query(`
                INSERT INTO chats (name, description, type, created_by)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [name, description, type, createdBy]);

            const chat = chatResult.rows[0];

            // Add creator as owner
            await this.pool.query(`
                INSERT INTO chat_participants (chat_id, user_id, role)
                VALUES ($1, $2, 'owner')
            `, [chat.id, createdBy]);

            // Add other participants
            for (const participantId of participants) {
                if (participantId !== createdBy) {
                    await this.pool.query(`
                        INSERT INTO chat_participants (chat_id, user_id, role)
                        VALUES ($1, $2, 'member')
                    `, [chat.id, participantId]);
                }
            }

            return chat;

        } catch (error) {
            throw new Error(`Failed to create chat: ${error.message}`);
        }
    }

    async addParticipant(chatId, userId, addedBy, role = 'member') {
        try {
            // Verify adder has permission
            const hasPermission = await this.verifyUserChatPermission(addedBy, chatId, 'add_participants');
            if (!hasPermission) {
                throw new Error('Permission denied');
            }

            // Add participant
            await this.pool.query(`
                INSERT INTO chat_participants (chat_id, user_id, role, invited_by)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (chat_id, user_id) DO NOTHING
            `, [chatId, userId, role, addedBy]);

            // If user is online, join them to the chat room
            const activeUser = this.activeUsers.get(userId);
            if (activeUser) {
                const socket = this.io.sockets.sockets.get(activeUser.socketId);
                if (socket) {
                    socket.join(chatId);
                }
            }

            return { success: true };

        } catch (error) {
            throw new Error(`Failed to add participant: ${error.message}`);
        }
    }

    async removeParticipant(chatId, userId, removedBy) {
        try {
            // Verify remover has permission
            const hasPermission = await this.verifyUserChatPermission(removedBy, chatId, 'remove_participants');
            if (!hasPermission) {
                throw new Error('Permission denied');
            }

            // Remove participant
            await this.pool.query(`
                UPDATE chat_participants SET left_at = CURRENT_TIMESTAMP
                WHERE chat_id = $1 AND user_id = $2
            `, [chatId, userId]);

            // Remove from socket room
            const activeUser = this.activeUsers.get(userId);
            if (activeUser) {
                const socket = this.io.sockets.sockets.get(activeUser.socketId);
                if (socket) {
                    socket.leave(chatId);
                }
            }

            return { success: true };

        } catch (error) {
            throw new Error(`Failed to remove participant: ${error.message}`);
        }
    }

    // Message reactions
    async addMessageReaction(messageId, userId, reaction) {
        try {
            // Get message and verify access
            const messageResult = await this.pool.query(
                'SELECT chat_id FROM messages WHERE id = $1',
                [messageId]
            );

            if (messageResult.rows.length === 0) {
                throw new Error('Message not found');
            }

            const chatId = messageResult.rows[0].chat_id;
            const hasAccess = await this.verifyUserChatAccess(userId, chatId);
            if (!hasAccess) {
                throw new Error('Access denied');
            }

            // Add reaction
            await this.pool.query(`
                INSERT INTO message_reactions (message_id, user_id, reaction)
                VALUES ($1, $2, $3)
                ON CONFLICT (message_id, user_id, reaction) DO NOTHING
            `, [messageId, userId, reaction]);

            return { messageId, userId, reaction, chatId };

        } catch (error) {
            throw new Error(`Failed to add reaction: ${error.message}`);
        }
    }

    async removeMessageReaction(messageId, userId, reaction) {
        try {
            // Get message and verify access
            const messageResult = await this.pool.query(
                'SELECT chat_id FROM messages WHERE id = $1',
                [messageId]
            );

            if (messageResult.rows.length === 0) {
                throw new Error('Message not found');
            }

            const chatId = messageResult.rows[0].chat_id;

            // Remove reaction
            await this.pool.query(`
                DELETE FROM message_reactions
                WHERE message_id = $1 AND user_id = $2 AND reaction = $3
            `, [messageId, userId, reaction]);

            return { messageId, userId, reaction, chatId };

        } catch (error) {
            throw new Error(`Failed to remove reaction: ${error.message}`);
        }
    }

    // Read receipts
    async markMessagesAsRead(chatId, userId) {
        try {
            await this.pool.query(`
                UPDATE chat_participants
                SET last_read_at = CURRENT_TIMESTAMP
                WHERE chat_id = $1 AND user_id = $2
            `, [chatId, userId]);

            return { success: true };

        } catch (error) {
            throw new Error(`Failed to mark messages as read: ${error.message}`);
        }
    }

    // Helper functions
    async verifySocketToken(token) {
        // Implement JWT token verification
        // Return user object if valid, null if invalid
        const jwt = require('jsonwebtoken');
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const result = await this.pool.query(
                'SELECT * FROM users WHERE id = $1 AND is_active = true',
                [decoded.userId]
            );
            return result.rows[0];
        } catch (error) {
            return null;
        }
    }

    async verifyUserChatAccess(userId, chatId) {
        const result = await this.pool.query(`
            SELECT 1 FROM chat_participants
            WHERE user_id = $1 AND chat_id = $2 AND left_at IS NULL
        `, [userId, chatId]);

        return result.rows.length > 0;
    }

    async verifyUserChatPermission(userId, chatId, permission) {
        const result = await this.pool.query(`
            SELECT role, permissions FROM chat_participants
            WHERE user_id = $1 AND chat_id = $2 AND left_at IS NULL
        `, [userId, chatId]);

        if (result.rows.length === 0) return false;

        const { role, permissions } = result.rows[0];

        // Owners and admins have all permissions
        if (role === 'owner' || role === 'admin') return true;

        // Check specific permissions
        const userPermissions = permissions || {};
        return userPermissions[permission] === true;
    }

    async joinUserChats(socket, userId) {
        const result = await this.pool.query(`
            SELECT chat_id FROM chat_participants
            WHERE user_id = $1 AND left_at IS NULL
        `, [userId]);

        for (const row of result.rows) {
            socket.join(row.chat_id);
        }
    }

    async enrichMessage(message) {
        // Add sender info, reply info, reactions, etc.
        const enrichResult = await this.pool.query(`
            SELECT
                m.*,
                u.nickname as sender_nickname,
                u.display_name as sender_display_name,
                u.avatar as sender_avatar,
                rm.content as reply_content,
                ru.nickname as reply_sender_nickname,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'reaction', mr.reaction,
                            'count', mr.reaction_count,
                            'users', mr.user_list
                        )
                    ) FILTER (WHERE mr.reaction IS NOT NULL),
                    '[]'
                ) as reactions
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            LEFT JOIN messages rm ON m.reply_to_id = rm.id
            LEFT JOIN users ru ON rm.sender_id = ru.id
            LEFT JOIN (
                SELECT
                    message_id,
                    reaction,
                    COUNT(*) as reaction_count,
                    array_agg(user_id) as user_list
                FROM message_reactions
                GROUP BY message_id, reaction
            ) mr ON m.id = mr.message_id
            WHERE m.id = $1
            GROUP BY m.id, u.nickname, u.display_name, u.avatar, rm.content, ru.nickname
        `, [message.id]);

        return enrichResult.rows[0];
    }

    async updateUserStatus(userId, status) {
        await this.pool.query(`
            UPDATE users SET
                status = $1,
                last_seen = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [status, userId]);
    }

    async broadcastStatusUpdate(userId, status) {
        // Get user's contacts and broadcast status to them
        const contactsResult = await this.pool.query(`
            SELECT DISTINCT
                CASE
                    WHEN requester_id = $1 THEN addressee_id
                    ELSE requester_id
                END as contact_id
            FROM user_relationships
            WHERE (requester_id = $1 OR addressee_id = $1)
            AND status = 'accepted'
        `, [userId]);

        for (const contact of contactsResult.rows) {
            const activeContact = this.activeUsers.get(contact.contact_id);
            if (activeContact) {
                const socket = this.io.sockets.sockets.get(activeContact.socketId);
                if (socket) {
                    socket.emit('user_status_update', {
                        userId: userId,
                        status: status,
                        timestamp: new Date()
                    });
                }
            }
        }
    }

    async createMessageNotifications(chatId, senderId, messageId) {
        // Create notifications for all chat participants except sender
        const participants = await this.pool.query(`
            SELECT cp.user_id, u.nickname, us.notification_desktop
            FROM chat_participants cp
            JOIN users u ON cp.user_id = u.id
            LEFT JOIN user_settings us ON u.id = us.user_id
            WHERE cp.chat_id = $1 AND cp.user_id != $2 AND cp.left_at IS NULL
        `, [chatId, senderId]);

        for (const participant of participants.rows) {
            if (participant.notification_desktop) {
                await this.pool.query(`
                    INSERT INTO notifications (
                        user_id, type, title, message, related_entity_type, related_entity_id
                    ) VALUES ($1, 'new_message', 'New Message', $2, 'message', $3)
                `, [
                    participant.user_id,
                    `New message in chat`,
                    messageId
                ]);
            }
        }
    }

    // API endpoints for REST calls
    async getChatMessages(chatId, userId, limit = 50, offset = 0) {
        try {
            const hasAccess = await this.verifyUserChatAccess(userId, chatId);
            if (!hasAccess) {
                throw new Error('Access denied to chat');
            }

            const result = await this.pool.query(`
                SELECT
                    m.*,
                    u.nickname as sender_nickname,
                    u.display_name as sender_display_name,
                    u.avatar as sender_avatar,
                    rm.content as reply_content,
                    ru.nickname as reply_sender_nickname,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'reaction', mr.reaction,
                                'count', mr.reaction_count,
                                'users', mr.user_list
                            )
                        ) FILTER (WHERE mr.reaction IS NOT NULL),
                        '[]'
                    ) as reactions
                FROM messages m
                LEFT JOIN users u ON m.sender_id = u.id
                LEFT JOIN messages rm ON m.reply_to_id = rm.id
                LEFT JOIN users ru ON rm.sender_id = ru.id
                LEFT JOIN (
                    SELECT
                        message_id,
                        reaction,
                        COUNT(*) as reaction_count,
                        array_agg(user_id) as user_list
                    FROM message_reactions
                    GROUP BY message_id, reaction
                ) mr ON m.id = mr.message_id
                WHERE m.chat_id = $1 AND m.is_deleted = false
                GROUP BY m.id, u.nickname, u.display_name, u.avatar, rm.content, ru.nickname
                ORDER BY m.created_at DESC
                LIMIT $2 OFFSET $3
            `, [chatId, limit, offset]);

            return result.rows.reverse(); // Return in chronological order

        } catch (error) {
            throw new Error(`Failed to get messages: ${error.message}`);
        }
    }

    async getUserChats(userId) {
        try {
            const result = await this.pool.query(`
                SELECT
                    c.*,
                    cp.role,
                    cp.is_muted,
                    cp.is_pinned,
                    cp.last_read_at,
                    (
                        SELECT COUNT(*)
                        FROM messages m
                        WHERE m.chat_id = c.id
                        AND m.created_at > cp.last_read_at
                        AND m.sender_id != $1
                        AND m.is_deleted = false
                    ) as unread_count,
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', u.id,
                                'nickname', u.nickname,
                                'display_name', u.display_name,
                                'avatar', u.avatar,
                                'status', u.status
                            )
                        )
                        FROM chat_participants cp2
                        JOIN users u ON cp2.user_id = u.id
                        WHERE cp2.chat_id = c.id AND cp2.left_at IS NULL
                    ) as participants
                FROM chats c
                JOIN chat_participants cp ON c.id = cp.chat_id
                WHERE cp.user_id = $1 AND cp.left_at IS NULL AND c.is_active = true
                ORDER BY c.last_message_at DESC
            `, [userId]);

            return result.rows;

        } catch (error) {
            throw new Error(`Failed to get user chats: ${error.message}`);
        }
    }
}

module.exports = EnhancedChatService;