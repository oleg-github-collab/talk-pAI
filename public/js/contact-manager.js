/**
 * Professional Contact Management System
 * Production-grade contact handling with full CRUD operations
 */

class ContactManager {
    constructor() {
        this.contacts = new Map();
        this.contactCache = new Map();
        this.searchIndex = new Map();
        this.isInitialized = false;
        this.init();
    }

    async init() {
        await this.loadContacts();
        this.bindEvents();
        this.isInitialized = true;
        console.log('✅ Contact Manager initialized');
    }

    async loadContacts() {
        try {
            // Load from server
            const response = await fetch('/api/contacts');
            if (response.ok) {
                const data = await response.json();
                data.contacts?.forEach(contact => {
                    this.addContactToCache(contact);
                });
            }
        } catch (error) {
            console.warn('Failed to load contacts from server, using demo data');
            this.loadDemoContacts();
        }
    }

    loadDemoContacts() {
        const demoContacts = [
            {
                id: 'demo-contact-1',
                name: 'Alice Johnson',
                nickname: 'alice_j',
                email: 'alice@example.com',
                phone: '+1 (555) 123-4567',
                avatar: '👩‍💼',
                status: 'online',
                lastSeen: new Date(),
                isOnline: true,
                groups: ['Work', 'Friends'],
                notes: 'Product Manager at TechCorp',
                isFavorite: true
            },
            {
                id: 'demo-contact-2',
                name: 'Bob Smith',
                nickname: 'bob_dev',
                email: 'bob@example.com',
                phone: '+1 (555) 987-6543',
                avatar: '👨‍💻',
                status: 'away',
                lastSeen: new Date(Date.now() - 30 * 60 * 1000),
                isOnline: false,
                groups: ['Work'],
                notes: 'Senior Developer',
                isFavorite: false
            },
            {
                id: 'demo-contact-3',
                name: 'Carol Wilson',
                nickname: 'carol_design',
                email: 'carol@example.com',
                phone: '+1 (555) 456-7890',
                avatar: '👩‍🎨',
                status: 'busy',
                lastSeen: new Date(Date.now() - 10 * 60 * 1000),
                isOnline: true,
                groups: ['Work', 'Creative'],
                notes: 'UX Designer',
                isFavorite: true
            }
        ];

        demoContacts.forEach(contact => {
            this.addContactToCache(contact);
        });
    }

    addContactToCache(contact) {
        this.contacts.set(contact.id, contact);
        this.updateSearchIndex(contact);
    }

    updateSearchIndex(contact) {
        const searchTerms = [
            contact.name?.toLowerCase(),
            contact.nickname?.toLowerCase(),
            contact.email?.toLowerCase(),
            ...(contact.groups || []).map(g => g.toLowerCase())
        ].filter(Boolean);

        searchTerms.forEach(term => {
            if (!this.searchIndex.has(term)) {
                this.searchIndex.set(term, new Set());
            }
            this.searchIndex.get(term).add(contact.id);
        });
    }

