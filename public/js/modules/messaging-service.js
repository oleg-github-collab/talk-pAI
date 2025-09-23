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
        this.ready = false;

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

            this.ready = true;
            document.dispatchEvent(new CustomEvent('messaging-service:ready', {
                detail: this
            }));

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
                return await this.loadDemoChats();
            }

            const response = await fetch('/api/messages/chats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.chats.clear();
                    data.chats.forEach(chat => {
                        this.chats.set(chat.id.toString(), chat);
                    });
                    this.updateChatsList();
                    return data.chats;
                }
            }

            // Fallback to demo chats
            return await this.loadDemoChats();

        } catch (error) {
            console.error('❌ Failed to load chats:', error);
            return await this.loadDemoChats();
        }
    }

    async loadDemoChats() {
        try {
            const response = await fetch('/api/messages/demo/chats');
            const data = await response.json();

            if (data.success) {
                this.chats.clear();
                data.chats.forEach(chat => {
                    this.chats.set(chat.id.toString(), chat);
                });
                this.updateChatsList();
                return data.chats;
            }
        } catch (error) {
            console.error('❌ Failed to load demo chats:', error);
        }

        return [];
    }

    updateChatsList() {
        const chatList = document.getElementById('chatList') || document.querySelector('.chat-list');
        if (!chatList) return;

        chatList.innerHTML = '';

        this.chats.forEach((chat) => {
            const chatElement = this.createChatElement(chat);
            chatList.appendChild(chatElement);
        });

        if (!this.currentChatId && this.chats.size > 0) {
            const firstChatId = this.chats.keys().next().value;
            if (firstChatId) {
                this.selectChat(firstChatId);
            }
        }
    }

    createChatElement(chat) {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'chat-item';
        item.dataset.chat = chat.id;

        if (chat.participants) {
            item.dataset.participants = JSON.stringify(chat.participants);
        }

        const avatar = chat.avatar || chat.name?.charAt(0)?.toUpperCase() || '💬';
        const lastMessage = chat.lastMessage || 'No messages yet';
        const time = chat.lastMessageTime ? this.formatTime(chat.lastMessageTime) : '';
        const unread = chat.unreadCount ? `<div class="chat-unread">${chat.unreadCount}</div>` : '';

        item.innerHTML = `
            <div class="chat-avatar">${avatar}</div>
            <div class="chat-info">
                <div class="chat-name">${chat.name || 'Chat'}</div>
                <div class="chat-preview">${lastMessage}</div>
            </div>
            <div class="chat-meta">
                <div class="chat-time">${time}</div>
                ${unread}
            </div>
        `;

        item.addEventListener('click', (event) => {
            event.preventDefault();
            this.selectChat(chat.id);
        });

        return item;
    }

    async selectChat(chatId) {
        if (!chatId) return;

        // Update UI
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });

        const selectedChatElement = document.querySelector(`[data-chat="${chatId}"]`);
        if (selectedChatElement) {
            selectedChatElement.classList.add('active');
        }

        const previousChatId = this.currentChatId;
        this.currentChatId = chatId.toString();

        // Leave current chat room
        if (previousChatId && this.isConnected) {
            this.socket.emit('leave-chat', previousChatId);
        }

        // Join new chat room
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
                    const normalizedMessages = data.messages.map(msg => ({
                        ...msg,
                        chatId
                    }));

                    this.messages.set(chatId.toString(), normalizedMessages);
                    this.displayMessages(normalizedMessages);
                    return;
                }
            }

            this.loadDemoMessages(chatId);

        } catch (error) {
            console.error('❌ Failed to load messages:', error);
            this.loadDemoMessages(chatId);
        }
    }

    loadDemoMessages(chatId) {
        const demoMessages = [
            {
                id: `demo-${chatId}-1`,
                chatId,
                content: 'Welcome to Talk pAI! 🎉',
                senderId: 'system',
                senderName: 'System',
                senderAvatar: '🤖',
                timestamp: new Date(Date.now() - 3600000),
                messageType: 'text'
            },
            {
                id: `demo-${chatId}-2`,
                chatId,
                content: 'This is a demo message to show the interface.',
                senderId: 'demo-user',
                senderName: 'Demo User',
                senderAvatar: 'DU',
                timestamp: new Date(Date.now() - 1800000),
                messageType: 'text'
            }
        ];

        this.messages.set(chatId.toString(), demoMessages);
        this.displayMessages(demoMessages);
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
        const wrapper = document.createElement('div');
        const isOwnMessage = this.isOwnMessage(message);
        const timestamp = this.formatTime(message.timestamp);

        wrapper.className = `message-group ${isOwnMessage ? 'sent' : 'received'}`;

        if (isOwnMessage) {
            wrapper.innerHTML = `
                <div class="message-bubble">
                    <div class="message-content">${this.escapeHtml(message.content)}</div>
                    <div class="message-states">
                        <svg class="message-check" viewBox="0 0 24 24">
                            <polyline points="20,6 9,17 4,12"></polyline>
                        </svg>
                        <svg class="message-check" viewBox="0 0 24 24">
                            <polyline points="20,6 9,17 4,12"></polyline>
                        </svg>
                        <span>${timestamp}</span>
                    </div>
                </div>
            `;
        } else {
            const avatar = message.senderAvatar || this.getChatAvatar(this.currentChatId);
            const senderName = message.senderName || 'Participant';
            wrapper.innerHTML = `
                <div class="message-bubble">
                    <div class="message-header">
                        <div class="message-avatar">${avatar}</div>
                        <span class="message-sender">${senderName}</span>
                        <span class="message-time">${timestamp}</span>
                    </div>
                    <div class="message-content">${this.escapeHtml(message.content)}</div>
                </div>
            `;
        }

        wrapper.dataset.messageId = message.id;
        return wrapper;
    }

    async sendMessage(content, messageType = 'text') {
        if (!content || content.trim().length === 0) return;
        if (!this.currentChatId) return;

        try {
            const token = localStorage.getItem('talkpai-token');
            let response;
            const payload = {
                content: content.trim(),
                messageType
            };

            if (token) {
                response = await fetch(`/api/messages/chats/${this.currentChatId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
            } else {
                // Demo mode
                response = await fetch('/api/messages/demo/message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ...payload,
                        chatId: this.currentChatId
                    })
                });
            }

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // For demo mode or when socket is unavailable, ensure the message appears
                    if (!this.isConnected || !this.socket) {
                        this.handleIncomingMessage({
                            ...data.message,
                            chatId: this.currentChatId
                        });
                    }
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
        if (!message || !message.chatId) return;

        const chatKey = message.chatId.toString();
        const chatMessages = this.messages.get(chatKey) || [];
        const alreadyExists = chatMessages.some(existing => existing.id === message.id);
        if (!alreadyExists) {
            chatMessages.push(message);
            this.messages.set(chatKey, chatMessages);
        }

        // Update UI if this is the current chat
        if (chatKey === this.currentChatId?.toString()) {
            this.appendMessageToUI(message);
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
            const previewElement = document.querySelector(`[data-chat="${chatId}"] .chat-preview`);
            if (previewElement) {
                previewElement.textContent = message.content;
            }

            const timeElement = document.querySelector(`[data-chat="${chatId}"] .chat-time`);
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

    appendMessageToUI(message) {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        const element = this.createMessageElement(message);
        messagesContainer.appendChild(element);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    isOwnMessage(message) {
        const senderId = message.senderId?.toString();
        const currentUserId = this.currentUser?.id?.toString();
        if (currentUserId && senderId) {
            return senderId === currentUserId;
        }

        return senderId === 'demo-user' || senderId === 'system-self';
    }

    getChatAvatar(chatId) {
        const chat = this.chats.get(chatId?.toString());
        return chat?.avatar || chat?.name?.charAt(0)?.toUpperCase() || '👤';
    }

    setCurrentUser(user) {
        this.currentUser = user;
    }

    getChatsArray() {
        return Array.from(this.chats.values());
    }

    getChatParticipants(chatId) {
        const chat = this.chats.get(chatId?.toString());
        return chat?.participants || [];
    }

    isReady() {
        return this.ready;
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
