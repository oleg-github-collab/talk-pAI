/**
 * Advanced Error Handling System for Talk pAI
 * Features: Custom error types, error recovery, user-friendly messages, monitoring
 */

class TalkPAIError extends Error {
    constructor(message, code = 'GENERAL_ERROR', statusCode = 500, context = {}) {
        super(message);
        this.name = 'TalkPAIError';
        this.code = code;
        this.statusCode = statusCode;
        this.context = context;
        this.timestamp = new Date().toISOString();
        this.isOperational = true;

        Error.captureStackTrace(this, TalkPAIError);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            context: this.context,
            timestamp: this.timestamp,
            isOperational: this.isOperational
        };
    }
}

// Specific error types
class ValidationError extends TalkPAIError {
    constructor(message, field = null, value = null) {
        super(message, 'VALIDATION_ERROR', 400, { field, value });
        this.name = 'ValidationError';
    }
}

class AuthenticationError extends TalkPAIError {
    constructor(message = 'Authentication required') {
        super(message, 'AUTH_ERROR', 401);
        this.name = 'AuthenticationError';
    }
}

class AuthorizationError extends TalkPAIError {
    constructor(message = 'Insufficient permissions') {
        super(message, 'AUTHZ_ERROR', 403);
        this.name = 'AuthorizationError';
    }
}

class NotFoundError extends TalkPAIError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 'NOT_FOUND', 404, { resource });
        this.name = 'NotFoundError';
    }
}

class ConflictError extends TalkPAIError {
    constructor(message = 'Resource conflict') {
        super(message, 'CONFLICT', 409);
        this.name = 'ConflictError';
    }
}

class RateLimitError extends TalkPAIError {
    constructor(limit = 100, window = '1 hour') {
        super(`Rate limit exceeded: ${limit} requests per ${window}`, 'RATE_LIMIT', 429, { limit, window });
        this.name = 'RateLimitError';
    }
}

class DatabaseError extends TalkPAIError {
    constructor(message, operation = null, table = null) {
        super(message, 'DATABASE_ERROR', 500, { operation, table });
        this.name = 'DatabaseError';
    }
}

class FileUploadError extends TalkPAIError {
    constructor(message, filename = null, size = null) {
        super(message, 'FILE_UPLOAD_ERROR', 413, { filename, size });
        this.name = 'FileUploadError';
    }
}

class WebSocketError extends TalkPAIError {
    constructor(message, event = null, socketId = null) {
        super(message, 'WEBSOCKET_ERROR', 500, { event, socketId });
        this.name = 'WebSocketError';
    }
}

class ExternalServiceError extends TalkPAIError {
    constructor(service, message, statusCode = 503) {
        super(`${service} service error: ${message}`, 'EXTERNAL_SERVICE_ERROR', statusCode, { service });
        this.name = 'ExternalServiceError';
    }
}

class ErrorHandler {
    constructor(logger) {
        this.logger = logger;
        this.errorStats = {
            total: 0,
            byType: {},
            byCode: {},
            recentErrors: []
        };

        this.userFriendlyMessages = {
            VALIDATION_ERROR: 'The information provided is invalid. Please check and try again.',
            AUTH_ERROR: 'Please log in to continue.',
            AUTHZ_ERROR: 'You don\'t have permission to perform this action.',
            NOT_FOUND: 'The requested item could not be found.',
            CONFLICT: 'This action conflicts with existing data.',
            RATE_LIMIT: 'Too many requests. Please wait a moment and try again.',
            DATABASE_ERROR: 'We\'re experiencing technical difficulties. Please try again later.',
            FILE_UPLOAD_ERROR: 'File upload failed. Please check the file size and type.',
            WEBSOCKET_ERROR: 'Connection issue detected. Reconnecting...',
            EXTERNAL_SERVICE_ERROR: 'External service temporarily unavailable.',
            GENERAL_ERROR: 'An unexpected error occurred. Our team has been notified.'
        };

        this.recoveryStrategies = {
            DATABASE_ERROR: this.retryDatabaseOperation.bind(this),
            EXTERNAL_SERVICE_ERROR: this.retryExternalService.bind(this),
            WEBSOCKET_ERROR: this.reconnectWebSocket.bind(this)
        };
    }

    // Main error handling middleware for Express
    middleware() {
        return (error, req, res, next) => {
            this.handleError(error, req, res);
        };
    }

    handleError(error, req = null, res = null) {
        // Track error statistics
        this.trackError(error);

        // Log the error
        this.logError(error, req);

        // Attempt recovery if possible
        this.attemptRecovery(error);

        // Send response if Express response object provided
        if (res && !res.headersSent) {
            this.sendErrorResponse(error, res);
        }

        // Critical error handling
        if (!error.isOperational) {
            this.handleCriticalError(error);
        }
    }

    trackError(error) {
        this.errorStats.total++;

        // Track by error type
        const errorType = error.name || 'Unknown';
        this.errorStats.byType[errorType] = (this.errorStats.byType[errorType] || 0) + 1;

        // Track by error code
        const errorCode = error.code || 'UNKNOWN';
        this.errorStats.byCode[errorCode] = (this.errorStats.byCode[errorCode] || 0) + 1;

        // Track recent errors (last 100)
        this.errorStats.recentErrors.unshift({
            timestamp: new Date().toISOString(),
            type: errorType,
            code: errorCode,
            message: error.message,
            stack: error.stack
        });

        if (this.errorStats.recentErrors.length > 100) {
            this.errorStats.recentErrors = this.errorStats.recentErrors.slice(0, 100);
        }
    }