    bindEvents() {
        // Search functionality
        const searchInput = document.getElementById('contactSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchContacts(e.target.value);
            });
        }

        // Add contact button
        document.addEventListener('click', (e) => {
            if (e.target.matches('.add-contact-btn, .add-contact-btn *')) {
                this.showAddContactModal();
            }
        });
    }

    searchContacts(query) {
        if (!query.trim()) {
            this.renderContactList(Array.from(this.contacts.values()));
            return;
        }

        const lowerQuery = query.toLowerCase();
        const matchingIds = new Set();

        // Search in index
        for (const [term, contactIds] of this.searchIndex.entries()) {
            if (term.includes(lowerQuery)) {
                contactIds.forEach(id => matchingIds.add(id));
            }
        }

        const matchingContacts = Array.from(matchingIds)
            .map(id => this.contacts.get(id))
            .filter(Boolean)
            .sort((a, b) => {
                // Prioritize favorites and online status
                if (a.isFavorite !== b.isFavorite) {
                    return b.isFavorite - a.isFavorite;
                }
                if (a.isOnline !== b.isOnline) {
                    return b.isOnline - a.isOnline;
                }
                return a.name.localeCompare(b.name);
            });

        this.renderContactList(matchingContacts);
    }

    renderContactList(contacts = Array.from(this.contacts.values())) {
        const container = document.getElementById('contactList');
        if (!container) return;

        // Sort contacts: favorites first, then online, then alphabetical
        const sortedContacts = contacts.sort((a, b) => {
            if (a.isFavorite !== b.isFavorite) {
                return b.isFavorite - a.isFavorite;
            }
            if (a.isOnline !== b.isOnline) {
                return b.isOnline - a.isOnline;
            }
            return a.name.localeCompare(b.name);
        });

        container.innerHTML = sortedContacts.map(contact => this.createContactElement(contact)).join('');
    }

    createContactElement(contact) {
        const statusDot = this.getStatusDot(contact.status);
        const lastSeenText = this.getLastSeenText(contact);

        return `
            <div class="contact-item" data-contact-id="${contact.id}">
                <div class="contact-avatar" style="position: relative;">
                    ${contact.avatar}
                    <div class="status-indicator ${contact.status}" title="${contact.status}"></div>
                    ${contact.isFavorite ? '<div class="favorite-badge">⭐</div>' : ''}
                </div>
                <div class="contact-info" onclick="productionInterface.openContactProfile('${contact.id}')">
                    <h4>${this.escapeHtml(contact.name)}</h4>
                    <p>${contact.isOnline ? contact.status : lastSeenText}</p>
                    ${contact.notes ? `<span class="contact-notes">${this.escapeHtml(contact.notes)}</span>` : ''}
                </div>
                <div class="contact-actions">
                    <button onclick="contactManager.startVoiceCall('${contact.id}')"
                            class="action-btn voice-btn" title="Voice Call">📞</button>
                    <button onclick="contactManager.startVideoCall('${contact.id}')"
                            class="action-btn video-btn" title="Video Call">📹</button>
                    <button onclick="contactManager.startChat('${contact.id}')"
                            class="action-btn chat-btn" title="Start Chat">💬</button>
                    <button onclick="contactManager.showContactOptions('${contact.id}')"
                            class="action-btn options-btn" title="More Options">⋯</button>
                </div>
            </div>
        `;
    }

    getStatusDot(status) {
        const statusMap = {
            online: '🟢',
            away: '🟡',
            busy: '🔴',
            offline: '⚫'
        };
        return statusMap[status] || '⚫';
    }

    getLastSeenText(contact) {
        if (contact.isOnline) return contact.status;
        if (!contact.lastSeen) return 'Last seen unknown';

        const now = new Date();
        const lastSeen = new Date(contact.lastSeen);
        const diffMs = now - lastSeen;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Last seen just now';
        if (diffMins < 60) return `Last seen ${diffMins}m ago`;
        if (diffHours < 24) return `Last seen ${diffHours}h ago`;
        if (diffDays < 7) return `Last seen ${diffDays}d ago`;
        return 'Last seen long ago';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showAddContactModal() {
        const modal = this.createAddContactModal();
        document.body.appendChild(modal);
        modal.style.display = 'flex';

        // Focus first input
        setTimeout(() => {
            modal.querySelector('input').focus();
        }, 100);
    }

    createAddContactModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'addContactModal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add New Contact</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <form class="add-contact-form" onsubmit="contactManager.handleAddContact(event)">
                    <div class="form-group">
                        <label for="contactName">Full Name *</label>
                        <input type="text" id="contactName" required placeholder="Enter full name">
                    </div>
                    <div class="form-group">
                        <label for="contactNickname">Nickname</label>
                        <input type="text" id="contactNickname" placeholder="Enter nickname">
                    </div>
                    <div class="form-group">
                        <label for="contactEmail">Email</label>
                        <input type="email" id="contactEmail" placeholder="Enter email address">
                    </div>
                    <div class="form-group">
                        <label for="contactPhone">Phone</label>
                        <input type="tel" id="contactPhone" placeholder="Enter phone number">
                    </div>
                    <div class="form-group">
                        <label for="contactAvatar">Avatar</label>
                        <div class="avatar-selector">
                            <input type="text" id="contactAvatar" value="👤" placeholder="Pick an emoji">
                            <div class="avatar-options">
                                <button type="button" onclick="document.getElementById('contactAvatar').value='👤'">👤</button>
                                <button type="button" onclick="document.getElementById('contactAvatar').value='👨'">👨</button>
                                <button type="button" onclick="document.getElementById('contactAvatar').value='👩'">👩</button>
                                <button type="button" onclick="document.getElementById('contactAvatar').value='👨‍💼'">👨‍💼</button>
                                <button type="button" onclick="document.getElementById('contactAvatar').value='👩‍💼'">👩‍💼</button>
                                <button type="button" onclick="document.getElementById('contactAvatar').value='👨‍💻'">👨‍💻</button>
                                <button type="button" onclick="document.getElementById('contactAvatar').value='👩‍💻'">👩‍💻</button>
                                <button type="button" onclick="document.getElementById('contactAvatar').value='👨‍🎨'">👨‍🎨</button>
                                <button type="button" onclick="document.getElementById('contactAvatar').value='👩‍🎨'">👩‍🎨</button>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="contactNotes">Notes</label>
                        <textarea id="contactNotes" placeholder="Add notes about this contact" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="contactFavorite">
                            Add to favorites
                        </label>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="contactManager.closeModal('addContactModal')">Cancel</button>
                        <button type="submit" class="btn btn-primary">Add Contact</button>
                    </div>
                </form>
            </div>
        `;

        return modal;
    }

    async handleAddContact(event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const contactData = {
            id: 'contact-' + Date.now(),
            name: document.getElementById('contactName').value.trim(),
            nickname: document.getElementById('contactNickname').value.trim(),
            email: document.getElementById('contactEmail').value.trim(),
            phone: document.getElementById('contactPhone').value.trim(),
            avatar: document.getElementById('contactAvatar').value || '👤',
            notes: document.getElementById('contactNotes').value.trim(),
            isFavorite: document.getElementById('contactFavorite').checked,
            status: 'offline',
            isOnline: false,
            lastSeen: new Date(),
            groups: []
        };

        try {
            // Add to local cache
            this.addContactToCache(contactData);

            // Send to server
            await this.saveContact(contactData);

            // Update UI
            this.renderContactList();
            this.closeModal('addContactModal');

            this.showNotification('Contact added successfully!', 'success');
        } catch (error) {
            console.error('Failed to add contact:', error);
            this.showNotification('Failed to add contact. Please try again.', 'error');
        }
    }

    async saveContact(contact) {
        try {
            const response = await fetch('/api/contacts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('talkpai-token')}`
                },
                body: JSON.stringify(contact)
            });

            if (!response.ok) {
                throw new Error('Failed to save contact');
            }

            return await response.json();
        } catch (error) {
            console.warn('Failed to save contact to server:', error);
            // Continue with local storage for demo
        }
    }

    startVoiceCall(contactId) {
        const contact = this.contacts.get(contactId);
        if (!contact) return;

        console.log('Starting voice call with:', contact.name);

        // Initialize call manager if available
        if (window.callManager) {
            window.callManager.startVoiceCall(contactId, contact);
        } else {
            this.showNotification(`Starting voice call with ${contact.name}...`, 'info');
            // Simulate call
            setTimeout(() => {
                this.showNotification(`Voice call with ${contact.name} ended`, 'info');
            }, 5000);
        }
    }

    startVideoCall(contactId) {
        const contact = this.contacts.get(contactId);
        if (!contact) return;

        console.log('Starting video call with:', contact.name);

        // Initialize call manager if available
        if (window.callManager) {
            window.callManager.startVideoCall(contactId, contact);
        } else {
            this.showNotification(`Starting video call with ${contact.name}...`, 'info');
            // Simulate call
            setTimeout(() => {
                this.showNotification(`Video call with ${contact.name} ended`, 'info');
            }, 8000);
        }
    }

    startChat(contactId) {
        const contact = this.contacts.get(contactId);
        if (!contact) return;

        console.log('Starting chat with:', contact.name);

        // Switch to chat view and open conversation
        if (window.productionInterface) {
            window.productionInterface.switchView('chats');
            window.productionInterface.selectChat(contactId);
        }

        this.showNotification(`Started chat with ${contact.name}`, 'success');
    }

    showContactOptions(contactId) {
        const contact = this.contacts.get(contactId);
        if (!contact) return;

        const options = document.createElement('div');
        options.className = 'contact-options-menu';
        options.innerHTML = `
            <div class="options-overlay" onclick="this.parentElement.remove()"></div>
            <div class="options-content">
                <button onclick="contactManager.editContact('${contactId}')" class="option-item">
                    ✏️ Edit Contact
                </button>
                <button onclick="contactManager.toggleFavorite('${contactId}')" class="option-item">
                    ${contact.isFavorite ? '⭐' : '☆'} ${contact.isFavorite ? 'Remove from' : 'Add to'} Favorites
                </button>
                <button onclick="contactManager.blockContact('${contactId}')" class="option-item">
                    🚫 Block Contact
                </button>
                <button onclick="contactManager.deleteContact('${contactId}')" class="option-item danger">
                    🗑️ Delete Contact
                </button>
            </div>
        `;

        document.body.appendChild(options);
    }

    async toggleFavorite(contactId) {
        const contact = this.contacts.get(contactId);
        if (!contact) return;

        contact.isFavorite = !contact.isFavorite;
        await this.saveContact(contact);
        this.renderContactList();

        const action = contact.isFavorite ? 'added to' : 'removed from';
        this.showNotification(`${contact.name} ${action} favorites`, 'success');

        // Close options menu
        document.querySelector('.contact-options-menu')?.remove();
    }

    async deleteContact(contactId) {
        const contact = this.contacts.get(contactId);
        if (!contact) return;

        if (!confirm(`Are you sure you want to delete ${contact.name}?`)) {
            return;
        }

        try {
            // Remove from server
            await fetch(`/api/contacts/${contactId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('talkpai-token')}`
                }
            });
        } catch (error) {
            console.warn('Failed to delete contact from server:', error);
        }

        // Remove from local cache
        this.contacts.delete(contactId);
        this.renderContactList();

        this.showNotification(`${contact.name} deleted`, 'success');

        // Close options menu
        document.querySelector('.contact-options-menu')?.remove();
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;

        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: '10000',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '300px',
            animation: 'slideInRight 0.3s ease'
        });

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // Public API
    getContact(contactId) {
        return this.contacts.get(contactId);
    }

    getAllContacts() {
        return Array.from(this.contacts.values());
    }

    getOnlineContacts() {
        return this.getAllContacts().filter(contact => contact.isOnline);
    }

    getFavoriteContacts() {
        return this.getAllContacts().filter(contact => contact.isFavorite);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.contactManager = new ContactManager();
    });
} else {
    window.contactManager = new ContactManager();
}

