const database = require('../database/connection');
const AudioService = require('../audio/service');

class ChatService {
  constructor() {
    this.useDatabase = database.isConnected;
    this.audioService = new AudioService();
  }

  async createChat({ name, type = 'private', createdBy, participants = [] }) {
    if (!this.useDatabase) {
      throw new Error('Database required for chat functionality');
    }

    return await database.transaction(async (client) => {
      // Create chat
      const chatResult = await client.query(`
        INSERT INTO chats (name, type, created_by)
        VALUES ($1, $2, $3)
        RETURNING id, name, type, created_by, created_at
      `, [name, type, createdBy]);

      const chat = chatResult.rows[0];

      // Add creator as participant
      await client.query(`
        INSERT INTO chat_participants (chat_id, user_id, role)
        VALUES ($1, $2, 'admin')
      `, [chat.id, createdBy]);

      // Add other participants
      for (const participantId of participants) {
        if (participantId !== createdBy) {
          await client.query(`
            INSERT INTO chat_participants (chat_id, user_id, role)
            VALUES ($1, $2, 'member')
            ON CONFLICT (chat_id, user_id) DO NOTHING
          `, [chat.id, participantId]);
        }
      }

      return chat;
    });
  }

  async getUserChats(userId) {
    if (!this.useDatabase) {
      return [];
    }

    const result = await database.query(`
      SELECT c.id, c.name, c.type, c.created_at, c.updated_at,
             cp.role,
             (SELECT COUNT(*) FROM chat_participants WHERE chat_id = c.id) as participant_count,
             (SELECT JSON_AGG(
               JSON_BUILD_OBJECT(
                 'id', u.id,
                 'nickname', u.nickname,
                 'avatar', u.avatar
               )
             ) FROM chat_participants cp2
             JOIN users u ON cp2.user_id = u.id
             WHERE cp2.chat_id = c.id AND u.id != $1) as other_participants,
             (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
             (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
             (SELECT COUNT(*) FROM messages WHERE chat_id = c.id AND created_at > COALESCE(cp.last_read, '1970-01-01')) as unread_count
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chat_id
      WHERE cp.user_id = $1
      ORDER BY COALESCE(
        (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1),
        c.updated_at
      ) DESC
    `, [userId]);

    return result.rows;
  }

  async getChatMessages(chatId, userId, limit = 50, offset = 0) {
    if (!this.useDatabase) {
      return [];
    }

    // Check if user is participant
    const participantCheck = await database.query(`
      SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2
    `, [chatId, userId]);

    if (participantCheck.rows.length === 0) {
      throw new Error('Access denied: You are not a participant in this chat');
    }

    const result = await database.query(`
      SELECT m.id, m.content, m.message_type, m.created_at, m.updated_at,
             m.reply_to, m.is_deleted, m.file_url, m.file_type, m.file_size, m.duration, m.is_ai_message,
             u.id as user_id, u.nickname, u.avatar,
             CASE WHEN m.reply_to IS NOT NULL THEN
               JSON_BUILD_OBJECT(
                 'id', rm.id,
                 'content', rm.content,
                 'user_nickname', ru.nickname
               )
             ELSE NULL END as reply_message
      FROM messages m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN messages rm ON m.reply_to = rm.id
      LEFT JOIN users ru ON rm.user_id = ru.id
      WHERE m.chat_id = $1 AND m.is_deleted = false
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `, [chatId, limit, offset]);

    return result.rows.reverse(); // Return in chronological order
  }

