const express = require('express');
const ChatService = require('./service');
const AuthService = require('../auth/service');
const uploadMiddleware = require('../middleware/upload');

class ChatRoutes {
  constructor() {
    this.router = express.Router();
    this.chatService = new ChatService();
    this.authService = new AuthService();
    this.setupRoutes();
  }

  setupRoutes() {
    // Apply authentication middleware to all routes
    this.router.use(this.authenticate.bind(this));

    // Chat management
    this.router.post('/create', this.createChat.bind(this));
    this.router.get('/my-chats', this.getUserChats.bind(this));
    this.router.get('/:chatId/messages', this.getChatMessages.bind(this));

    // Messaging
    this.router.post('/:chatId/messages', this.sendMessage.bind(this));
    this.router.post('/:chatId/audio', uploadMiddleware.handleAudioUpload(), this.sendAudioMessage.bind(this));
    this.router.delete('/messages/:messageId', this.deleteMessage.bind(this));

    // Participants management
    this.router.post('/:chatId/participants', this.addParticipant.bind(this));
    this.router.delete('/:chatId/participants/:userId', this.removeParticipant.bind(this));

    // User search
    this.router.get('/search/users', this.searchUsers.bind(this));
  }

  async authenticate(req, res, next) {
    try {
      const token = req.headers['authorization']?.split(' ')[1];
      const user = await this.authService.authenticate(token);
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ error: error.message });
    }
  }

  async createChat(req, res) {
    try {
      const { name, type, participants } = req.body;
      const userId = req.user.id;

      const chat = await this.chatService.createChat({
        name,
        type,
        createdBy: userId,
        participants: participants || []
      });

      res.json({
        success: true,
        chat
      });
    } catch (error) {
      console.error('Create chat error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async getUserChats(req, res) {
    try {
      const userId = req.user.id;
      const chats = await this.chatService.getUserChats(userId);

      res.json({
        success: true,
        chats
      });
    } catch (error) {
      console.error('Get user chats error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getChatMessages(req, res) {
    try {
      const { chatId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      const userId = req.user.id;

      const messages = await this.chatService.getChatMessages(
        parseInt(chatId),
        userId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        messages
      });
    } catch (error) {
      console.error('Get chat messages error:', error);
      res.status(403).json({ error: error.message });
    }
  }

  async sendMessage(req, res) {
    try {
      const { chatId } = req.params;
      const { content, messageType, replyTo } = req.body;
      const userId = req.user.id;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Message content is required' });
      }

      const message = await this.chatService.sendMessage({
        chatId: parseInt(chatId),
        userId,
        content: content.trim(),
        messageType,
        replyTo
      });

      // Emit to Socket.io
      const io = req.app.get('io');
      if (io) {
        io.to(`chat_${chatId}`).emit('new_message', {
          chatId: parseInt(chatId),
          message
        });
      }

      res.json({
        success: true,
        message
      });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(403).json({ error: error.message });
    }
  }

  async sendAudioMessage(req, res) {
    try {
      const { chatId } = req.params;
      const { duration, replyTo } = req.body;
      const userId = req.user.id;
      const audioFile = req.file;

      if (!audioFile) {
        return res.status(400).json({ error: 'Audio file is required' });
      }

      const message = await this.chatService.sendAudioMessage({
        chatId: parseInt(chatId),
        userId,
        audioFile,
        duration: duration ? parseInt(duration) : null,
        replyTo: replyTo ? parseInt(replyTo) : null
      });

      // Emit to Socket.io
      const io = req.app.get('io');
      if (io) {
        io.to(`chat_${chatId}`).emit('new_message', {
          chatId: parseInt(chatId),
          message,
          type: 'audio'
        });
      }

      res.json({
        success: true,
        message,
        audioUrl: message.file_url
      });
    } catch (error) {
      console.error('Send audio message error:', error);
      res.status(403).json({ error: error.message });
    }
  }

  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user.id;

      const result = await this.chatService.deleteMessage(parseInt(messageId), userId);

      // Emit to Socket.io
      const io = req.app.get('io');
      if (io) {
        io.emit('message_deleted', {
          messageId: parseInt(messageId),
          userId
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Delete message error:', error);
      res.status(403).json({ error: error.message });
    }
  }

  async addParticipant(req, res) {
    try {
      const { chatId } = req.params;
      const { userId: newParticipantId, role } = req.body;
      const userId = req.user.id;

      const result = await this.chatService.addParticipant(
        parseInt(chatId),
        userId,
        newParticipantId,
        role
      );

      // Emit to Socket.io
      const io = req.app.get('io');
      if (io) {
        io.to(`chat_${chatId}`).emit('participant_added', {
          chatId: parseInt(chatId),
          participantId: newParticipantId,
          addedBy: userId
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Add participant error:', error);
      res.status(403).json({ error: error.message });
    }
  }

  async removeParticipant(req, res) {
    try {
      const { chatId, userId: participantId } = req.params;
      const userId = req.user.id;

      const result = await this.chatService.removeParticipant(
        parseInt(chatId),
        userId,
        parseInt(participantId)
      );

      // Emit to Socket.io
      const io = req.app.get('io');
      if (io) {
        io.to(`chat_${chatId}`).emit('participant_removed', {
          chatId: parseInt(chatId),
          participantId: parseInt(participantId),
          removedBy: userId
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Remove participant error:', error);
      res.status(403).json({ error: error.message });
    }
  }

  async searchUsers(req, res) {
    try {
      const { q: query, limit } = req.query;

      if (!query || query.length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters' });
      }

      const users = await this.chatService.searchUsers(query, parseInt(limit) || 10);

      res.json({
        success: true,
        users
      });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = ChatRoutes;