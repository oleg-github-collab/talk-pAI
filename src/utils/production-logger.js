/**
 * Production-Grade Logger for Talk pAI
 * Enhanced logging system with multiple levels, file rotation, and monitoring
 */

const fs = require('fs').promises;
const path = require('path');

class ProductionLogger {
    constructor(options = {}) {
        this.appName = options.appName || 'TalkPAI';
        this.logLevel = this.parseLogLevel(options.logLevel || 'info');
        this.enableConsole = options.enableConsole !== false;
        this.enableFile = options.enableFile !== false;
        this.logDir = options.logDir || 'logs';
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.maxFiles = options.maxFiles || 5;
        this.dateFormat = options.dateFormat || 'YYYY-MM-DD HH:mm:ss';

        // Initialize the logger - simplified for immediate use
        this.isReady = false;
        this.initializeLogger().catch(err => {
            console.warn('Logger initialization failed, using console fallback:', err.message);
            this.enableFile = false;
            this.isReady = true;
        });

        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            verbose: 4
        };

        this.colors = {
            error: '\x1b[31m',   // Red
            warn: '\x1b[33m',    // Yellow
            info: '\x1b[36m',    // Cyan
            debug: '\x1b[35m',   // Magenta
            verbose: '\x1b[37m', // White
            reset: '\x1b[0m'
        };

        this.logStats = {
            totalLogs: 0,
            errorCount: 0,
            warnCount: 0,
            infoCount: 0,
            debugCount: 0,
            verboseCount: 0,
            startTime: Date.now()
        };