  async sendMessage({ chatId, userId, content, messageType = 'text', replyTo = null, fileData = null }) {
    if (!this.useDatabase) {
      throw new Error('Database required for messaging');
    }

    // Check if user is participant
    const participantCheck = await database.query(`
      SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2
    `, [chatId, userId]);

    if (participantCheck.rows.length === 0) {
      throw new Error('Access denied: You are not a participant in this chat');
    }

    let result;
    if (fileData) {
      result = await database.query(`
        INSERT INTO messages (chat_id, user_id, content, message_type, reply_to, file_url, file_type, file_size, duration)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, content, message_type, created_at, reply_to, file_url, file_type, file_size, duration
      `, [chatId, userId, content, messageType, replyTo, fileData.fileUrl, fileData.fileType, fileData.fileSize, fileData.duration || null]);
    } else {
      result = await database.query(`
        INSERT INTO messages (chat_id, user_id, content, message_type, reply_to)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, content, message_type, created_at, reply_to
      `, [chatId, userId, content, messageType, replyTo]);
    }

    // Update chat timestamp
    await database.query(`
      UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = $1
    `, [chatId]);

    // Get full message data with user info
    const messageResult = await database.query(`
      SELECT m.id, m.content, m.message_type, m.created_at, m.reply_to,
             m.file_url, m.file_type, m.file_size, m.duration, m.is_ai_message,
             u.id as user_id, u.nickname, u.avatar
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = $1
    `, [result.rows[0].id]);

    return messageResult.rows[0];
  }

  async sendAudioMessage({ chatId, userId, audioFile, duration = null, replyTo = null }) {
    if (!this.useDatabase) {
      throw new Error('Database required for messaging');
    }

    try {
      // Save audio file
      const audioData = await this.audioService.saveAudioFile(audioFile, userId);

      // Send message with audio data
      const message = await this.sendMessage({
        chatId,
        userId,
        content: audioData.originalName || 'Audio message',
        messageType: 'audio',
        replyTo,
        fileData: {
          fileUrl: audioData.fileUrl,
          fileType: audioData.fileType,
          fileSize: audioData.fileSize,
          duration: duration
        }
      });

      return {
        ...message,
        audioData
      };
    } catch (error) {
      console.error('Send audio message error:', error);
      throw error;
    }
  }

  async deleteMessage(messageId, userId) {
    if (!this.useDatabase) {
      throw new Error('Database required for messaging');
    }

    const result = await database.query(`
      UPDATE messages
      SET is_deleted = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [messageId, userId]);

    if (result.rows.length === 0) {
      throw new Error('Message not found or access denied');
    }

    return { success: true };
  }

  async addParticipant(chatId, userId, newParticipantId, role = 'member') {
    if (!this.useDatabase) {
      throw new Error('Database required for chat management');
    }

    // Check if user is admin of the chat
    const adminCheck = await database.query(`
      SELECT 1 FROM chat_participants
      WHERE chat_id = $1 AND user_id = $2 AND role IN ('admin', 'owner')
    `, [chatId, userId]);

    if (adminCheck.rows.length === 0) {
      throw new Error('Access denied: Admin privileges required');
    }

    const result = await database.query(`
      INSERT INTO chat_participants (chat_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (chat_id, user_id) DO NOTHING
      RETURNING id
    `, [chatId, newParticipantId, role]);

    return { success: true, added: result.rows.length > 0 };
  }

  async removeParticipant(chatId, userId, participantId) {
    if (!this.useDatabase) {
      throw new Error('Database required for chat management');
    }

    // Check if user is admin or removing themselves
    const canRemove = await database.query(`
      SELECT 1 FROM chat_participants
      WHERE chat_id = $1 AND user_id = $2
      AND (role IN ('admin', 'owner') OR user_id = $3)
    `, [chatId, userId, participantId]);

    if (canRemove.rows.length === 0) {
      throw new Error('Access denied: Cannot remove this participant');
    }

    await database.query(`
      DELETE FROM chat_participants
      WHERE chat_id = $1 AND user_id = $2
    `, [chatId, participantId]);

    return { success: true };
  }

  async searchUsers(query, limit = 10) {
    if (!this.useDatabase) {
      return [];
    }

    const result = await database.query(`
      SELECT id, nickname, avatar
      FROM users
      WHERE nickname ILIKE $1 AND is_active = true
      ORDER BY nickname
      LIMIT $2
    `, [`%${query}%`, limit]);

    return result.rows;
  }
}

module.exports = ChatService;