/**
 * TalkPAI Enhanced Error Handler and Logging System
 * Corporate-grade error handling with comprehensive logging
 */

class ErrorHandler {
    constructor() {
        this.errorQueue = [];
        this.maxErrorsStored = 100;
        this.logLevel = 'info'; // debug, info, warn, error
        this.enableConsoleOutput = true;
        this.enableRemoteLogging = false;
        this.remoteEndpoint = null;

        this.init();
    }

    init() {
        this.setupGlobalErrorHandlers();
        this.setupPerformanceMonitoring();
        this.loadStoredErrors();

        console.log('🛡️ Enhanced Error Handler initialized');
    }

    setupGlobalErrorHandlers() {
        // Global JavaScript errors
        window.addEventListener('error', (event) => {
            this.handleGlobalError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                stack: event.error?.stack
            });
        });

        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleGlobalError({
                type: 'promise',
                message: event.reason?.message || 'Unhandled promise rejection',
                reason: event.reason,
                stack: event.reason?.stack
            });
        });

        // Network errors
        this.setupNetworkErrorHandling();
    }

    setupNetworkErrorHandling() {
        // Monkey patch fetch to catch network errors
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            try {
                const response = await originalFetch(...args);

                if (!response.ok) {
                    this.log('warn', 'Network request failed', {
                        url: args[0],
                        status: response.status,
                        statusText: response.statusText
                    });
                }

                return response;
            } catch (error) {
                this.handleError(error, 'Network Request', {
                    url: args[0],
                    method: args[1]?.method || 'GET'
                });
                throw error;
            }
        };
    }

    setupPerformanceMonitoring() {
        // Monitor for performance issues
        if ('PerformanceObserver' in window) {
            const perfObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.duration > 1000) { // Log operations taking > 1 second
                        this.log('warn', 'Performance issue detected', {
                            name: entry.name,
                            duration: entry.duration,
                            type: entry.entryType
                        });
                    }
                }
            });

            try {
                perfObserver.observe({ entryTypes: ['measure', 'navigation'] });
            } catch (error) {
                this.log('warn', 'Performance monitoring not available');
            }
        }
    }

    handleGlobalError(errorInfo) {
        this.log('error', 'Global error caught', errorInfo);

        // Show user-friendly notification for critical errors
        if (this.isCriticalError(errorInfo)) {
            this.showCriticalErrorNotification();
        }
    }

    handleError(error, context = 'Unknown', additionalData = {}) {
        const errorDetails = {
            id: this.generateErrorId(),
            timestamp: new Date().toISOString(),
            context,
            message: error?.message || 'Unknown error',
            stack: error?.stack,
            type: error?.name || 'Error',
            userAgent: navigator.userAgent,
            url: window.location.href,
            userId: this.getCurrentUserId(),
            sessionId: this.getSessionId(),
            additionalData
        };

        this.log('error', `Error in ${context}`, errorDetails);

        // Store error for debugging
        this.storeError(errorDetails);

        // Send to remote logging service if enabled
        if (this.enableRemoteLogging) {
            this.sendToRemoteLogging(errorDetails);
        }

        // Show user notification for certain types of errors
        if (this.shouldShowUserNotification(errorDetails)) {
            this.showUserErrorNotification(errorDetails);
        }

        return errorDetails;
    }

    log(level, message, data = {}) {
        const logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
        const currentLevelValue = logLevels[this.logLevel] || 1;
        const messageLevelValue = logLevels[level] || 1;

        if (messageLevelValue < currentLevelValue) {
            return; // Skip logging if below current log level
        }

        const logEntry = {
            id: this.generateLogId(),
            timestamp: new Date().toISOString(),
            level,
            message,
            data,
            context: this.getLogContext()
        };

        // Console output
        if (this.enableConsoleOutput) {
            this.logToConsole(logEntry);
        }

        // Store log entry
        this.storeLogEntry(logEntry);

        // Send to remote if enabled
        if (this.enableRemoteLogging && level === 'error') {
            this.sendToRemoteLogging(logEntry);
        }
    }

    logToConsole(logEntry) {
        const { level, timestamp, message, data } = logEntry;
        const timeStr = new Date(timestamp).toLocaleTimeString();

        const styles = {
            debug: 'color: #888; font-size: 11px;',
            info: 'color: #2563eb; font-weight: 500;',
            warn: 'color: #f59e0b; font-weight: 500;',
            error: 'color: #dc2626; font-weight: 600;'
        };

        const prefix = level === 'error' ? '🚨' : level === 'warn' ? '⚠️' : 'ℹ️';

        console.group(`%c${prefix} [${timeStr}] ${message}`, styles[level] || '');

        if (Object.keys(data).length > 0) {
            console.log('Data:', data);
        }

        console.groupEnd();
    }

    storeError(errorDetails) {
        this.errorQueue.push(errorDetails);

        // Keep only recent errors
        if (this.errorQueue.length > this.maxErrorsStored) {
            this.errorQueue = this.errorQueue.slice(-this.maxErrorsStored);
        }

        // Store in localStorage for persistence
        try {
            localStorage.setItem('talkpai-errors', JSON.stringify(this.errorQueue));
        } catch (e) {
            console.warn('Could not store errors in localStorage');
        }
    }

    storeLogEntry(logEntry) {
        // Store only error and warn level logs
        if (logEntry.level === 'error' || logEntry.level === 'warn') {
            const logs = this.getStoredLogs();
            logs.push(logEntry);

            // Keep only last 200 log entries
            if (logs.length > 200) {
                logs.splice(0, logs.length - 200);
            }

            try {
                localStorage.setItem('talkpai-logs', JSON.stringify(logs));
            } catch (e) {
                console.warn('Could not store logs in localStorage');
            }
        }
    }

    loadStoredErrors() {
        try {
            const storedErrors = localStorage.getItem('talkpai-errors');
            if (storedErrors) {
                this.errorQueue = JSON.parse(storedErrors);
            }
        } catch (e) {
            console.warn('Could not load stored errors');
        }
    }

    getStoredLogs() {
        try {
            const storedLogs = localStorage.getItem('talkpai-logs');
            return storedLogs ? JSON.parse(storedLogs) : [];
        } catch (e) {
            return [];
        }
    }

    async sendToRemoteLogging(data) {
        if (!this.remoteEndpoint) return;

        try {
            await fetch(this.remoteEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...data,
                    app: 'talkpai-messenger',
                    version: '1.0.0'
                })
            });
        } catch (error) {
            console.warn('Failed to send to remote logging:', error);
        }
    }

    isCriticalError(errorInfo) {
        const criticalPatterns = [
            /network error/i,
            /failed to fetch/i,
            /webrtc/i,
            /media/i,
            /permission/i
        ];

        const message = errorInfo.message || '';
        return criticalPatterns.some(pattern => pattern.test(message));
    }

    shouldShowUserNotification(errorDetails) {
        const userFacingErrors = [
            'Network Request',
            'Call Manager',
            'File Upload',
            'Authentication'
        ];

        return userFacingErrors.includes(errorDetails.context);
    }

    showUserErrorNotification(errorDetails) {
        const userMessages = {
            'Network Request': 'Connection problem. Please check your internet.',
            'Call Manager': 'Call failed. Please try again.',
            'File Upload': 'File upload failed. Please try again.',
            'Authentication': 'Authentication error. Please log in again.'
        };

        const message = userMessages[errorDetails.context] || 'Something went wrong. Please try again.';
        this.showErrorNotification(message);
    }

    showCriticalErrorNotification() {
        this.showErrorNotification('A critical error occurred. Please refresh the page.', true);
    }

    showErrorNotification(message, isCritical = false) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `error-notification ${isCritical ? 'critical' : ''}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${isCritical ? 'linear-gradient(135deg, #DC2626, #B91C1C)' : 'linear-gradient(135deg, #EF4444, #DC2626)'};
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            z-index: 10000;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 10px 40px rgba(239, 68, 68, 0.4);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            max-width: 400px;
            font-weight: 500;
        `;

        if (isCritical) {
            notification.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 20px;">🚨</span>
                    <div>
                        <div style="font-weight: 600; margin-bottom: 4px;">Critical Error</div>
                        <div style="font-size: 14px; opacity: 0.9;">${message}</div>
                    </div>
                </div>
            `;
        } else {
            notification.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 18px;">⚠️</span>
                    <div style="font-size: 14px;">${message}</div>
                </div>
            `;
        }

        document.body.appendChild(notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        });

        // Auto remove
        const duration = isCritical ? 10000 : 5000;
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    // Utility methods
    generateErrorId() {
        return 'err_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateLogId() {
        return 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getCurrentUserId() {
        // In a real app, get from authentication system
        return localStorage.getItem('talkpai-user-id') || 'anonymous';
    }

    getSessionId() {
        // Generate or retrieve session ID
        let sessionId = sessionStorage.getItem('talkpai-session-id');
        if (!sessionId) {
            sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('talkpai-session-id', sessionId);
        }
        return sessionId;
    }

    getLogContext() {
        return {
            url: window.location.href,
            timestamp: Date.now(),
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            userAgent: navigator.userAgent
        };
    }

    // Public API methods
    getErrorReport() {
        return {
            errors: this.errorQueue,
            logs: this.getStoredLogs(),
            system: {
                userAgent: navigator.userAgent,
                url: window.location.href,
                timestamp: new Date().toISOString(),
                sessionId: this.getSessionId()
            }
        };
    }

    clearErrors() {
        this.errorQueue = [];
        localStorage.removeItem('talkpai-errors');
        localStorage.removeItem('talkpai-logs');
        this.log('info', 'Error logs cleared');
    }

    setLogLevel(level) {
        const validLevels = ['debug', 'info', 'warn', 'error'];
        if (validLevels.includes(level)) {
            this.logLevel = level;
            this.log('info', `Log level set to ${level}`);
        }
    }

    enableRemoteLogging(endpoint) {
        this.enableRemoteLogging = true;
        this.remoteEndpoint = endpoint;
        this.log('info', 'Remote logging enabled');
    }

    disableRemoteLogging() {
        this.enableRemoteLogging = false;
        this.remoteEndpoint = null;
        this.log('info', 'Remote logging disabled');
    }
}

// Global error handler instance
let globalErrorHandler = null;

// Initialize function
function initializeErrorHandler() {
    if (!globalErrorHandler) {
        globalErrorHandler = new ErrorHandler();
    }
    return globalErrorHandler;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ErrorHandler, initializeErrorHandler };
}

// Global access
window.ErrorHandler = ErrorHandler;
window.initializeErrorHandler = initializeErrorHandler;