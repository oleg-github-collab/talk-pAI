/**
 * Enhanced Chat System with Advanced Features
 * Mentions, Quotes, Markdown, Voice Messages, Reactions, Threading
 */

class EnhancedChatSystem {
    constructor() {
        this.activeChat = null;
        this.messageCache = new Map();
        this.voiceRecorder = null;
        this.isRecording = false;
        this.replyToMessage = null;
        this.editingMessage = null;
        this.typingUsers = new Set();
        this.mentionSuggestions = [];
        this.messageHistory = [];
        this.historyIndex = -1;

        this.init();
    }

    init() {
        this.initializeMessageInput();
        this.initializeVoiceRecording();
        this.initializeMentions();
        this.initializeMarkdown();
        this.initializeReactions();
        this.initializeFileUpload();
        this.initializeKeyboardShortcuts();
    }

    // ================================
    // MESSAGE INPUT ENHANCEMENT
    // ================================

    initializeMessageInput() {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput) return;

        // Enhanced input with rich text support
        this.replaceInputWithEditor(messageInput);
        this.bindInputEvents();
    }

    replaceInputWithEditor(originalInput) {
        const container = originalInput.parentElement;

        // Create enhanced editor
        const editor = document.createElement('div');
        editor.className = 'enhanced-message-editor';
        editor.contentEditable = true;
        editor.setAttribute('data-placeholder', 'Type your message...');
        editor.id = 'enhancedMessageInput';

        // Replace original input
        container.replaceChild(editor, originalInput);

        // Add formatting toolbar
        this.addFormattingToolbar(container);
    }

    addFormattingToolbar(container) {
        const toolbar = document.createElement('div');
        toolbar.className = 'formatting-toolbar hidden';
        toolbar.innerHTML = `
            <button class="format-btn" data-format="bold" title="Bold (Ctrl+B)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
                    <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
                </svg>
            </button>
            <button class="format-btn" data-format="italic" title="Italic (Ctrl+I)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="19" y1="4" x2="10" y2="4"/>
                    <line x1="14" y1="20" x2="5" y2="20"/>
                    <line x1="15" y1="4" x2="9" y2="20"/>
                </svg>
            </button>
            <button class="format-btn" data-format="code" title="Code (Ctrl+Shift+C)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="16,18 22,12 16,6"/>
                    <polyline points="8,6 2,12 8,18"/>
                </svg>
            </button>
            <button class="format-btn" data-format="quote" title="Quote">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
                    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
                </svg>
            </button>
            <div class="toolbar-separator"></div>
            <button class="format-btn" data-action="emoji" title="Emoji">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                    <line x1="9" y1="9" x2="9.01" y2="9"/>
                    <line x1="15" y1="9" x2="15.01" y2="9"/>
                </svg>
            </button>
            <button class="format-btn" data-action="mention" title="Mention (@)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="4"/>
                    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>
                </svg>
            </button>
        `;

        container.insertBefore(toolbar, container.firstChild);
        this.bindToolbarEvents(toolbar);
    }

    bindInputEvents() {
        const editor = document.getElementById('enhancedMessageInput');
        const sendBtn = document.getElementById('sendBtn');
        const toolbar = document.querySelector('.formatting-toolbar');

        // Show/hide toolbar on focus
        editor.addEventListener('focus', () => {
            toolbar.classList.remove('hidden');
            editor.classList.add('focused');
        });

        editor.addEventListener('blur', (e) => {
            // Delay to allow toolbar clicks
            setTimeout(() => {
                if (!e.relatedTarget?.closest('.formatting-toolbar')) {
                    toolbar.classList.add('hidden');
                    editor.classList.remove('focused');
                }
            }, 100);
        });

        // Handle input changes
        editor.addEventListener('input', () => {
            this.handleInputChange();
            this.updateSendButton();
        });

        // Handle keyboard shortcuts
        editor.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Handle paste events
        editor.addEventListener('paste', (e) => {
            this.handlePaste(e);
        });

        // Send message on Enter
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Send button
        sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });
    }

    bindToolbarEvents(toolbar) {
        toolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('.format-btn');
            if (!btn) return;

            const format = btn.dataset.format;
            const action = btn.dataset.action;

            if (format) {
                this.applyFormatting(format);
            } else if (action) {
                this.executeAction(action);
            }
        });
    }

    // ================================
    // FORMATTING & MARKDOWN
    // ================================

    initializeMarkdown() {
        // Real-time markdown preview
        this.markdownEnabled = true;
    }

    applyFormatting(format) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        let formattedText = '';
        switch (format) {
            case 'bold':
                formattedText = `**${selectedText}**`;
                break;
            case 'italic':
                formattedText = `*${selectedText}*`;
                break;
            case 'code':
                formattedText = `\`${selectedText}\``;
                break;
            case 'quote':
                formattedText = `> ${selectedText}`;
                break;
        }

        if (formattedText) {
            this.insertText(formattedText);
        }
    }

    insertText(text) {
        const editor = document.getElementById('enhancedMessageInput');
        const selection = window.getSelection();

        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();

            const textNode = document.createTextNode(text);
            range.insertNode(textNode);

            // Move cursor to end of inserted text
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            editor.appendChild(document.createTextNode(text));
        }

        this.updateSendButton();
    }

    parseMarkdown(text) {
        return text
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Code
            .replace(/`(.*?)`/g, '<code>$1</code>')
            // Strikethrough
            .replace(/~~(.*?)~~/g, '<del>$1</del>')
            // Code blocks
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            // Quotes
            .replace(/^> (.+)/gm, '<blockquote>$1</blockquote>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            // Line breaks
            .replace(/\n/g, '<br>');
    }

    // ================================
    // MENTIONS SYSTEM
    // ================================

    initializeMentions() {
        this.mentionsList = document.createElement('div');
        this.mentionsList.className = 'mentions-suggestions hidden';
        document.body.appendChild(this.mentionsList);

        this.loadMentionUsers();
    }

    async loadMentionUsers() {
        // In real app, fetch from API
        this.mentionSuggestions = [
            { id: 'user1', name: 'John Doe', avatar: '👨', status: 'online' },
            { id: 'user2', name: 'Jane Smith', avatar: '👩', status: 'away' },
            { id: 'user3', name: 'Bob Wilson', avatar: '👨‍💻', status: 'busy' },
            { id: 'ai-assistant', name: 'AI Assistant', avatar: '🤖', status: 'online' }
        ];
    }

    handleMentionInput(inputText, cursorPosition) {
        const mentionMatch = inputText.substring(0, cursorPosition).match(/@(\w*)$/);

        if (mentionMatch) {
            const query = mentionMatch[1].toLowerCase();
            const suggestions = this.mentionSuggestions.filter(user =>
                user.name.toLowerCase().includes(query)
            );

            this.showMentionSuggestions(suggestions, mentionMatch.index);
        } else {
            this.hideMentionSuggestions();
        }
    }

    showMentionSuggestions(suggestions, position) {
        const editor = document.getElementById('enhancedMessageInput');
        const rect = editor.getBoundingClientRect();

        this.mentionsList.innerHTML = suggestions.map((user, index) => `
            <div class="mention-item ${index === 0 ? 'selected' : ''}" data-user-id="${user.id}">
                <span class="mention-avatar">${user.avatar}</span>
                <div class="mention-info">
                    <div class="mention-name">${user.name}</div>
                    <div class="mention-status ${user.status}">${user.status}</div>
                </div>
            </div>
        `).join('');

        // Position suggestions
        this.mentionsList.style.left = rect.left + 'px';
        this.mentionsList.style.top = (rect.bottom + 5) + 'px';
        this.mentionsList.classList.remove('hidden');

        this.bindMentionEvents();
    }

    hideMentionSuggestions() {
        this.mentionsList.classList.add('hidden');
    }

    bindMentionEvents() {
        const items = this.mentionsList.querySelectorAll('.mention-item');

        items.forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.dataset.userId;
                const user = this.mentionSuggestions.find(u => u.id === userId);
                this.insertMention(user);
            });
        });
    }

    insertMention(user) {
        const editor = document.getElementById('enhancedMessageInput');
        const text = editor.textContent;
        const cursorPos = this.getCursorPosition(editor);

        // Find the @ symbol position
        const beforeCursor = text.substring(0, cursorPos);
        const atIndex = beforeCursor.lastIndexOf('@');

        if (atIndex !== -1) {
            const beforeMention = text.substring(0, atIndex);
            const afterCursor = text.substring(cursorPos);

            const mentionSpan = document.createElement('span');
            mentionSpan.className = 'mention';
            mentionSpan.dataset.userId = user.id;
            mentionSpan.textContent = `@${user.name}`;

            editor.innerHTML = '';
            editor.appendChild(document.createTextNode(beforeMention));
            editor.appendChild(mentionSpan);
            editor.appendChild(document.createTextNode(' ' + afterCursor));

            // Set cursor after mention
            this.setCursorAfter(mentionSpan);
        }

        this.hideMentionSuggestions();
    }

    // ================================
    // VOICE RECORDING
    // ================================

    initializeVoiceRecording() {
        const voiceBtn = document.getElementById('voiceBtn');
        if (!voiceBtn) return;

        voiceBtn.addEventListener('click', () => {
            if (this.isRecording) {
                this.stopVoiceRecording();
            } else {
                this.startVoiceRecording();
            }
        });

        // Long press for voice recording
        let pressTimer = null;

        voiceBtn.addEventListener('mousedown', () => {
            pressTimer = setTimeout(() => {
                if (!this.isRecording) {
                    this.startVoiceRecording();
                }
            }, 500);
        });

        voiceBtn.addEventListener('mouseup', () => {
            clearTimeout(pressTimer);
        });
    }

    async startVoiceRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            this.voiceRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.audioChunks = [];
            this.recordingStartTime = Date.now();

            this.voiceRecorder.addEventListener('dataavailable', (e) => {
                if (e.data.size > 0) {
                    this.audioChunks.push(e.data);
                }
            });

            this.voiceRecorder.addEventListener('stop', () => {
                this.processVoiceRecording();
            });

            this.voiceRecorder.start(100); // Collect data every 100ms
            this.isRecording = true;

            this.showVoiceRecordingUI();
            this.updateVoiceButton();

        } catch (error) {
            console.error('Failed to start voice recording:', error);
            this.showVoiceError('Microphone access denied');
        }
    }

    stopVoiceRecording() {
        if (this.voiceRecorder && this.isRecording) {
            this.voiceRecorder.stop();
            this.voiceRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;

            this.hideVoiceRecordingUI();
            this.updateVoiceButton();
        }
    }

    showVoiceRecordingUI() {
        const voiceUI = document.createElement('div');
        voiceUI.id = 'voiceRecordingUI';
        voiceUI.className = 'voice-recording-ui glass';
        voiceUI.innerHTML = `
            <div class="voice-recording-content">
                <div class="voice-animation">
                    <div class="voice-wave">
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
                <div class="voice-info">
                    <div class="voice-timer">00:00</div>
                    <div class="voice-hint">Release to send, click to cancel</div>
                </div>
                <div class="voice-actions">
                    <button class="voice-cancel-btn">✕</button>
                    <button class="voice-send-btn">📤</button>
                </div>
            </div>
        `;

        document.body.appendChild(voiceUI);

        // Start timer
        this.voiceTimer = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;

            const timerElement = voiceUI.querySelector('.voice-timer');
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }, 100);

        // Bind events
        voiceUI.querySelector('.voice-cancel-btn').addEventListener('click', () => {
            this.cancelVoiceRecording();
        });

        voiceUI.querySelector('.voice-send-btn').addEventListener('click', () => {
            this.stopVoiceRecording();
        });

        // Auto-stop after 5 minutes
        setTimeout(() => {
            if (this.isRecording) {
                this.stopVoiceRecording();
            }
        }, 300000);
    }

    hideVoiceRecordingUI() {
        const voiceUI = document.getElementById('voiceRecordingUI');
        if (voiceUI) {
            voiceUI.remove();
        }

        if (this.voiceTimer) {
            clearInterval(this.voiceTimer);
            this.voiceTimer = null;
        }
    }

    cancelVoiceRecording() {
        if (this.voiceRecorder && this.isRecording) {
            this.voiceRecorder.stop();
            this.voiceRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;
        }

        this.hideVoiceRecordingUI();
        this.updateVoiceButton();
        this.audioChunks = [];
    }

    async processVoiceRecording() {
        if (this.audioChunks.length === 0) return;

        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const duration = Date.now() - this.recordingStartTime;

        // Generate waveform data
        const waveformData = await this.generateWaveform(audioBlob);

        // Create audio URL
        const audioUrl = URL.createObjectURL(audioBlob);

        // Send voice message
        this.sendVoiceMessage({
            audioBlob,
            audioUrl,
            duration,
            waveformData
        });

        this.audioChunks = [];
    }

    async generateWaveform(audioBlob) {
        // Simplified waveform generation
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const channelData = audioBuffer.getChannelData(0);
        const samples = 50; // Number of waveform points
        const blockSize = Math.floor(channelData.length / samples);
        const waveform = [];

        for (let i = 0; i < samples; i++) {
            let blockStart = blockSize * i;
            let sum = 0;

            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(channelData[blockStart + j]);
            }

            waveform.push(sum / blockSize);
        }

        return waveform;
    }

    updateVoiceButton() {
        const voiceBtn = document.getElementById('voiceBtn');
        if (this.isRecording) {
            voiceBtn.classList.add('recording');
            voiceBtn.style.color = 'var(--accent-error)';
        } else {
            voiceBtn.classList.remove('recording');
            voiceBtn.style.color = '';
        }
    }

    showVoiceError(message) {
        const errorToast = document.createElement('div');
        errorToast.className = 'voice-error-toast glass';
        errorToast.textContent = message;
        errorToast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            padding: 1rem 2rem;
            background: var(--glass-primary);
            border: 1px solid var(--accent-error);
            border-radius: var(--radius-lg);
            color: var(--accent-error);
            z-index: 10000;
            backdrop-filter: var(--blur-glass);
        `;

        document.body.appendChild(errorToast);
        setTimeout(() => errorToast.remove(), 3000);
    }

    // ================================
    // REACTIONS SYSTEM
    // ================================

    initializeReactions() {
        this.reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '👎'];
        this.setupReactionEvents();
    }

    setupReactionEvents() {
        document.addEventListener('contextmenu', (e) => {
            const message = e.target.closest('.message');
            if (message) {
                e.preventDefault();
                this.showReactionPicker(e.clientX, e.clientY, message.dataset.messageId);
            }
        });

        // Quick reactions on hover
        document.addEventListener('mouseenter', (e) => {
            const message = e.target.closest('.message');
            if (message && !message.classList.contains('own')) {
                this.showQuickReactions(message);
            }
        }, true);

        document.addEventListener('mouseleave', (e) => {
            const message = e.target.closest('.message');
            if (message) {
                this.hideQuickReactions(message);
            }
        }, true);
    }

    showReactionPicker(x, y, messageId) {
        const picker = document.createElement('div');
        picker.className = 'reaction-picker glass';
        picker.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            z-index: 10000;
            display: flex;
            gap: 0.5rem;
            padding: 0.5rem;
            border-radius: var(--radius-lg);
            backdrop-filter: var(--blur-strong);
            border: var(--border-glass-strong);
            box-shadow: var(--shadow-glass-hover);
            animation: scaleIn 0.15s ease-out;
        `;

        picker.innerHTML = this.reactionEmojis.map(emoji => `
            <button class="reaction-emoji" data-emoji="${emoji}">${emoji}</button>
        `).join('');

        document.body.appendChild(picker);

        // Position adjustment
        const rect = picker.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            picker.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            picker.style.top = (y - rect.height) + 'px';
        }

        // Handle clicks
        picker.addEventListener('click', (e) => {
            const emojiBtn = e.target.closest('.reaction-emoji');
            if (emojiBtn) {
                this.addReaction(messageId, emojiBtn.dataset.emoji);
                picker.remove();
            }
        });

        // Remove on outside click
        setTimeout(() => {
            document.addEventListener('click', (e) => {
                if (!picker.contains(e.target)) {
                    picker.remove();
                }
            }, { once: true });
        }, 100);
    }

    showQuickReactions(messageElement) {
        if (messageElement.querySelector('.quick-reactions')) return;

        const quickReactions = document.createElement('div');
        quickReactions.className = 'quick-reactions';
        quickReactions.innerHTML = `
            <button class="quick-reaction" data-emoji="👍">👍</button>
            <button class="quick-reaction" data-emoji="❤️">❤️</button>
            <button class="quick-reaction" data-emoji="😂">😂</button>
            <button class="quick-reaction-more">+</button>
        `;

        messageElement.appendChild(quickReactions);

        // Handle clicks
        quickReactions.addEventListener('click', (e) => {
            const reactionBtn = e.target.closest('.quick-reaction');
            if (reactionBtn && reactionBtn.dataset.emoji) {
                this.addReaction(messageElement.dataset.messageId, reactionBtn.dataset.emoji);
            }
        });
    }

    hideQuickReactions(messageElement) {
        const quickReactions = messageElement.querySelector('.quick-reactions');
        if (quickReactions) {
            setTimeout(() => {
                if (!quickReactions.matches(':hover')) {
                    quickReactions.remove();
                }
            }, 100);
        }
    }

    addReaction(messageId, emoji) {
        // In real app, send to server
        console.log('Adding reaction:', messageId, emoji);

        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            this.updateMessageReactions(messageElement, messageId, emoji);
        }
    }

    updateMessageReactions(messageElement, messageId, newEmoji) {
        let reactionsContainer = messageElement.querySelector('.message-reactions');
        if (!reactionsContainer) {
            reactionsContainer = document.createElement('div');
            reactionsContainer.className = 'message-reactions';
            messageElement.querySelector('.message-content').appendChild(reactionsContainer);
        }

        // Find existing reaction or create new one
        let reactionElement = reactionsContainer.querySelector(`[data-emoji="${newEmoji}"]`);
        if (reactionElement) {
            const count = parseInt(reactionElement.querySelector('.reaction-count').textContent) + 1;
            reactionElement.querySelector('.reaction-count').textContent = count;
        } else {
            reactionElement = document.createElement('div');
            reactionElement.className = 'reaction';
            reactionElement.dataset.emoji = newEmoji;
            reactionElement.innerHTML = `
                <span class="reaction-emoji">${newEmoji}</span>
                <span class="reaction-count">1</span>
            `;
            reactionsContainer.appendChild(reactionElement);
        }

        // Add animation
        reactionElement.style.animation = 'reactionPop 0.3s ease-out';
    }

    // ================================
    // FILE UPLOAD & DRAG & DROP
    // ================================

    initializeFileUpload() {
        this.setupDragAndDrop();
        this.setupFileInput();
    }

    setupDragAndDrop() {
        const chatArea = document.getElementById('chatArea');

        chatArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            chatArea.classList.add('drag-over');
        });

        chatArea.addEventListener('dragleave', (e) => {
            if (!chatArea.contains(e.relatedTarget)) {
                chatArea.classList.remove('drag-over');
            }
        });

        chatArea.addEventListener('drop', (e) => {
            e.preventDefault();
            chatArea.classList.remove('drag-over');

            const files = Array.from(e.dataTransfer.files);
            this.handleFileUpload(files);
        });
    }

    setupFileInput() {
        const attachBtn = document.getElementById('attachBtn');
        const fileInput = document.getElementById('fileInput');

        attachBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleFileUpload(files);
            e.target.value = ''; // Reset input
        });
    }

    async handleFileUpload(files) {
        for (const file of files) {
            if (this.validateFile(file)) {
                await this.uploadFile(file);
            }
        }
    }

    validateFile(file) {
        const maxSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = [
            'image/', 'video/', 'audio/',
            'application/pdf', 'text/',
            'application/msword',
            'application/vnd.openxmlformats-officedocument'
        ];

        if (file.size > maxSize) {
            this.showFileError(`File "${file.name}" is too large. Maximum size is 5MB.`);
            return false;
        }

        const isAllowed = allowedTypes.some(type => file.type.startsWith(type));
        if (!isAllowed) {
            this.showFileError(`File type "${file.type}" is not supported.`);
            return false;
        }

        return true;
    }

    async uploadFile(file) {
        const uploadId = this.generateUploadId();
        this.showUploadProgress(uploadId, file);

        try {
            // Simulate upload progress
            await this.simulateUpload(uploadId);

            // Create file message
            const fileData = {
                name: file.name,
                size: file.size,
                type: file.type,
                url: URL.createObjectURL(file),
                uploadId
            };

            this.sendFileMessage(fileData);
            this.hideUploadProgress(uploadId);

        } catch (error) {
            this.showFileError(`Failed to upload "${file.name}": ${error.message}`);
            this.hideUploadProgress(uploadId);
        }
    }

    showUploadProgress(uploadId, file) {
        const progressElement = document.createElement('div');
        progressElement.className = 'upload-progress glass';
        progressElement.id = `upload-${uploadId}`;
        progressElement.innerHTML = `
            <div class="upload-info">
                <div class="upload-icon">${this.getFileIcon(file.type)}</div>
                <div class="upload-details">
                    <div class="upload-name">${file.name}</div>
                    <div class="upload-size">${this.formatFileSize(file.size)}</div>
                </div>
            </div>
            <div class="upload-progress-bar">
                <div class="upload-progress-fill"></div>
            </div>
            <button class="upload-cancel" data-upload-id="${uploadId}">✕</button>
        `;

        const inputArea = document.querySelector('.input-area');
        inputArea.appendChild(progressElement);

        // Handle cancel
        progressElement.querySelector('.upload-cancel').addEventListener('click', () => {
            this.cancelUpload(uploadId);
        });
    }

    async simulateUpload(uploadId) {
        const progressFill = document.querySelector(`#upload-${uploadId} .upload-progress-fill`);

        for (let i = 0; i <= 100; i += 10) {
            progressFill.style.width = i + '%';
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    hideUploadProgress(uploadId) {
        const progressElement = document.getElementById(`upload-${uploadId}`);
        if (progressElement) {
            progressElement.remove();
        }
    }

    // ================================
    // KEYBOARD SHORTCUTS
    // ================================

    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    handleKeyboardShortcuts(e) {
        const editor = document.getElementById('enhancedMessageInput');
        const isEditorFocused = document.activeElement === editor;

        // Global shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'k':
                    e.preventDefault();
                    document.getElementById('globalSearch')?.focus();
                    break;
                case 'n':
                    e.preventDefault();
                    this.createNewChat();
                    break;
                case '/':
                    e.preventDefault();
                    this.showHelpModal();
                    break;
            }
        }

        // Editor shortcuts
        if (isEditorFocused) {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'b':
                        e.preventDefault();
                        this.applyFormatting('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.applyFormatting('italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.applyFormatting('underline');
                        break;
                }
            }

            // Arrow keys for message history
            if (e.key === 'ArrowUp' && e.altKey) {
                e.preventDefault();
                this.navigateMessageHistory('up');
            } else if (e.key === 'ArrowDown' && e.altKey) {
                e.preventDefault();
                this.navigateMessageHistory('down');
            }

            // Escape to clear
            if (e.key === 'Escape') {
                this.clearEditor();
                this.cancelReply();
            }
        }
    }

    // ================================
    // MESSAGE MANAGEMENT
    // ================================

    sendMessage() {
        const editor = document.getElementById('enhancedMessageInput');
        const content = this.getEditorContent();

        if (!content.trim()) return;

        const message = {
            id: this.generateMessageId(),
            chatId: this.activeChat || 'ai-assistant',
            content: content,
            contentType: 'text',
            mentions: this.extractMentions(content),
            replyTo: this.replyToMessage,
            timestamp: new Date(),
            isOwn: true
        };

        this.addMessageToHistory(content);
        this.sendMessageToServer(message);
        this.clearEditor();
        this.cancelReply();
    }

    sendVoiceMessage(voiceData) {
        const message = {
            id: this.generateMessageId(),
            chatId: this.activeChat || 'ai-assistant',
            content: '',
            contentType: 'voice',
            voiceData: voiceData,
            timestamp: new Date(),
            isOwn: true
        };

        this.sendMessageToServer(message);
    }

    sendFileMessage(fileData) {
        const message = {
            id: this.generateMessageId(),
            chatId: this.activeChat || 'ai-assistant',
            content: fileData.name,
            contentType: 'file',
            fileData: fileData,
            timestamp: new Date(),
            isOwn: true
        };

        this.sendMessageToServer(message);
    }

    sendMessageToServer(message) {
        // Add to local cache
        if (!this.messageCache.has(message.chatId)) {
            this.messageCache.set(message.chatId, []);
        }
        this.messageCache.get(message.chatId).push(message);

        // Render message
        this.renderMessage(message);

        // Send to server (implementation depends on backend)
        if (window.socket) {
            window.socket.emit('message', message);
        }

        // Handle AI response for AI assistant chat
        if (message.chatId === 'ai-assistant' && message.contentType === 'text') {
            this.handleAIResponse(message.content);
        }
    }

    async handleAIResponse(userMessage) {
        // Show typing indicator
        this.showTypingIndicator('ai-assistant');

        try {
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

            const aiResponse = this.generateAIResponse(userMessage);
            const aiMessage = {
                id: this.generateMessageId(),
                chatId: 'ai-assistant',
                content: aiResponse,
                contentType: 'text',
                senderId: 'ai-assistant',
                senderName: 'AI Assistant',
                timestamp: new Date(),
                isOwn: false
            };

            this.hideTypingIndicator('ai-assistant');
            this.sendMessageToServer(aiMessage);

        } catch (error) {
            this.hideTypingIndicator('ai-assistant');
            console.error('AI response error:', error);
        }
    }

    generateAIResponse(userMessage) {
        // Enhanced AI responses based on content
        const responses = {
            greeting: [
                "Hello! How can I help you today?",
                "Hi there! What can I do for you?",
                "Hey! I'm here to assist with anything you need."
            ],
            question: [
                "That's a great question! Let me help you with that.",
                "I'd be happy to help you understand that better.",
                "Interesting question! Here's what I know about that..."
            ],
            thanks: [
                "You're very welcome! Happy to help anytime.",
                "My pleasure! Let me know if you need anything else.",
                "Glad I could help! Feel free to ask more questions."
            ],
            default: [
                "I understand what you're saying. How can I assist further?",
                "That's interesting! Tell me more about what you're looking for.",
                "I'm here to help with whatever you need. What would you like to explore?"
            ]
        };

        const lowerMessage = userMessage.toLowerCase();
        let category = 'default';

        if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
            category = 'greeting';
        } else if (lowerMessage.includes('?')) {
            category = 'question';
        } else if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
            category = 'thanks';
        }

        const responseArray = responses[category];
        return responseArray[Math.floor(Math.random() * responseArray.length)];
    }

    // ================================
    // UTILITY METHODS
    // ================================

    getEditorContent() {
        const editor = document.getElementById('enhancedMessageInput');
        return editor.textContent || '';
    }

    clearEditor() {
        const editor = document.getElementById('enhancedMessageInput');
        editor.innerHTML = '';
        this.updateSendButton();
    }

    updateSendButton() {
        const sendBtn = document.getElementById('sendBtn');
        const content = this.getEditorContent();
        sendBtn.disabled = !content.trim();
    }

    extractMentions(content) {
        const mentions = [];
        const mentionElements = document.querySelectorAll('#enhancedMessageInput .mention');

        mentionElements.forEach(element => {
            mentions.push({
                userId: element.dataset.userId,
                name: element.textContent
            });
        });

        return mentions;
    }

    getCursorPosition(element) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return 0;

        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);

        return preCaretRange.toString().length;
    }

    setCursorAfter(element) {
        const range = document.createRange();
        const selection = window.getSelection();

        range.setStartAfter(element);
        range.collapse(true);

        selection.removeAllRanges();
        selection.addRange(range);
    }

    generateMessageId() {
        return 'msg_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    generateUploadId() {
        return 'upload_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎥';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('word')) return '📝';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
        return '📎';
    }

    formatFileSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    showFileError(message) {
        const errorToast = document.createElement('div');
        errorToast.className = 'file-error-toast glass';
        errorToast.textContent = message;
        errorToast.style.cssText = `
            position: fixed;
            bottom: 120px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: var(--glass-primary);
            border: 1px solid var(--accent-error);
            border-radius: var(--radius-lg);
            color: var(--accent-error);
            z-index: 10000;
            backdrop-filter: var(--blur-glass);
            max-width: 300px;
            animation: slideInRight 0.3s ease-out;
        `;

        document.body.appendChild(errorToast);
        setTimeout(() => errorToast.remove(), 5000);
    }
}

