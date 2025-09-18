const fs = require('fs');
const path = require('path');

/**
 * Advanced Logger System for Talk pAI
 * Features: Multiple log levels, file rotation, structured logging, performance monitoring
 */
class AdvancedLogger {
    constructor(options = {}) {
        this.appName = options.appName || 'TalkPAI';
        this.logLevel = options.logLevel || 'info';
        this.enableConsole = options.enableConsole !== false;
        this.enableFile = options.enableFile !== false;
        this.logDir = options.logDir || path.join(process.cwd(), 'logs');
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.maxFiles = options.maxFiles || 5;

        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };

        this.colors = {
            error: '\x1b[31m', // Red
            warn: '\x1b[33m',  // Yellow
            info: '\x1b[36m',  // Cyan
            debug: '\x1b[35m', // Magenta
            trace: '\x1b[37m', // White
            reset: '\x1b[0m'
        };

        this.metrics = {
            requests: 0,
            errors: 0,
            warnings: 0,
            startTime: Date.now(),
            memoryUsage: [],
            responseTimeHistory: []
        };

        this.initializeLogger();
        this.startMetricsCollection();
    }

    initializeLogger() {
        if (this.enableFile) {
            this.ensureLogDirectory();
        }
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    getCurrentLogFile() {
        const date = new Date().toISOString().split('T')[0];
        return path.join(this.logDir, `talk-pai-${date}.log`);
    }

    getErrorLogFile() {
        const date = new Date().toISOString().split('T')[0];
        return path.join(this.logDir, `talk-pai-errors-${date}.log`);
    }

    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    formatMessage(level, message, context = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            app: this.appName,
            message,
            ...context,
            pid: process.pid,
            memory: this.getMemoryUsage(),
            uptime: this.getUptime()
        };

        return {
            structured: JSON.stringify(logEntry),
            readable: `[${timestamp}] ${level.toUpperCase()} [${this.appName}:${process.pid}] ${message}${
                Object.keys(context).length > 0 ? ' ' + JSON.stringify(context) : ''
            }`
        };
    }

    writeToFile(content, isError = false) {
        if (!this.enableFile) return;

        try {
            const logFile = isError ? this.getErrorLogFile() : this.getCurrentLogFile();

            // Check file size and rotate if necessary
            if (fs.existsSync(logFile)) {
                const stats = fs.statSync(logFile);
                if (stats.size > this.maxFileSize) {
                    this.rotateLogFile(logFile);
                }
            }

            fs.appendFileSync(logFile, content + '\n');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    rotateLogFile(logFile) {
        try {
            const base = logFile.replace('.log', '');
            const timestamp = Date.now();
            const rotatedFile = `${base}.${timestamp}.log`;

            fs.renameSync(logFile, rotatedFile);

            // Clean up old log files
            this.cleanupOldLogs();
        } catch (error) {
            console.error('Failed to rotate log file:', error);
        }
    }

    cleanupOldLogs() {
        try {
            const files = fs.readdirSync(this.logDir)
                .filter(file => file.startsWith('talk-pai-') && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.logDir, file),
                    time: fs.statSync(path.join(this.logDir, file)).mtime
                }))
                .sort((a, b) => b.time - a.time);

            if (files.length > this.maxFiles) {
                files.slice(this.maxFiles).forEach(file => {
                    fs.unlinkSync(file.path);
                });
            }
        } catch (error) {
            console.error('Failed to cleanup old logs:', error);
        }
    }

    log(level, message, context = {}) {
        if (!this.shouldLog(level)) return;

        const formatted = this.formatMessage(level, message, context);

        // Console output
        if (this.enableConsole) {
            const color = this.colors[level] || this.colors.reset;
            console.log(`${color}${formatted.readable}${this.colors.reset}`);
        }

        // File output
        this.writeToFile(formatted.structured, level === 'error');

        // Update metrics
        this.updateMetrics(level);
    }

    error(message, context = {}) {
        this.log('error', message, context);
        this.metrics.errors++;
    }

    warn(message, context = {}) {
        this.log('warn', message, context);
        this.metrics.warnings++;
    }

    info(message, context = {}) {
        this.log('info', message, context);
    }

    debug(message, context = {}) {
        this.log('debug', message, context);
    }

    trace(message, context = {}) {
        this.log('trace', message, context);
    }

    // Performance monitoring
    time(label) {
        if (!this.timers) this.timers = new Map();
        this.timers.set(label, Date.now());
    }

    timeEnd(label) {
        if (!this.timers || !this.timers.has(label)) return;

        const duration = Date.now() - this.timers.get(label);
        this.timers.delete(label);

        this.debug(`Timer "${label}" completed`, { duration: `${duration}ms` });
        return duration;
    }

    // HTTP Request logging middleware
    createRequestLogger() {
        return (req, res, next) => {
            const start = Date.now();
            const originalSend = res.send;

            this.metrics.requests++;

            res.send = function(data) {
                const duration = Date.now() - start;

                // Track response time
                this.metrics.responseTimeHistory.push(duration);
                if (this.metrics.responseTimeHistory.length > 1000) {
                    this.metrics.responseTimeHistory = this.metrics.responseTimeHistory.slice(-1000);
                }

                const logData = {
                    method: req.method,
                    url: req.url,
                    status: res.statusCode,
                    duration: `${duration}ms`,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip || req.connection.remoteAddress,
                    requestId: req.id || 'unknown'
                };

                if (res.statusCode >= 400) {
                    this.error('HTTP Request Error', logData);
                } else if (res.statusCode >= 300) {
                    this.warn('HTTP Request Redirect', logData);
                } else {
                    this.info('HTTP Request', logData);
                }

                return originalSend.call(res, data);
            }.bind(this);

            next();
        };
    }

    // WebSocket event logging
    logSocketEvent(event, data = {}) {
        this.debug(`Socket Event: ${event}`, {
            event,
            socketId: data.socketId,
            userId: data.userId,
            room: data.room,
            timestamp: new Date().toISOString()
        });
    }

    // Database operation logging
    logDatabaseOperation(operation, table, data = {}) {
        this.debug(`Database Operation: ${operation}`, {
            operation,
            table,
            recordId: data.id,
            userId: data.userId,
            timestamp: new Date().toISOString()
        });
    }

    // Security event logging
    logSecurityEvent(event, details = {}) {
        this.warn(`Security Event: ${event}`, {
            event,
            ip: details.ip,
            userAgent: details.userAgent,
            userId: details.userId,
            severity: details.severity || 'medium',
            timestamp: new Date().toISOString()
        });
    }

    // Error tracking and aggregation
    trackError(error, context = {}) {
        const errorId = this.generateErrorId();
        const errorData = {
            errorId,
            name: error.name,
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString(),
            count: 1
        };

        this.error('Application Error', errorData);
        return errorId;
    }

    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // System metrics collection
    startMetricsCollection() {
        setInterval(() => {
            this.collectMetrics();
        }, 60000); // Every minute
    }

    collectMetrics() {
        const memUsage = this.getMemoryUsage();
        this.metrics.memoryUsage.push({
            timestamp: Date.now(),
            ...memUsage
        });

        // Keep only last 100 entries
        if (this.metrics.memoryUsage.length > 100) {
            this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
        }

        this.debug('System Metrics', {
            memory: memUsage,
            uptime: this.getUptime(),
            requests: this.metrics.requests,
            errors: this.metrics.errors,
            warnings: this.metrics.warnings,
            avgResponseTime: this.getAverageResponseTime()
        });
    }

    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
            external: Math.round(usage.external / 1024 / 1024 * 100) / 100
        };
    }

    getUptime() {
        const uptime = Date.now() - this.metrics.startTime;
        const hours = Math.floor(uptime / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
        return `${hours}h ${minutes}m ${seconds}s`;
    }

    getAverageResponseTime() {
        if (this.metrics.responseTimeHistory.length === 0) return 0;
        const sum = this.metrics.responseTimeHistory.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.metrics.responseTimeHistory.length * 100) / 100;
    }

    updateMetrics(level) {
        // Additional metrics updates can be added here
    }

    // Health check endpoint data
    getHealthMetrics() {
        return {
            status: 'healthy',
            uptime: this.getUptime(),
            memory: this.getMemoryUsage(),
            requests: this.metrics.requests,
            errors: this.metrics.errors,
            warnings: this.metrics.warnings,
            avgResponseTime: this.getAverageResponseTime(),
            timestamp: new Date().toISOString()
        };
    }

    // Configuration methods
    setLogLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.logLevel = level;
            this.info(`Log level changed to: ${level}`);
        }
    }

    enableFileLogging() {
        this.enableFile = true;
        this.ensureLogDirectory();
        this.info('File logging enabled');
    }

    disableFileLogging() {
        this.enableFile = false;
        this.info('File logging disabled');
    }
}

module.exports = AdvancedLogger;