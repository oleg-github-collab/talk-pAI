/**
 * TalkPAI UI Events Module - FIXED VERSION
 * Handles all user interface events and interactions
 */

class UIEventsManager {
    constructor(messenger) {
        this.messenger = messenger;
        this.typingTimer = null;
        this.messagingService = window.messagingService || null;
        this.bindEvents();
        this.setupMessagingServiceListeners();
    }

    bindEvents() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.initializeEventBindings(), 100);
            });
        } else {
            setTimeout(() => this.initializeEventBindings(), 100);
        }
    }

    setupMessagingServiceListeners() {
        if (this.messagingService && typeof this.messagingService.isReady === 'function' && this.messagingService.isReady()) {
            return;
        }

        document.addEventListener('messaging-service:ready', (event) => {
            this.messagingService = event.detail;
        }, { once: true });
    }

    initializeEventBindings() {
        try {
            this.bindSidebarEvents();
            this.bindNavigationEvents();
            this.bindChatEvents();
            this.bindMessageEvents();
            this.bindCallEvents();
            this.bindDragDropEvents();
            this.bindModalEvents();
            this.bindKeyboardEvents();
            this.bindMobileEvents();

            console.log('🎯 All UI events bound successfully');
        } catch (error) {
            console.error('❌ Error binding UI events:', error);
            this.messenger.handleError(error, 'UI Events Initialization');
        }
    }

    bindSidebarEvents() {
        // Sidebar toggle
        document.getElementById('sidebarToggle')?.addEventListener('click', () => {
            this.messenger.toggleSidebar();
        });

        // Theme toggle
        document.getElementById('themeToggle')?.addEventListener('click', () => {
            if (window.themeCustomizer) {
                window.themeCustomizer.showCustomizer();
            } else {
                this.messenger.toggleTheme();
            }
        });
    }

    bindNavigationEvents() {
        try {
            // Navigation items with event delegation
            const navItems = document.querySelectorAll('.nav-item');
            console.log('🔗 Found navigation items:', navItems.length);

            // Direct event binding
            navItems.forEach((item, index) => {
                const navType = item.dataset.nav;
                if (navType) {
                    console.log(`🔗 Binding nav item ${index}: ${navType}`);

                    item.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🎯 Navigation clicked:', navType);
                        this.switchNavigation(navType);
                    });
                }
            });

            // Event delegation as fallback
            document.addEventListener('click', (e) => {
                const navItem = e.target.closest('.nav-item');
                if (navItem && navItem.dataset.nav) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🎯 Navigation clicked (delegation):', navItem.dataset.nav);
                    this.switchNavigation(navItem.dataset.nav);
                }
            });

            // Search functionality
            const searchInput = document.getElementById('globalSearch');
            if (searchInput) {
                let searchTimeout;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        this.handleSearch(e.target.value);
                    }, 300);
                });
                console.log('🔍 Global search bound');
            } else {
                console.log('⚠️ Global search input not found');
            }

            // Profile button
            const profileBtn = document.getElementById('profileBtn');
            if (profileBtn) {
                profileBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.messenger.showProfileModal();
                });
                console.log('👤 Profile button bound');
            }

            // Find users button
            const findUsersBtn = document.getElementById('findUsersBtn');
            if (findUsersBtn) {
                findUsersBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.messenger.showSearchModal();
                });
                console.log('🔍 Find users button bound');
            }

            // Logout button
            const logoutBtn = document.querySelector('.logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleLogout();
                });
                console.log('🚪 Logout button bound');
            }
        } catch (error) {
            console.error('❌ Error binding navigation events:', error);
        }
    }

    bindChatEvents() {
        // Chat items with event delegation
        const chatItems = document.querySelectorAll('.chat-item');
        console.log('💬 Found chat items:', chatItems.length);

        // Direct event binding
        chatItems.forEach((item, index) => {
            const chatId = item.dataset.chat;
            console.log(`💬 Binding chat item ${index}: ${chatId}`);

            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🎯 Chat clicked:', chatId);
                this.selectChat(chatId);
            });
        });

        // Event delegation as fallback
        document.addEventListener('click', (e) => {
            const chatItem = e.target.closest('.chat-item');
            if (chatItem && chatItem.dataset.chat) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🎯 Chat clicked (delegation):', chatItem.dataset.chat);
                this.selectChat(chatItem.dataset.chat);
            }
        });

        // New chat button
        document.getElementById('newChatBtn')?.addEventListener('click', () => {
            this.showNewChatModal();
        });

        // Chat list toggle for mobile
        document.getElementById('chatListToggle')?.addEventListener('click', () => {
            this.toggleChatList();
        });
    }

    bindMessageEvents() {
        // Message input
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('input', () => {
                this.messenger.autoResizeTextarea(messageInput);
                this.handleTyping();
            });

            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            messageInput.addEventListener('paste', (e) => {
                this.handlePaste(e);
            });
        }

        // Send button
        document.getElementById('sendBtn')?.addEventListener('click', () => {
            this.sendMessage();
        });

        // Emoji button
        document.getElementById('emojiBtn')?.addEventListener('click', () => {
            this.toggleEmojiPicker();
        });

        // Header action buttons
        document.getElementById('searchBtn')?.addEventListener('click', () => {
            this.messenger.showSearchModal();
        });

        document.getElementById('callBtn')?.addEventListener('click', () => {
            this.startVoiceCall();
        });

        document.getElementById('videoBtn')?.addEventListener('click', () => {
            this.startVideoCall();
        });

        // New chat button
        document.getElementById('newChatBtn')?.addEventListener('click', () => {
            this.showNewChatModal();
        });

        // File attachment button
        document.getElementById('attachBtn')?.addEventListener('click', () => {
            this.openFileDialog();
        });
    }

    bindCallEvents() {
        // Header call buttons
        document.getElementById('callBtn')?.addEventListener('click', () => {
            this.startCall('voice');
        });

        document.getElementById('videoBtn')?.addEventListener('click', () => {
            this.startCall('video');
        });

        // Voice call button (if exists)
        document.getElementById('voiceCallBtn')?.addEventListener('click', () => {
            this.startCall('voice');
        });

        // Video call button (if exists)
        document.getElementById('videoCallBtn')?.addEventListener('click', () => {
            this.startCall('video');
        });

        // Call control buttons
        const callManager = window.app?.callManager || window.callManager;
        if (callManager) {
            document.getElementById('muteBtn')?.addEventListener('click', () => {
                callManager.toggleMute();
            });

            document.getElementById('cameraBtn')?.addEventListener('click', () => {
                callManager.toggleVideo();
            });

            document.getElementById('endCallBtn')?.addEventListener('click', () => {
                callManager.endCall();
            });

            document.getElementById('speakerBtn')?.addEventListener('click', () => {
                callManager.toggleSpeaker();
            });

            document.getElementById('screenShareBtn')?.addEventListener('click', () => {
                callManager.toggleScreenShare();
            });
        }

        console.log('📞 Call events bound');
    }

    bindDragDropEvents() {
        // Window drag and drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            window.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        window.addEventListener('dragenter', () => {
            this.messenger.dragCounter++;
            if (this.messenger.dragCounter === 1) {
                this.showDragZone();
            }
        });

        window.addEventListener('dragleave', () => {
            this.messenger.dragCounter--;
            if (this.messenger.dragCounter === 0) {
                this.hideDragZone();
            }
        });

        window.addEventListener('drop', (e) => {
            this.messenger.dragCounter = 0;
            this.hideDragZone();
            this.handleFileDrop(e);
        });
    }

    bindModalEvents() {
        // Profile modal close buttons
        document.getElementById('profileCloseBtn')?.addEventListener('click', () => {
            this.messenger.closeModal('profileModal');
        });

        // User search modal close buttons
        document.getElementById('userSearchCloseBtn')?.addEventListener('click', () => {
            this.messenger.closeModal('userSearchModal');
        });

        // Profile modal overlay
        document.getElementById('profileModalOverlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.messenger.closeModal('profileModal');
            }
        });

        // User search modal overlay
        document.getElementById('userSearchModalOverlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.messenger.closeModal('userSearchModal');
            }
        });

        // Modal minimize/maximize buttons
        document.getElementById('profileMinimizeBtn')?.addEventListener('click', () => {
            console.log('Profile modal minimize clicked');
        });

        document.getElementById('profileMaximizeBtn')?.addEventListener('click', () => {
            console.log('Profile modal maximize clicked');
        });

        // User search input
        const userSearchInput = document.getElementById('userSearchInput');
        if (userSearchInput) {
            let searchTimeout;
            userSearchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.handleUserSearch(e.target.value);
                }, 300);
            });
        }

        // File upload buttons
        document.getElementById('fileCancelBtn')?.addEventListener('click', () => {
            this.hideFilePreview();
        });

        document.getElementById('fileSendBtn')?.addEventListener('click', () => {
            this.sendSelectedFiles();
        });

        document.getElementById('filePreviewClose')?.addEventListener('click', () => {
            this.hideFilePreview();
        });

        console.log('🪟 Modal events bound');
    }

    bindKeyboardEvents() {
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K for search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.focusGlobalSearch();
            }

            // Escape key for closing modals
            if (e.key === 'Escape') {
                this.closeTopModal();
            }

            // Ctrl/Cmd + Enter for sending messages
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                this.sendMessage();
            }
        });
    }

    bindMobileEvents() {
        // Mobile menu toggle
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                console.log('🔧 Mobile menu clicked');
                this.toggleMobileSidebar();
            });
        }

        // Mobile back button
        const mobileBackBtn = document.getElementById('mobileBackBtn');
        if (mobileBackBtn) {
            mobileBackBtn.addEventListener('click', () => {
                console.log('🔧 Mobile back clicked');
                this.handleMobileBack();
            });
        }

        // Touch events for better mobile experience
        if ('ontouchstart' in window) {
            this.bindTouchEvents();
        }
    }

    bindTouchEvents() {
        // Swipe gestures for mobile navigation
        let startX = 0;
        let startY = 0;

        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });

        document.addEventListener('touchend', (e) => {
            if (!startX || !startY) return;

            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const deltaX = endX - startX;
            const deltaY = endY - startY;

            // Swipe right to open sidebar (if closed)
            if (deltaX > 100 && Math.abs(deltaY) < 50) {
                const sidebar = document.getElementById('sidebar');
                if (sidebar && !sidebar.classList.contains('mobile-open')) {
                    this.toggleMobileSidebar();
                }
            }

            // Swipe left to close sidebar (if open)
            if (deltaX < -100 && Math.abs(deltaY) < 50) {
                const sidebar = document.getElementById('sidebar');
                if (sidebar && sidebar.classList.contains('mobile-open')) {
                    this.toggleMobileSidebar();
                }
            }

            startX = 0;
            startY = 0;
        });
    }

    toggleMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('mobile-open');
            console.log('📱 Mobile sidebar toggled:', sidebar.classList.contains('mobile-open'));
        }
    }

    handleMobileBack() {
        // Close any open modals first
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            this.closeModal(activeModal);
            return;
        }

        // Close emoji picker
        const emojiPicker = document.getElementById('emojiPicker');
        if (emojiPicker) {
            emojiPicker.remove();
            return;
        }

        // Close mobile sidebar
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
            this.toggleMobileSidebar();
            return;
        }

        // Navigate to default view
        this.switchNavigation('chats');
    }

    // Event handler implementations
    switchNavigation(navType) {
        try {
            const startTime = performance.now();
            console.log('🎯 Navigation switch triggered:', navType);

            // Remove active class from all nav items
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });

            // Add active class to clicked item
            const activeItem = document.querySelector(`[data-nav="${navType}"]`);
            if (activeItem) {
                activeItem.classList.add('active');
            }

            // Use messenger's navigation method if available
            if (this.messenger && this.messenger.switchNavigation) {
                this.messenger.switchNavigation(navType);
            } else {
                // Fallback navigation logic
                this.handleNavigationFallback(navType);
            }

            if (this.messenger && this.messenger.logPerformance) {
                this.messenger.logPerformance('Navigation Switch', startTime);
            }
        } catch (error) {
            console.error('Navigation error:', error);
            if (this.messenger && this.messenger.handleError) {
                this.messenger.handleError(error, 'Navigation');
            }
        }
    }

    handleNavigationFallback(navType) {
        console.log('🔄 Using navigation fallback for:', navType);

        // Hide all content sections
        const sections = ['chats', 'groups', 'contacts', 'files', 'profile', 'search', 'settings'];
        sections.forEach(section => {
            const element = document.getElementById(section + '-section') || document.querySelector(`.${section}-view`);
            if (element) {
                element.style.display = 'none';
            }
        });

        // Show target section or handle special cases
        switch (navType) {
            case 'chats':
                this.showChatsView();
                break;
            case 'groups':
                this.showGroupsView();
                break;
            case 'contacts':
                this.showContactsView();
                break;
            case 'files':
                this.showFilesView();
                break;
            case 'profile':
                this.showProfileView();
                break;
            case 'search':
                this.showSearchView();
                break;
            case 'settings':
                this.showSettingsView();
                break;
            default:
                console.warn('Unknown navigation type:', navType);
        }
    }

    showGroupsView() {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.setAttribute('data-view', 'groups');
            mainContent.innerHTML = `
                <div class="groups-view">
                    <div class="groups-header">
                        <h2>Groups</h2>
                        <button class="btn-primary" onclick="window.app?.uiEvents?.createGroup()">
                            ➕ Create Group
                        </button>
                    </div>
                    <div class="groups-list">
                        <div class="group-item">
                            <div class="group-avatar">👥</div>
                            <div class="group-info">
                                <span class="group-name">General Discussion</span>
                                <span class="group-members">12 members</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    showFilesView() {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.setAttribute('data-view', 'files');
            mainContent.innerHTML = `
                <div class="files-view">
                    <div class="files-header">
                        <h2>Files</h2>
                        <button class="btn-primary" onclick="window.app?.uiEvents?.uploadFile()">
                            📁 Upload File
                        </button>
                    </div>
                    <div class="files-list">
                        <div class="file-item">
                            <div class="file-icon">📄</div>
                            <div class="file-info">
                                <span class="file-name">Document.pdf</span>
                                <span class="file-size">2.4 MB</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    showProfileView() {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.setAttribute('data-view', 'profile');
            mainContent.innerHTML = `
                <div class="profile-view">
                    <div class="profile-header">
                        <h2>Profile</h2>
                        <button class="btn-secondary" onclick="window.app?.uiEvents?.editProfile()">
                            ✏️ Edit Profile
                        </button>
                    </div>
                    <div class="profile-content">
                        <div class="profile-avatar">👤</div>
                        <div class="profile-info">
                            <h3>Demo User</h3>
                            <p>@demo_user</p>
                            <p>Welcome to Talk pAI!</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    showSearchView() {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.setAttribute('data-view', 'search');
            mainContent.innerHTML = `
                <div class="search-view">
                    <div class="search-header">
                        <h2>Search</h2>
                        <div class="search-bar">
                            <input type="text" placeholder="Search users, messages..." class="search-input" id="globalSearchInput">
                            <button class="btn-primary">🔍</button>
                        </div>
                    </div>
                    <div class="search-results">
                        <p>Start typing to search...</p>
                    </div>
                </div>
            `;
        }
    }

    selectChat(chatId) {
        try {
            const startTime = performance.now();
            console.log('🎯 Chat selection triggered:', chatId);

            if (this.messagingService) {
                this.messagingService.selectChat(chatId);
            } else if (this.messenger) {
                this.messenger.selectChat(chatId);
            }

            this.messenger.logPerformance('Chat Selection', startTime);
        } catch (error) {
            this.messenger.handleError(error, 'Chat Selection');
        }
    }

    async sendMessage() {
        try {
            const messageInput = document.getElementById('messageInput');
            const message = messageInput.value.trim();

            if (!message) return;

            const startTime = performance.now();
            console.log('📤 Sending message:', message);

            if (this.messagingService) {
                await this.messagingService.sendMessage(message);
            } else {
                this.messenger.sendMessage(message);
                this.sendMessageToBackend(message);
            }

            // Clear input
            messageInput.value = '';
            this.messenger.autoResizeTextarea(messageInput);

            this.messenger.logPerformance('Send Message', startTime);
        } catch (error) {
            this.messenger.handleError(error, 'Send Message');
        }
    }

    handleSearch(query) {
        try {
            const startTime = performance.now();
            console.log('🔍 Search triggered:', query);

            // Use messenger's search method
            this.messenger.handleSearch(query);

            this.messenger.logPerformance('Search', startTime);
        } catch (error) {
            this.messenger.handleError(error, 'Search');
        }
    }

    // Helper methods
    showDragZone() {
        const dragZone = document.getElementById('dragDropZone');
        if (dragZone) {
            dragZone.classList.add('active');
            this.messenger.isDragActive = true;
        }
    }

    hideDragZone() {
        const dragZone = document.getElementById('dragDropZone');
        if (dragZone) {
            dragZone.classList.remove('active');
            this.messenger.isDragActive = false;
        }
    }

    toggleChatList(force) {
        const chatListPanel = document.querySelector('.chat-list-panel');
        if (chatListPanel) {
            if (force !== undefined) {
                chatListPanel.classList.toggle('open', force);
            } else {
                chatListPanel.classList.toggle('open');
            }
        }
    }

    scrollToBottom() {
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    // Navigation view implementations
    showChatsView() {
        const mainContent = document.querySelector('.main-content');
        const chatListPanel = document.querySelector('.chat-list-panel');
        const chatContainer = document.querySelector('.chat-container');

        if (mainContent) {
            mainContent.setAttribute('data-view', 'chats');
        }

        if (chatListPanel) {
            chatListPanel.style.display = 'flex';
        }

        if (chatContainer) {
            chatContainer.style.display = 'flex';
        }

        this.hideOtherViews(['calls', 'contacts', 'settings']);
    }

    showCallsView() {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.setAttribute('data-view', 'calls');
            mainContent.innerHTML = `
                <div class="calls-view">
                    <div class="calls-header">
                        <h2>Recent Calls</h2>
                        <button class="btn-primary" onclick="window.app?.uiEvents?.startCall('voice')">
                            📞 Start Call
                        </button>
                    </div>
                    <div class="calls-list">
                        <div class="call-item">
                            <div class="call-info">
                                <span class="call-contact">AI Assistant</span>
                                <span class="call-time">2 minutes ago</span>
                            </div>
                            <span class="call-type">📞</span>
                        </div>
                    </div>
                </div>
            `;
        }
        this.hideOtherViews(['chats', 'contacts', 'settings']);
    }

    showContactsView() {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.setAttribute('data-view', 'contacts');
            mainContent.innerHTML = `
                <div class="contacts-view">
                    <div class="contacts-header">
                        <h2>Contacts</h2>
                        <button class="btn-primary" onclick="window.app?.uiEvents?.showSearchModal()">
                            ➕ Add Contact
                        </button>
                    </div>
                    <div class="contacts-list">
                        <div class="contact-item">
                            <div class="contact-avatar">🤖</div>
                            <div class="contact-info">
                                <span class="contact-name">AI Assistant</span>
                                <span class="contact-status">Online</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        this.hideOtherViews(['chats', 'calls', 'settings']);
    }

    showSettingsView() {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.setAttribute('data-view', 'settings');
            mainContent.innerHTML = `
                <div class="settings-view">
                    <div class="settings-header">
                        <h2>Settings</h2>
                    </div>
                    <div class="settings-content">
                        <div class="setting-group">
                            <h3>Theme</h3>
                            <button class="btn-secondary" onclick="window.app?.messenger?.toggleTheme()">
                                Toggle Theme
                            </button>
                        </div>
                        <div class="setting-group">
                            <h3>Profile</h3>
                            <button class="btn-secondary" onclick="window.app?.uiEvents?.showProfileEditModal()">
                                Edit Profile
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        this.hideOtherViews(['chats', 'calls', 'contacts']);
    }

    hideOtherViews(excludeViews) {
        if (!excludeViews.includes('chats')) {
            const chatListPanel = document.querySelector('.chat-list-panel');
            const chatContainer = document.querySelector('.chat-container');
            if (chatListPanel) chatListPanel.style.display = 'none';
            if (chatContainer) chatContainer.style.display = 'none';
        }
    }

    loadChatMessages(chatId) {
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="message received">
                    <div class="message-avatar">🤖</div>
                    <div class="message-content">
                        <div class="message-text">Hello! How can I help you today?</div>
                        <div class="message-time">2:30 PM</div>
                    </div>
                </div>
            `;
        }

        // Always hide typing indicator when loading new chat
        this.hideTypingIndicator();
    }

    updateChatHeader(chatId) {
        const chatHeader = document.querySelector('.chat-header');
        if (chatHeader) {
            const chatData = this.getChatData(chatId);
            chatHeader.innerHTML = `
                <div class="chat-info">
                    <div class="chat-avatar">${chatData.avatar}</div>
                    <div class="chat-details">
                        <div class="chat-name">${chatData.name}</div>
                        <div class="chat-status">${chatData.status}</div>
                    </div>
                </div>
                <div class="chat-actions">
                    <button id="voiceCallBtn" class="btn-icon">📞</button>
                    <button id="videoCallBtn" class="btn-icon">📹</button>
                </div>
            `;

            // Rebind call events after updating header
            this.bindCallEvents();
        }
    }

    getChatData(chatId) {
        const chatMap = {
            '1': { name: 'AI Assistant', avatar: '🤖', status: 'Online' },
            '2': { name: 'General Chat', avatar: '💬', status: 'Active' },
            '3': { name: 'Support', avatar: '🎧', status: 'Available' }
        };
        return chatMap[chatId] || { name: 'Unknown Chat', avatar: '❓', status: 'Offline' };
    }

    showSearchLoading() {
        console.log('Showing search loading');
    }

    hideSearchLoading() {
        console.log('Hiding search loading');
    }

    clearSearchResults() {
        console.log('Clearing search results');
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
        }
    }

    showNoSearchResults() {
        console.log('Showing no search results');
    }

    addMessageToUI(message) {
        console.log('Adding message to UI:', message);

        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) {
            console.warn('Messages container not found');
            return;
        }

        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender === 'me' ? 'sent' : 'received'}`;
        messageElement.setAttribute('data-message-id', message.id);

        const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        if (message.sender === 'me') {
            messageElement.innerHTML = `
                <div class="message-content">
                    <div class="message-text">${this.escapeHtml(message.content)}</div>
                    <div class="message-time">${timestamp}</div>
                </div>
            `;
        } else {
            messageElement.innerHTML = `
                <div class="message-avatar">${message.avatar || '🤖'}</div>
                <div class="message-content">
                    <div class="message-text">${this.escapeHtml(message.content)}</div>
                    <div class="message-time">${timestamp}</div>
                </div>
            `;
        }

        messagesContainer.appendChild(messageElement);
        this.scrollToBottom();

        // Add smooth animation
        requestAnimationFrame(() => {
            messageElement.style.opacity = '0';
            messageElement.style.transform = 'translateY(20px)';
            messageElement.style.transition = 'all 0.3s ease';

            requestAnimationFrame(() => {
                messageElement.style.opacity = '1';
                messageElement.style.transform = 'translateY(0)';
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showTypingIndicator() {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) {
            indicator.style.display = 'flex';
        }
    }

    hideTypingIndicator() {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) {
            indicator.style.display = 'none';
            indicator.classList.remove('active');
        }

        // Also clear any ongoing typing timers
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }
    }

    addAutoResponse(originalMessage) {
        const responses = [
            "That's interesting! Tell me more.",
            "I understand what you mean.",
            "Thanks for sharing that with me.",
            "That sounds great!",
            "I'm here if you need anything else."
        ];

        const response = responses[Math.floor(Math.random() * responses.length)];

        setTimeout(() => {
            this.hideTypingIndicator();
            // Actually add the response message to UI
            this.addMessageToUI({
                id: Date.now() + 1,
                content: response,
                sender: 'other',
                timestamp: new Date().toISOString(),
                type: 'text'
            });
        }, 1000 + Math.random() * 2000);
    }

    showProfileEditModal() {
        const modal = document.getElementById('profileEditModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    showSearchModal() {
        const modal = document.getElementById('searchModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    closeModal(modal) {
        if (modal) {
            modal.classList.remove('active');
        }
    }

    closeTopModal() {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            activeModal.classList.remove('active');
        }
    }

    showNewChatModal() {
        console.log('Showing new chat modal');
    }

    toggleEmojiPicker() {
        if (window.emojiPicker) {
            window.emojiPicker.toggle();
        } else {
            // Create fallback emoji picker
            this.showEmojiPicker();
        }
    }

    showEmojiPicker() {
        // Remove existing picker if any
        const existingPicker = document.getElementById('emojiPicker');
        if (existingPicker) {
            existingPicker.remove();
            return;
        }

        const emojiPicker = document.createElement('div');
        emojiPicker.id = 'emojiPicker';
        emojiPicker.style.cssText = `
            position: absolute;
            bottom: 60px;
            right: 20px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            padding: 16px;
            z-index: 1000;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            max-width: 300px;
            max-height: 200px;
            overflow-y: auto;
        `;

        const emojis = [
            '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
            '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
            '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
            '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
            '👍', '👎', '👌', '🤞', '✌️', '🤟', '🤘', '👊', '✊', '🤛',
            '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '👂'
        ];

        let emojiHTML = '<div style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 8px;">';
        emojis.forEach(emoji => {
            emojiHTML += `
                <button class="emoji-btn" style="
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 8px;
                    transition: background 0.2s;
                " onmouseover="this.style.background='rgba(0,0,0,0.1)'"
                   onmouseout="this.style.background='none'"
                   onclick="window.app?.uiEvents?.insertEmoji('${emoji}')">${emoji}</button>
            `;
        });
        emojiHTML += '</div>';

        emojiPicker.innerHTML = emojiHTML;

        // Position relative to emoji button
        const emojiBtn = document.getElementById('emojiBtn');
        if (emojiBtn) {
            const rect = emojiBtn.getBoundingClientRect();
            emojiPicker.style.position = 'fixed';
            emojiPicker.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
            emojiPicker.style.right = (window.innerWidth - rect.right) + 'px';
        }

        document.body.appendChild(emojiPicker);

        // Close picker when clicking outside
        setTimeout(() => {
            document.addEventListener('click', this.closeEmojiPickerOnOutsideClick, true);
        }, 100);
    }

    closeEmojiPickerOnOutsideClick = (event) => {
        const emojiPicker = document.getElementById('emojiPicker');
        if (emojiPicker && !emojiPicker.contains(event.target) && event.target.id !== 'emojiBtn') {
            emojiPicker.remove();
            document.removeEventListener('click', this.closeEmojiPickerOnOutsideClick, true);
        }
    }

    insertEmoji(emoji) {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            const cursorPos = messageInput.selectionStart;
            const textBefore = messageInput.value.substring(0, cursorPos);
            const textAfter = messageInput.value.substring(cursorPos);

            messageInput.value = textBefore + emoji + textAfter;
            messageInput.focus();
            messageInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);

            // Auto-resize the textarea
            this.messenger.autoResizeTextarea(messageInput);
        }

        // Close emoji picker
        const emojiPicker = document.getElementById('emojiPicker');
        if (emojiPicker) {
            emojiPicker.remove();
            document.removeEventListener('click', this.closeEmojiPickerOnOutsideClick, true);
        }
    }

    openFileDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.txt';
        input.onchange = (e) => {
            console.log('Files selected:', Array.from(e.target.files));
        };
        input.click();
    }

    startCall(type) {
        console.log('Starting call:', type);
        const callManager = window.app?.callManager || window.callManager;
        const activeChatId = this.messagingService?.currentChatId || this.messenger?.currentChat;
        const participants = this.messagingService?.getChatParticipants(activeChatId);

        if (callManager) {
            callManager.startCall(type, activeChatId, participants);
        } else {
            // Fallback implementation for testing
            this.showCallInterface(type);
        }
    }

    endCall() {
        console.log('Ending call');

        const callManager = window.app?.callManager || window.callManager;
        if (callManager) {
            callManager.endCall();
        } else {
            // Fallback implementation
            this.hideCallInterface();
        }
    }

    showCallInterface(type) {
        // Create call overlay
        const callOverlay = document.createElement('div');
        callOverlay.id = 'callOverlay';
        callOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        `;

        callOverlay.innerHTML = `
            <div class="call-interface">
                <h2>${type === 'video' ? '📹' : '📞'} ${type === 'video' ? 'Video' : 'Voice'} Call</h2>
                <p>Calling AI Assistant...</p>
                <div class="call-controls">
                    <button id="muteBtn" class="btn-icon">🔇</button>
                    <button id="endCallBtn" class="btn-danger">📞 End Call</button>
                    ${type === 'video' ? '<button id="cameraBtn" class="btn-icon">📹</button>' : ''}
                </div>
            </div>
        `;

        document.body.appendChild(callOverlay);

        // Bind end call button
        document.getElementById('endCallBtn').addEventListener('click', () => {
            this.endCall();
        });

        // Simulate call connection after 2 seconds
        setTimeout(() => {
            const status = callOverlay.querySelector('p');
            if (status) {
                status.textContent = 'Connected';
            }
        }, 2000);
    }

    hideCallInterface() {
        const callOverlay = document.getElementById('callOverlay');
        if (callOverlay) {
            callOverlay.remove();
        }
    }

    handleFileDrop(e) {
        const files = Array.from(e.dataTransfer.files);
        console.log('Files dropped:', files);
        this.showFilePreview(files);
    }

    handlePaste(e) {
        const items = e.clipboardData.items;
        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                console.log('Image pasted:', file);
                this.showFilePreview([file]);
                e.preventDefault();
            }
        }
    }

    showFilePreview(files) {
        const preview = document.getElementById('filePreview');
        const fileList = document.getElementById('fileList');

        if (!preview || !fileList) return;

        fileList.innerHTML = '';

        files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-icon">📄</div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${this.formatFileSize(file.size)}</div>
                </div>
                <button class="file-remove" onclick="this.parentElement.remove()">×</button>
            `;
            fileList.appendChild(fileItem);
        });

        preview.classList.add('active');
    }

    hideFilePreview() {
        const preview = document.getElementById('filePreview');
        if (preview) {
            preview.classList.remove('active');
        }
    }

    sendSelectedFiles() {
        console.log('Sending selected files...');
        this.hideFilePreview();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async handleUserSearch(query) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer || !query || query.length < 2) {
            if (resultsContainer) {
                resultsContainer.innerHTML = `
                    <div class="search-placeholder">
                        <div class="search-placeholder-icon">👥</div>
                        <div class="search-placeholder-text">Start typing to search for users</div>
                    </div>
                `;
            }
            return;
        }

        // Show loading state
        resultsContainer.innerHTML = `
            <div class="search-placeholder">
                <div class="search-placeholder-icon">🔍</div>
                <div class="search-placeholder-text">Searching...</div>
            </div>
        `;

        try {
            // Search via API
            const response = await fetch(`/api/contacts/search/users?q=${encodeURIComponent(query)}&limit=10`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.data && result.data.length > 0) {
                resultsContainer.innerHTML = result.data.map(user => `
                    <div class="user-result" onclick="window.app?.uiEvents?.selectUser('${user.id}')">
                        <div class="user-result-avatar">
                            ${user.avatar_url ? `<img src="${user.avatar_url}" alt="${user.display_name}">` :
                              user.display_name ? user.display_name.substring(0, 2).toUpperCase() : '👤'}
                        </div>
                        <div class="user-result-info">
                            <div class="user-result-name">${user.display_name || user.nickname}</div>
                            <div class="user-result-details">@${user.nickname}</div>
                            ${user.bio ? `<div class="user-result-bio">${user.bio}</div>` : ''}
                            <div class="user-result-status">
                                <div class="status-indicator ${user.user_status || 'offline'}"></div>
                                <span>${user.user_status || 'offline'}</span>
                                ${user.is_verified ? '<span class="verified-badge">✓</span>' : ''}
                            </div>
                        </div>
                        <div class="user-result-actions">
                            ${user.is_contact ?
                                '<button class="btn-contact-exists">Contact</button>' :
                                '<button class="btn-add-contact" onclick="event.stopPropagation(); window.app?.uiEvents?.addContact(' + user.id + ')">Add</button>'
                            }
                        </div>
                    </div>
                `).join('');
            } else {
                // Fall back to demo data if API fails
                this.handleUserSearchFallback(query, resultsContainer);
            }
        } catch (error) {
            console.warn('User search API failed, using fallback:', error);
            this.handleUserSearchFallback(query, resultsContainer);
        }
    }

    handleUserSearchFallback(query, resultsContainer) {
        // Demo data fallback
        const demoUsers = [
            { id: 1, display_name: 'Alice Johnson', nickname: 'alice', email: 'alice@example.com', user_status: 'online', avatar: 'AJ' },
            { id: 2, display_name: 'Bob Smith', nickname: 'bob', email: 'bob@example.com', user_status: 'away', avatar: 'BS' },
            { id: 3, display_name: 'Carol Brown', nickname: 'carol', email: 'carol@example.com', user_status: 'offline', avatar: 'CB' },
            { id: 4, display_name: 'David Wilson', nickname: 'david', email: 'david@example.com', user_status: 'online', avatar: 'DW' }
        ];

        const filteredUsers = demoUsers.filter(user =>
            user.display_name.toLowerCase().includes(query.toLowerCase()) ||
            user.nickname.toLowerCase().includes(query.toLowerCase()) ||
            user.email.toLowerCase().includes(query.toLowerCase())
        );

        if (filteredUsers.length > 0) {
            resultsContainer.innerHTML = filteredUsers.map(user => `
                <div class="user-result" onclick="window.app?.uiEvents?.selectUser('${user.id}')">
                    <div class="user-result-avatar">${user.avatar}</div>
                    <div class="user-result-info">
                        <div class="user-result-name">${user.display_name}</div>
                        <div class="user-result-details">@${user.nickname}</div>
                        <div class="user-result-status">
                            <div class="status-indicator ${user.user_status}"></div>
                            <span>${user.user_status}</span>
                        </div>
                    </div>
                    <div class="user-result-actions">
                        <button class="btn-add-contact" onclick="event.stopPropagation(); window.app?.uiEvents?.addContact(${user.id})">Add</button>
                    </div>
                </div>
            `).join('');
        } else {
            resultsContainer.innerHTML = `
                <div class="search-placeholder">
                    <div class="search-placeholder-icon">❌</div>
                    <div class="search-placeholder-text">No users found</div>
                </div>
            `;
        }
    }

    async addContact(userId) {
        try {
            console.log('Adding contact:', userId);

            const response = await fetch('/api/contacts/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    message: 'Hi! I would like to connect with you.'
                })
            });

            const result = await response.json();

            if (result.success) {
                this.messenger?.showNotification?.('Friend request sent successfully!', 'success') ||
                    alert('Friend request sent successfully!');
            } else {
                this.messenger?.showNotification?.('Failed to send friend request: ' + result.error, 'error') ||
                    alert('Failed to send friend request: ' + result.error);
            }
        } catch (error) {
            console.error('Add contact error:', error);
            this.messenger?.showNotification?.('Network error. Please try again.', 'error') ||
                alert('Network error. Please try again.');
        }
    }

    selectUser(userId) {
        console.log('User selected:', userId);
        // Add user to contacts or start chat
        this.messenger.closeModal('userSearchModal');
    }

    handleTyping() {
        console.log('User is typing...');
    }

    focusGlobalSearch() {
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.focus();
        }
    }

    // Frontend-Backend Communication
    async sendMessageToBackend(message) {
        try {
            const response = await fetch('/api/messages/demo/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: message,
                    chatId: this.messenger.currentChat,
                    type: 'text'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ Message sent to backend:', result);
            return result;

        } catch (error) {
            console.error('❌ Failed to send message to backend:', error);
            this.messenger.handleError(error, 'Backend Communication');
            return null;
        }
    }

    async loadChatsFromBackend() {
        try {
            if (this.messagingService) {
                const chats = await this.messagingService.loadChats();
                console.log('✅ Chats loaded from messaging service:', chats);
                return chats;
            }

            const response = await fetch('/api/messages/demo/chats');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const chats = await response.json();
            console.log('✅ Chats loaded from backend:', chats);
            return chats;

        } catch (error) {
            console.error('❌ Failed to load chats from backend:', error);
            this.messenger.handleError(error, 'Backend Communication');
            return [];
        }
    }

    async loadMessagesFromBackend(chatId) {
        try {
            if (this.messagingService) {
                await this.messagingService.loadMessages(chatId);
                const cache = this.messagingService.messages.get(chatId.toString()) || [];
                console.log('✅ Messages loaded from messaging service:', cache);
                return cache;
            }

            const response = await fetch(`/api/messages/chats/${chatId}/messages`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const messages = await response.json();
            console.log('✅ Messages loaded from backend:', messages);
            return messages;

        } catch (error) {
            console.error('❌ Failed to load messages from backend:', error);
            this.messenger.handleError(error, 'Backend Communication');
            return [];
        }
    }

    handleLogout() {
        try {
            console.log('🚪 Logout initiated');

            // Clear local storage
            localStorage.removeItem('talkpai-token');
            localStorage.removeItem('talkpai-user');

            // Show logout confirmation
            this.messenger.showNotification('Logged out successfully', 'success');

            // In a real app, this would redirect to login page
            // For demo, we'll reload the page
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error) {
            console.error('❌ Logout error:', error);
            this.messenger.handleError(error, 'Logout');
        }
    }

    handleLogin() {
        try {
            console.log('🔐 Login initiated');

            // For demo, simulate login
            const demoUser = {
                id: 'demo-user-' + Math.random().toString(36).substr(2, 9),
                name: 'Demo User',
                email: 'demo@talkpai.com'
            };

            localStorage.setItem('talkpai-user', JSON.stringify(demoUser));
            localStorage.setItem('talkpai-token', 'demo-token-' + Date.now());

            this.messenger.showNotification('Login successful!', 'success');

            // Hide auth modal
            document.body.classList.remove('auth-mode');

        } catch (error) {
            console.error('❌ Login error:', error);
            this.messenger.handleError(error, 'Login');
        }
    }

    handleRegister() {
        try {
            console.log('📝 Registration initiated');

            // For demo, simulate registration
            const demoUser = {
                id: 'new-user-' + Math.random().toString(36).substr(2, 9),
                name: 'New User',
                email: 'newuser@talkpai.com'
            };

            localStorage.setItem('talkpai-user', JSON.stringify(demoUser));
            localStorage.setItem('talkpai-token', 'demo-token-' + Date.now());

            this.messenger.showNotification('Registration successful!', 'success');

            // Hide auth modal
            document.body.classList.remove('auth-mode');

        } catch (error) {
            console.error('❌ Registration error:', error);
            this.messenger.handleError(error, 'Registration');
        }
    }

    demoLogin() {
        try {
            console.log('🎮 Demo login initiated');

            const demoUser = {
                id: 'demo-user-001',
                name: 'Demo User',
                email: 'demo@talkpai.com',
                avatar: 'DU'
            };

            localStorage.setItem('talkpai-user', JSON.stringify(demoUser));
            localStorage.setItem('talkpai-token', 'demo-token');

            this.messenger.showNotification('Welcome to Talk pAI Demo!', 'success');

            // Hide auth modal
            document.body.classList.remove('auth-mode');

        } catch (error) {
            console.error('❌ Demo login error:', error);
            this.messenger.handleError(error, 'Demo Login');
        }
    }

    startVoiceCall() {
        try {
            console.log('📞 Starting voice call');
            this.startCall('voice');
        } catch (error) {
            console.error('❌ Voice call error:', error);
            this.messenger.handleError(error, 'Voice Call');
        }
    }

    startVideoCall() {
        try {
            console.log('📹 Starting video call');
            this.startCall('video');
        } catch (error) {
            console.error('❌ Video call error:', error);
            this.messenger.handleError(error, 'Video Call');
        }
    }

    showNewChatModal() {
        try {
            console.log('💬 Opening new chat modal');
            this.messenger.showNotification('New chat feature coming soon!', 'info');
        } catch (error) {
            console.error('❌ New chat modal error:', error);
            this.messenger.handleError(error, 'New Chat');
        }
    }

    toggleEmojiPicker() {
        try {
            console.log('😀 Toggling emoji picker');
            this.messenger.showNotification('Emoji picker coming soon!', 'info');
        } catch (error) {
            console.error('❌ Emoji picker error:', error);
            this.messenger.handleError(error, 'Emoji Picker');
        }
    }

    openFileDialog() {
        try {
            console.log('📎 Opening file dialog');
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = '*/*';
            input.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files);
            });
            input.click();
        } catch (error) {
            console.error('❌ File dialog error:', error);
            this.messenger.handleError(error, 'File Upload');
        }
    }

    handleFileSelection(files) {
        try {
            console.log('📁 Files selected:', files.length);
            for (let file of files) {
                console.log(`File: ${file.name}, Size: ${file.size} bytes`);
            }
            this.messenger.showNotification(`${files.length} file(s) selected`, 'success');
        } catch (error) {
            console.error('❌ File selection error:', error);
            this.messenger.handleError(error, 'File Selection');
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIEventsManager;
}

// Global access
window.UIEventsManager = UIEventsManager;
