class Logger {
  constructor(module = 'App') {
    this.module = module;
    this.isDev = process.env.NODE_ENV !== 'production';
    this.logLevel = this._getLogLevel();
  }

  _getLogLevel() {
    const level = process.env.LOG_LEVEL || (this.isDev ? 'debug' : 'info');
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    return levels[level.toLowerCase()] || 2;
  }

  _shouldLog(level) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    return levels[level] <= this.logLevel;
  }

  log(level, message, data = {}) {
    if (!this._shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      module: this.module,
      level,
      message,
      pid: process.pid,
      ...data
    };

    // Add stack trace for errors
    if (level === 'error' && data.error instanceof Error) {
      logEntry.stack = data.error.stack;
    }

    // Performance monitoring
    if (data.startTime) {
      logEntry.duration = Date.now() - data.startTime;
    }

    if (this.isDev) {
      const colors = {
        error: '\x1b[31m', // red
        warn: '\x1b[33m',  // yellow
        info: '\x1b[36m',  // cyan
        debug: '\x1b[90m'  // gray
      };
      const reset = '\x1b[0m';
      const color = colors[level] || '';

      console.log(`${color}[${timestamp}] [${this.module}] ${level.toUpperCase()}: ${message}${reset}`);
      if (Object.keys(data).length > 0) {
        console.log(`${color}Data:${reset}`, data);
      }
    } else {
      // Structured logging for production
      console.log(JSON.stringify(logEntry));
    }
  }

  info(message, data = {}) {
    this.log('info', message, data);
  }

  warn(message, data = {}) {
    this.log('warn', message, data);
  }

  error(message, data = {}) {
    this.log('error', message, data);
  }

  debug(message, data = {}) {
    this.log('debug', message, data);
  }

  // Performance logging
  time(label) {
    return { startTime: Date.now(), label };
  }

  timeEnd(timer, message = 'Operation completed') {
    const duration = Date.now() - timer.startTime;
    this.info(message, {
      operation: timer.label,
      duration: `${duration}ms`
    });
    return duration;
  }

  // Request logging middleware
  static createRequestLogger() {
    const logger = new Logger('HTTP');
    return (req, res, next) => {
      const start = Date.now();
      const originalSend = res.send;

      res.send = function(body) {
        const duration = Date.now() - start;
        logger.info('HTTP Request', {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          duration: `${duration}ms`,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
        return originalSend.call(this, body);
      };

      next();
    };
  }

  // Database query logging
  logQuery(query, params, duration) {
    this.debug('Database Query', {
      query: query.replace(/\s+/g, ' ').trim(),
      params: params ? params.length : 0,
      duration: `${duration}ms`
    });
  }

  // Security event logging
  security(event, data = {}) {
    this.log('warn', `SECURITY: ${event}`, {
      ...data,
      security: true,
      alert: true
    });
  }
}

module.exports = Logger;