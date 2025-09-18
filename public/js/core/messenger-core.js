/**
 * TalkPAI Messenger Core Module
 * Central messenger management and initialization
 */

class TalkPAIMessenger {
    constructor() {
        this.currentTheme = localStorage.getItem('talkpai-theme') || 'light';
        this.sidebarCollapsed = localStorage.getItem('talkpai-sidebar-collapsed') === 'true';
        this.chatListOpen = false;
        this.currentChat = '1';
        this.isTyping = false;
        this.messages = [];

        // Call state
        this.callState = 'idle'; // idle, calling, connected, incoming
        this.callType = null; // voice, video
        this.callTimer = null;
        this.callStartTime = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isMuted = false;
        this.isVideoOn = true;
        this.isSpeakerOn = false;
        this.isScreenSharing = false;

        // Drag and drop state
        this.dragCounter = 0;
        this.selectedFiles = [];
        this.isDragActive = false;

        this.init();
    }

    init() {
        this.setupTheme();
        this.setupSidebar();
        this.setupDragAndDrop();
        this.bindEvents();
        this.autoResize();
        this.loadDemoData();

        // Initialize external components
        if (window.themeCustomizer) {
            window.themeCustomizer.onThemeChange = (theme) => {
                this.applyTheme(theme);
            };
        }

        console.log('🚀 Talk pAI Messenger initialized with award-winning design!');
    }

    setupTheme() {
        document.body.setAttribute('data-theme', this.currentTheme);
    }

    setupSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (this.sidebarCollapsed) {
            sidebar.classList.add('collapsed');
        }
    }

    // Core toggle methods
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        this.sidebarCollapsed = !this.sidebarCollapsed;
        localStorage.setItem('talkpai-sidebar-collapsed', this.sidebarCollapsed);

        // Add smooth animation with magnetic effect
        this.addMagneticEffect();
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('talkpai-theme', this.currentTheme);

        // Add divine theme morphing animation
        this.triggerThemeMorph();
    }

    // Error handling and logging
    handleError(error, context = 'Unknown') {
        console.error(`[TalkPAI ${context}]`, error);

        // Enhanced error logging for debugging
        const errorDetails = {
            timestamp: new Date().toISOString(),
            context,
            message: error.message || 'Unknown error',
            stack: error.stack,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Store error for debugging (in production, send to logging service)
        const errors = JSON.parse(localStorage.getItem('talkpai-errors') || '[]');
        errors.push(errorDetails);

        // Keep only last 50 errors to prevent storage overflow
        if (errors.length > 50) {
            errors.splice(0, errors.length - 50);
        }

        localStorage.setItem('talkpai-errors', JSON.stringify(errors));

        // Show user-friendly error notification
        this.showErrorNotification('An error occurred. Please try again.');
    }

    showErrorNotification(message) {
        // Create temporary error notification
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #EF4444, #DC2626);
            color: white;
            padding: 12px 24px;
            border-radius: 12px;
            z-index: 10000;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 10px 40px rgba(239, 68, 68, 0.3);
            backdrop-filter: blur(20px);
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        });

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 5000);
    }

    // Enhanced performance logging
    logPerformance(operation, startTime) {
        const duration = performance.now() - startTime;
        console.log(`[TalkPAI Performance] ${operation}: ${duration.toFixed(2)}ms`);

        if (duration > 100) {
            console.warn(`[TalkPAI Performance Warning] ${operation} took ${duration.toFixed(2)}ms`);
        }
    }

    // Animation effects
    addMagneticEffect() {
        const sidebar = document.getElementById('sidebar');
        sidebar.style.transform = 'scale(0.98)';

        setTimeout(() => {
            sidebar.style.transform = 'scale(1)';
        }, 150);
    }

    triggerThemeMorph() {
        // Add divine particle effect during theme change
        const particles = [];
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: fixed;
                width: 4px;
                height: 4px;
                background: var(--accent-primary);
                border-radius: 50%;
                pointer-events: none;
                z-index: 9999;
                opacity: 0.8;
                transition: all 2s cubic-bezier(0.4, 0, 0.2, 1);
            `;

            const startX = Math.random() * window.innerWidth;
            const startY = Math.random() * window.innerHeight;

            particle.style.left = startX + 'px';
            particle.style.top = startY + 'px';

            document.body.appendChild(particle);
            particles.push(particle);

            // Animate particles
            setTimeout(() => {
                particle.style.transform = `translate(${(Math.random() - 0.5) * 200}px, ${(Math.random() - 0.5) * 200}px) scale(0)`;
                particle.style.opacity = '0';
            }, 50);
        }

        // Cleanup particles
        setTimeout(() => {
            particles.forEach(particle => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            });
        }, 2000);
    }

    // Auto resize functionality
    autoResize() {
        this.autoResizeTextarea(document.getElementById('messageInput'));
    }

    autoResizeTextarea(textarea) {
        if (!textarea) return;

        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    // Performance logging method expected by UI Events
    logPerformance(operation, startTime) {
        const duration = performance.now() - startTime;
        console.log(`[TalkPAI Performance] ${operation}: ${duration.toFixed(2)}ms`);

        if (duration > 100) {
            console.warn(`[TalkPAI Performance Warning] ${operation} took ${duration.toFixed(2)}ms`);
        }
    }

    // Error handling method expected by UI Events
    handleError(error, context = 'Unknown') {
        console.error(`[TalkPAI ${context}]`, error);

        // Enhanced error logging for debugging
        const errorDetails = {
            timestamp: new Date().toISOString(),
            context,
            message: error.message || 'Unknown error',
            stack: error.stack,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Store error for debugging (in production, send to logging service)
        const errors = JSON.parse(localStorage.getItem('talkpai-errors') || '[]');
        errors.push(errorDetails);

        // Keep only last 50 errors to prevent storage overflow
        if (errors.length > 50) {
            errors.splice(0, errors.length - 50);
        }

        localStorage.setItem('talkpai-errors', JSON.stringify(errors));

        // Show user-friendly error notification
        this.showErrorNotification('An error occurred. Please try again.');
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TalkPAIMessenger;
}

// Global access
window.TalkPAIMessenger = TalkPAIMessenger;