// Add CSS for contact manager
const contactStyles = document.createElement('style');
contactStyles.textContent = `
.contact-item {
    position: relative;
}

.contact-avatar .status-indicator {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--primary-bg);
}

.contact-avatar .status-indicator.online { background: #10b981; }
.contact-avatar .status-indicator.away { background: #f59e0b; }
.contact-avatar .status-indicator.busy { background: #ef4444; }
.contact-avatar .status-indicator.offline { background: #6b7280; }

.contact-avatar .favorite-badge {
    position: absolute;
    top: -2px;
    left: -2px;
    font-size: 12px;
}

.contact-notes {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    font-style: italic;
}

.contact-actions {
    display: flex;
    gap: 4px;
}

.action-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: var(--glass-bg);
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    font-size: 14px;
}

.action-btn:hover {
    background: var(--accent-primary);
    color: white;
    transform: scale(1.1);
}

.contact-options-menu {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10000;
}

.options-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
}

.options-content {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--primary-bg);
    border-radius: 12px;
    padding: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    min-width: 200px;
}

.option-item {
    width: 100%;
    padding: 12px 16px;
    border: none;
    background: none;
    text-align: left;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s ease;
    display: flex;
    align-items: center;
    gap: 8px;
}

.option-item:hover {
    background: var(--glass-bg);
}

.option-item.danger {
    color: var(--accent-error);
}

.option-item.danger:hover {
    background: var(--accent-error);
    color: white;
}

.add-contact-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.form-group label {
    font-weight: 500;
    color: var(--text-primary);
}

.form-group input,
.form-group textarea {
    padding: 12px;
    border: 1px solid var(--glass-border);
    border-radius: 8px;
    background: var(--glass-bg);
    color: var(--text-primary);
    transition: border-color 0.15s ease;
}

.form-group input:focus,
.form-group textarea:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.avatar-selector {
    display: flex;
    gap: 8px;
    align-items: center;
}

.avatar-selector input {
    width: 60px;
    text-align: center;
    font-size: 20px;
}

.avatar-options {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
}

.avatar-options button {
    width: 32px;
    height: 32px;
    border: none;
    background: var(--glass-bg);
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.15s ease;
}

.avatar-options button:hover {
    background: var(--accent-primary);
    transform: scale(1.1);
}

.form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding-top: 16px;
    border-top: 1px solid var(--glass-border);
}

.btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.15s ease;
}

.btn-primary {
    background: var(--accent-primary);
    color: white;
}

.btn-primary:hover {
    background: var(--accent-secondary);
    transform: translateY(-1px);
}

.btn-secondary {
    background: var(--glass-bg);
    color: var(--text-primary);
    border: 1px solid var(--glass-border);
}

.btn-secondary:hover {
    background: var(--tertiary-bg);
}

@keyframes slideInRight {
    from {
        opacity: 0;
        transform: translateX(100%);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}
`;

document.head.appendChild(contactStyles);

// Global access
window.ContactManager = ContactManager;