/**
 * TalkPAI Main Application Module
 * Integrates all components and manages initialization
 */

class TalkPAIApp {
    constructor() {
        this.messenger = null;
        this.uiEvents = null;
        this.callManager = null;
        this.components = null;
        this.initialized = false;

        console.log('🔧 TalkPAI App constructor called');
    }

    async init() {
        try {
            console.log('🚀 Starting TalkPAI initialization...');

            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            // Initialize core messenger
            this.messenger = new TalkPAIMessenger();
            console.log('✅ Messenger initialized');

            // Initialize UI components
            if (typeof UIComponents !== 'undefined') {
                this.components = new UIComponents();
                console.log('✅ UI Components initialized');
            }

            // Initialize UI Events with messenger reference
            this.uiEvents = new UIEventsManager(this.messenger);
            console.log('✅ UI Events initialized');

            // Initialize call manager if available
            if (typeof CallManager !== 'undefined') {
                this.callManager = new CallManager(this.messenger);
                console.log('✅ Call Manager initialized');
            }

            // Initialize WebRTC client
            try {
                if (typeof initializeWebRTC === 'function') {
                    // Initialize WebRTC with socket.io connection
                    const socket = io();
                    this.webrtcClient = initializeWebRTC(socket);
                    console.log('✅ WebRTC Client initialized');
                } else {
                    console.warn('⚠️ WebRTC client not available');
                }
            } catch (error) {
                console.warn('⚠️ WebRTC initialization failed:', error.message);
            }

            // Set up global references
            this.setupGlobalReferences();

            // Initialize theme and responsive features
            this.initializeTheme();
            this.initializeResponsiveFeatures();

            // Load initial data
            await this.loadInitialData();

            this.initialized = true;
            console.log('🎉 TalkPAI fully initialized!');

            // Trigger initialization complete event
            window.dispatchEvent(new CustomEvent('talkpai:initialized', {
                detail: { app: this }
            }));

        } catch (error) {
            console.error('❌ Failed to initialize TalkPAI:', error);
            this.showErrorNotification('Failed to initialize messenger. Please refresh the page.');
        }
    }

    setupGlobalReferences() {
        // Make components available globally for debugging and external access
        window.app = this;
        window.messenger = this.messenger;
        window.uiEvents = this.uiEvents;

        if (this.callManager) {
            window.callManager = this.callManager;
        }

        if (this.components) {
            window.UI = this.components;
        }

        console.log('🌐 Global references set up');
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('talkpai-theme') || 'light';
        document.body.setAttribute('data-theme', savedTheme);

        // Apply theme change listener
        document.addEventListener('theme-change', (e) => {
            document.body.setAttribute('data-theme', e.detail.theme);
            localStorage.setItem('talkpai-theme', e.detail.theme);
        });

        console.log('🎨 Theme initialized:', savedTheme);
    }

    initializeResponsiveFeatures() {
        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 100);
        });

        // Handle orientation change on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleResize();
            }, 100);
        });

        // Initial resize handling
        this.handleResize();

        console.log('📱 Responsive features initialized');
    }

    handleResize() {
        const isMobile = window.innerWidth <= 968;
        const isTablet = window.innerWidth > 968 && window.innerWidth <= 1200;

        document.body.setAttribute('data-device', isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop');

        // Notify components about resize
        if (this.uiEvents && typeof this.uiEvents.handleResize === 'function') {
            this.uiEvents.handleResize(isMobile, isTablet);
        }
    }

    async loadInitialData() {
        try {
            console.log('📊 Loading initial data...');

            // Load demo chats
            if (this.uiEvents && typeof this.uiEvents.loadChatsFromBackend === 'function') {
                const chats = await this.uiEvents.loadChatsFromBackend();
                this.displayChats(chats);
            }

            console.log('✅ Initial data loaded');
        } catch (error) {
            console.warn('⚠️ Failed to load initial data:', error);
            // Continue with demo data
            this.loadDemoChats();
        }
    }

    loadDemoChats() {
        console.log('📋 Loading demo chats...');

        const demoChats = [
            {
                id: '1',
                name: 'AI Assistant',
                avatar: '🤖',
                lastMessage: 'Hello! How can I help you today?',
                timestamp: new Date().toISOString(),
                unreadCount: 0,
                isOnline: true
            },
            {
                id: '2',
                name: 'General Chat',
                avatar: '💬',
                lastMessage: 'Welcome to Talk pAI!',
                timestamp: new Date().toISOString(),
                unreadCount: 2,
                isOnline: true
            },
            {
                id: '3',
                name: 'Support Team',
                avatar: '🎧',
                lastMessage: 'We are here to help!',
                timestamp: new Date().toISOString(),
                unreadCount: 0,
                isOnline: false
            }
        ];

        this.displayChats(demoChats);
    }

    displayChats(chats) {
        const chatListContainer = document.querySelector('.chat-list');
        if (!chatListContainer) {
            console.warn('Chat list container not found');
            return;
        }

        chatListContainer.innerHTML = chats.map(chat => `
            <div class="chat-item" data-chat="${chat.id}">
                <div class="chat-avatar">${chat.avatar}</div>
                <div class="chat-info">
                    <div class="chat-name">${chat.name}</div>
                    <div class="chat-preview">${chat.lastMessage}</div>
                </div>
                <div class="chat-meta">
                    <div class="chat-time">${this.formatTime(chat.timestamp)}</div>
                    ${chat.unreadCount > 0 ? `<div class="chat-badge">${chat.unreadCount}</div>` : ''}
                    <div class="chat-status ${chat.isOnline ? 'online' : 'offline'}"></div>
                </div>
            </div>
        `).join('');

        console.log(`✅ Displayed ${chats.length} chats`);
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 1) {
            return 'now';
        } else if (diffHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString();
        }
    }

    showErrorNotification(message) {
        console.error('🚨 Error:', message);

        // Create error notification
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #EF4444, #DC2626);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            z-index: 10000;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease;
            max-width: 400px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 10px 40px rgba(239, 68, 68, 0.3);
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        });

        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    // Public API methods
    getCurrentChat() {
        return this.messenger ? this.messenger.currentChat : null;
    }

    selectChat(chatId) {
        if (this.uiEvents && typeof this.uiEvents.selectChat === 'function') {
            this.uiEvents.selectChat(chatId);
        }
    }

    sendMessage(content) {
        if (this.uiEvents && typeof this.uiEvents.sendMessage === 'function') {
            // Set message input value and trigger send
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.value = content;
                this.uiEvents.sendMessage();
            }
        }
    }

    toggleTheme() {
        if (this.messenger && typeof this.messenger.toggleTheme === 'function') {
            this.messenger.toggleTheme();
        }
    }

    isInitialized() {
        return this.initialized;
    }
}

// Auto-initialize when DOM is ready
let talkPAIApp;

function initializeTalkPAI() {
    if (!talkPAIApp) {
        talkPAIApp = new TalkPAIApp();
        talkPAIApp.init();
    }
    return talkPAIApp;
}

// Initialize based on document state
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTalkPAI);
} else {
    // DOM already loaded
    setTimeout(initializeTalkPAI, 100);
}

// Export for external use
window.TalkPAIApp = TalkPAIApp;
window.initializeTalkPAI = initializeTalkPAI;

// Debug helper
window.restartTalkPAI = function() {
    if (talkPAIApp) {
        console.log('🔄 Restarting TalkPAI...');
        talkPAIApp = new TalkPAIApp();
        talkPAIApp.init();
    }
};

console.log('📦 TalkPAI App module loaded');