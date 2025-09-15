// AI Module with Separate Window Interface
class AIModule {
  constructor() {
    this.isWindowOpen = false;
    this.aiWindow = null;
    this.currentConversation = [];
    this.messageHistory = [];
    this.suggestions = [];
    this.init();
  }

  init() {
    this.createAIButton();
    this.setupEventListeners();
    this.loadSettings();
  }

  createAIButton() {
    // Create floating AI button
    const aiButton = document.createElement('div');
    aiButton.id = 'ai-floating-btn';
    aiButton.innerHTML = `
      <div class="ai-btn-content">
        <i class="fas fa-robot"></i>
        <span class="ai-btn-text">AI Assistant</span>
      </div>
    `;
    aiButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      cursor: pointer;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      color: white;
      font-size: 24px;
      overflow: hidden;
    `;

    aiButton.addEventListener('mouseenter', () => {
      aiButton.style.transform = 'scale(1.1)';
      aiButton.style.width = '180px';
      aiButton.style.borderRadius = '30px';
      aiButton.querySelector('.ai-btn-text').style.display = 'inline';
    });

    aiButton.addEventListener('mouseleave', () => {
      aiButton.style.transform = 'scale(1)';
      aiButton.style.width = '60px';
      aiButton.style.borderRadius = '50%';
      aiButton.querySelector('.ai-btn-text').style.display = 'none';
    });

    // Style the text inside button
    const btnText = aiButton.querySelector('.ai-btn-text');
    btnText.style.cssText = `
      display: none;
      margin-left: 8px;
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      transition: all 0.3s ease;
    `;

    document.body.appendChild(aiButton);
  }

  setupEventListeners() {
    // Open AI window on button click
    document.getElementById('ai-floating-btn').addEventListener('click', () => {
      this.toggleAIWindow();
    });

    // Listen for keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        this.toggleAIWindow();
      }
    });
  }

  toggleAIWindow() {
    if (this.isWindowOpen) {
      this.closeAIWindow();
    } else {
      this.openAIWindow();
    }
  }

  openAIWindow() {
    if (this.aiWindow) {
      this.aiWindow.style.display = 'flex';
      this.isWindowOpen = true;
      return;
    }

    this.createAIWindow();
    this.isWindowOpen = true;
  }

  createAIWindow() {
    const aiWindow = document.createElement('div');
    aiWindow.id = 'ai-window';
    aiWindow.innerHTML = `
      <div class="ai-window-content">
        <div class="ai-window-header">
          <div class="ai-window-title">
            <i class="fas fa-robot"></i>
            <span>AI Assistant</span>
          </div>
          <div class="ai-window-controls">
            <button class="ai-btn-minimize" title="Minimize">
              <i class="fas fa-minus"></i>
            </button>
            <button class="ai-btn-close" title="Close">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div class="ai-window-body">
          <div class="ai-conversation-area" id="ai-conversation">
            <div class="ai-welcome-message">
              <div class="ai-avatar">
                <i class="fas fa-robot"></i>
              </div>
              <div class="ai-message-content">
                <h3>Welcome to AI Assistant!</h3>
                <p>I'm here to help you with various tasks. You can:</p>
                <ul>
                  <li>Ask questions and get intelligent responses</li>
                  <li>Get message suggestions and tone analysis</li>
                  <li>Summarize content and generate ideas</li>
                  <li>Get writing assistance and improvements</li>
                </ul>
                <p>How can I assist you today?</p>
              </div>
            </div>
          </div>

          <div class="ai-suggestions-bar" id="ai-suggestions" style="display: none;">
            <div class="suggestions-title">Suggested improvements:</div>
            <div class="suggestions-container" id="suggestions-container"></div>
          </div>

          <div class="ai-input-area">
            <div class="ai-input-container">
              <textarea
                id="ai-input"
                placeholder="Type your message or question..."
                rows="3"
              ></textarea>
              <div class="ai-input-actions">
                <button class="ai-btn-tone" id="ai-analyze-tone" title="Analyze Tone">
                  <i class="fas fa-chart-line"></i>
                </button>
                <button class="ai-btn-suggest" id="ai-get-suggestions" title="Get Suggestions">
                  <i class="fas fa-lightbulb"></i>
                </button>
                <button class="ai-btn-send" id="ai-send" title="Send Message">
                  <i class="fas fa-paper-plane"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Apply styles
    aiWindow.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      height: 500px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      z-index: 2000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: aiWindowOpen 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    // Add CSS for the window
    this.addAIWindowStyles();

    document.body.appendChild(aiWindow);
    this.aiWindow = aiWindow;

    // Setup window event listeners
    this.setupWindowEventListeners();

    // Make window draggable
    this.makeDraggable();

    // Focus on input
    setTimeout(() => {
      document.getElementById('ai-input').focus();
    }, 100);
  }

