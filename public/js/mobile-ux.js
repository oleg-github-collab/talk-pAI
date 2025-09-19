/**
 * Talk pAI Mobile UX Controller
 * Native-like mobile experience with gestures, navigation, and interactions
 * 🚀 iOS/Android-like functionality for web browsers
 */

class MobileUX {
    constructor() {
        this.isMobile = this.detectMobile();
        this.currentView = 'chats'; // chats, chat, profile, settings
        this.isInitialized = false;
        this.gestureStartX = 0;
        this.gestureStartY = 0;
        this.swipeThreshold = 50;
        this.touchStartTime = 0;
        this.longPressTimeout = null;
        this.hapticSupport = 'vibrate' in navigator;

        // View stack for navigation
        this.viewStack = [];
        this.currentChatId = null;

        this.init();
    }

    detectMobile() {
        // Comprehensive mobile detection
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth <= 768;

        return isMobileUA || (isTouchDevice && isSmallScreen);
    }

    init() {
        if (!this.isMobile) return;

        console.log('🚀 Initializing Mobile UX...');

        // Apply mobile layout
        this.applyMobileLayout();

        // Setup navigation
        this.setupNavigation();

        // Setup gestures
        this.setupGestures();

        // Setup mobile-specific features
        this.setupMobileFeatures();

        // Setup PWA features
        this.setupPWA();

        this.isInitialized = true;
        console.log('✅ Mobile UX initialized successfully');
    }

    applyMobileLayout() {
        // Add mobile classes to body and container
        document.body.classList.add('mobile-view');
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.classList.add('mobile-layout');
        }

        // Create mobile UI structure
        this.createMobileHeader();
        this.createMobileBottomNav();
        this.createMobileInterface();

        // Hide desktop elements
        this.hideDesktopElements();

