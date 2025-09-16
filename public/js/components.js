// Modern UI Components for Talk pAI
class UIComponents {
  constructor() {
    this.theme = localStorage.getItem('theme') || 'light';
    this.isMobile = window.innerWidth <= 768;
    this.setupTheme();
    this.setupResponsive();
  }

  setupTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
  }

  setupResponsive() {
    window.addEventListener('resize', () => {
      this.isMobile = window.innerWidth <= 768;
      this.updateLayout();
    });
  }

  updateLayout() {
    const sidebar = document.querySelector('.sidebar');
    const chatArea = document.querySelector('.chat-area');

    if (this.isMobile) {
      sidebar?.classList.add('mobile-hidden');
      chatArea?.classList.add('mobile-full');
    } else {
      sidebar?.classList.remove('mobile-hidden');
      chatArea?.classList.remove('mobile-full');
    }
  }

  // User Search Component with Real-time Suggestions
  createUserSearchComponent(container, options = {}) {
    const {
      placeholder = 'Search users...',
      onSelect = () => {},
      minChars = 2,
      debounceMs = 300
    } = options;

    const searchContainer = document.createElement('div');
    searchContainer.className = 'user-search-container';
    searchContainer.innerHTML = `
      <div class="search-input-wrapper">
        <input type="text" class="search-input" placeholder="${placeholder}" autocomplete="off">
        <div class="search-icon">🔍</div>
        <div class="search-spinner hidden">⏳</div>
      </div>
      <div class="search-suggestions hidden"></div>
    `;

    const input = searchContainer.querySelector('.search-input');
    const suggestions = searchContainer.querySelector('.search-suggestions');
    const spinner = searchContainer.querySelector('.search-spinner');
    const icon = searchContainer.querySelector('.search-icon');

    let debounceTimer;
    let currentQuery = '';

    input.addEventListener('input', (e) => {
      const query = e.target.value.trim();

      if (query.length < minChars) {
        this.hideSuggestions(suggestions);
        return;
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.performUserSearch(query, suggestions, spinner, icon, onSelect);
      }, debounceMs);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideSuggestions(suggestions);
        input.blur();
      }
    });

    // Click outside to close suggestions
    document.addEventListener('click', (e) => {
      if (!searchContainer.contains(e.target)) {
        this.hideSuggestions(suggestions);
      }
    });

    container.appendChild(searchContainer);
    return { input, suggestions };
  }

  async performUserSearch(query, suggestions, spinner, icon, onSelect) {
    try {
      // Show loading state
      spinner.classList.remove('hidden');
      icon.classList.add('hidden');

      const response = await fetch(`/api/search/users/suggestions?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Search failed');

      const users = await response.json();
      this.displayUserSuggestions(users, suggestions, onSelect);

    } catch (error) {
      console.error('Search error:', error);
      this.showSearchError(suggestions);
    } finally {
      // Hide loading state
      spinner.classList.add('hidden');
      icon.classList.remove('hidden');
    }
  }

  displayUserSuggestions(users, container, onSelect) {
    if (users.length === 0) {
      container.innerHTML = '<div class="no-results">No users found</div>';
      container.classList.remove('hidden');
      return;
    }

    container.innerHTML = users.map(user => `
      <div class="suggestion-item" data-user-id="${user.id}">
        <div class="user-avatar-small">${user.avatar || user.nickname.charAt(0).toUpperCase()}</div>
        <div class="user-details">
          <div class="user-name">${this.escapeHtml(user.nickname)}</div>
          ${user.full_name ? `<div class="user-full-name">${this.escapeHtml(user.full_name)}</div>` : ''}
          ${user.title ? `<div class="user-title">${this.escapeHtml(user.title)}</div>` : ''}
        </div>
        <div class="user-status ${user.status || 'offline'}"></div>
      </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const userId = item.dataset.userId;
        const user = users.find(u => u.id.toString() === userId);
        onSelect(user);
        this.hideSuggestions(container);
      });
    });

    container.classList.remove('hidden');
  }

  hideSuggestions(container) {
    container.classList.add('hidden');
    container.innerHTML = '';
  }

  showSearchError(container) {
    container.innerHTML = '<div class="search-error">Search temporarily unavailable</div>';
    container.classList.remove('hidden');
    setTimeout(() => this.hideSuggestions(container), 3000);
  }

  // Chat Message Component with Rich Features
  createMessageComponent(message, currentUserId) {
    const isOwn = message.user_id === currentUserId;
    const messageTime = new Date(message.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    const messageEl = document.createElement('div');
    messageEl.className = `message ${isOwn ? 'own-message' : 'other-message'}`;
    messageEl.dataset.messageId = message.id;

    let messageContent = '';

    if (message.message_type === 'audio') {
      messageContent = this.createAudioMessageContent(message);
    } else if (message.message_type === 'file') {
      messageContent = this.createFileMessageContent(message);
    } else {
      messageContent = this.createTextMessageContent(message);
    }

    messageEl.innerHTML = `
      <div class="message-content">
        <div class="message-header">
          <span class="message-author">${this.escapeHtml(message.nickname)}</span>
          <span class="message-time">${messageTime}</span>
        </div>
        ${messageContent}
        <div class="message-actions">
          <button class="reply-btn" title="Reply">↩️</button>
          ${isOwn ? '<button class="delete-btn" title="Delete">🗑️</button>' : ''}
          <button class="react-btn" title="React">😊</button>
        </div>
      </div>
    `;

    this.setupMessageActions(messageEl, message);
    return messageEl;
  }

  createTextMessageContent(message) {
    const content = this.escapeHtml(message.content);
    const formattedContent = this.formatMessageText(content);

    return `
      <div class="message-text">${formattedContent}</div>
      ${message.reply_message ? this.createReplyPreview(message.reply_message) : ''}
    `;
  }

  createAudioMessageContent(message) {
    return `
      <div class="audio-message">
        <div class="audio-player">
          <button class="play-btn">▶️</button>
          <div class="audio-waveform"></div>
          <span class="audio-duration">${this.formatDuration(message.duration)}</span>
        </div>
        <audio src="${message.file_url}" preload="metadata"></audio>
      </div>
    `;
  }

  createFileMessageContent(message) {
    const fileIcon = this.getFileIcon(message.file_type);
    const fileSize = this.formatFileSize(message.file_size);

    return `
      <div class="file-message">
        <div class="file-icon">${fileIcon}</div>
        <div class="file-details">
          <div class="file-name">${this.escapeHtml(message.content)}</div>
          <div class="file-meta">${fileSize} • ${message.file_type}</div>
        </div>
        <a href="${message.file_url}" class="download-btn" download>📥</a>
      </div>
    `;
  }

  createReplyPreview(replyMessage) {
    return `
      <div class="reply-preview">
        <div class="reply-line"></div>
        <div class="reply-content">
          <div class="reply-author">${this.escapeHtml(replyMessage.user_nickname)}</div>
          <div class="reply-text">${this.escapeHtml(replyMessage.content)}</div>
        </div>
      </div>
    `;
  }

  formatMessageText(text) {
    // Format URLs
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

    // Format mentions
    text = text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');

    // Format hashtags
    text = text.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');

    // Format basic markdown
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/`(.*?)`/g, '<code>$1</code>');

    return text;
  }

  setupMessageActions(messageEl, message) {
    const replyBtn = messageEl.querySelector('.reply-btn');
    const deleteBtn = messageEl.querySelector('.delete-btn');
    const reactBtn = messageEl.querySelector('.react-btn');

    replyBtn?.addEventListener('click', () => {
      this.startReply(message);
    });

    deleteBtn?.addEventListener('click', () => {
      this.deleteMessage(message.id);
    });

    reactBtn?.addEventListener('click', (e) => {
      this.showReactionPicker(e.target, message.id);
    });

    // Setup audio player if present
    const audioPlayer = messageEl.querySelector('.audio-player');
    if (audioPlayer) {
      this.setupAudioPlayer(audioPlayer);
    }
  }

  setupAudioPlayer(container) {
    const playBtn = container.querySelector('.play-btn');
    const audio = container.parentElement.querySelector('audio');

    playBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        playBtn.textContent = '⏸️';
      } else {
        audio.pause();
        playBtn.textContent = '▶️';
      }
    });

    audio.addEventListener('ended', () => {
      playBtn.textContent = '▶️';
    });
  }

  // Typing Indicator Component
  createTypingIndicator(users) {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';

    if (users.length === 0) {
      indicator.style.display = 'none';
      return indicator;
    }

    const userNames = users.map(u => u.nickname).join(', ');
    const verb = users.length === 1 ? 'is' : 'are';

    indicator.innerHTML = `
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span class="typing-text">${userNames} ${verb} typing...</span>
    `;

    return indicator;
  }

  // Notification Component
  createNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    notification.innerHTML = `
      <div class="notification-content">
        <div class="notification-icon">${this.getNotificationIcon(type)}</div>
        <div class="notification-message">${this.escapeHtml(message)}</div>
        <button class="notification-close">×</button>
      </div>
    `;

    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      this.removeNotification(notification);
    });

    // Auto remove after duration
    setTimeout(() => {
      this.removeNotification(notification);
    }, duration);

    // Add to container
    let container = document.querySelector('.notifications-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'notifications-container';
      document.body.appendChild(container);
    }

    container.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    return notification;
  }

  removeNotification(notification) {
    notification.classList.add('removing');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }

  getNotificationIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  }

  // Utility Methods
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  getFileIcon(fileType) {
    const icons = {
      'image': '🖼️',
      'video': '🎥',
      'audio': '🎵',
      'pdf': '📄',
      'doc': '📝',
      'zip': '📦',
      'code': '💻'
    };

    if (fileType) {
      if (fileType.startsWith('image/')) return icons.image;
      if (fileType.startsWith('video/')) return icons.video;
      if (fileType.startsWith('audio/')) return icons.audio;
      if (fileType.includes('pdf')) return icons.pdf;
      if (fileType.includes('doc') || fileType.includes('word')) return icons.doc;
      if (fileType.includes('zip') || fileType.includes('archive')) return icons.zip;
    }

    return '📄';
  }

  // Theme Methods
  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', this.theme);
    this.setupTheme();
    return this.theme;
  }

  setTheme(theme) {
    this.theme = theme;
    localStorage.setItem('theme', theme);
    this.setupTheme();
  }
}

// Initialize global UI components
window.UI = new UIComponents();