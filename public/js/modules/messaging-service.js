/**
 * Talk pAI Messaging Service
 * Handles real-time messaging with WebSocket and API integration
 */

class MessagingService {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.currentChatId = null;
        this.chats = new Map();
        this.messages = new Map();
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        this.init();
    }

    async init() {
        try {
            // Get current user from auth manager
            if (window.auth && window.auth.currentUser) {
                this.currentUser = window.auth.currentUser;
            }

            // Initialize WebSocket connection
            this.initializeSocket();

            // Load initial chats
            await this.loadChats();

            console.log('✅ Messaging service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize messaging service:', error);
        }
    }

    initializeSocket() {
        try {
            this.socket = io();

            this.socket.on('connect', () => {
                console.log('🔌 WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;

                // Join current chat if any
                if (this.currentChatId) {
                    this.joinChat(this.currentChatId);
                }
            });

            this.socket.on('disconnect', () => {
                console.log('🔌 WebSocket disconnected');
                this.isConnected = false;
                this.attemptReconnect();
            });

            this.socket.on('message', (message) => {
                this.handleIncomingMessage(message);
            });

            this.socket.on('user-typing', (data) => {
                this.handleUserTyping(data);
            });

            this.socket.on('user-stopped-typing', (data) => {
                this.handleUserStoppedTyping(data);
            });

            this.socket.on('user-status-updated', (data) => {
                this.handleUserStatusUpdate(data);
            });

        } catch (error) {
            console.error('❌ Failed to initialize WebSocket:', error);
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

            console.log(`🔄 Attempting to reconnect in ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            setTimeout(() => {
                this.initializeSocket();
            }, delay);
        }
    }

    async loadChats() {
        try {
            const token = localStorage.getItem('talkpai-token');
            if (!token) {
                // Load demo chats for unauthenticated users
                return this.loadDemoChats();
            }

            const response = await fetch('/api/messages/chats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    data.chats.forEach(chat => {
                        this.chats.set(chat.id.toString(), chat);
                    });
                    this.updateChatsList();
                    return;
                }
            }

            // Fallback to demo chats
            this.loadDemoChats();

        } catch (error) {
            console.error('❌ Failed to load chats:', error);
            this.loadDemoChats();
        }
    }

    async loadDemoChats() {
        try {
            const response = await fetch('/api/messages/demo/chats');
            const data = await response.json();

            if (data.success) {
                data.chats.forEach(chat => {
                    this.chats.set(chat.id.toString(), chat);
                });
                this.updateChatsList();
            }
        } catch (error) {
            console.error('❌ Failed to load demo chats:', error);
        }
    }

    updateChatsList() {
        const chatsList = document.querySelector('.chats-list');
        if (!chatsList) return;

        chatsList.innerHTML = '';

        this.chats.forEach((chat, chatId) => {
            const chatElement = this.createChatElement(chat);
            chatsList.appendChild(chatElement);
        });
    }

    createChatElement(chat) {
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.dataset.chatId = chat.id;

        div.innerHTML = `
            <div class="chat-avatar">${chat.avatar || chat.name.charAt(0).toUpperCase()}</div>
            <div class="chat-info">
                <div class="chat-name">${chat.name}</div>
                <div class="chat-last-message">${chat.lastMessage || 'No messages yet'}</div>
            </div>
            <div class="chat-meta">
                <div class="chat-time">${this.formatTime(chat.lastMessageTime)}</div>
                ${chat.unreadCount ? `<div class="chat-unread">${chat.unreadCount}</div>` : ''}
            </div>
        `;

        div.addEventListener('click', () => {
            this.selectChat(chat.id);
        });

        return div;
    }

    async selectChat(chatId) {
        // Update UI
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });

        const selectedChatElement = document.querySelector(`[data-chat-id="${chatId}"]`);
        if (selectedChatElement) {
            selectedChatElement.classList.add('active');
        }

        // Leave current chat room
        if (this.currentChatId && this.isConnected) {
            this.socket.emit('leave-chat', this.currentChatId);
        }

        // Join new chat room
        this.currentChatId = chatId;
        if (this.isConnected) {
            this.joinChat(chatId);
        }

        // Load messages
        await this.loadMessages(chatId);

        // Update chat header
        this.updateChatHeader(chatId);
    }

    joinChat(chatId) {
        if (this.socket && this.isConnected) {
            this.socket.emit('join-chat', chatId);
        }
    }

    async loadMessages(chatId) {
        try {
            const messagesContainer = document.getElementById('messagesContainer');
            if (!messagesContainer) return;

            // Show loading state
            messagesContainer.innerHTML = '<div class="loading-messages">Loading messages...</div>';

            const token = localStorage.getItem('talkpai-token');
            let response;

            if (token) {
                response = await fetch(`/api/messages/chats/${chatId}/messages`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            } else {
                // For demo users, we'll create some demo messages
                this.loadDemoMessages(chatId);
                return;
            }

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.displayMessages(data.messages);
                    this.messages.set(chatId, data.messages);
                }
            } else {
                this.loadDemoMessages(chatId);
            }

        } catch (error) {
            console.error('❌ Failed to load messages:', error);
            this.loadDemoMessages(chatId);
        }
    }

    loadDemoMessages(chatId) {
        const demoMessages = [
            {
                id: 1,
                content: 'Welcome to Talk pAI! 🎉',
                senderId: 'system',
                senderName: 'System',
                senderAvatar: '🤖',
                timestamp: new Date(Date.now() - 3600000),
                messageType: 'text'
            },
            {
                id: 2,
                content: 'This is a demo message to show the interface.',
                senderId: 'demo-user',
                senderName: 'Demo User',
                senderAvatar: 'DU',
                timestamp: new Date(Date.now() - 1800000),
                messageType: 'text'
            }
        ];

        this.displayMessages(demoMessages);
        this.messages.set(chatId, demoMessages);
    }

    displayMessages(messages) {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        messagesContainer.innerHTML = '';

        messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    createMessageElement(message) {
        const div = document.createElement('div');
        const isOwnMessage = message.senderId === this.currentUser?.id || message.senderId === 'demo-user';

        div.className = `message ${isOwnMessage ? 'own-message' : 'other-message'}`;

        div.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <span class="sender-name">${message.senderName}</span>
                    <span class="message-time">${this.formatTime(message.timestamp)}</span>
                </div>
                <div class="message-text">${this.escapeHtml(message.content)}</div>
            </div>
        `;

        return div;
    }

    async sendMessage(content, messageType = 'text') {
        if (!content || content.trim().length === 0) return;
        if (!this.currentChatId) return;

        try {
            const token = localStorage.getItem('talkpai-token');
            let response;

            if (token) {
                response = await fetch(`/api/messages/chats/${this.currentChatId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        content: content.trim(),
                        messageType
                    })
                });
            } else {
                // Demo mode
                response = await fetch('/api/messages/demo/message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        content: content.trim(),
                        messageType,
                        chatId: this.currentChatId
                    })
                });
            }

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Message will be received via WebSocket, so we don't need to add it manually
                    console.log('✅ Message sent successfully');
                }
            } else {
                throw new Error('Failed to send message');
            }

        } catch (error) {
            console.error('❌ Failed to send message:', error);
            this.showError('Failed to send message. Please try again.');
        }
    }

    handleIncomingMessage(message) {
        // Add to messages cache
        const chatMessages = this.messages.get(message.chatId.toString()) || [];
        chatMessages.push(message);
        this.messages.set(message.chatId.toString(), chatMessages);

        // Update UI if this is the current chat
        if (message.chatId.toString() === this.currentChatId) {
            const messageElement = this.createMessageElement(message);
            const messagesContainer = document.getElementById('messagesContainer');
            if (messagesContainer) {
                messagesContainer.appendChild(messageElement);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }

        // Update chat list
        this.updateChatLastMessage(message.chatId, message);

        // Play notification sound
        this.playNotificationSound();
    }

    updateChatLastMessage(chatId, message) {
        const chat = this.chats.get(chatId.toString());
        if (chat) {
            chat.lastMessage = message.content;
            chat.lastMessageTime = message.timestamp;

            // Update in UI
            const chatElement = document.querySelector(`[data-chat-id="${chatId}"] .chat-last-message`);
            if (chatElement) {
                chatElement.textContent = message.content;
            }

            const timeElement = document.querySelector(`[data-chat-id="${chatId}"] .chat-time`);
            if (timeElement) {
                timeElement.textContent = this.formatTime(message.timestamp);
            }
        }
    }

    updateChatHeader(chatId) {
        const chat = this.chats.get(chatId.toString());
        if (!chat) return;

        const chatHeaderName = document.querySelector('.chat-header-name');
        if (chatHeaderName) {
            chatHeaderName.textContent = chat.name;
        }

        const chatHeaderStatus = document.querySelector('.chat-header-status');
        if (chatHeaderStatus) {
            chatHeaderStatus.textContent = chat.type === 'ai' ? 'AI Assistant' : 'Online';
        }
    }

    handleUserTyping(data) {
        // Show typing indicator
        console.log(`${data.username} is typing...`);
    }

    handleUserStoppedTyping(data) {
        // Hide typing indicator
        console.log(`${data.userId} stopped typing`);
    }

    handleUserStatusUpdate(data) {
        // Update user status in UI
        console.log('User status updated:', data);
    }

    startTyping() {
        if (this.socket && this.isConnected && this.currentChatId && this.currentUser) {
            this.socket.emit('typing-start', {
                chatId: this.currentChatId,
                userId: this.currentUser.id,
                username: this.currentUser.displayName || this.currentUser.nickname
            });
        }
    }

    stopTyping() {
        if (this.socket && this.isConnected && this.currentChatId && this.currentUser) {
            this.socket.emit('typing-stop', {
                chatId: this.currentChatId,
                userId: this.currentUser.id
            });
        }
    }

    playNotificationSound() {
        // Simple notification sound
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMgAzuB0fPQeCcJJInO8N8=');
            audio.volume = 0.3;
            audio.play().catch(() => {}); // Ignore autoplay errors
        } catch (error) {
            // Ignore audio errors
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;

        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        // Show error notification
        console.error(message);

        // You can implement a toast notification here
        if (window.showNotification) {
            window.showNotification(message, 'error');
        }
    }
}

// Initialize messaging service when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.messagingService = new MessagingService();
});