// Additional CSS for enhanced chat features
const enhancedChatCSS = `
/* Enhanced Message Editor */
.enhanced-message-editor {
    flex: 1;
    min-height: 20px;
    max-height: 120px;
    padding: 0.5rem;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 0.9375rem;
    line-height: 1.4;
    overflow-y: auto;
    resize: none;
}

.enhanced-message-editor:empty::before {
    content: attr(data-placeholder);
    color: var(--text-tertiary);
    pointer-events: none;
}

.enhanced-message-editor.focused {
    background: rgba(255, 255, 255, 0.02);
    border-radius: var(--radius-sm);
}

/* Formatting Toolbar */
.formatting-toolbar {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    background: var(--glass-secondary);
    border-bottom: var(--border-glass);
    transition: var(--transition-fast);
    overflow-x: auto;
}

.formatting-toolbar.hidden {
    height: 0;
    padding: 0;
    opacity: 0;
    overflow: hidden;
}

.format-btn {
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--transition-fast);
    flex-shrink: 0;
}

.format-btn:hover {
    background: var(--glass-hover);
    color: var(--text-primary);
}

.format-btn.active {
    background: var(--glass-accent);
    color: var(--accent-primary);
}

.toolbar-separator {
    width: 1px;
    height: 20px;
    background: var(--border-glass);
    margin: 0 0.25rem;
}

/* Mentions */
.mention {
    background: var(--glass-accent);
    color: var(--accent-primary);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
}

.mention:hover {
    background: var(--accent-primary);
    color: white;
}

.mentions-suggestions {
    position: fixed;
    background: var(--glass-primary);
    backdrop-filter: var(--blur-strong);
    border: var(--border-glass-strong);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-glass-hover);
    min-width: 200px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 10000;
    animation: slideUp 0.15s ease-out;
}

.mention-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    cursor: pointer;
    transition: var(--transition-fast);
}

.mention-item:hover,
.mention-item.selected {
    background: var(--glass-hover);
}

.mention-avatar {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    flex-shrink: 0;
}

.mention-info {
    flex: 1;
}

.mention-name {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 0.875rem;
}

.mention-status {
    font-size: 0.75rem;
    color: var(--text-tertiary);
}

.mention-status.online { color: var(--accent-success); }
.mention-status.away { color: var(--accent-warning); }
.mention-status.busy { color: var(--accent-error); }

/* Voice Recording UI */
.voice-recording-ui {
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    padding: 1.5rem 2rem;
    border-radius: var(--radius-xl);
    backdrop-filter: var(--blur-strong);
    border: var(--border-glass-strong);
    box-shadow: var(--shadow-glass-hover);
    z-index: 10000;
    animation: slideUp 0.3s ease-out;
}

.voice-recording-content {
    display: flex;
    align-items: center;
    gap: 1.5rem;
}

.voice-animation {
    display: flex;
    align-items: center;
    justify-content: center;
}

.voice-wave {
    display: flex;
    align-items: end;
    gap: 2px;
    height: 24px;
}

.voice-wave span {
    width: 3px;
    background: var(--accent-primary);
    border-radius: 2px;
    animation: voiceWave 1s ease-in-out infinite;
}

.voice-wave span:nth-child(1) { animation-delay: 0s; }
.voice-wave span:nth-child(2) { animation-delay: 0.1s; }
.voice-wave span:nth-child(3) { animation-delay: 0.2s; }
.voice-wave span:nth-child(4) { animation-delay: 0.3s; }
.voice-wave span:nth-child(5) { animation-delay: 0.4s; }

@keyframes voiceWave {
    0%, 100% { height: 4px; }
    50% { height: 24px; }
}

.voice-info {
    text-align: center;
}

.voice-timer {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
}

.voice-hint {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    margin-top: 0.25rem;
}

.voice-actions {
    display: flex;
    gap: 0.75rem;
}

.voice-cancel-btn,
.voice-send-btn {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    transition: var(--transition-fast);
}

.voice-cancel-btn {
    background: var(--glass-secondary);
    color: var(--accent-error);
    border: 1px solid var(--accent-error);
}

.voice-send-btn {
    background: var(--accent-primary);
    color: white;
}

.voice-cancel-btn:hover,
.voice-send-btn:hover {
    transform: scale(1.1);
}

/* Reactions */
.reaction-picker {
    animation: scaleIn 0.15s ease-out;
}

@keyframes scaleIn {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}

.reaction-emoji {
    width: 40px;
    height: 40px;
    border: none;
    background: var(--glass-secondary);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 1.2rem;
    transition: var(--transition-fast);
}

.reaction-emoji:hover {
    background: var(--glass-hover);
    transform: scale(1.1);
}

.quick-reactions {
    position: absolute;
    top: -50px;
    right: 10px;
    display: flex;
    gap: 0.25rem;
    background: var(--glass-primary);
    backdrop-filter: var(--blur-glass);
    border: var(--border-glass);
    border-radius: var(--radius-lg);
    padding: 0.5rem;
    box-shadow: var(--shadow-glass);
    animation: slideUp 0.2s ease-out;
}

.quick-reaction {
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 1rem;
    transition: var(--transition-fast);
}

.quick-reaction:hover {
    background: var(--glass-hover);
    transform: scale(1.1);
}

.quick-reaction-more {
    width: 32px;
    height: 32px;
    border: none;
    background: var(--glass-secondary);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--text-tertiary);
    font-size: 1.2rem;
    transition: var(--transition-fast);
}

.quick-reaction-more:hover {
    background: var(--glass-hover);
    color: var(--text-primary);
}

.message-reactions {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.5rem;
    flex-wrap: wrap;
}

.reaction {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: var(--glass-secondary);
    border: var(--border-glass);
    border-radius: var(--radius-md);
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    cursor: pointer;
    transition: var(--transition-fast);
}

.reaction:hover {
    background: var(--glass-hover);
    transform: scale(1.05);
}

.reaction.own {
    background: var(--glass-accent);
    border-color: var(--accent-primary);
}

@keyframes reactionPop {
    0% { transform: scale(0.8); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
}

/* File Upload */
.upload-progress {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    margin-bottom: 1rem;
    border-radius: var(--radius-lg);
    backdrop-filter: var(--blur-glass);
    border: var(--border-glass);
}

.upload-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
}

.upload-icon {
    font-size: 1.5rem;
}

.upload-details {
    flex: 1;
}

.upload-name {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 0.875rem;
}

.upload-size {
    font-size: 0.75rem;
    color: var(--text-tertiary);
}

.upload-progress-bar {
    width: 100px;
    height: 4px;
    background: var(--glass-secondary);
    border-radius: 2px;
    overflow: hidden;
}

.upload-progress-fill {
    height: 100%;
    background: var(--accent-primary);
    transition: width 0.3s ease;
    border-radius: 2px;
}

.upload-cancel {
    width: 24px;
    height: 24px;
    border: none;
    background: var(--glass-secondary);
    border-radius: 50%;
    color: var(--text-tertiary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    transition: var(--transition-fast);
}

.upload-cancel:hover {
    background: var(--accent-error);
    color: white;
}

/* Drag & Drop */
.drag-over {
    position: relative;
}

.drag-over::after {
    content: 'Drop files here to upload';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(102, 126, 234, 0.1);
    border: 2px dashed var(--accent-primary);
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--accent-primary);
    z-index: 1000;
}

/* Animations */
@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
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

/* Voice Button Recording State */
.input-btn.recording {
    background: var(--accent-error) !important;
    color: white !important;
    animation: recordingPulse 1s ease-in-out infinite;
}

@keyframes recordingPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
}
`;

// Inject CSS
const enhancedChatStyleSheet = document.createElement('style');
enhancedChatStyleSheet.textContent = enhancedChatCSS;
document.head.appendChild(enhancedChatStyleSheet);

// Export for global use
window.EnhancedChatSystem = EnhancedChatSystem;