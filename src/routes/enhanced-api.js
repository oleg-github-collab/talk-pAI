const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const database = require('../database/optimized-connection');
const Logger = require('../utils/enhanced-logger');

const router = express.Router();
const logger = new Logger('EnhancedAPI');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'audio/mpeg', 'audio/wav', 'audio/ogg',
      'video/mp4', 'video/webm',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'application/zip'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Authentication middleware
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify session token
    const session = await database.query(
      'SELECT s.*, u.* FROM user_sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = ? AND s.is_active = true AND s.expires_at > NOW()',
      [token]
    );

    if (!session.length) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = session[0];

    // Update last activity
    await database.query(
      'UPDATE user_sessions SET last_activity_at = NOW() WHERE session_token = ?',
      [token]
    );

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// ================================
// USER MANAGEMENT ROUTES
// ================================

// Get current user profile
router.get('/user/profile', authenticateUser, async (req, res) => {
  try {
    const user = { ...req.user };
    delete user.password_hash;
    res.json({ user });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.patch('/user/profile', authenticateUser, async (req, res) => {
  try {
    const { display_name, bio, status, status_message, department, position, phone, location, timezone, language } = req.body;

    const updateFields = [];
    const values = [];

    if (display_name !== undefined) { updateFields.push('display_name = ?'); values.push(display_name); }
    if (bio !== undefined) { updateFields.push('bio = ?'); values.push(bio); }
    if (status !== undefined) { updateFields.push('status = ?'); values.push(status); }
    if (status_message !== undefined) { updateFields.push('status_message = ?'); values.push(status_message); }
    if (department !== undefined) { updateFields.push('department = ?'); values.push(department); }
    if (position !== undefined) { updateFields.push('position = ?'); values.push(position); }
    if (phone !== undefined) { updateFields.push('phone = ?'); values.push(phone); }
    if (location !== undefined) { updateFields.push('location = ?'); values.push(location); }
    if (timezone !== undefined) { updateFields.push('timezone = ?'); values.push(timezone); }
    if (language !== undefined) { updateFields.push('language = ?'); values.push(language); }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.user.id);

    await database.query(
      `UPDATE users SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update user preferences
router.patch('/user/preferences', authenticateUser, async (req, res) => {
  try {
    const { theme_preferences, ui_layout, notification_settings, privacy_settings, keyboard_shortcuts } = req.body;

    const updates = {};
    if (theme_preferences) updates.theme_preferences = JSON.stringify(theme_preferences);
    if (ui_layout) updates.ui_layout = JSON.stringify(ui_layout);
    if (notification_settings) updates.notification_settings = JSON.stringify(notification_settings);
    if (privacy_settings) updates.privacy_settings = JSON.stringify(privacy_settings);
    if (keyboard_shortcuts) updates.keyboard_shortcuts = JSON.stringify(keyboard_shortcuts);

    const updateFields = Object.keys(updates).map(key => `${key} = ?`);
    const values = Object.values(updates);
    values.push(req.user.id);

    if (updateFields.length > 0) {
      await database.query(
        `UPDATE users SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      );
    }

    res.json({ success: true, message: 'Preferences updated successfully' });
  } catch (error) {
    logger.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Search users globally
router.get('/users/search', authenticateUser, async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ users: [] });
    }

    const users = await database.query(`
      SELECT id, nickname, display_name, bio, avatar_url, status, department, position
      FROM users
      WHERE (nickname ILIKE ? OR display_name ILIKE ?)
        AND is_active = true
        AND id != ?
      ORDER BY
        CASE WHEN nickname ILIKE ? THEN 1 ELSE 2 END,
        display_name
      LIMIT ?
    `, [`%${q}%`, `%${q}%`, req.user.id, `${q}%`, parseInt(limit)]);

    res.json({ users });
  } catch (error) {
    logger.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Upload avatar
router.post('/user/avatar', authenticateUser, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;

    await database.query(
      'UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?',
      [avatarUrl, req.user.id]
    );

    res.json({ success: true, avatar_url: avatarUrl });
  } catch (error) {
    logger.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// ================================
// CHAT MANAGEMENT ROUTES
// ================================

// Get all chats for user
router.get('/chats', authenticateUser, async (req, res) => {
  try {
    const chats = await database.query(`
      SELECT
        c.*,
        cp.is_pinned,
        cp.is_muted,
        cp.is_hidden,
        cp.last_read_at,
        cp.notification_level,
        (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id AND m.created_at > cp.last_read_at) as unread_count,
        (SELECT content FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
        (SELECT m.created_at FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM chat_participants cp2 WHERE cp2.chat_id = c.id) as participant_count
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chat_id
      WHERE cp.user_id = ? AND cp.is_hidden = false
      ORDER BY
        cp.is_pinned DESC,
        COALESCE((SELECT m.created_at FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1), c.created_at) DESC
    `, [req.user.id]);

    // Get participants for each chat
    for (const chat of chats) {
      const participants = await database.query(`
        SELECT u.id, u.nickname, u.display_name, u.avatar_url, u.status, cp.role
        FROM chat_participants cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.chat_id = ?
      `, [chat.id]);

      chat.participants = participants;
    }

    res.json({ chats });
  } catch (error) {
    logger.error('Get chats error:', error);
    res.status(500).json({ error: 'Failed to get chats' });
  }
});

// Create new chat
router.post('/chats', authenticateUser, async (req, res) => {
  try {
    const { type, name, description, participant_ids = [], is_private = false } = req.body;

    // Create chat
    const chatResult = await database.query(`
      INSERT INTO chats (type, name, description, is_private, created_by)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `, [type, name, description, is_private, req.user.id]);

    const chat = chatResult[0];

    // Add creator as owner
    await database.query(`
      INSERT INTO chat_participants (chat_id, user_id, role)
      VALUES (?, ?, 'owner')
    `, [chat.id, req.user.id]);

    // Add other participants
    for (const participantId of participant_ids) {
      await database.query(`
        INSERT INTO chat_participants (chat_id, user_id, role)
        VALUES (?, ?, 'member')
      `, [chat.id, participantId]);
    }

    res.json({ success: true, chat });
  } catch (error) {
    logger.error('Create chat error:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Get chat details
router.get('/chats/:chatId', authenticateUser, async (req, res) => {
  try {
    const { chatId } = req.params;

    // Verify user has access to chat
    const access = await database.query(`
      SELECT * FROM chat_participants
      WHERE chat_id = ? AND user_id = ?
    `, [chatId, req.user.id]);

    if (!access.length) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const chat = await database.query('SELECT * FROM chats WHERE id = ?', [chatId]);

    if (!chat.length) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Get participants
    const participants = await database.query(`
      SELECT u.id, u.nickname, u.display_name, u.avatar_url, u.status, cp.role, cp.joined_at
      FROM chat_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.chat_id = ?
      ORDER BY cp.role, u.display_name
    `, [chatId]);

    // Get pinned messages
    const pinnedMessages = await database.query(`
      SELECT m.*, u.nickname as sender_nickname, u.display_name as sender_display_name, u.avatar_url as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = ? AND m.is_pinned = true AND m.is_deleted = false
      ORDER BY m.created_at DESC
    `, [chatId]);

    res.json({
      chat: chat[0],
      participants,
      pinned_messages: pinnedMessages,
      user_access: access[0]
    });
  } catch (error) {
    logger.error('Get chat details error:', error);
    res.status(500).json({ error: 'Failed to get chat details' });
  }
});

// Update chat settings
router.patch('/chats/:chatId/settings', authenticateUser, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { is_pinned, is_muted, notification_level } = req.body;

    const updateFields = [];
    const values = [];

    if (is_pinned !== undefined) { updateFields.push('is_pinned = ?'); values.push(is_pinned); }
    if (is_muted !== undefined) { updateFields.push('is_muted = ?'); values.push(is_muted); }
    if (notification_level !== undefined) { updateFields.push('notification_level = ?'); values.push(notification_level); }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No settings to update' });
    }

    values.push(chatId, req.user.id);

    await database.query(`
      UPDATE chat_participants
      SET ${updateFields.join(', ')}
      WHERE chat_id = ? AND user_id = ?
    `, values);

    res.json({ success: true, message: 'Chat settings updated' });
  } catch (error) {
    logger.error('Update chat settings error:', error);
    res.status(500).json({ error: 'Failed to update chat settings' });
  }
});

// ================================
// MESSAGE ROUTES
// ================================

// Get messages for a chat
router.get('/chats/:chatId/messages', authenticateUser, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 50, before_id, after_id } = req.query;

    // Verify access
    const access = await database.query(`
      SELECT * FROM chat_participants
      WHERE chat_id = ? AND user_id = ?
    `, [chatId, req.user.id]);

    if (!access.length) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let whereClause = 'WHERE m.chat_id = ? AND m.is_deleted = false';
    const queryParams = [chatId];

    if (before_id) {
      whereClause += ' AND m.id < ?';
      queryParams.push(before_id);
    }

    if (after_id) {
      whereClause += ' AND m.id > ?';
      queryParams.push(after_id);
    }

    queryParams.push(parseInt(limit));

    const messages = await database.query(`
      SELECT
        m.*,
        u.nickname as sender_nickname,
        u.display_name as sender_display_name,
        u.avatar_url as sender_avatar,
        u.status as sender_status,
        reply_msg.content as reply_content,
        reply_user.display_name as reply_sender_name,
        (SELECT COUNT(*) FROM message_reactions mr WHERE mr.message_id = m.id) as reaction_count,
        (SELECT json_agg(json_build_object('emoji', emoji, 'count', reaction_count, 'users', users))
         FROM (
           SELECT emoji, COUNT(*) as reaction_count,
                  json_agg(json_build_object('id', u2.id, 'nickname', u2.nickname)) as users
           FROM message_reactions mr2
           JOIN users u2 ON mr2.user_id = u2.id
           WHERE mr2.message_id = m.id
           GROUP BY emoji
         ) reactions) as reactions
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN messages reply_msg ON m.reply_to_id = reply_msg.id
      LEFT JOIN users reply_user ON reply_msg.sender_id = reply_user.id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ?
    `, queryParams);

    // Get file attachments for messages
    for (const message of messages) {
      const attachments = await database.query(`
        SELECT * FROM file_attachments WHERE message_id = ?
      `, [message.id]);
      message.attachments = attachments;

      if (message.content_type === 'voice') {
        const voiceData = await database.query(`
          SELECT * FROM voice_messages WHERE message_id = ?
        `, [message.id]);
        message.voice_data = voiceData[0];
      }
    }

    // Update last read timestamp
    await database.query(`
      UPDATE chat_participants
      SET last_read_at = NOW()
      WHERE chat_id = ? AND user_id = ?
    `, [chatId, req.user.id]);

    res.json({ messages: messages.reverse() });
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Send a message
router.post('/chats/:chatId/messages', authenticateUser, upload.array('files', 5), async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, content_type = 'text', reply_to_id, mentions } = req.body;

    // Verify access
    const access = await database.query(`
      SELECT * FROM chat_participants
      WHERE chat_id = ? AND user_id = ?
    `, [chatId, req.user.id]);

    if (!access.length) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create message
    const messageResult = await database.query(`
      INSERT INTO messages (chat_id, sender_id, content, content_type, reply_to_id)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `, [chatId, req.user.id, content, content_type, reply_to_id || null]);

    const message = messageResult[0];

    // Handle file attachments
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await database.query(`
          INSERT INTO file_attachments (message_id, original_name, stored_name, file_path, file_size, mime_type, file_type, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          message.id,
          file.originalname,
          file.filename,
          file.path,
          file.size,
          file.mimetype,
          file.mimetype.split('/')[0],
          req.user.id
        ]);
      }
    }

    // Handle mentions
    if (mentions && Array.isArray(mentions)) {
      for (const mention of mentions) {
        await database.query(`
          INSERT INTO message_mentions (message_id, user_id, mention_type)
          VALUES (?, ?, 'user')
        `, [message.id, mention.user_id]);
      }
    }

    // Get full message data to return
    const fullMessage = await database.query(`
      SELECT
        m.*,
        u.nickname as sender_nickname,
        u.display_name as sender_display_name,
        u.avatar_url as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `, [message.id]);

    res.json({ success: true, message: fullMessage[0] });
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Add reaction to message
router.post('/messages/:messageId/reactions', authenticateUser, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    await database.query(`
      INSERT INTO message_reactions (message_id, user_id, emoji)
      VALUES (?, ?, ?)
      ON CONFLICT (message_id, user_id, emoji) DO NOTHING
    `, [messageId, req.user.id, emoji]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Add reaction error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Remove reaction from message
router.delete('/messages/:messageId/reactions/:emoji', authenticateUser, async (req, res) => {
  try {
    const { messageId, emoji } = req.params;

    await database.query(`
      DELETE FROM message_reactions
      WHERE message_id = ? AND user_id = ? AND emoji = ?
    `, [messageId, req.user.id, emoji]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Remove reaction error:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// Pin/unpin message
router.patch('/messages/:messageId/pin', authenticateUser, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { is_pinned } = req.body;

    // Check if user has permission to pin messages
    const message = await database.query('SELECT chat_id FROM messages WHERE id = ?', [messageId]);
    if (!message.length) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const access = await database.query(`
      SELECT role FROM chat_participants
      WHERE chat_id = ? AND user_id = ? AND role IN ('owner', 'admin', 'moderator')
    `, [message[0].chat_id, req.user.id]);

    if (!access.length) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await database.query(`
      UPDATE messages SET is_pinned = ? WHERE id = ?
    `, [is_pinned, messageId]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Pin message error:', error);
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

// ================================
// NOTIFICATION ROUTES
// ================================

// Get notifications
router.get('/notifications', authenticateUser, async (req, res) => {
  try {
    const { limit = 50, unread_only = false } = req.query;

    let whereClause = 'WHERE user_id = ?';
    const params = [req.user.id];

    if (unread_only === 'true') {
      whereClause += ' AND is_read = false';
    }

    params.push(parseInt(limit));

    const notifications = await database.query(`
      SELECT * FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `, params);

    res.json({ notifications });
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Mark notification as read
router.patch('/notifications/:notificationId/read', authenticateUser, async (req, res) => {
  try {
    const { notificationId } = req.params;

    await database.query(`
      UPDATE notifications
      SET is_read = true
      WHERE id = ? AND user_id = ?
    `, [notificationId, req.user.id]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/notifications/read-all', authenticateUser, async (req, res) => {
  try {
    await database.query(`
      UPDATE notifications
      SET is_read = true
      WHERE user_id = ? AND is_read = false
    `, [req.user.id]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// ================================
// SEARCH ROUTES
// ================================

// Global search
router.get('/search', authenticateUser, async (req, res) => {
  try {
    const { q, type = 'all', limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ results: [] });
    }

    const results = {
      messages: [],
      users: [],
      chats: []
    };

    if (type === 'all' || type === 'messages') {
      // Search messages in accessible chats
      const messages = await database.query(`
        SELECT
          m.*,
          u.nickname as sender_nickname,
          u.display_name as sender_display_name,
          c.name as chat_name,
          c.type as chat_type
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        JOIN chats c ON m.chat_id = c.id
        JOIN chat_participants cp ON c.id = cp.chat_id
        WHERE cp.user_id = ?
          AND m.content ILIKE ?
          AND m.is_deleted = false
        ORDER BY m.created_at DESC
        LIMIT ?
      `, [req.user.id, `%${q}%`, Math.min(parseInt(limit), 50)]);

      results.messages = messages;
    }

    if (type === 'all' || type === 'users') {
      const users = await database.query(`
        SELECT id, nickname, display_name, bio, avatar_url, status
        FROM users
        WHERE (nickname ILIKE ? OR display_name ILIKE ?)
          AND is_active = true
          AND id != ?
        ORDER BY display_name
        LIMIT ?
      `, [`%${q}%`, `%${q}%`, req.user.id, Math.min(parseInt(limit), 20)]);

      results.users = users;
    }

    if (type === 'all' || type === 'chats') {
      const chats = await database.query(`
        SELECT DISTINCT c.*
        FROM chats c
        JOIN chat_participants cp ON c.id = cp.chat_id
        WHERE cp.user_id = ?
          AND (c.name ILIKE ? OR c.description ILIKE ?)
        ORDER BY c.name
        LIMIT ?
      `, [req.user.id, `%${q}%`, `%${q}%`, Math.min(parseInt(limit), 10)]);

      results.chats = chats;
    }

    res.json({ results });
  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;