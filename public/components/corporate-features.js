// Corporate Features Component for Talk pAI
// Advanced enterprise features: channels, threads, statuses, teams

class CorporateFeatures {
    constructor() {
        this.channels = new Map();
        this.threads = new Map();
        this.teams = new Map();
        this.workspaces = new Map();
        this.userStatuses = new Map();
        this.presenceStates = new Map();
        this.mentions = new Map();
        this.pinnedMessages = new Map();

        this.init();
    }

    init() {
        this.setupStatusSystem();
        this.setupChannelSystem();
        this.setupThreadSystem();
        this.setupMentionSystem();
        this.setupPresenceSystem();
        this.setupWorkspaceSystem();
        this.bindEvents();
    }

    // Advanced Status System
    setupStatusSystem() {
        this.statusTypes = {
            'online': { icon: '🟢', text: 'Online', color: '#4ade80' },
            'away': { icon: '🟡', text: 'Away', color: '#f59e0b' },
            'busy': { icon: '🔴', text: 'Busy', color: '#ef4444' },
            'dnd': { icon: '⛔', text: 'Do Not Disturb', color: '#dc2626' },
            'meeting': { icon: '📅', text: 'In Meeting', color: '#8b5cf6' },
            'lunch': { icon: '🍽️', text: 'At Lunch', color: '#06b6d4' },
            'commuting': { icon: '🚗', text: 'Commuting', color: '#6366f1' },
            'invisible': { icon: '👻', text: 'Invisible', color: '#64748b' }
        };

        this.customStatuses = new Map();
    }

    createStatusSelector() {
        const statusContainer = document.createElement('div');
        statusContainer.className = 'status-selector glassmorphism';
        statusContainer.innerHTML = `
            <div class="status-header">
                <h3>Set Status</h3>
                <button class="close-btn" onclick="this.closest('.status-selector').remove()">×</button>
            </div>
            <div class="status-options">
                ${Object.entries(this.statusTypes).map(([key, status]) => `
                    <div class="status-option" data-status="${key}">
                        <span class="status-icon">${status.icon}</span>
                        <span class="status-text">${status.text}</span>
                        <div class="status-color" style="background: ${status.color}"></div>
                    </div>
                `).join('')}
            </div>
            <div class="custom-status">
                <input type="text" placeholder="Set custom status message..." maxlength="100">
                <input type="datetime-local" class="status-expiry" title="Status expires at">
                <button class="set-custom-status">Set</button>
            </div>
        `;

        return statusContainer;
    }

    // Channel Management System
    setupChannelSystem() {
        this.channelTypes = {
            'public': { icon: '#', description: 'Public channel' },
            'private': { icon: '🔒', description: 'Private channel' },
            'announcement': { icon: '📢', description: 'Announcement only' },
            'general': { icon: '💬', description: 'General discussion' },
            'project': { icon: '📁', description: 'Project specific' },
            'random': { icon: '🎲', description: 'Random chat' }
        };
    }

    createChannelManager() {
        const channelManager = document.createElement('div');
        channelManager.className = 'channel-manager glassmorphism';
        channelManager.innerHTML = `
            <div class="channel-header">
                <h3>Channel Management</h3>
                <button class="create-channel-btn">+ Create Channel</button>
            </div>
            <div class="channel-categories">
                <div class="category" data-category="public">
                    <h4><span class="category-icon">#</span> Public Channels</h4>
                    <div class="channel-list" id="public-channels"></div>
                </div>
                <div class="category" data-category="private">
                    <h4><span class="category-icon">🔒</span> Private Channels</h4>
                    <div class="channel-list" id="private-channels"></div>
                </div>
                <div class="category" data-category="archived">
                    <h4><span class="category-icon">📦</span> Archived</h4>
                    <div class="channel-list" id="archived-channels"></div>
                </div>
            </div>
        `;

        return channelManager;
    }

