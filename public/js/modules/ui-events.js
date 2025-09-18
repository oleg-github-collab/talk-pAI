/**
 * TalkPAI UI Events Module - FIXED VERSION
 * Handles all user interface events and interactions
 */

class UIEventsManager {
    constructor(messenger) {
        this.messenger = messenger;
        this.typingTimer = null;
        this.bindEvents();
    }

    bindEvents() {
        this.bindSidebarEvents();
        this.bindNavigationEvents();
        this.bindChatEvents();
        this.bindMessageEvents();
        this.bindCallEvents();
        this.bindDragDropEvents();
        this.bindModalEvents();
        this.bindKeyboardEvents();
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
        // Navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchNavigation(item.dataset.nav);
            });
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
        }
    }

    bindChatEvents() {
        // Chat items
        document.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectChat(item.dataset.chat);
            });
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

        // File attachment button
        document.getElementById('attachBtn')?.addEventListener('click', () => {
            this.openFileDialog();
        });
    }

    bindCallEvents() {
        // Voice call button
        document.getElementById('voiceCallBtn')?.addEventListener('click', () => {
            this.startCall('voice');
        });

        // Video call button
        document.getElementById('videoCallBtn')?.addEventListener('click', () => {
            this.startCall('video');
        });

        // Call control buttons
        document.getElementById('muteBtn')?.addEventListener('click', () => {
            this.messenger.toggleMute();
        });

        document.getElementById('cameraBtn')?.addEventListener('click', () => {
            this.messenger.toggleVideo();
        });

        document.getElementById('endCallBtn')?.addEventListener('click', () => {
            this.endCall();
        });

        document.getElementById('speakerBtn')?.addEventListener('click', () => {
            this.messenger.toggleSpeaker();
        });

        document.getElementById('screenShareBtn')?.addEventListener('click', () => {
            this.messenger.toggleScreenShare();
        });
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
        // Profile edit modal
        document.getElementById('editProfileBtn')?.addEventListener('click', () => {
            this.showProfileEditModal();
        });

        // Search users modal
        document.getElementById('searchUsersBtn')?.addEventListener('click', () => {
            this.showSearchModal();
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close, .modal-overlay').forEach(element => {
            element.addEventListener('click', (e) => {
                if (e.target === element) {
                    this.closeModal(e.target.closest('.modal'));
                }
            });
        });
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

    // Event handler implementations
    switchNavigation(navType) {
        try {
            const startTime = performance.now();

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
            switch (navType) {
                case 'chats':
                    this.showChatsView();
                    break;
                case 'calls':
                    this.showCallsView();
                    break;
                case 'contacts':
                    this.showContactsView();
                    break;
                case 'settings':
                    this.showSettingsView();
                    break;
            }

            this.messenger.logPerformance('Navigation Switch', startTime);
        } catch (error) {
            this.messenger.handleError(error, 'Navigation');
        }
    }

    selectChat(chatId) {
        try {
            const startTime = performance.now();

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
            this.messenger.currentChat = chatId;

            // Load chat messages
            this.loadChatMessages(chatId);

            // Update chat header
            this.updateChatHeader(chatId);

            // Close chat list on mobile
            if (window.innerWidth <= 968) {
                this.toggleChatList(false);
            }

            this.messenger.logPerformance('Chat Selection', startTime);
        } catch (error) {
            this.messenger.handleError(error, 'Chat Selection');
        }
    }

    sendMessage() {
        try {
            const messageInput = document.getElementById('messageInput');
            const message = messageInput.value.trim();

            if (!message) return;

            const startTime = performance.now();

            // Add message to UI
            this.addMessageToUI({
                id: Date.now(),
                content: message,
                sender: 'me',
                timestamp: new Date().toISOString(),
                type: 'text'
            });

            // Clear input
            messageInput.value = '';
            this.messenger.autoResizeTextarea(messageInput);

            // Scroll to bottom
            this.scrollToBottom();

            // Simulate typing indicator and response
            this.showTypingIndicator();

            setTimeout(() => {
                this.hideTypingIndicator();
                this.addAutoResponse(message);
            }, 1000 + Math.random() * 2000);

            this.messenger.logPerformance('Send Message', startTime);
        } catch (error) {
            this.messenger.handleError(error, 'Send Message');
        }
    }

    handleSearch(query) {
        try {
            if (!query || query.length < 2) {
                this.clearSearchResults();
                return;
            }

            const startTime = performance.now();

            // Show loading state
            this.showSearchLoading();

            // Simulate API call with timeout
            setTimeout(() => {
                // Filter chats based on query
                const chatItems = document.querySelectorAll('.chat-item');
                let visibleCount = 0;

                chatItems.forEach(item => {
                    const chatName = item.querySelector('.chat-name').textContent.toLowerCase();
                    const chatPreview = item.querySelector('.chat-preview').textContent.toLowerCase();
                    const searchTerm = query.toLowerCase();

                    const isMatch = chatName.includes(searchTerm) || chatPreview.includes(searchTerm);

                    if (isMatch) {
                        item.style.display = 'flex';
                        visibleCount++;
                    } else {
                        item.style.display = 'none';
                    }
                });

                this.hideSearchLoading();
                this.messenger.logPerformance('Search', startTime);

                if (visibleCount === 0) {
                    this.showNoSearchResults();
                }
            }, 300);

        } catch (error) {
            this.messenger.handleError(error, 'Search');
        }
    }

    // Helper methods
    showDragZone() {
        const dragZone = document.getElementById('dragZone');
        if (dragZone) {
            dragZone.classList.add('active');
            this.messenger.isDragActive = true;
        }
    }

    hideDragZone() {
        const dragZone = document.getElementById('dragZone');
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

        if (window.app && window.app.callManager) {
            window.app.callManager.initiateCall(type);
        } else {
            // Fallback implementation for testing
            this.showCallInterface(type);
        }
    }

    endCall() {
        console.log('Ending call');

        if (window.app && window.app.callManager) {
            window.app.callManager.endCall();
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
    }

    handlePaste(e) {
        const items = e.clipboardData.items;
        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                console.log('Image pasted:', file);
                e.preventDefault();
            }
        }
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
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIEventsManager;
}

// Global access
window.UIEventsManager = UIEventsManager;