    logError(error, req = null) {
        const context = {
            errorId: this.generateErrorId(),
            errorType: error.name,
            errorCode: error.code,
            statusCode: error.statusCode,
            isOperational: error.isOperational,
            stack: error.stack
        };

        if (req) {
            context.request = {
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                userId: req.user?.id,
                sessionId: req.sessionID
            };
        }

        if (error.context) {
            context.errorContext = error.context;
        }

        this.logger.error(error.message, context);
    }

    sendErrorResponse(error, res) {
        const isDevelopment = process.env.NODE_ENV === 'development';

        const response = {
            success: false,
            error: {
                message: this.getUserFriendlyMessage(error),
                code: error.code || 'GENERAL_ERROR',
                timestamp: new Date().toISOString()
            }
        };

        // Include technical details in development
        if (isDevelopment) {
            response.error.technical = {
                originalMessage: error.message,
                stack: error.stack,
                context: error.context
            };
        }

        // Include validation details for validation errors
        if (error instanceof ValidationError) {
            response.error.validation = {
                field: error.context.field,
                value: error.context.value
            };
        }

        res.status(error.statusCode || 500).json(response);
    }

    getUserFriendlyMessage(error) {
        return this.userFriendlyMessages[error.code] ||
               this.userFriendlyMessages.GENERAL_ERROR;
    }

    attemptRecovery(error) {
        const strategy = this.recoveryStrategies[error.code];
        if (strategy) {
            try {
                strategy(error);
            } catch (recoveryError) {
                this.logger.error('Error recovery failed', {
                    originalError: error.message,
                    recoveryError: recoveryError.message
                });
            }
        }
    }

    async retryDatabaseOperation(error) {
        this.logger.info('Attempting database operation recovery', {
            operation: error.context.operation,
            table: error.context.table
        });
        // Implement database retry logic here
    }

    async retryExternalService(error) {
        this.logger.info('Attempting external service recovery', {
            service: error.context.service
        });
        // Implement service retry logic here
    }

    async reconnectWebSocket(error) {
        this.logger.info('Attempting WebSocket reconnection', {
            socketId: error.context.socketId
        });
        // Implement WebSocket reconnection logic here
    }

    handleCriticalError(error) {
        this.logger.error('CRITICAL ERROR DETECTED', {
            error: error.message,
            stack: error.stack,
            pid: process.pid,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        });

        // Notify monitoring services
        this.notifyMonitoring(error);

        // Graceful shutdown for unrecoverable errors
        if (this.shouldShutdown(error)) {
            this.gracefulShutdown();
        }
    }

    shouldShutdown(error) {
        const shutdownTriggers = [
            'EADDRINUSE',
            'ENOTFOUND',
            'MODULE_NOT_FOUND'
        ];

        return shutdownTriggers.some(trigger =>
            error.message.includes(trigger) || error.code === trigger
        );
    }

    async gracefulShutdown() {
        this.logger.error('Initiating graceful shutdown due to critical error');

        try {
            // Close database connections
            // Close server
            // Clean up resources

            process.exit(1);
        } catch (shutdownError) {
            this.logger.error('Error during graceful shutdown', {
                error: shutdownError.message
            });
            process.exit(1);
        }
    }

    notifyMonitoring(error) {
        // Implement monitoring service notifications (Sentry, etc.)
        this.logger.error('Monitoring notification', {
            error: error.message,
            severity: 'critical'
        });
    }

    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Error statistics and monitoring
    getErrorStats() {
        return {
            ...this.errorStats,
            errorRate: this.calculateErrorRate(),
            topErrors: this.getTopErrors(),
            healthScore: this.calculateHealthScore()
        };
    }

    calculateErrorRate() {
        const recentErrors = this.errorStats.recentErrors.filter(error => {
            const errorTime = new Date(error.timestamp);
            const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
            return errorTime > hourAgo;
        });

        return {
            lastHour: recentErrors.length,
            rate: recentErrors.length / 60 // errors per minute
        };
    }

    getTopErrors() {
        return Object.entries(this.errorStats.byCode)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([code, count]) => ({ code, count }));
    }

    calculateHealthScore() {
        const errorRate = this.calculateErrorRate().rate;

        if (errorRate === 0) return 100;
        if (errorRate < 1) return 90;
        if (errorRate < 5) return 70;
        if (errorRate < 10) return 50;
        return 30;
    }

    // Validation helpers
    static validateRequired(value, fieldName) {
        if (value === undefined || value === null || value === '') {
            throw new ValidationError(`${fieldName} is required`, fieldName, value);
        }
        return value;
    }

    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new ValidationError('Invalid email format', 'email', email);
        }
        return email;
    }

    static validateLength(value, fieldName, min, max) {
        if (value.length < min || value.length > max) {
            throw new ValidationError(
                `${fieldName} must be between ${min} and ${max} characters`,
                fieldName,
                value
            );
        }
        return value;
    }

    static validateFileSize(size, maxSize = 5 * 1024 * 1024) {
        if (size > maxSize) {
            throw new FileUploadError(
                `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`,
                null,
                size
            );
        }
        return size;
    }
}

// Export all error types and handler
module.exports = {
    ErrorHandler,
    TalkPAIError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    DatabaseError,
    FileUploadError,
    WebSocketError,
    ExternalServiceError
};