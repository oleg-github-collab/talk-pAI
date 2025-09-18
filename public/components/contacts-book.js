// Enhanced Contacts Book and User Search for Talk pAI
// Advanced contact management with groups, search, and discovery

class ContactsBook {
    constructor() {
        this.contacts = new Map();
        this.contactGroups = new Map();
        this.friendRequests = new Map();
        this.searchHistory = [];
        this.searchCache = new Map();
        this.selectedContacts = new Set();
        this.currentView = 'all'; // all, favorites, groups, requests, blocked

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadContacts();
        this.loadFriendRequests();
    }

    // Create main contacts interface
    createContactsInterface() {
        const contactsInterface = document.createElement('div');
        contactsInterface.className = 'contacts-interface glassmorphism';
        contactsInterface.innerHTML = `
            <div class="contacts-header">
                <div class="contacts-title">
                    <h2>Contacts</h2>
                    <span class="contacts-count">${this.contacts.size} contacts</span>
                </div>
                <div class="contacts-actions">
                    <button class="add-contact-btn" title="Add Contact">
                        <span class="icon">👤+</span>
                    </button>
                    <button class="search-users-btn" title="Search Users">
                        <span class="icon">🔍</span>
                    </button>
                    <button class="sync-contacts-btn" title="Sync Contacts">
                        <span class="icon">🔄</span>
                    </button>
                </div>
            </div>

            <div class="contacts-search">
                <div class="search-input-container">
                    <input type="text" class="contacts-search-input" placeholder="Search contacts..." autocomplete="off">
                    <button class="clear-search" style="display: none;">×</button>
                </div>
                <div class="search-suggestions" style="display: none;"></div>
            </div>

            <div class="contacts-filters">
                <div class="filter-tabs">
                    <button class="filter-tab active" data-filter="all">
                        <span class="tab-icon">👥</span>
                        <span class="tab-text">All</span>
                        <span class="tab-count">${this.contacts.size}</span>
                    </button>
                    <button class="filter-tab" data-filter="favorites">
                        <span class="tab-icon">⭐</span>
                        <span class="tab-text">Favorites</span>
                        <span class="tab-count">${this.getFavoriteCount()}</span>
                    </button>
                    <button class="filter-tab" data-filter="groups">
                        <span class="tab-icon">📁</span>
                        <span class="tab-text">Groups</span>
                        <span class="tab-count">${this.contactGroups.size}</span>
                    </button>
                    <button class="filter-tab" data-filter="requests">
                        <span class="tab-icon">📨</span>
                        <span class="tab-text">Requests</span>
                        <span class="tab-count">${this.getPendingRequestsCount()}</span>
                    </button>
                </div>

                <div class="filter-options">
                    <select class="sort-select">
                        <option value="name">Sort by Name</option>
                        <option value="recent">Recent Activity</option>
                        <option value="added">Date Added</option>
                        <option value="status">Online Status</option>
                    </select>

                    <button class="view-toggle" data-view="grid" title="Grid View">
                        <span class="icon">⊞</span>
                    </button>
                    <button class="view-toggle active" data-view="list" title="List View">
                        <span class="icon">☰</span>
                    </button>
                </div>
            </div>

            <div class="contacts-content">
                <div class="contacts-list" id="contacts-list">
                    ${this.renderContactsList()}
                </div>

                <div class="contact-groups" id="contact-groups" style="display: none;">
                    ${this.renderContactGroups()}
                </div>

                <div class="friend-requests" id="friend-requests" style="display: none;">
                    ${this.renderFriendRequests()}
                </div>
            </div>

            <div class="contacts-footer">
                <div class="bulk-actions" style="display: none;">
                    <span class="selected-count">0 selected</span>
                    <button class="bulk-action" data-action="group">Add to Group</button>
                    <button class="bulk-action" data-action="favorite">Add to Favorites</button>
                    <button class="bulk-action" data-action="delete">Remove</button>
                </div>
            </div>
        `;

        return contactsInterface;
    }