    createChannelItem(channel) {
        const channelItem = document.createElement('div');
        channelItem.className = 'channel-item';
        channelItem.dataset.channelId = channel.id;

        const unreadCount = this.getUnreadCount(channel.id);
        const isActive = this.isChannelActive(channel.id);

        channelItem.innerHTML = `
            <div class="channel-info">
                <span class="channel-icon">${this.channelTypes[channel.type]?.icon || '#'}</span>
                <span class="channel-name">${channel.name}</span>
                ${channel.topic ? `<span class="channel-topic">${channel.topic}</span>` : ''}
            </div>
            <div class="channel-meta">
                ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                <span class="member-count">${channel.memberCount || 0}</span>
                <div class="channel-actions">
                    <button class="channel-action" data-action="mute">🔕</button>
                    <button class="channel-action" data-action="star">⭐</button>
                    <button class="channel-action" data-action="settings">⚙️</button>
                </div>
            </div>
        `;

        if (isActive) channelItem.classList.add('active');
        if (channel.isMuted) channelItem.classList.add('muted');
        if (channel.isStarred) channelItem.classList.add('starred');

        return channelItem;
    }

    // Thread Management System
    setupThreadSystem() {
        this.threadStates = new Map();
    }

    createThreadView(messageId, parentMessage) {
        const threadView = document.createElement('div');
        threadView.className = 'thread-view glassmorphism';
        threadView.dataset.messageId = messageId;

        threadView.innerHTML = `
            <div class="thread-header">
                <div class="thread-info">
                    <button class="back-btn">← Back</button>
                    <h3>Thread</h3>
                    <span class="thread-participants">${this.getThreadParticipants(messageId)} replies</span>
                </div>
                <div class="thread-actions">
                    <button class="follow-thread">👁️ Follow</button>
                    <button class="thread-settings">⚙️</button>
                </div>
            </div>

            <div class="thread-content">
                <div class="parent-message">
                    ${this.renderMessage(parentMessage, true)}
                </div>

                <div class="thread-replies" id="thread-${messageId}">
                    ${this.renderThreadReplies(messageId)}
                </div>
            </div>

            <div class="thread-input">
                <div class="thread-composer">
                    <div class="composer-header">
                        <span>Reply to thread</span>
                        <label class="also-send-to-channel">
                            <input type="checkbox"> Also send to #${this.getCurrentChannelName()}
                        </label>
                    </div>
                    <div class="composer-input">
                        <textarea placeholder="Reply to thread..." rows="3"></textarea>
                        <div class="composer-actions">
                            <button class="attach-file">📎</button>
                            <button class="add-emoji">😊</button>
                            <button class="mention-user">@</button>
                            <button class="send-reply">Send</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return threadView;
    }

    // Mention System
    setupMentionSystem() {
        this.mentionTypes = {
            'user': { prefix: '@', style: 'user-mention' },
            'channel': { prefix: '#', style: 'channel-mention' },
            'everyone': { prefix: '@', style: 'everyone-mention' },
            'here': { prefix: '@', style: 'here-mention' },
            'group': { prefix: '@', style: 'group-mention' }
        };
    }

    createMentionPicker(inputElement, cursorPosition) {
        const picker = document.createElement('div');
        picker.className = 'mention-picker glassmorphism';

        const users = this.getAvailableUsers();
        const channels = this.getAvailableChannels();
        const groups = this.getAvailableGroups();

        picker.innerHTML = `
            <div class="mention-sections">
                <div class="mention-section">
                    <h4>People</h4>
                    ${users.map(user => `
                        <div class="mention-option" data-type="user" data-id="${user.id}">
                            <img src="${user.avatar}" class="mention-avatar">
                            <div class="mention-info">
                                <span class="mention-name">${user.displayName}</span>
                                <span class="mention-username">@${user.username}</span>
                                <span class="mention-status">${user.status}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="mention-section">
                    <h4>Channels</h4>
                    ${channels.map(channel => `
                        <div class="mention-option" data-type="channel" data-id="${channel.id}">
                            <span class="mention-icon">#</span>
                            <div class="mention-info">
                                <span class="mention-name">${channel.name}</span>
                                <span class="mention-desc">${channel.description}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="mention-section">
                    <h4>Special</h4>
                    <div class="mention-option" data-type="everyone" data-id="everyone">
                        <span class="mention-icon">👥</span>
                        <span class="mention-name">@everyone</span>
                        <span class="mention-desc">Notify all members</span>
                    </div>
                    <div class="mention-option" data-type="here" data-id="here">
                        <span class="mention-icon">👋</span>
                        <span class="mention-name">@here</span>
                        <span class="mention-desc">Notify online members</span>
                    </div>
                </div>
            </div>
        `;

        return picker;
    }

    // Presence System
    setupPresenceSystem() {
        this.presenceInterval = setInterval(() => {
            this.updatePresenceIndicators();
        }, 30000); // Update every 30 seconds
    }

    updatePresenceIndicators() {
        document.querySelectorAll('.presence-indicator').forEach(indicator => {
            const userId = indicator.dataset.userId;
            const presence = this.getUserPresence(userId);

            indicator.className = `presence-indicator ${presence.status}`;
            indicator.title = `${presence.status} - Last seen ${presence.lastSeen}`;
        });
    }

    createPresenceIndicator(userId) {
        const indicator = document.createElement('div');
        indicator.className = 'presence-indicator';
        indicator.dataset.userId = userId;

        const presence = this.getUserPresence(userId);
        indicator.classList.add(presence.status);
        indicator.title = `${presence.status} - Last seen ${presence.lastSeen}`;

        return indicator;
    }

    // Workspace System
    setupWorkspaceSystem() {
        this.currentWorkspace = null;
        this.workspaceSettings = new Map();
    }

    createWorkspaceSwitcher() {
        const switcher = document.createElement('div');
        switcher.className = 'workspace-switcher glassmorphism';

        switcher.innerHTML = `
            <div class="workspace-header">
                <h3>Workspaces</h3>
                <button class="add-workspace">+</button>
            </div>
            <div class="workspace-list">
                ${Array.from(this.workspaces.values()).map(workspace => `
                    <div class="workspace-item ${workspace.id === this.currentWorkspace?.id ? 'active' : ''}"
                         data-workspace-id="${workspace.id}">
                        <div class="workspace-avatar">
                            ${workspace.logo ? `<img src="${workspace.logo}">` : workspace.name.charAt(0)}
                        </div>
                        <div class="workspace-info">
                            <span class="workspace-name">${workspace.name}</span>
                            <span class="workspace-members">${workspace.memberCount} members</span>
                        </div>
                        <div class="workspace-notification">
                            ${this.getWorkspaceUnreadCount(workspace.id) || ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        return switcher;
    }

    // Team Management
    createTeamManager() {
        const teamManager = document.createElement('div');
        teamManager.className = 'team-manager glassmorphism';

        teamManager.innerHTML = `
            <div class="team-header">
                <h3>Team Management</h3>
                <button class="create-team-btn">+ Create Team</button>
            </div>

            <div class="team-list">
                ${this.renderTeamList()}
            </div>

            <div class="team-permissions">
                <h4>Permissions</h4>
                <div class="permission-matrix">
                    ${this.renderPermissionMatrix()}
                </div>
            </div>
        `;

        return teamManager;
    }

    // Event Handlers
    bindEvents() {
        // Channel events
        document.addEventListener('click', (e) => {
            if (e.target.matches('.create-channel-btn')) {
                this.showCreateChannelDialog();
            }

            if (e.target.matches('.channel-item')) {
                this.switchToChannel(e.target.dataset.channelId);
            }

            if (e.target.matches('.start-thread')) {
                this.startThread(e.target.dataset.messageId);
            }

            if (e.target.matches('.mention-option')) {
                this.insertMention(e.target);
            }

            if (e.target.matches('.status-option')) {
                this.setUserStatus(e.target.dataset.status);
            }
        });

        // Thread events
        document.addEventListener('input', (e) => {
            if (e.target.matches('.thread-composer textarea')) {
                this.handleThreadComposerInput(e);
            }
        });

        // Mention events
        document.addEventListener('keydown', (e) => {
            if (e.target.matches('textarea, input[type="text"]')) {
                this.handleMentionKeydown(e);
            }
        });
    }

    // API Integration Methods
    async createChannel(channelData) {
        try {
            const response = await fetch('/api/enhanced/channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(channelData)
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to create channel:', error);
        }
    }

    async joinChannel(channelId) {
        try {
            const response = await fetch(`/api/enhanced/channels/${channelId}/join`, {
                method: 'POST'
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to join channel:', error);
        }
    }

    async createThread(messageId, content) {
        try {
            const response = await fetch(`/api/enhanced/messages/${messageId}/thread`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to create thread:', error);
        }
    }

    async updateUserStatus(status, message = '', expiresAt = null) {
        try {
            const response = await fetch('/api/enhanced/users/status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, message, expiresAt })
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    }

    // Utility Methods
    getUnreadCount(channelId) {
        return this.channels.get(channelId)?.unreadCount || 0;
    }

    isChannelActive(channelId) {
        return this.currentChannel === channelId;
    }

    getThreadParticipants(messageId) {
        return this.threads.get(messageId)?.participants?.length || 0;
    }

    getUserPresence(userId) {
        return this.presenceStates.get(userId) || {
            status: 'offline',
            lastSeen: 'Unknown'
        };
    }

    getWorkspaceUnreadCount(workspaceId) {
        const count = this.workspaces.get(workspaceId)?.unreadCount || 0;
        return count > 0 ? count : null;
    }

    getCurrentChannelName() {
        return this.channels.get(this.currentChannel)?.name || 'general';
    }

    getAvailableUsers() {
        // Mock data - replace with actual API call
        return [
            { id: 1, username: 'john', displayName: 'John Doe', avatar: '/avatars/john.jpg', status: 'online' },
            { id: 2, username: 'jane', displayName: 'Jane Smith', avatar: '/avatars/jane.jpg', status: 'away' }
        ];
    }

    getAvailableChannels() {
        return Array.from(this.channels.values());
    }

    getAvailableGroups() {
        return Array.from(this.teams.values());
    }

    renderTeamList() {
        return Array.from(this.teams.values()).map(team => `
            <div class="team-item" data-team-id="${team.id}">
                <div class="team-info">
                    <span class="team-name">${team.name}</span>
                    <span class="team-members">${team.members.length} members</span>
                </div>
                <div class="team-actions">
                    <button class="edit-team">Edit</button>
                    <button class="delete-team">Delete</button>
                </div>
            </div>
        `).join('');
    }

    renderPermissionMatrix() {
        const permissions = ['read', 'write', 'delete', 'moderate', 'admin'];
        const roles = ['member', 'moderator', 'admin', 'owner'];

        return `
            <table class="permission-table">
                <thead>
                    <tr>
                        <th>Permission</th>
                        ${roles.map(role => `<th>${role}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${permissions.map(permission => `
                        <tr>
                            <td>${permission}</td>
                            ${roles.map(role => `
                                <td>
                                    <input type="checkbox"
                                           data-permission="${permission}"
                                           data-role="${role}"
                                           ${this.hasPermission(role, permission) ? 'checked' : ''}>
                                </td>
                            `).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    hasPermission(role, permission) {
        // Mock permission logic
        const permissionMap = {
            'member': ['read'],
            'moderator': ['read', 'write', 'moderate'],
            'admin': ['read', 'write', 'delete', 'moderate', 'admin'],
            'owner': ['read', 'write', 'delete', 'moderate', 'admin']
        };

        return permissionMap[role]?.includes(permission) || false;
    }

    // Cleanup
    destroy() {
        if (this.presenceInterval) {
            clearInterval(this.presenceInterval);
        }
    }
}

// Export for use in other components
window.CorporateFeatures = CorporateFeatures;