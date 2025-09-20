/**
 * Talk pAI Production Interface Manager
 * Professional-grade UI/UX with full functionality
 */

class ProductionInterface {
    constructor() {
        this.isInitialized = false;
        this.currentView = 'chats';
        this.selectedChat = null;
        this.isDarkMode = false;
        this.init();
    }

    init() {
        this.setupThemeSystem();
        this.createCascadingSidebar();
        this.setupMessageInput();
        this.setupDragAndDrop();
        this.setupEmojiPicker();
        this.setupModalSystem();
        this.setupContactManagement();
        this.setupCallSystem();
        this.bindGlobalEvents();

        this.isInitialized = true;
        console.log('✅ Production Interface initialized');
    }

    setupThemeSystem() {
        // Get saved theme or system preference
        const savedTheme = localStorage.getItem('talkpai-theme');
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const theme = savedTheme || systemTheme;

        this.applyTheme(theme);

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('talkpai-theme')) {
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        this.isDarkMode = theme === 'dark';
        localStorage.setItem('talkpai-theme', theme);

        // Update theme toggle button if exists
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.textContent = this.isDarkMode ? '☀️' : '🌙';
        }
    }

    createCascadingSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        // Create enhanced sidebar structure
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <div class="user-profile-section">
                    <div class="user-avatar" id="userAvatar">👤</div>
                    <div class="user-info">
                        <h3 class="user-name" id="userName">User</h3>
                        <span class="user-status">
                            <div class="status-dot online"></div>
                            Online
                        </span>
                    </div>
                    <div class="sidebar-actions">
                        <button class="theme-toggle" onclick="productionInterface.toggleTheme()">🌙</button>
                        <button class="settings-btn" onclick="productionInterface.openSettings()">⚙️</button>
                    </div>
                </div>
            </div>

            <nav class="sidebar-navigation">
                <div class="nav-section">
                    <button class="nav-item active" data-view="chats" onclick="productionInterface.switchView('chats')">
                        <span class="nav-icon">💬</span>
                        <span class="nav-label">Chats</span>
                        <span class="nav-badge" id="chatsBadge">3</span>
                    </button>
                    <button class="nav-item" data-view="contacts" onclick="productionInterface.switchView('contacts')">
                        <span class="nav-icon">👥</span>
                        <span class="nav-label">Contacts</span>
                    </button>
                    <button class="nav-item" data-view="groups" onclick="productionInterface.switchView('groups')">
                        <span class="nav-icon">👨‍👩‍👧‍👦</span>
                        <span class="nav-label">Groups</span>
                    </button>
                    <button class="nav-item" data-view="calls" onclick="productionInterface.switchView('calls')">
                        <span class="nav-icon">📞</span>
                        <span class="nav-label">Calls</span>
                    </button>
                    <button class="nav-item" data-view="ai" onclick="productionInterface.switchView('ai')">
                        <span class="nav-icon">🤖</span>
                        <span class="nav-label">AI Assistant</span>
                    </button>
                </div>
            </nav>

            <div class="sidebar-panel" id="sidebarPanel">
                <!-- Dynamic content based on selected view -->
            </div>
        `;

        this.updateSidebarContent('chats');
    }

    switchView(view) {
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-view="${view}"]`).classList.add('active');

        this.currentView = view;
        this.updateSidebarContent(view);
        this.updateMainContent(view);
    }

    updateSidebarContent(view) {
        const panel = document.getElementById('sidebarPanel');
        if (!panel) return;

        switch (view) {
            case 'chats':
                panel.innerHTML = this.createChatsPanel();
                break;
            case 'contacts':
                panel.innerHTML = this.createContactsPanel();
                break;
            case 'groups':
                panel.innerHTML = this.createGroupsPanel();
                break;
            case 'calls':
                panel.innerHTML = this.createCallsPanel();
                break;
            case 'ai':
                panel.innerHTML = this.createAIPanel();
                break;
        }
    }

    createChatsPanel() {
        return `
            <div class="panel-header">
                <h3>Recent Chats</h3>
                <button class="new-chat-btn" onclick="productionInterface.startNewChat()">➕</button>
            </div>
            <div class="search-box">
                <input type="text" placeholder="Search chats..." id="chatSearch">
            </div>
            <div class="chat-list" id="chatList">
                <div class="chat-item active" onclick="productionInterface.selectChat('general')">
                    <div class="chat-avatar">GE</div>
                    <div class="chat-info">
                        <h4>General Chat</h4>
                        <p>Welcome to Talk pAI! 🚀</p>
                    </div>
                    <div class="chat-meta">
                        <span class="time">2m</span>
                        <span class="unread">3</span>
                    </div>
                </div>
                <div class="chat-item" onclick="productionInterface.selectChat('ai')">
                    <div class="chat-avatar">🤖</div>
                    <div class="chat-info">
                        <h4>AI Assistant</h4>
                        <p>How can I help you today?</p>
                    </div>
                    <div class="chat-meta">
                        <span class="time">5m</span>
                    </div>
                </div>
            </div>
        `;
    }

    createContactsPanel() {
        return `
            <div class="panel-header">
                <h3>Contacts</h3>
                <button class="add-contact-btn" onclick="productionInterface.addContact()">➕</button>
            </div>
            <div class="search-box">
                <input type="text" placeholder="Search contacts..." id="contactSearch">
            </div>
            <div class="contact-list" id="contactList">
                <div class="contact-item" onclick="productionInterface.openContactProfile('user1')">
                    <div class="contact-avatar">👤</div>
                    <div class="contact-info">
                        <h4>Demo User</h4>
                        <p>Online • Last seen 2m ago</p>
                    </div>
                    <div class="contact-actions">
                        <button onclick="productionInterface.startVideoCall('user1')" title="Video Call">📹</button>
                        <button onclick="productionInterface.startVoiceCall('user1')" title="Voice Call">📞</button>
                    </div>
                </div>
            </div>
        `;
    }

    createGroupsPanel() {
        return `
            <div class="panel-header">
                <h3>Groups</h3>
                <button class="create-group-btn" onclick="productionInterface.createGroup()">➕</button>
            </div>
            <div class="search-box">
                <input type="text" placeholder="Search groups..." id="groupSearch">
            </div>
            <div class="group-list" id="groupList">
                <div class="group-item" onclick="productionInterface.selectGroup('dev-team')">
                    <div class="group-avatar">DT</div>
                    <div class="group-info">
                        <h4>Development Team</h4>
                        <p>5 members • Last message 1h ago</p>
                    </div>
                </div>
            </div>
        `;
    }

    createCallsPanel() {
        return `
            <div class="panel-header">
                <h3>Recent Calls</h3>
                <button class="start-call-btn" onclick="productionInterface.startCall()">📞</button>
            </div>
            <div class="call-list" id="callList">
                <div class="call-item">
                    <div class="call-avatar">👤</div>
                    <div class="call-info">
                        <h4>Demo User</h4>
                        <p>📹 Video call • 5 min</p>
                    </div>
                    <div class="call-meta">
                        <span class="time">2h ago</span>
                        <button onclick="productionInterface.startVideoCall('user1')">📞</button>
                    </div>
                </div>
            </div>
        `;
    }

    createAIPanel() {
        return `
            <div class="panel-header">
                <h3>AI Assistant</h3>
            </div>
            <div class="ai-features">
                <button class="ai-feature" onclick="productionInterface.startAIChat()">
                    <span class="feature-icon">💬</span>
                    <span>Start AI Chat</span>
                </button>
                <button class="ai-feature" onclick="productionInterface.aiSummary()">
                    <span class="feature-icon">📄</span>
                    <span>Summarize Chat</span>
                </button>
                <button class="ai-feature" onclick="productionInterface.aiTranslate()">
                    <span class="feature-icon">🌐</span>
                    <span>Translate</span>
                </button>
            </div>
        `;
    }

    setupMessageInput() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        if (!messageInput || !sendBtn) return;

        // Auto-resize textarea
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        });

        // Send on Enter (Shift+Enter for new line)
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Send button
        sendBtn.addEventListener('click', () => this.sendMessage());

        // Typing indicator
        let typingTimer;
        messageInput.addEventListener('input', () => {
            clearTimeout(typingTimer);
            this.showTypingIndicator(true);
            typingTimer = setTimeout(() => {
                this.showTypingIndicator(false);
            }, 1000);
        });
    }

    setupDragAndDrop() {
        const chatArea = document.querySelector('.chat-area');
        if (!chatArea) return;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            chatArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Visual feedback for drag
        ['dragenter', 'dragover'].forEach(eventName => {
            chatArea.addEventListener(eventName, () => {
                chatArea.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            chatArea.addEventListener(eventName, () => {
                chatArea.classList.remove('drag-over');
            });
        });

        // Handle dropped files
        chatArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFileUpload(files);
        });
    }

    setupEmojiPicker() {
        const emojiBtn = document.getElementById('emojiBtn');
        if (!emojiBtn) return;

        emojiBtn.addEventListener('click', () => {
            this.toggleEmojiPicker();
        });
    }

    toggleEmojiPicker() {
        let picker = document.getElementById('emojiPicker');

        if (picker) {
            picker.remove();
            return;
        }

        picker = document.createElement('div');
        picker.id = 'emojiPicker';
        picker.className = 'emoji-picker';
        picker.innerHTML = `
            <div class="emoji-categories">
                <button data-category="smileys">😀</button>
                <button data-category="people">👥</button>
                <button data-category="nature">🌿</button>
                <button data-category="food">🍕</button>
                <button data-category="activities">⚽</button>
                <button data-category="travel">🚗</button>
                <button data-category="objects">💡</button>
                <button data-category="symbols">❤️</button>
            </div>
            <div class="emoji-grid" id="emojiGrid">
                ${this.generateEmojiGrid('smileys')}
            </div>
        `;

        document.body.appendChild(picker);

        // Position near emoji button
        const rect = document.getElementById('emojiBtn').getBoundingClientRect();
        picker.style.position = 'fixed';
        picker.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
        picker.style.left = rect.left + 'px';

        // Bind category switching
        picker.querySelectorAll('[data-category]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                document.getElementById('emojiGrid').innerHTML = this.generateEmojiGrid(category);
            });
        });

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', this.closeEmojiPicker, true);
        }, 100);
    }

    generateEmojiGrid(category) {
        const emojis = {
            smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩'],
            people: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
            nature: ['🌱', '🌿', '🍀', '🍃', '🍂', '🍁', '🌾', '🌲', '🌳', '🌴', '🌵', '🌶️', '🍄', '🌰', '🌼', '🌻', '🌺', '🌸', '🌷', '💐', '🌹', '🥀', '🌭', '🌮', '🌯', '🍟', '🍕', '🌮', '🌭', '🍔'],
            food: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥒', '🥬', '🌶️', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥖', '🍞'],
            activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️'],
            travel: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞'],
            objects: ['💡', '🔦', '🏮', '🪔', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '💾', '💿', '📀', '🧮', '🎥', '📹', '📷', '📸', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏰', '⏳', '⌛', '📡', '🔋'],
            symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐']
        };

        return (emojis[category] || emojis.smileys).map(emoji =>
            `<button class="emoji-btn" onclick="productionInterface.insertEmoji('${emoji}')">${emoji}</button>`
        ).join('');
    }

    insertEmoji(emoji) {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput) return;

        const start = messageInput.selectionStart;
        const end = messageInput.selectionEnd;
        const text = messageInput.value;

        messageInput.value = text.substring(0, start) + emoji + text.substring(end);
        messageInput.focus();
        messageInput.setSelectionRange(start + emoji.length, start + emoji.length);

        this.closeEmojiPicker();
    }

    closeEmojiPicker = (e) => {
        const picker = document.getElementById('emojiPicker');
        const emojiBtn = document.getElementById('emojiBtn');

        if (picker && !picker.contains(e.target) && !emojiBtn.contains(e.target)) {
            picker.remove();
            document.removeEventListener('click', this.closeEmojiPicker, true);
        }
    }

    setupModalSystem() {
        // Ensure all modals have proper close functionality
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.closeModal(e.target);
            }
            if (e.target.classList.contains('modal-close')) {
                this.closeModal(e.target.closest('.modal-overlay'));
            }
        });

        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal-overlay:not([style*="display: none"])');
                if (openModal) {
                    this.closeModal(openModal);
                }
            }
        });
    }

    closeModal(modal) {
        if (modal) {
            modal.style.display = 'none';
            modal.style.opacity = '0';
        }
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            modal.style.opacity = '1';
        }
    }

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (!message) return;

        // Create message element
        this.addMessageToChat({
            id: Date.now(),
            content: message,
            sender: 'You',
            timestamp: new Date(),
            isSelf: true
        });

        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';

        // Send to server (implement your API call here)
        this.sendMessageToServer(message);
    }

    addMessageToChat(message) {
        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) return;

        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.isSelf ? 'sent' : 'received'}`;
        messageEl.innerHTML = `
            <div class="message-bubble">
                <div class="message-content">${this.escapeHtml(message.content)}</div>
                <div class="message-time">${this.formatTime(message.timestamp)}</div>
            </div>
        `;

        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime(date) {
        return new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    sendMessageToServer(message) {
        // Implement your server communication here
        console.log('Sending message:', message);

        // Demo response
        setTimeout(() => {
            this.addMessageToChat({
                id: Date.now() + 1,
                content: `Thanks for your message: "${message}"`,
                sender: 'Demo User',
                timestamp: new Date(),
                isSelf: false
            });
        }, 1000);
    }

    handleFileUpload(files) {
        Array.from(files).forEach(file => {
            this.uploadFile(file);
        });
    }

    uploadFile(file) {
        // Create file message
        this.addMessageToChat({
            id: Date.now(),
            content: `📎 ${file.name} (${this.formatFileSize(file.size)})`,
            sender: 'You',
            timestamp: new Date(),
            isSelf: true,
            isFile: true
        });

        // TODO: Implement actual file upload to server
        console.log('Uploading file:', file.name);
    }

    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    toggleTheme() {
        const newTheme = this.isDarkMode ? 'light' : 'dark';
        this.applyTheme(newTheme);
    }

    // Public API methods
    selectChat(chatId) {
        this.selectedChat = chatId;
        console.log('Selected chat:', chatId);
        // Update UI accordingly
    }

    startNewChat() {
        console.log('Starting new chat');
        // Implement new chat logic
    }

    addContact() {
        console.log('Adding contact');
        // Implement add contact logic
    }

    startVideoCall(userId) {
        console.log('Starting video call with:', userId);
        // Implement video call logic
    }

    startVoiceCall(userId) {
        console.log('Starting voice call with:', userId);
        // Implement voice call logic
    }

    openSettings() {
        console.log('Opening settings');
        // Implement settings modal
    }

    bindGlobalEvents() {
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'k':
                        e.preventDefault();
                        document.getElementById('chatSearch')?.focus();
                        break;
                    case '1':
                        e.preventDefault();
                        this.switchView('chats');
                        break;
                    case '2':
                        e.preventDefault();
                        this.switchView('contacts');
                        break;
                    case '3':
                        e.preventDefault();
                        this.switchView('groups');
                        break;
                }
            }
        });
    }

    showTypingIndicator(show) {
        // Implement typing indicator logic
        console.log('Typing indicator:', show);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.productionInterface = new ProductionInterface();
    });
} else {
    window.productionInterface = new ProductionInterface();
}

// Global access
window.ProductionInterface = ProductionInterface;