    // Create user search modal
    createUserSearchModal() {
        const searchModal = document.createElement('div');
        searchModal.className = 'user-search-modal glassmorphism';
        searchModal.innerHTML = `
            <div class="search-modal-header">
                <h3>Find People</h3>
                <button class="close-search-modal">×</button>
            </div>

            <div class="search-modal-content">
                <div class="global-search">
                    <div class="search-input-container">
                        <input type="text" class="global-search-input" placeholder="Search by name, username, email..." autocomplete="off">
                        <button class="advanced-search-toggle" title="Advanced Search">⚙️</button>
                    </div>

                    <div class="search-filters" style="display: none;">
                        <div class="filter-row">
                            <label>
                                <input type="checkbox" class="verified-only"> Verified users only
                            </label>
                            <label>
                                <input type="checkbox" class="same-organization"> Same organization
                            </label>
                        </div>
                        <div class="filter-row">
                            <select class="location-filter">
                                <option value="">Any location</option>
                                <option value="local">Near me</option>
                                <option value="same-city">Same city</option>
                            </select>
                            <select class="department-filter">
                                <option value="">Any department</option>
                                <option value="engineering">Engineering</option>
                                <option value="design">Design</option>
                                <option value="marketing">Marketing</option>
                                <option value="sales">Sales</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="search-results">
                    <div class="search-loading" style="display: none;">
                        <div class="loading-spinner"></div>
                        <span>Searching...</span>
                    </div>

                    <div class="search-results-list">
                        <div class="search-empty">
                            <div class="empty-icon">🔍</div>
                            <h4>Find people to connect with</h4>
                            <p>Search by name, username, or interests to discover new contacts</p>
                        </div>
                    </div>
                </div>

                <div class="search-suggestions">
                    <h4>Suggested Contacts</h4>
                    <div class="suggestions-list">
                        ${this.renderSuggestedContacts()}
                    </div>
                </div>
            </div>
        `;

        return searchModal;
    }

    // Render contacts list
    renderContactsList() {
        const contacts = Array.from(this.contacts.values());

        if (contacts.length === 0) {
            return `
                <div class="contacts-empty">
                    <div class="empty-icon">👥</div>
                    <h3>No contacts yet</h3>
                    <p>Start building your network by adding contacts</p>
                    <button class="add-first-contact">Add Your First Contact</button>
                </div>
            `;
        }

        return contacts.map(contact => this.renderContactItem(contact)).join('');
    }

    // Render individual contact item
    renderContactItem(contact) {
        const statusIcon = this.getStatusIcon(contact.user_status);
        const isOnline = contact.user_status === 'online';

        return `
            <div class="contact-item ${contact.is_pinned ? 'pinned' : ''} ${contact.is_favorite ? 'favorite' : ''}"
                 data-contact-id="${contact.contact_id}"
                 data-user-id="${contact.user_id}">

                <div class="contact-selection">
                    <input type="checkbox" class="contact-checkbox">
                </div>

                <div class="contact-avatar-container">
                    <img src="${contact.avatar_url || '/assets/default-avatar.svg'}"
                         alt="${contact.display_name}"
                         class="contact-avatar">
                    <div class="contact-status ${contact.user_status}">
                        <span class="status-icon">${statusIcon}</span>
                    </div>
                </div>

                <div class="contact-info">
                    <div class="contact-primary">
                        <h4 class="contact-name">
                            ${contact.custom_nickname || contact.display_name}
                            ${contact.is_favorite ? '<span class="favorite-star">⭐</span>' : ''}
                        </h4>
                        <span class="contact-username">@${contact.nickname}</span>
                    </div>

                    <div class="contact-secondary">
                        ${contact.department ? `<span class="contact-department">${contact.department}</span>` : ''}
                        ${contact.position ? `<span class="contact-position">${contact.position}</span>` : ''}
                        ${contact.status_message ? `<p class="contact-status-message">${contact.status_message}</p>` : ''}
                    </div>

                    ${contact.notes ? `<div class="contact-notes">${contact.notes}</div>` : ''}

                    <div class="contact-tags">
                        ${contact.tags ? contact.tags.map(tag => `<span class="contact-tag">${tag}</span>`).join('') : ''}
                    </div>

                    <div class="contact-meta">
                        ${contact.last_interaction_at ?
                            `<span class="last-interaction">Last: ${this.formatDate(contact.last_interaction_at)}</span>` :
                            '<span class="no-interaction">No recent activity</span>'
                        }
                    </div>
                </div>

                <div class="contact-actions">
                    <button class="contact-action message" title="Send Message" data-action="message">
                        💬
                    </button>
                    <button class="contact-action call" title="Voice Call" data-action="call">
                        📞
                    </button>
                    <button class="contact-action video" title="Video Call" data-action="video">
                        📹
                    </button>
                    <button class="contact-action more" title="More Actions" data-action="more">
                        ⋯
                    </button>
                </div>

                ${contact.is_pinned ? '<div class="pin-indicator">📌</div>' : ''}
            </div>
        `;
    }