  addAIWindowStyles() {
    if (document.getElementById('ai-window-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'ai-window-styles';
    styles.textContent = `
      @keyframes aiWindowOpen {
        from {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
      }

      .ai-window-content {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .ai-window-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        cursor: move;
        user-select: none;
      }

      .ai-window-title {
        display: flex;
        align-items: center;
        font-weight: 600;
        font-size: 16px;
      }

      .ai-window-title i {
        margin-right: 8px;
        font-size: 18px;
      }

      .ai-window-controls {
        display: flex;
        gap: 8px;
      }

      .ai-window-controls button {
        width: 32px;
        height: 32px;
        border: none;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease;
      }

      .ai-window-controls button:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .ai-window-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .ai-conversation-area {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        background: #f8fafc;
      }

      .ai-welcome-message {
        display: flex;
        gap: 12px;
        background: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .ai-avatar {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 18px;
        flex-shrink: 0;
      }

      .ai-message-content h3 {
        margin: 0 0 12px 0;
        color: #1e293b;
        font-size: 18px;
      }

      .ai-message-content p {
        margin: 0 0 12px 0;
        color: #64748b;
        line-height: 1.5;
      }

      .ai-message-content ul {
        margin: 0 0 12px 0;
        padding-left: 20px;
        color: #64748b;
      }

      .ai-message-content li {
        margin-bottom: 4px;
        line-height: 1.4;
      }

      .ai-suggestions-bar {
        padding: 16px 20px;
        background: #fff3cd;
        border-top: 1px solid #ffeaa7;
      }

      .suggestions-title {
        font-size: 14px;
        font-weight: 600;
        color: #856404;
        margin-bottom: 8px;
      }

      .suggestions-container {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .suggestion-btn {
        padding: 6px 12px;
        background: white;
        border: 1px solid #ffd93d;
        border-radius: 16px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        color: #856404;
      }

      .suggestion-btn:hover {
        background: #ffd93d;
        color: #5d4e04;
      }

      .ai-input-area {
        padding: 20px;
        background: white;
        border-top: 1px solid #e2e8f0;
      }

      .ai-input-container {
        position: relative;
      }

      #ai-input {
        width: 100%;
        padding: 12px 80px 12px 16px;
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        font-size: 14px;
        resize: none;
        outline: none;
        transition: border-color 0.2s ease;
        font-family: inherit;
      }

      #ai-input:focus {
        border-color: #667eea;
      }

      .ai-input-actions {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        gap: 4px;
      }

      .ai-input-actions button {
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        color: #64748b;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }

      .ai-input-actions button:hover {
        background: #f1f5f9;
        color: #334155;
      }

      .ai-btn-send {
        background: #667eea !important;
        color: white !important;
      }

      .ai-btn-send:hover {
        background: #5a67d8 !important;
      }

      .ai-message {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        padding: 16px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .ai-message.user {
        flex-direction: row-reverse;
        background: #667eea;
        color: white;
      }

      .ai-message.user .ai-avatar {
        background: rgba(255, 255, 255, 0.2);
      }

      .ai-message-text {
        flex: 1;
        line-height: 1.5;
      }

      .ai-message-time {
        font-size: 12px;
        opacity: 0.7;
        margin-top: 4px;
      }

      .ai-typing {
        display: flex;
        gap: 4px;
        align-items: center;
        margin-top: 8px;
      }

      .ai-typing-dot {
        width: 8px;
        height: 8px;
        background: #667eea;
        border-radius: 50%;
        animation: aiTyping 1.4s infinite ease-in-out;
      }

      .ai-typing-dot:nth-child(2) {
        animation-delay: -0.16s;
      }

      .ai-typing-dot:nth-child(3) {
        animation-delay: -0.32s;
      }

      @keyframes aiTyping {
        0%, 80%, 100% {
          transform: scale(0);
          opacity: 0.5;
        }
        40% {
          transform: scale(1);
          opacity: 1;
        }
      }

      @media (max-width: 768px) {
        #ai-window {
          width: 90vw !important;
          height: 80vh !important;
        }

        .ai-window-header {
          padding: 12px 16px;
        }

        .ai-conversation-area {
          padding: 16px;
        }

        .ai-input-area {
          padding: 16px;
        }
      }
    `;
    document.head.appendChild(styles);
  }

  setupWindowEventListeners() {
    // Close button
    this.aiWindow.querySelector('.ai-btn-close').addEventListener('click', () => {
      this.closeAIWindow();
    });

    // Minimize button
    this.aiWindow.querySelector('.ai-btn-minimize').addEventListener('click', () => {
      this.minimizeAIWindow();
    });

    // Send message
    const sendBtn = this.aiWindow.querySelector('#ai-send');
    const input = this.aiWindow.querySelector('#ai-input');

    sendBtn.addEventListener('click', () => {
      this.sendMessage();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Get suggestions
    this.aiWindow.querySelector('#ai-get-suggestions').addEventListener('click', () => {
      this.getSuggestions();
    });

    // Analyze tone
    this.aiWindow.querySelector('#ai-analyze-tone').addEventListener('click', () => {
      this.analyzeTone();
    });
  }

  makeDraggable() {
    const header = this.aiWindow.querySelector('.ai-window-header');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.ai-window-controls')) return;

      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;

      if (e.target === header || header.contains(e.target)) {
        isDragging = true;
        header.style.cursor = 'grabbing';
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        this.aiWindow.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`;
      }
    });

    document.addEventListener('mouseup', () => {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      header.style.cursor = 'move';
    });
  }

  async sendMessage() {
    const input = this.aiWindow.querySelector('#ai-input');
    const message = input.value.trim();

    if (!message) return;

    // Add user message to conversation
    this.addMessageToConversation(message, 'user');
    input.value = '';

    // Show typing indicator
    this.showTypingIndicator();

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          message: message,
          context: this.currentConversation.slice(-5) // Last 5 messages for context
        })
      });

      const data = await response.json();

      this.hideTypingIndicator();

      if (data.success) {
        this.addMessageToConversation(data.response, 'ai');
        this.currentConversation.push(
          { role: 'user', content: message },
          { role: 'assistant', content: data.response }
        );
      } else {
        this.addMessageToConversation('Sorry, I encountered an error. Please try again.', 'ai', true);
      }
    } catch (error) {
      this.hideTypingIndicator();
      this.addMessageToConversation('Sorry, I\'m having trouble connecting. Please check your connection and try again.', 'ai', true);
    }
  }

  addMessageToConversation(message, sender, isError = false) {
    const conversation = this.aiWindow.querySelector('#ai-conversation');
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ${sender}`;

    const avatar = sender === 'user' ?
      '<i class="fas fa-user"></i>' :
      '<i class="fas fa-robot"></i>';

    messageDiv.innerHTML = `
      <div class="ai-avatar">${avatar}</div>
      <div class="ai-message-text">
        ${message}
        <div class="ai-message-time">${new Date().toLocaleTimeString()}</div>
      </div>
    `;

    if (isError) {
      messageDiv.style.background = '#fee2e2';
      messageDiv.style.borderLeft = '4px solid #ef4444';
    }

    conversation.appendChild(messageDiv);
    conversation.scrollTop = conversation.scrollHeight;
  }

  showTypingIndicator() {
    const conversation = this.aiWindow.querySelector('#ai-conversation');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'ai-typing-indicator';
    typingDiv.className = 'ai-message ai';
    typingDiv.innerHTML = `
      <div class="ai-avatar"><i class="fas fa-robot"></i></div>
      <div class="ai-message-text">
        <div class="ai-typing">
          <div class="ai-typing-dot"></div>
          <div class="ai-typing-dot"></div>
          <div class="ai-typing-dot"></div>
        </div>
      </div>
    `;
    conversation.appendChild(typingDiv);
    conversation.scrollTop = conversation.scrollHeight;
  }

  hideTypingIndicator() {
    const typingIndicator = this.aiWindow.querySelector('#ai-typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  async getSuggestions() {
    const input = this.aiWindow.querySelector('#ai-input');
    const message = input.value.trim();

    if (!message) {
      alert('Please enter a message to get suggestions');
      return;
    }

    try {
      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          message: message,
          context: this.currentConversation.slice(-3)
        })
      });

      const data = await response.json();

      if (data.success) {
        this.showSuggestions(data.suggestions);
      } else {
        alert('Failed to get suggestions. Please try again.');
      }
    } catch (error) {
      alert('Error getting suggestions. Please check your connection.');
    }
  }

  showSuggestions(suggestions) {
    const suggestionsBar = this.aiWindow.querySelector('#ai-suggestions');
    const suggestionsContainer = this.aiWindow.querySelector('#suggestions-container');

    suggestionsContainer.innerHTML = '';

    suggestions.forEach(suggestion => {
      const btn = document.createElement('button');
      btn.className = 'suggestion-btn';
      btn.textContent = `${suggestion.tone}: ${suggestion.content.substring(0, 50)}${suggestion.content.length > 50 ? '...' : ''}`;
      btn.title = suggestion.content;

      btn.addEventListener('click', () => {
        this.applySuggestion(suggestion);
      });

      suggestionsContainer.appendChild(btn);
    });

    suggestionsBar.style.display = 'block';
  }

  applySuggestion(suggestion) {
    const input = this.aiWindow.querySelector('#ai-input');
    input.value = suggestion.content;
    input.focus();

    // Hide suggestions
    this.aiWindow.querySelector('#ai-suggestions').style.display = 'none';

    // Mark suggestion as used
    this.markSuggestionUsed(suggestion.id);
  }

  async markSuggestionUsed(suggestionId) {
    try {
      await fetch(`/api/ai/suggestions/${suggestionId}/use`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.log('Failed to mark suggestion as used');
    }
  }

  async analyzeTone() {
    const input = this.aiWindow.querySelector('#ai-input');
    const message = input.value.trim();

    if (!message) {
      alert('Please enter a message to analyze');
      return;
    }

    try {
      const response = await fetch('/api/ai/analyze/tone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          message: message,
          context: this.currentConversation.slice(-3)
        })
      });

      const data = await response.json();

      if (data.success) {
        this.showToneAnalysis(data.analysis);
      } else {
        alert('Failed to analyze tone. Please try again.');
      }
    } catch (error) {
      alert('Error analyzing tone. Please check your connection.');
    }
  }

