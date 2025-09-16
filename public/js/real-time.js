// Real-time features for Talk pAI
class RealTimeManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentUser = null;
    this.currentChat = null;
    this.typingUsers = new Map(); // chatId -> Set of typing users
    this.presenceUsers = new Map(); // userId -> presence info
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.typingTimeout = null;
    this.lastTypingTime = 0;
    this.typingThrottle = 1000; // 1 second throttle

    this.initializeSocket();
    this.setupEventListeners();
  }

  initializeSocket() {
    try {
      // Initialize Socket.IO connection
      this.socket = io({
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 20000,
        forceNew: false
      });

      this.setupSocketListeners();

      console.log('🔌 Socket.IO initialized');
    } catch (error) {
      console.error('❌ Socket.IO initialization failed:', error);
      this.scheduleReconnect();
    }
  }

  setupSocketListeners() {
    // Connection events
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('✅ Connected to server');

      // Authenticate if user is logged in
      if (this.currentUser) {
        this.authenticateUser(this.currentUser);
      }

      this.notifyConnectionChange(true);
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('❌ Disconnected from server:', reason);

      this.notifyConnectionChange(false);

      if (reason === 'io server disconnect') {
        // Server disconnected us, reconnect manually
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 Connection error:', error);
      this.scheduleReconnect();
    });

    // Authentication events
    this.socket.on('authenticated', (data) => {
      console.log('✅ Socket authenticated:', data.user);
      this.showNotification('Connected to real-time services', 'success');
    });

    this.socket.on('auth_error', (data) => {
      console.error('❌ Socket authentication failed:', data);
      this.showNotification('Authentication failed', 'error');
    });

    // Chat events
    this.socket.on('user_joined_chat', (data) => {
      this.handleUserJoinedChat(data);
    });

    this.socket.on('user_left_chat', (data) => {
      this.handleUserLeftChat(data);
    });

    this.socket.on('chat_joined', (data) => {
      console.log('📝 Joined chat:', data);
      this.updateChatParticipants(data.chatId, data.participants);
    });

    // Typing indicators
    this.socket.on('user_typing', (data) => {
      this.handleUserTyping(data);
    });

    this.socket.on('user_stopped_typing', (data) => {
      this.handleUserStoppedTyping(data);
    });

    // Message events
    this.socket.on('message_reaction_added', (data) => {
      this.handleMessageReaction(data);
    });

    this.socket.on('message_read_status', (data) => {
      this.handleMessageReadStatus(data);
    });

    // Presence events
    this.socket.on('user_online', (data) => {
      this.handleUserOnline(data);
    });

    this.socket.on('user_offline', (data) => {
      this.handleUserOffline(data);
    });

    this.socket.on('user_presence_changed', (data) => {
      this.handlePresenceChange(data);
    });

    // Error handling
    this.socket.on('join_chat_error', (data) => {
      console.error('❌ Failed to join chat:', data);
      this.showNotification('Failed to join chat', 'error');
    });
  }

  setupEventListeners() {
    // Message input typing detection
    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('message-input')) {
        this.handleTypingInput();
      }
    });

    // Stop typing when user stops typing or sends message
    document.addEventListener('keydown', (e) => {
      if (e.target.classList.contains('message-input')) {
        if (e.key === 'Enter' && !e.shiftKey) {
          this.stopTyping();
        }
      }
    });

    // Page visibility change to update presence
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.updatePresence('away', 'Away from keyboard');
      } else {
        this.updatePresence('online');
      }
    });

    // Heartbeat to maintain connection
    setInterval(() => {
      if (this.isConnected && this.socket) {
        this.socket.emit('ping');
      }
    }, 30000); // Every 30 seconds
  }

  // Authentication
  authenticateUser(user) {
    this.currentUser = user;

    if (this.socket && this.isConnected) {
      this.socket.emit('authenticate', {
        userId: user.id,
        nickname: user.nickname,
        token: localStorage.getItem('token') // Include auth token
      });
    }
  }

  // Chat management
  joinChat(chatId) {
    if (!this.currentUser || !this.isConnected) return;

    this.currentChat = chatId;
    this.socket.emit('join_chat', {
      chatId,
      userId: this.currentUser.id
    });
  }

  leaveChat(chatId) {
    if (!this.currentUser || !this.isConnected) return;

    this.socket.emit('leave_chat', {
      chatId,
      userId: this.currentUser.id
    });

    if (this.currentChat === chatId) {
      this.currentChat = null;
    }
  }

  // Typing indicators
  handleTypingInput() {
    if (!this.currentChat || !this.currentUser || !this.isConnected) return;

    const now = Date.now();

    // Throttle typing events
    if (now - this.lastTypingTime < this.typingThrottle) return;

    this.lastTypingTime = now;

    // Send typing start event
    this.socket.emit('typing_start', {
      chatId: this.currentChat,
      userId: this.currentUser.id,
      nickname: this.currentUser.nickname
    });

    // Clear existing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Set new timeout to stop typing
    this.typingTimeout = setTimeout(() => {
      this.stopTyping();
    }, 2000);
  }

  stopTyping() {
    if (!this.currentChat || !this.currentUser || !this.isConnected) return;

    this.socket.emit('typing_stop', {
      chatId: this.currentChat,
      userId: this.currentUser.id
    });

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
  }

  handleUserTyping(data) {
    const { chatId, userId, nickname } = data;

    if (userId === this.currentUser?.id) return; // Don't show own typing

    if (!this.typingUsers.has(chatId)) {
      this.typingUsers.set(chatId, new Set());
    }

    this.typingUsers.get(chatId).add({ userId, nickname });
    this.updateTypingIndicator(chatId);
  }

  handleUserStoppedTyping(data) {
    const { chatId, userId } = data;

    if (this.typingUsers.has(chatId)) {
      const typingSet = this.typingUsers.get(chatId);
      typingSet.delete(Array.from(typingSet).find(user => user.userId === userId));

      if (typingSet.size === 0) {
        this.typingUsers.delete(chatId);
      }
    }

    this.updateTypingIndicator(chatId);
  }

  updateTypingIndicator(chatId) {
    const typingIndicator = document.querySelector(`#typing-indicator-${chatId}`);
    if (!typingIndicator) return;

    const typingSet = this.typingUsers.get(chatId);

    if (!typingSet || typingSet.size === 0) {
      typingIndicator.style.display = 'none';
      return;
    }

    const typingNames = Array.from(typingSet).map(user => user.nickname);
    let text;

    if (typingNames.length === 1) {
      text = `${typingNames[0]} is typing...`;
    } else if (typingNames.length === 2) {
      text = `${typingNames[0]} and ${typingNames[1]} are typing...`;
    } else {
      text = `${typingNames[0]} and ${typingNames.length - 1} others are typing...`;
    }

    typingIndicator.innerHTML = `
      <div class="typing-indicator">
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span class="typing-text">${text}</span>
      </div>
    `;
    typingIndicator.style.display = 'block';
  }

  // Message reactions
  addMessageReaction(messageId, reaction) {
    if (!this.currentChat || !this.currentUser || !this.isConnected) return;

    this.socket.emit('message_reaction', {
      messageId,
      chatId: this.currentChat,
      reaction,
      userId: this.currentUser.id
    });
  }

  handleMessageReaction(data) {
    const { messageId, reaction, userId, nickname } = data;
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);

    if (messageElement) {
      this.addReactionToMessage(messageElement, reaction, userId, nickname);
    }
  }

  addReactionToMessage(messageElement, reaction, userId, nickname) {
    let reactionsContainer = messageElement.querySelector('.message-reactions');

    if (!reactionsContainer) {
      reactionsContainer = document.createElement('div');
      reactionsContainer.className = 'message-reactions';
      messageElement.appendChild(reactionsContainer);
    }

    // Add or update reaction
    const existingReaction = reactionsContainer.querySelector(`[data-reaction="${reaction}"]`);
    if (existingReaction) {
      const count = existingReaction.querySelector('.reaction-count');
      count.textContent = parseInt(count.textContent) + 1;
    } else {
      const reactionElement = document.createElement('div');
      reactionElement.className = 'message-reaction';
      reactionElement.dataset.reaction = reaction;
      reactionElement.innerHTML = `
        <span class="reaction-emoji">${reaction}</span>
        <span class="reaction-count">1</span>
      `;
      reactionsContainer.appendChild(reactionElement);
    }
  }

  // Message read status
  markMessageAsRead(messageId) {
    if (!this.currentChat || !this.currentUser || !this.isConnected) return;

    this.socket.emit('message_read', {
      messageId,
      chatId: this.currentChat,
      userId: this.currentUser.id
    });
  }

  handleMessageReadStatus(data) {
    const { messageId, readBy, nickname } = data;
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);

    if (messageElement) {
      this.updateMessageReadStatus(messageElement, readBy, nickname);
    }
  }

  updateMessageReadStatus(messageElement, readBy, nickname) {
    let readStatus = messageElement.querySelector('.message-read-status');

    if (!readStatus) {
      readStatus = document.createElement('div');
      readStatus.className = 'message-read-status';
      messageElement.appendChild(readStatus);
    }

    readStatus.innerHTML = `<span class="read-by">Read by ${nickname}</span>`;
    readStatus.classList.add('visible');
  }

  // Presence management
  updatePresence(status, customMessage = '') {
    if (!this.isConnected || !this.currentUser) return;

    this.socket.emit('presence_update', {
      status,
      customMessage
    });
  }

  handleUserOnline(data) {
    const { userId, nickname } = data;
    this.presenceUsers.set(userId, {
      status: 'online',
      nickname,
      lastSeen: new Date()
    });

    this.updateUserPresenceUI(userId, 'online');
    this.showNotification(`${nickname} came online`, 'info', 3000);
  }

  handleUserOffline(data) {
    const { userId, nickname } = data;
    this.presenceUsers.set(userId, {
      status: 'offline',
      nickname,
      lastSeen: new Date()
    });

    this.updateUserPresenceUI(userId, 'offline');
  }

  handlePresenceChange(data) {
    const { userId, nickname, status, customMessage } = data;
    this.presenceUsers.set(userId, {
      status,
      nickname,
      customMessage,
      lastSeen: new Date()
    });

    this.updateUserPresenceUI(userId, status);
  }

  updateUserPresenceUI(userId, status) {
    const userElements = document.querySelectorAll(`[data-user-id="${userId}"]`);

    userElements.forEach(element => {
      const statusIndicator = element.querySelector('.user-status');
      if (statusIndicator) {
        statusIndicator.className = `user-status ${status}`;
        statusIndicator.title = status.charAt(0).toUpperCase() + status.slice(1);
      }
    });
  }

  // Chat participants
  handleUserJoinedChat(data) {
    const { userId, nickname, chatId } = data;
    this.showNotification(`${nickname} joined the chat`, 'info', 3000);
    this.updateChatParticipants(chatId);
  }

  handleUserLeftChat(data) {
    const { userId, nickname, chatId } = data;
    this.showNotification(`${nickname} left the chat`, 'info', 3000);
    this.updateChatParticipants(chatId);
  }

  updateChatParticipants(chatId, count = null) {
    const participantCounter = document.querySelector(`#participants-${chatId}`);
    if (participantCounter && count !== null) {
      participantCounter.textContent = `${count} participant${count !== 1 ? 's' : ''}`;
    }
  }

  // Utility methods
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.showNotification('Connection lost. Please refresh the page.', 'error');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (this.socket) {
        this.socket.connect();
      }
    }, delay);
  }

  notifyConnectionChange(connected) {
    const event = new CustomEvent('connectionChange', {
      detail: { connected, socket: this.socket }
    });
    document.dispatchEvent(event);
  }

  showNotification(message, type = 'info', duration = 5000) {
    if (window.UI && window.UI.createNotification) {
      window.UI.createNotification(message, type, duration);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // Public API
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      user: this.currentUser,
      currentChat: this.currentChat,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  getUserPresence(userId) {
    return this.presenceUsers.get(userId) || { status: 'unknown' };
  }

  getTypingUsers(chatId) {
    return Array.from(this.typingUsers.get(chatId) || []);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.currentUser = null;
    this.currentChat = null;
  }
}

// Initialize global real-time manager
window.RealTime = new RealTimeManager();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RealTimeManager;
}