/**
 * TalkPAI Messenger Core Module
 * Central messenger management and initialization
 */

class TalkPAIMessenger {
    constructor() {
        this.currentTheme = localStorage.getItem('talkpai-theme') || 'light';
        this.sidebarCollapsed = localStorage.getItem('talkpai-sidebar-collapsed') === 'true';
        this.chatListOpen = false;
        this.currentChat = '1';
        this.isTyping = false;
        this.messages = [];

        // Call state
        this.callState = 'idle'; // idle, calling, connected, incoming
        this.callType = null; // voice, video
        this.callTimer = null;
        this.callStartTime = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isMuted = false;
        this.isVideoOn = true;
        this.isSpeakerOn = false;
        this.isScreenSharing = false;

        // Drag and drop state
        this.dragCounter = 0;
        this.selectedFiles = [];
        this.isDragActive = false;

        // Modal state
        this.activeModals = [];

        this.init();
    }

    init() {
        this.setupTheme();
        this.setupSidebar();
        this.autoResize();
        this.loadDemoData();

        // Initialize external components
        if (window.themeCustomizer) {
            window.themeCustomizer.onThemeChange = (theme) => {
                this.applyTheme(theme);
            };
        }

        console.log('🚀 Talk pAI Messenger initialized with award-winning design!');
    }

    setupTheme() {
        document.body.setAttribute('data-theme', this.currentTheme);
    }

    setupSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (this.sidebarCollapsed) {
            sidebar.classList.add('collapsed');
        }
    }

    // Core toggle methods
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        this.sidebarCollapsed = !this.sidebarCollapsed;
        localStorage.setItem('talkpai-sidebar-collapsed', this.sidebarCollapsed);

        // Add smooth animation with magnetic effect
        this.addMagneticEffect();
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('talkpai-theme', this.currentTheme);

        // Add divine theme morphing animation
        this.triggerThemeMorph();
    }

    // Error handling and logging
    handleError(error, context = 'Unknown') {
        console.error(`[TalkPAI ${context}]`, error);

        // Enhanced error logging for debugging
        const errorDetails = {
            timestamp: new Date().toISOString(),
            context,
            message: error.message || 'Unknown error',
            stack: error.stack,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Store error for debugging (in production, send to logging service)
        const errors = JSON.parse(localStorage.getItem('talkpai-errors') || '[]');
        errors.push(errorDetails);

        // Keep only last 50 errors to prevent storage overflow
        if (errors.length > 50) {
            errors.splice(0, errors.length - 50);
        }

        localStorage.setItem('talkpai-errors', JSON.stringify(errors));

        // Show user-friendly error notification
        this.showErrorNotification('An error occurred. Please try again.');
    }

    showErrorNotification(message) {
        // Create temporary error notification
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #EF4444, #DC2626);
            color: white;
            padding: 12px 24px;
            border-radius: 12px;
            z-index: 10000;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 10px 40px rgba(239, 68, 68, 0.3);
            backdrop-filter: blur(20px);
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        });

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 5000);
    }

    // Enhanced performance logging
    logPerformance(operation, startTime) {
        const duration = performance.now() - startTime;
        console.log(`[TalkPAI Performance] ${operation}: ${duration.toFixed(2)}ms`);

        if (duration > 100) {
            console.warn(`[TalkPAI Performance Warning] ${operation} took ${duration.toFixed(2)}ms`);
        }
    }

    // Animation effects
    addMagneticEffect() {
        const sidebar = document.getElementById('sidebar');
        sidebar.style.transform = 'scale(0.98)';

        setTimeout(() => {
            sidebar.style.transform = 'scale(1)';
        }, 150);
    }

    triggerThemeMorph() {
        // Add divine particle effect during theme change
        const particles = [];
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: fixed;
                width: 4px;
                height: 4px;
                background: var(--accent-primary);
                border-radius: 50%;
                pointer-events: none;
                z-index: 9999;
                opacity: 0.8;
                transition: all 2s cubic-bezier(0.4, 0, 0.2, 1);
            `;

            const startX = Math.random() * window.innerWidth;
            const startY = Math.random() * window.innerHeight;

            particle.style.left = startX + 'px';
            particle.style.top = startY + 'px';

            document.body.appendChild(particle);
            particles.push(particle);

            // Animate particles
            setTimeout(() => {
                particle.style.transform = `translate(${(Math.random() - 0.5) * 200}px, ${(Math.random() - 0.5) * 200}px) scale(0)`;
                particle.style.opacity = '0';
            }, 50);
        }

        // Cleanup particles
        setTimeout(() => {
            particles.forEach(particle => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            });
        }, 2000);
    }

    // Auto resize functionality
    autoResize() {
        this.autoResizeTextarea(document.getElementById('messageInput'));
    }

    autoResizeTextarea(textarea) {
        if (!textarea) return;

        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    // Call management methods
    toggleMute() {
        this.isMuted = !this.isMuted;
        console.log('🎤 Mute toggled:', this.isMuted);
    }

    toggleVideo() {
        this.isVideoOn = !this.isVideoOn;
        console.log('📹 Video toggled:', this.isVideoOn);
    }

    toggleSpeaker() {
        this.isSpeakerOn = !this.isSpeakerOn;
        console.log('🔊 Speaker toggled:', this.isSpeakerOn);
    }

    toggleScreenShare() {
        this.isScreenSharing = !this.isScreenSharing;
        console.log('🖥️ Screen share toggled:', this.isScreenSharing);
    }

    // Chat management methods
    selectChat(chatId) {
        const startTime = performance.now();

        try {
            // Remove active class from all chat items
            document.querySelectorAll('.chat-item').forEach(item => {
                item.classList.remove('active');
            });

            // Add active class to selected chat
            const activeChat = document.querySelector(`[data-chat="${chatId}"]`);
            if (activeChat) {
                activeChat.classList.add('active');
            }

            // Update current chat
            this.currentChat = chatId;

            // Update chat header
            this.updateChatHeader(chatId);

            // Load chat messages
            this.loadChatMessages(chatId);

            // Close mobile chat list
            if (window.innerWidth <= 768) {
                this.closeMobileChatList();
            }

            this.logPerformance('Chat Selection', startTime);
        } catch (error) {
            this.handleError(error, 'Chat Selection');
        }
    }

    updateChatHeader(chatId) {
        const chatHeaderName = document.querySelector('.chat-header-name');
        const chatHeaderStatus = document.querySelector('.chat-header-status');
        const chatHeaderAvatar = document.querySelector('.chat-header-avatar');

        const chatData = this.getChatData(chatId);

        if (chatHeaderName) chatHeaderName.textContent = chatData.name;
        if (chatHeaderStatus) chatHeaderStatus.textContent = chatData.status;
        if (chatHeaderAvatar) chatHeaderAvatar.textContent = chatData.avatar;
    }

    getChatData(chatId) {
        const chatMap = {
            '1': { name: 'AI Assistant', avatar: 'AI', status: 'Online' },
            '2': { name: 'General Chat', avatar: 'GE', status: 'Active' },
            '3': { name: 'Team Chat', avatar: 'TC', status: 'Available' }
        };
        return chatMap[chatId] || { name: 'Unknown Chat', avatar: '?', status: 'Offline' };
    }

    loadChatMessages(chatId) {
        const container = document.querySelector('.messages-container');
        if (!container) return;

        // Clear existing messages
        container.innerHTML = '';

        // Add demo messages based on chat
        const demoMessages = this.getDemoMessages(chatId);
        demoMessages.forEach(message => {
            this.addMessageToUI(message);
        });

        // Scroll to bottom
        this.scrollToBottom();
    }

    getDemoMessages(chatId) {
        const messagesMap = {
            '1': [
                {
                    id: 1,
                    content: "Welcome to Talk pAI! 🚀 This is an award-winning ultra-modern messaging platform with glassmorphism design, smooth animations, and premium micro-interactions. How can I help you today?",
                    sender: 'other',
                    timestamp: new Date(Date.now() - 300000).toISOString(),
                    avatar: 'AI'
                },
                {
                    id: 2,
                    content: "This looks absolutely incredible! The glassmorphism effects and smooth animations are perfect. 🤩",
                    sender: 'me',
                    timestamp: new Date(Date.now() - 120000).toISOString()
                },
                {
                    id: 3,
                    content: "Thank you! ✨ I'm designed with the latest design trends: glassmorphism, neumorphism, spring animations, and beautiful micro-interactions. Every element is crafted for an award-winning user experience!",
                    sender: 'other',
                    timestamp: new Date(Date.now() - 60000).toISOString(),
                    avatar: 'AI'
                }
            ],
            '2': [
                {
                    id: 4,
                    content: "Welcome to the general chat! This is where everyone can connect and share ideas.",
                    sender: 'other',
                    timestamp: new Date(Date.now() - 180000).toISOString(),
                    avatar: 'GE'
                }
            ],
            '3': [
                {
                    id: 5,
                    content: "Team chat is ready for collaboration! Let's build something amazing together. 🚀",
                    sender: 'other',
                    timestamp: new Date(Date.now() - 240000).toISOString(),
                    avatar: 'TC'
                }
            ]
        };

        return messagesMap[chatId] || [];
    }

    addMessageToUI(message) {
        const container = document.querySelector('.messages-container');
        if (!container) return;

        const messageGroup = document.createElement('div');
        messageGroup.className = `message-group ${message.sender === 'me' ? 'sent' : 'received'}`;

        const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        if (message.sender === 'me') {
            messageGroup.innerHTML = `
                <div class="message-bubble">
                    <div class="message-content">${this.escapeHtml(message.content)}</div>
                    <div class="message-states">
                        <svg class="message-check" viewBox="0 0 24 24">
                            <polyline points="20,6 9,17 4,12"/>
                        </svg>
                        <svg class="message-check" viewBox="0 0 24 24">
                            <polyline points="20,6 9,17 4,12"/>
                        </svg>
                        <span>Read</span>
                    </div>
                </div>
            `;
        } else {
            messageGroup.innerHTML = `
                <div class="message-bubble">
                    <div class="message-header">
                        <div class="message-avatar">${message.avatar || '🤖'}</div>
                        <span class="message-sender">${message.sender === 'other' ? this.getChatData(this.currentChat).name : 'User'}</span>
                        <span class="message-time">${timestamp}</span>
                    </div>
                    <div class="message-content">${this.escapeHtml(message.content)}</div>
                </div>
            `;
        }

        container.appendChild(messageGroup);
        this.scrollToBottom();

        // Add animation
        requestAnimationFrame(() => {
            messageGroup.style.opacity = '0';
            messageGroup.style.transform = 'translateY(20px)';
            messageGroup.style.transition = 'all 0.3s ease';

            requestAnimationFrame(() => {
                messageGroup.style.opacity = '1';
                messageGroup.style.transform = 'translateY(0)';
            });
        });
    }

    sendMessage(content) {
        if (!content || !content.trim()) return;

        const message = {
            id: Date.now(),
            content: content.trim(),
            sender: 'me',
            timestamp: new Date().toISOString()
        };

        this.addMessageToUI(message);
        this.messages.push(message);

        // Simulate AI response after delay
        setTimeout(() => {
            this.simulateAIResponse(content);
        }, 1000 + Math.random() * 2000);
    }

    simulateAIResponse(originalMessage) {
        const responses = [
            "That's interesting! Tell me more about that.",
            "I understand what you mean. How can I help you with that?",
            "Thanks for sharing that with me. What would you like to know?",
            "That sounds great! Is there anything specific you'd like to explore?",
            "I'm here to help! What else can I assist you with?",
            "Fascinating! Could you elaborate on that point?",
            "I see what you're getting at. Let's dive deeper into that."
        ];

        const response = responses[Math.floor(Math.random() * responses.length)];

        const aiMessage = {
            id: Date.now() + 1,
            content: response,
            sender: 'other',
            timestamp: new Date().toISOString(),
            avatar: this.getChatData(this.currentChat).avatar
        };

        this.addMessageToUI(aiMessage);
        this.messages.push(aiMessage);
    }

    scrollToBottom() {
        const container = document.querySelector('.messages-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Navigation methods
    switchNavigation(navType) {
        try {
            // Remove active class from all nav items
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });

            // Add active class to clicked item
            const activeItem = document.querySelector(`[data-nav="${navType}"]`);
            if (activeItem) {
                activeItem.classList.add('active');
            }

            // Handle navigation logic
            this.showView(navType);
        } catch (error) {
            this.handleError(error, 'Navigation');
        }
    }

    showView(viewType) {
        const chatListPanel = document.querySelector('.chat-list-panel');
        const mainChat = document.querySelector('.main-chat');

        switch (viewType) {
            case 'chats':
                if (chatListPanel) chatListPanel.style.display = 'flex';
                if (mainChat) mainChat.style.display = 'flex';
                break;
            case 'contacts':
                this.showContactsModal();
                break;
            case 'profile':
                this.showProfileModal();
                break;
            case 'search':
                this.showSearchModal();
                break;
            case 'settings':
                this.showSettingsModal();
                break;
        }
    }

    // Modal management
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById(modalId + 'Overlay') || document.querySelector('.modal-overlay');

        if (modal && overlay) {
            overlay.classList.add('active');
            modal.classList.add('active');
            this.activeModals.push(modalId);
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById(modalId + 'Overlay') || document.querySelector('.modal-overlay');

        if (modal && overlay) {
            overlay.classList.remove('active');
            modal.classList.remove('active');
            this.activeModals = this.activeModals.filter(id => id !== modalId);
        }
    }

    showContactsModal() {
        this.showModal('userSearchModal');
    }

    showProfileModal() {
        this.showModal('profileModal');
    }

    showSearchModal() {
        this.showModal('userSearchModal');
    }

    showSettingsModal() {
        // Create settings modal dynamically
        this.createSettingsModal();
    }

    createSettingsModal() {
        // Remove existing settings modal
        const existingModal = document.getElementById('settingsModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHTML = `
            <div class="modal-overlay" id="settingsModalOverlay">
                <div class="floating-modal" id="settingsModal">
                    <div class="modal-header">
                        <div class="modal-title">
                            <div class="modal-icon">⚙️</div>
                            Settings
                        </div>
                        <div class="modal-controls">
                            <button class="modal-control-btn close" onclick="window.messenger?.closeModal('settingsModal')">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="modal-body">
                        <div class="settings-content">
                            <div class="setting-group">
                                <h3>Theme</h3>
                                <button class="modal-btn modal-btn-secondary" onclick="window.messenger?.toggleTheme()">
                                    Toggle Theme
                                </button>
                            </div>
                            <div class="setting-group">
                                <h3>Sidebar</h3>
                                <button class="modal-btn modal-btn-secondary" onclick="window.messenger?.toggleSidebar()">
                                    Toggle Sidebar
                                </button>
                            </div>
                            <div class="setting-group">
                                <h3>Notifications</h3>
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" checked>
                                    Enable sound notifications
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.showModal('settingsModal');
    }

    // Mobile support methods
    closeMobileChatList() {
        const chatListPanel = document.querySelector('.chat-list-panel');
        if (chatListPanel) {
            chatListPanel.classList.remove('mobile-open');
        }
    }

    toggleMobileChatList() {
        const chatListPanel = document.querySelector('.chat-list-panel');
        if (chatListPanel) {
            chatListPanel.classList.toggle('mobile-open');
        }
    }

    // Search functionality
    handleSearch(query) {
        if (!query || query.length < 2) {
            this.clearSearchResults();
            return;
        }

        const chatItems = document.querySelectorAll('.chat-item');
        let visibleCount = 0;

        chatItems.forEach(item => {
            const chatName = item.querySelector('.chat-name')?.textContent.toLowerCase() || '';
            const chatPreview = item.querySelector('.chat-preview')?.textContent.toLowerCase() || '';
            const searchTerm = query.toLowerCase();

            const isMatch = chatName.includes(searchTerm) || chatPreview.includes(searchTerm);

            if (isMatch) {
                item.style.display = 'flex';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });

        if (visibleCount === 0) {
            this.showNoSearchResults();
        }
    }

    clearSearchResults() {
        const chatItems = document.querySelectorAll('.chat-item');
        chatItems.forEach(item => {
            item.style.display = 'flex';
        });
    }

    showNoSearchResults() {
        console.log('No search results found');
    }

    // Demo data loading
    loadDemoData() {
        console.log('📊 Loading demo data...');
        // Load initial chat if none selected
        if (this.currentChat) {
            this.selectChat(this.currentChat);
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TalkPAIMessenger;
}

// Global access
window.TalkPAIMessenger = TalkPAIMessenger;