  showToneAnalysis(analysis) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 3000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    modal.innerHTML = `
      <div style="
        background: white;
        padding: 24px;
        border-radius: 12px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      ">
        <h3 style="margin: 0 0 16px 0; color: #1e293b;">Tone Analysis</h3>
        <div style="margin-bottom: 16px;">
          <strong>Overall Tone:</strong> ${analysis.overall_tone}
        </div>
        <div style="margin-bottom: 16px;">
          <strong>Confidence:</strong> ${analysis.confidence}%
        </div>
        <div style="margin-bottom: 16px;">
          <strong>Recommendations:</strong>
          <ul style="margin: 8px 0; padding-left: 20px;">
            ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>
        <div style="text-align: right;">
          <button onclick="this.closest('[style*=\"position: fixed\"]').remove()" style="
            padding: 8px 16px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
          ">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  closeAIWindow() {
    if (this.aiWindow) {
      this.aiWindow.style.display = 'none';
      this.isWindowOpen = false;
    }
  }

  minimizeAIWindow() {
    this.closeAIWindow();
  }

  loadSettings() {
    // Load any saved settings from localStorage
    const savedPosition = localStorage.getItem('ai-window-position');
    if (savedPosition) {
      const { x, y } = JSON.parse(savedPosition);
      // Apply saved position when window is created
    }
  }

  saveSettings() {
    // Save current settings to localStorage
    if (this.aiWindow) {
      const rect = this.aiWindow.getBoundingClientRect();
      localStorage.setItem('ai-window-position', JSON.stringify({
        x: rect.left,
        y: rect.top
      }));
    }
  }
}

// Initialize AI Module when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.aiModule = new AIModule();
});

// Save settings when page is unloaded
window.addEventListener('beforeunload', () => {
  if (window.aiModule) {
    window.aiModule.saveSettings();
  }
});