        // Show mobile elements
        this.showMobileElements();
    }

    createMobileHeader() {
        const header = document.createElement('div');
        header.className = 'mobile-header';
        header.innerHTML = `
            <div class="mobile-header-left">
                <button class="mobile-nav-btn" id="mobileMenuBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="mobile-header-title" id="mobileHeaderTitle">Talk pAI</div>
            <div class="mobile-header-right">
                <button class="mobile-nav-btn" id="mobileSearchBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                </button>
                <button class="mobile-nav-btn" id="mobileCallBtn" style="display: none;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                </button>
            </div>
        `;

        // Insert header at the beginning of body
        document.body.insertBefore(header, document.body.firstChild);

        // Setup header event listeners
        this.setupHeaderEvents();
    }

    createMobileBottomNav() {
        const bottomNav = document.createElement('div');
        bottomNav.className = 'mobile-bottom-nav';
        bottomNav.innerHTML = `
            <div class="mobile-nav-item active" data-view="chats">
                <svg class="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="mobile-nav-label">Chats</span>
            </div>
            <div class="mobile-nav-item" data-view="calls">
                <svg class="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <span class="mobile-nav-label">Calls</span>
            </div>
            <div class="mobile-nav-item" data-view="contacts">
                <svg class="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span class="mobile-nav-label">Contacts</span>
            </div>
            <div class="mobile-nav-item" data-view="settings">
                <svg class="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1m10 0a7 7 0 1 1 0-14 7 7 0 0 1 0 14z"></path>
                </svg>
                <span class="mobile-nav-label">Settings</span>
            </div>
        `;

        document.body.appendChild(bottomNav);
        this.setupBottomNavEvents();
    }

    createMobileInterface() {
        // Create main mobile content container
        const mainContent = document.createElement('div');
        mainContent.className = 'main-content';

        // Create mobile chat list
        this.createMobileChatList(mainContent);

        // Create mobile chat interface (hidden by default)
        this.createMobileChatInterface(mainContent);

        // Add FAB for new chat
        this.createFloatingActionButton();

        // Insert main content
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.appendChild(mainContent);
        }
    }

    createMobileChatList(container) {
        const chatList = document.createElement('div');
        chatList.className = 'mobile-chat-list';
        chatList.id = 'mobileChatList';

        // Load chats from API
        this.loadMobileChats(chatList);

        container.appendChild(chatList);
    }

    createMobileChatInterface(container) {
        const chatInterface = document.createElement('div');
        chatInterface.className = 'chat-interface mobile-interface';
        chatInterface.id = 'mobileChatInterface';
        chatInterface.style.display = 'none';

        chatInterface.innerHTML = `
            <div class="mobile-chat-header">
                <button class="mobile-nav-btn" id="mobileBackBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15,18 9,12 15,6"></polyline>
                    </svg>
                </button>
                <div class="mobile-chat-avatar" id="mobileChatAvatar">?</div>
                <div class="mobile-chat-info">
                    <div class="mobile-chat-name" id="mobileChatName">Loading...</div>
                    <div class="mobile-chat-status" id="mobileChatStatus">Connecting...</div>
                </div>
                <div class="mobile-chat-actions">
                    <button class="mobile-nav-btn" id="mobileVideoCallBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="23,7 16,12 23,17 23,7"></polygon>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="messages-container mobile-messages" id="mobileMessagesContainer">
                <!-- Messages will be loaded here -->
            </div>
            <div class="mobile-input-container">
                <button class="mobile-action-btn mobile-attach-btn" id="mobileAttachBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path>
                    </svg>
                </button>
                <div class="mobile-input-wrapper">
                    <textarea class="mobile-input-field" id="mobileMessageInput" placeholder="Type a message..." rows="1"></textarea>
                </div>
                <button class="mobile-action-btn mobile-send-btn" id="mobileSendBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
                    </svg>
                </button>
            </div>
        `;

        container.appendChild(chatInterface);
        this.setupChatInterfaceEvents();
    }

    createFloatingActionButton() {
        const fab = document.createElement('button');
        fab.className = 'mobile-fab';
        fab.id = 'mobileFab';
        fab.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
        `;

        fab.addEventListener('click', () => {
            this.hapticFeedback();
            this.showNewChatModal();
        });

        document.body.appendChild(fab);
    }

    hideDesktopElements() {
        // Hide desktop sidebar
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.style.display = 'none';

        // Hide desktop chat interface
        const desktopChat = document.querySelector('.chat-interface:not(.mobile-interface)');
        if (desktopChat) desktopChat.style.display = 'none';
    }

    showMobileElements() {
        // Show mobile-specific elements
        const mobileElements = document.querySelectorAll('.mobile-only');
        mobileElements.forEach(el => el.style.display = 'block');
    }

    setupNavigation() {
        // Setup view navigation
        this.viewStack = ['chats'];

        // Back button handler
        window.addEventListener('popstate', (e) => {
            this.handleBackNavigation();
        });

        // Handle browser back button
        history.pushState({ view: 'chats' }, '', location.href);
    }

    setupGestures() {
        // Touch event listeners
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: true });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });

        // Prevent zoom on double tap
        document.addEventListener('touchend', (e) => {
            if (e.detail > 1) {
                e.preventDefault();
            }
        });

        // Setup swipe gestures for chat list items
        this.setupSwipeGestures();
    }

    setupMobileFeatures() {
        // Auto-resize textarea
        this.setupAutoResizeTextarea();

        // Setup pull-to-refresh
        this.setupPullToRefresh();

        // Setup virtual keyboard handling
        this.setupVirtualKeyboard();

        // Setup haptic feedback
        this.setupHapticFeedback();
    }

    setupPWA() {
        // Add to homescreen prompt
        this.setupAddToHomescreen();

        // Service worker for offline functionality
        this.setupServiceWorker();

        // Handle app install prompt
        this.setupInstallPrompt();
    }

    // ===== EVENT HANDLERS =====

    setupHeaderEvents() {
        const menuBtn = document.getElementById('mobileMenuBtn');
        const searchBtn = document.getElementById('mobileSearchBtn');
        const callBtn = document.getElementById('mobileCallBtn');

        menuBtn?.addEventListener('click', () => {
            this.hapticFeedback();
            this.toggleMobileMenu();
        });

        searchBtn?.addEventListener('click', () => {
            this.hapticFeedback();
            this.showSearchInterface();
        });

        callBtn?.addEventListener('click', () => {
            this.hapticFeedback();
            this.startCall('audio');
        });
    }

    setupBottomNavEvents() {
        const navItems = document.querySelectorAll('.mobile-nav-item');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                this.hapticFeedback();
                const view = item.dataset.view;
                this.switchView(view);

                // Update active state
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            });
        });
    }

    setupChatInterfaceEvents() {
        const backBtn = document.getElementById('mobileBackBtn');
        const sendBtn = document.getElementById('mobileSendBtn');
        const messageInput = document.getElementById('mobileMessageInput');
        const attachBtn = document.getElementById('mobileAttachBtn');
        const videoCallBtn = document.getElementById('mobileVideoCallBtn');

        backBtn?.addEventListener('click', () => {
            this.hapticFeedback();
            this.navigateBack();
        });

        sendBtn?.addEventListener('click', () => {
            this.sendMessage();
        });

        messageInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        attachBtn?.addEventListener('click', () => {
            this.hapticFeedback();
            this.showAttachmentOptions();
        });

        videoCallBtn?.addEventListener('click', () => {
            this.hapticFeedback();
            this.startCall('video');
        });
    }

    // ===== GESTURE HANDLING =====

    handleTouchStart(e) {
        this.gestureStartX = e.touches[0].clientX;
        this.gestureStartY = e.touches[0].clientY;
        this.touchStartTime = Date.now();

        // Setup long press
        this.longPressTimeout = setTimeout(() => {
            this.handleLongPress(e);
        }, 500);
    }

    handleTouchMove(e) {
        // Clear long press if user moves
        if (this.longPressTimeout) {
            clearTimeout(this.longPressTimeout);
            this.longPressTimeout = null;
        }
    }

    handleTouchEnd(e) {
        // Clear long press
        if (this.longPressTimeout) {
            clearTimeout(this.longPressTimeout);
            this.longPressTimeout = null;
        }

        const deltaX = (e.changedTouches[0].clientX - this.gestureStartX);
        const deltaY = (e.changedTouches[0].clientY - this.gestureStartY);
        const deltaTime = Date.now() - this.touchStartTime;

        // Detect swipe gestures
        if (Math.abs(deltaX) > this.swipeThreshold && deltaTime < 500) {
            if (deltaX > 0) {
                this.handleSwipeRight(e);
            } else {
                this.handleSwipeLeft(e);
            }
        }

        // Detect vertical swipes
        if (Math.abs(deltaY) > this.swipeThreshold && deltaTime < 500) {
            if (deltaY > 0) {
                this.handleSwipeDown(e);
            } else {
                this.handleSwipeUp(e);
            }
        }
    }

    handleSwipeRight(e) {
        if (this.currentView === 'chat') {
            // Go back to chat list
            this.navigateBack();
        }
    }

    handleSwipeLeft(e) {
        // Could be used for quick actions
    }

    handleSwipeDown(e) {
        // Pull to refresh
        if (window.scrollY === 0) {
            this.triggerRefresh();
        }
    }

    handleSwipeUp(e) {
        // Could be used for quick scroll to bottom
    }

    handleLongPress(e) {
        this.hapticFeedback('heavy');

        // Show context menu based on element
        const target = e.target.closest('.mobile-chat-item, .message-bubble');
        if (target) {
            this.showContextMenu(target, e);
        }
    }

    // ===== NAVIGATION METHODS =====

    switchView(view) {
        this.currentView = view;

        // Update header title
        const titles = {
            chats: 'Talk pAI',
            calls: 'Recent Calls',
            contacts: 'Contacts',
            settings: 'Settings'
        };

        document.getElementById('mobileHeaderTitle').textContent = titles[view] || 'Talk pAI';

        // Show/hide appropriate content
        this.showViewContent(view);

        // Update navigation history
        history.pushState({ view }, '', `#${view}`);
    }

    navigateToChat(chatId, chatName) {
        this.currentChatId = chatId;
        this.currentView = 'chat';

        // Update header
        document.getElementById('mobileHeaderTitle').textContent = chatName;
        document.getElementById('mobileCallBtn').style.display = 'block';

        // Show chat interface
        document.getElementById('mobileChatList').style.display = 'none';
        document.getElementById('mobileChatInterface').style.display = 'flex';
        document.getElementById('mobileFab').style.display = 'none';

        // Load chat data
        this.loadChatData(chatId);

        // Update navigation history
        this.viewStack.push('chat');
        history.pushState({ view: 'chat', chatId }, '', `#chat/${chatId}`);
    }

    navigateBack() {
        if (this.viewStack.length > 1) {
            this.viewStack.pop();
            const previousView = this.viewStack[this.viewStack.length - 1];

            if (previousView === 'chats') {
                // Back to chat list
                this.currentView = 'chats';
                document.getElementById('mobileHeaderTitle').textContent = 'Talk pAI';
                document.getElementById('mobileCallBtn').style.display = 'none';
                document.getElementById('mobileChatList').style.display = 'block';
                document.getElementById('mobileChatInterface').style.display = 'none';
                document.getElementById('mobileFab').style.display = 'block';
            }

            history.back();
        }
    }

    // ===== API INTEGRATION =====

    async loadMobileChats(container) {
        try {
            const response = await fetch('/api/v2/demo/chats');
            const data = await response.json();

            if (data.success) {
                this.renderChatList(data.chats, container);
            }
        } catch (error) {
            console.error('Failed to load chats:', error);
            this.showErrorMessage('Failed to load chats');
        }
    }

    renderChatList(chats, container) {
        container.innerHTML = chats.map(chat => `
            <div class="mobile-chat-item" data-chat-id="${chat.id}" onclick="mobileUX.navigateToChat('${chat.id}', '${chat.name}')">
                <div class="mobile-chat-item-avatar">${chat.avatar || chat.name.charAt(0)}</div>
                <div class="mobile-chat-item-content">
                    <div class="mobile-chat-item-header">
                        <div class="mobile-chat-item-name">${chat.name}</div>
                        <div class="mobile-chat-item-time">${this.formatTime(chat.timestamp)}</div>
                    </div>
                    <div class="mobile-chat-item-message">${chat.lastMessage || 'No messages yet'}</div>
                </div>
                ${chat.unreadCount > 0 ? `<div class="mobile-chat-item-badge">${chat.unreadCount}</div>` : ''}
            </div>
        `).join('');
    }

    async loadChatData(chatId) {
        // Update chat info
        document.getElementById('mobileChatName').textContent = 'Loading...';
        document.getElementById('mobileChatStatus').textContent = 'Connecting...';

        // Load messages
        // This would integrate with your existing message loading logic
        console.log('Loading chat data for:', chatId);
    }

    sendMessage() {
        const input = document.getElementById('mobileMessageInput');
        const message = input.value.trim();

        if (message) {
            this.hapticFeedback('light');

            // Add message to UI
            this.addMessageToUI(message, 'sent');

            // Clear input
            input.value = '';
            input.style.height = 'auto';

            // Send to server (integrate with existing message sending)
            console.log('Sending message:', message);
        }
    }

    addMessageToUI(content, type) {
        const container = document.getElementById('mobileMessagesContainer');
        const messageEl = document.createElement('div');
        messageEl.className = `message-bubble mobile-message ${type}`;
        messageEl.innerHTML = `
            ${content}
            <div class="message-timestamp mobile-timestamp">${this.formatTime(new Date())}</div>
        `;

        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
    }

    // ===== UTILITY METHODS =====

    hapticFeedback(type = 'light') {
        if (this.hapticSupport) {
            const patterns = {
                light: 10,
                medium: 50,
                heavy: 100
            };
            navigator.vibrate(patterns[type] || 10);
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
        if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    showErrorMessage(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'mobile-toast error';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #e53e3e;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        document.body.appendChild(toast);

        setTimeout(() => toast.style.opacity = '1', 100);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    // ===== SETUP METHODS =====

    setupAutoResizeTextarea() {
        const textarea = document.getElementById('mobileMessageInput');
        if (textarea) {
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
            });
        }
    }

    setupPullToRefresh() {
        // Implementation for pull-to-refresh
        console.log('Pull-to-refresh setup');
    }

    setupVirtualKeyboard() {
        // Handle virtual keyboard appearance
        const viewport = window.visualViewport;
        if (viewport) {
            viewport.addEventListener('resize', () => {
                const inputContainer = document.querySelector('.mobile-input-container');
                if (inputContainer) {
                    inputContainer.style.bottom = `${window.innerHeight - viewport.height}px`;
                }
            });
        }
    }

    setupHapticFeedback() {
        // Enhanced haptic feedback patterns
        console.log('Haptic feedback setup, support:', this.hapticSupport);
    }

    setupAddToHomescreen() {
        // PWA add to homescreen functionality
        console.log('Add to homescreen setup');
    }

    setupServiceWorker() {
        // Service worker for offline functionality
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(console.error);
        }
    }

    setupInstallPrompt() {
        // Handle app install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.installPrompt = e;
        });
    }

    setupSwipeGestures() {
        // Setup swipe gestures for chat items
        console.log('Swipe gestures setup');
    }

    // ===== PLACEHOLDER METHODS =====

    toggleMobileMenu() { console.log('Toggle mobile menu'); }
    showSearchInterface() { console.log('Show search'); }
    startCall(type) { console.log('Start call:', type); }
    showNewChatModal() { console.log('Show new chat modal'); }
    showAttachmentOptions() { console.log('Show attachment options'); }
    showContextMenu(target, event) { console.log('Show context menu'); }
    triggerRefresh() { console.log('Trigger refresh'); }
    showViewContent(view) { console.log('Show view:', view); }
    handleBackNavigation() { this.navigateBack(); }
}

// Initialize mobile UX
const mobileUX = new MobileUX();

// Export for global access
window.mobileUX = mobileUX;

console.log('📱 Mobile UX module loaded');