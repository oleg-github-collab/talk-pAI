/**
 * TalkPAI UI Events Module
 * Handles all user interface events and interactions
 */

class UIEventsManager {
    constructor(messenger) {
        this.messenger = messenger;
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

        // Modal drag functionality
        this.setupModalDrag();
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

    setupModalDrag() {
        const modals = document.querySelectorAll('.modal-content');
        modals.forEach(modal => {
            const header = modal.querySelector('.modal-header');
            if (header) {
                this.makeDraggable(modal, header);
            }
        });
    }

    makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIEventsManager;
}

// Global access
window.UIEventsManager = UIEventsManager;