        this.initializeLogger();
    }

    parseLogLevel(level) {
        if (typeof level === 'string') {
            return this.levels[level.toLowerCase()] ?? this.levels.info;
        }
        return level;
    }

    async initializeLogger() {
        if (this.enableFile) {
            try {
                await fs.mkdir(this.logDir, { recursive: true });
                await this.cleanupOldLogs();
            } catch (error) {
                console.error('Failed to initialize logger:', error.message);
                this.enableFile = false;
            }
        }
    }

    formatTimestamp() {
        const now = new Date();
        return now.toISOString().replace('T', ' ').substring(0, 19);
    }

    formatMessage(level, message, meta = null) {
        const timestamp = this.formatTimestamp();
        const pid = process.pid;
        const upperLevel = level.toUpperCase().padEnd(7);

        let logEntry = `[${timestamp}] [${pid}] [${upperLevel}] [${this.appName}] ${message}`;

        if (meta) {
            if (typeof meta === 'object') {
                try {
                    logEntry += ' ' + JSON.stringify(meta, null, 2);
                } catch (error) {
                    logEntry += ' [Object: Unable to stringify]';
                }
            } else {
                logEntry += ' ' + String(meta);
            }
        }

        return logEntry;
    }

    shouldLog(level) {
        return this.levels[level] <= this.logLevel;
    }

    async writeToFile(level, formattedMessage) {
        if (!this.enableFile) return;

        try {
            const logFile = path.join(this.logDir, `${this.appName.toLowerCase()}.log`);
            const errorLogFile = path.join(this.logDir, `${this.appName.toLowerCase()}-error.log`);

            // Write to main log
            await fs.appendFile(logFile, formattedMessage + '\n');

            // Write errors to separate error log
            if (level === 'error') {
                await fs.appendFile(errorLogFile, formattedMessage + '\n');
            }

            // Check file size and rotate if necessary
            await this.rotateLogsIfNeeded();

        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }
    }

    async rotateLogsIfNeeded() {
        try {
            const logFile = path.join(this.logDir, `${this.appName.toLowerCase()}.log`);
            const stats = await fs.stat(logFile);

            if (stats.size > this.maxFileSize) {
                await this.rotateLogs();
            }
        } catch (error) {
            // File doesn't exist or other error, ignore
        }
    }

    async rotateLogs() {
        try {
            const baseLogFile = `${this.appName.toLowerCase()}.log`;
            const baseErrorLogFile = `${this.appName.toLowerCase()}-error.log`;

            // Rotate main log files
            for (let i = this.maxFiles - 1; i > 0; i--) {
                const oldFile = path.join(this.logDir, `${baseLogFile}.${i}`);
                const newFile = path.join(this.logDir, `${baseLogFile}.${i + 1}`);

                try {
                    await fs.rename(oldFile, newFile);
                } catch (error) {
                    // File doesn't exist, continue
                }
            }

            // Move current log to .1
            const currentLog = path.join(this.logDir, baseLogFile);
            const rotatedLog = path.join(this.logDir, `${baseLogFile}.1`);

            try {
                await fs.rename(currentLog, rotatedLog);
            } catch (error) {
                // File doesn't exist, continue
            }

            // Rotate error log files
            for (let i = this.maxFiles - 1; i > 0; i--) {
                const oldFile = path.join(this.logDir, `${baseErrorLogFile}.${i}`);
                const newFile = path.join(this.logDir, `${baseErrorLogFile}.${i + 1}`);

                try {
                    await fs.rename(oldFile, newFile);
                } catch (error) {
                    // File doesn't exist, continue
                }
            }

            // Move current error log to .1
            const currentErrorLog = path.join(this.logDir, baseErrorLogFile);
            const rotatedErrorLog = path.join(this.logDir, `${baseErrorLogFile}.1`);

            try {
                await fs.rename(currentErrorLog, rotatedErrorLog);
            } catch (error) {
                // File doesn't exist, continue
            }

            // Clean up old files beyond maxFiles
            await this.cleanupOldLogs();

        } catch (error) {
            console.error('Failed to rotate logs:', error.message);
        }
    }

    async cleanupOldLogs() {
        try {
            const files = await fs.readdir(this.logDir);
            const logFiles = files.filter(file =>
                file.startsWith(this.appName.toLowerCase()) &&
                /\.\d+$/.test(file)
            );

            for (const file of logFiles) {
                const match = file.match(/\.(\d+)$/);
                if (match && parseInt(match[1]) > this.maxFiles) {
                    await fs.unlink(path.join(this.logDir, file));
                }
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    }

    log(level, message, meta = null) {
        if (!this.shouldLog(level)) return;

        this.logStats.totalLogs++;
        this.logStats[level + 'Count']++;

        const formattedMessage = this.formatMessage(level, message, meta);

        // Console output with colors
        if (this.enableConsole) {
            const color = this.colors[level] || this.colors.reset;
            console.log(`${color}${formattedMessage}${this.colors.reset}`);
        }

        // File output (async, don't block)
        this.writeToFile(level, formattedMessage).catch(() => {
            // Ignore file write errors
        });
    }

    error(message, meta = null) {
        this.log('error', message, meta);
    }

    warn(message, meta = null) {
        this.log('warn', message, meta);
    }

    info(message, meta = null) {
        this.log('info', message, meta);
    }

    debug(message, meta = null) {
        this.log('debug', message, meta);
    }

    verbose(message, meta = null) {
        this.log('verbose', message, meta);
    }

    // Request logging middleware
    createRequestLogger() {
        return (req, res, next) => {
            const start = Date.now();
            const originalSend = res.send;

            // Track response
            res.send = function(data) {
                res.send = originalSend;
                const duration = Date.now() - start;

                // Log the request
                const logData = {
                    method: req.method,
                    url: req.originalUrl || req.url,
                    status: res.statusCode,
                    duration: `${duration}ms`,
                    ip: req.ip || req.connection.remoteAddress,
                    userAgent: req.get('User-Agent'),
                    contentLength: res.get('Content-Length') || 0
                };

                const level = res.statusCode >= 500 ? 'error' :
                            res.statusCode >= 400 ? 'warn' : 'info';

                this.log(level, `${req.method} ${req.originalUrl || req.url}`, logData);

                return originalSend.call(this, data);
            }.bind(this);

            next();
        };
    }

    // Performance monitoring
    startTimer(label) {
        const start = process.hrtime.bigint();
        return {
            end: () => {
                const end = process.hrtime.bigint();
                const duration = Number(end - start) / 1000000; // Convert to milliseconds
                this.debug(`Timer [${label}]: ${duration.toFixed(2)}ms`);
                return duration;
            }
        };
    }

    // Memory usage logging
    logMemoryUsage() {
        const memUsage = process.memoryUsage();
        const memInfo = {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
        };

        this.info('Memory Usage', memInfo);
        return memInfo;
    }

    // Get logger statistics
    getStats() {
        const runtime = Date.now() - this.logStats.startTime;
        return {
            ...this.logStats,
            runtime: `${Math.round(runtime / 1000)}s`,
            averageLogsPerSecond: Math.round(this.logStats.totalLogs / (runtime / 1000))
        };
    }

    // Set log level dynamically
    setLogLevel(level) {
        this.logLevel = this.parseLogLevel(level);
        this.info(`Log level changed to: ${level}`);
    }

    // Flush all pending writes
    async flush() {
        // This is a no-op since we write asynchronously
        // In a more complex implementation, you might maintain a write queue
        this.debug('Logger flush requested');
    }

    // Create child logger with context
    child(context) {
        return {
            error: (message, meta) => this.error(message, { ...context, ...meta }),
            warn: (message, meta) => this.warn(message, { ...context, ...meta }),
            info: (message, meta) => this.info(message, { ...context, ...meta }),
            debug: (message, meta) => this.debug(message, { ...context, ...meta }),
            verbose: (message, meta) => this.verbose(message, { ...context, ...meta })
        };
    }
}

// Fallback logger for when the full logger fails
class FallbackLogger {
    constructor(name = 'Fallback') {
        this.name = name;
    }

    static createRequestLogger() {
        return (req, res, next) => {
            console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
            next();
        };
    }

    log(level, message, meta) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${this.name}] ${message}`;

        if (level === 'error') {
            console.error(logMessage, meta || '');
        } else {
            console.log(logMessage, meta || '');
        }
    }

    error(message, meta) { this.log('error', message, meta); }
    warn(message, meta) { this.log('warn', message, meta); }
    info(message, meta) { this.log('info', message, meta); }
    debug(message, meta) { this.log('debug', message, meta); }
    verbose(message, meta) { this.log('verbose', message, meta); }

    createRequestLogger() {
        return FallbackLogger.createRequestLogger();
    }

    child(context) {
        return this;
    }

    getStats() {
        return { type: 'fallback', message: 'Using basic console logging' };
    }
}

module.exports = { ProductionLogger, FallbackLogger };