    // Render contact groups
    renderContactGroups() {
        const groups = Array.from(this.contactGroups.values());

        if (groups.length === 0) {
            return `
                <div class="groups-empty">
                    <div class="empty-icon">📁</div>
                    <h3>No contact groups</h3>
                    <p>Organize your contacts by creating groups</p>
                    <button class="create-first-group">Create Your First Group</button>
                </div>
            `;
        }

        return `
            <div class="groups-list">
                <div class="create-group-card">
                    <div class="create-group-icon">+</div>
                    <span>Create New Group</span>
                </div>

                ${groups.map(group => `
                    <div class="group-card" data-group-id="${group.id}">
                        <div class="group-header">
                            <div class="group-icon" style="background: ${group.color}">
                                ${group.icon || '👥'}
                            </div>
                            <div class="group-info">
                                <h4 class="group-name">${group.name}</h4>
                                <p class="group-description">${group.description || ''}</p>
                                <span class="group-count">${group.member_count || 0} members</span>
                            </div>
                        </div>
                        <div class="group-actions">
                            <button class="group-action" data-action="view">View</button>
                            <button class="group-action" data-action="edit">Edit</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Render friend requests
    renderFriendRequests() {
        const requests = Array.from(this.friendRequests.values());

        if (requests.length === 0) {
            return `
                <div class="requests-empty">
                    <div class="empty-icon">📨</div>
                    <h3>No friend requests</h3>
                    <p>You're all caught up with friend requests</p>
                </div>
            `;
        }

        const receivedRequests = requests.filter(r => r.type === 'received' && r.status === 'pending');
        const sentRequests = requests.filter(r => r.type === 'sent');

        return `
            <div class="friend-requests-content">
                ${receivedRequests.length > 0 ? `
                    <div class="requests-section">
                        <h4>Received Requests (${receivedRequests.length})</h4>
                        <div class="requests-list">
                            ${receivedRequests.map(request => this.renderFriendRequest(request, 'received')).join('')}
                        </div>
                    </div>
                ` : ''}

                ${sentRequests.length > 0 ? `
                    <div class="requests-section">
                        <h4>Sent Requests (${sentRequests.length})</h4>
                        <div class="requests-list">
                            ${sentRequests.map(request => this.renderFriendRequest(request, 'sent')).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Render individual friend request
    renderFriendRequest(request, type) {
        const user = request.user;
        const statusClass = request.status;

        return `
            <div class="friend-request-item ${statusClass}" data-request-id="${request.id}">
                <div class="request-avatar">
                    <img src="${user.avatar_url || '/assets/default-avatar.svg'}" alt="${user.display_name}">
                </div>

                <div class="request-info">
                    <h4 class="request-name">${user.display_name}</h4>
                    <span class="request-username">@${user.nickname}</span>
                    ${user.bio ? `<p class="request-bio">${user.bio}</p>` : ''}
                    ${request.message ? `<p class="request-message">"${request.message}"</p>` : ''}

                    <div class="request-meta">
                        <span class="request-date">${this.formatDate(request.created_at)}</span>
                        ${request.responded_at ? `<span class="response-date">Responded: ${this.formatDate(request.responded_at)}</span>` : ''}
                    </div>
                </div>

                <div class="request-actions">
                    ${type === 'received' && request.status === 'pending' ? `
                        <button class="request-action accept" data-action="accept">
                            ✅ Accept
                        </button>
                        <button class="request-action decline" data-action="decline">
                            ❌ Decline
                        </button>
                    ` : type === 'sent' ? `
                        <span class="request-status status-${request.status}">
                            ${this.getRequestStatusText(request.status)}
                        </span>
                        ${request.status === 'pending' ? `
                            <button class="request-action cancel" data-action="cancel">
                                Cancel
                            </button>
                        ` : ''}
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Render suggested contacts
    renderSuggestedContacts() {
        const suggestions = [
            { id: 1, name: 'John Smith', username: 'johnsmith', mutual: 5, reason: 'Same department' },
            { id: 2, name: 'Sarah Wilson', username: 'swilson', mutual: 3, reason: 'Mutual connections' },
            { id: 3, name: 'Mike Johnson', username: 'mjohnson', mutual: 2, reason: 'Similar interests' }
        ];

        return suggestions.map(suggestion => `
            <div class="suggestion-item" data-user-id="${suggestion.id}">
                <div class="suggestion-avatar">
                    <img src="/assets/default-avatar.svg" alt="${suggestion.name}">
                </div>
                <div class="suggestion-info">
                    <h5>${suggestion.name}</h5>
                    <span>@${suggestion.username}</span>
                    <p class="suggestion-reason">${suggestion.reason}</p>
                    ${suggestion.mutual ? `<span class="mutual-count">${suggestion.mutual} mutual</span>` : ''}
                </div>
                <button class="add-suggestion" data-user-id="${suggestion.id}">
                    Add
                </button>
            </div>
        `).join('');
    }

    // Event listeners
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            // Add contact button
            if (e.target.matches('.add-contact-btn, .add-first-contact')) {
                this.showAddContactDialog();
            }

            // Search users button
            if (e.target.matches('.search-users-btn')) {
                this.showUserSearchModal();
            }

            // Filter tabs
            if (e.target.matches('.filter-tab')) {
                this.switchFilter(e.target.dataset.filter);
            }

            // Contact actions
            if (e.target.matches('.contact-action')) {
                const contactId = e.target.closest('.contact-item').dataset.contactId;
                const action = e.target.dataset.action;
                this.handleContactAction(contactId, action);
            }

            // Friend request actions
            if (e.target.matches('.request-action')) {
                const requestId = e.target.closest('.friend-request-item').dataset.requestId;
                const action = e.target.dataset.action;
                this.handleFriendRequestAction(requestId, action);
            }

            // Close search modal
            if (e.target.matches('.close-search-modal')) {
                this.closeUserSearchModal();
            }

            // Add suggestion
            if (e.target.matches('.add-suggestion')) {
                const userId = e.target.dataset.userId;
                this.sendFriendRequest(userId);
            }
        });

        // Search input
        document.addEventListener('input', (e) => {
            if (e.target.matches('.contacts-search-input')) {
                this.handleContactsSearch(e.target.value);
            }

            if (e.target.matches('.global-search-input')) {
                this.handleGlobalSearch(e.target.value);
            }
        });

        // Contact selection
        document.addEventListener('change', (e) => {
            if (e.target.matches('.contact-checkbox')) {
                this.handleContactSelection(e.target);
            }
        });
    }

    // API methods
    async loadContacts() {
        try {
            const response = await fetch('/api/contacts/contacts');
            if (response.ok) {
                const data = await response.json();
                this.contacts.clear();
                data.data.forEach(contact => {
                    this.contacts.set(contact.contact_id, contact);
                });
                this.updateContactsList();
            }
        } catch (error) {
            console.error('Failed to load contacts:', error);
        }
    }

    async searchUsers(query, options = {}) {
        try {
            this.showSearchLoading(true);

            const params = new URLSearchParams({
                q: query,
                limit: options.limit || 20,
                offset: options.offset || 0,
                verified_only: options.verifiedOnly || false
            });

            const response = await fetch(`/api/contacts/search/users?${params}`);
            if (response.ok) {
                const data = await response.json();
                this.displaySearchResults(data.data);
            }
        } catch (error) {
            console.error('User search failed:', error);
        } finally {
            this.showSearchLoading(false);
        }
    }

    async sendFriendRequest(userId, message = '') {
        try {
            const response = await fetch('/api/contacts/contacts/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, message })
            });

            if (response.ok) {
                this.showNotification('Friend request sent successfully', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Failed to send friend request', 'error');
            }
        } catch (error) {
            console.error('Send friend request failed:', error);
            this.showNotification('Failed to send friend request', 'error');
        }
    }

    async respondToFriendRequest(requestId, action) {
        try {
            const response = await fetch(`/api/contacts/requests/${requestId}/respond`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });

            if (response.ok) {
                this.showNotification(`Friend request ${action}ed`, 'success');
                this.loadFriendRequests();
                if (action === 'accept') {
                    this.loadContacts();
                }
            }
        } catch (error) {
            console.error('Respond to friend request failed:', error);
            this.showNotification('Failed to respond to request', 'error');
        }
    }

    // Helper methods
    getStatusIcon(status) {
        const icons = {
            'online': '🟢',
            'away': '🟡',
            'busy': '🔴',
            'dnd': '⛔',
            'offline': '⚫'
        };
        return icons[status] || '⚫';
    }

    getFavoriteCount() {
        return Array.from(this.contacts.values()).filter(c => c.is_favorite).length;
    }

    getPendingRequestsCount() {
        return Array.from(this.friendRequests.values()).filter(r => r.status === 'pending').length;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

        return date.toLocaleDateString();
    }

    getRequestStatusText(status) {
        const texts = {
            'pending': 'Pending',
            'accepted': 'Accepted',
            'declined': 'Declined',
            'cancelled': 'Cancelled'
        };
        return texts[status] || status;
    }

    showNotification(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);
        // Implementation for notifications
    }

    updateContactsList() {
        const contactsList = document.getElementById('contacts-list');
        if (contactsList) {
            contactsList.innerHTML = this.renderContactsList();
        }
    }

    // Cleanup
    destroy() {
        // Remove event listeners and cleanup
    }
}

// Export for use in other components
window.ContactsBook = ContactsBook;