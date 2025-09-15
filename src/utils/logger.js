const database = require('../database/connection');

class ActivityLogger {
  constructor() {
    this.useDatabase = false;
    this.initializeLogger();
  }

  async initializeLogger() {
    this.useDatabase = database.isConnected;
  }

  async logActivity(data) {
    const {
      userId,
      action,
      resourceType = null,
      resourceId = null,
      metadata = {},
      ipAddress = null,
      userAgent = null,
      workspaceId = null,
      req = null
    } = data;

    try {
      // Extract IP and User Agent from request if provided
      const clientIp = ipAddress || (req ? this.extractIpAddress(req) : null);
      const clientUserAgent = userAgent || (req ? req.get('User-Agent') : null);

      // Enhanced metadata with timestamp and session info
      const enhancedMetadata = {
        ...metadata,
        timestamp: new Date().toISOString(),
        sessionId: req?.sessionID || null,
        source: 'application'
      };

      // Console logging for development
      console.log(`📊 [${action}] User ${userId} - ${resourceType}:${resourceId}`, {
        workspace: workspaceId,
        ip: clientIp,
        metadata: enhancedMetadata
      });

      // Database logging
      if (this.useDatabase) {
        await database.query(`
          INSERT INTO activity_logs (
            user_id, action, resource_type, resource_id,
            metadata, ip_address, user_agent, workspace_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          userId,
          action,
          resourceType,
          resourceId,
          JSON.stringify(enhancedMetadata),
          clientIp,
          clientUserAgent,
          workspaceId
        ]);
      }
    } catch (error) {
      console.error('❌ Activity logging failed:', error);
      // Don't throw error to avoid breaking main functionality
    }
  }

  extractIpAddress(req) {
    return req.ip ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           'unknown';
  }

  // Predefined action helpers
  async logUserAction(userId, action, metadata = {}, req = null) {
    return this.logActivity({
      userId,
      action: `user.${action}`,
      resourceType: 'user',
      resourceId: userId,
      metadata,
      req
    });
  }

  async logChatAction(userId, chatId, action, metadata = {}, req = null) {
    return this.logActivity({
      userId,
      action: `chat.${action}`,
      resourceType: 'chat',
      resourceId: chatId,
      metadata,
      req
    });
  }

  async logWorkspaceAction(userId, workspaceId, action, metadata = {}, req = null) {
    return this.logActivity({
      userId,
      action: `workspace.${action}`,
      resourceType: 'workspace',
      resourceId: workspaceId,
      workspaceId,
      metadata,
      req
    });
  }

  async logAIAction(userId, action, metadata = {}, req = null) {
    return this.logActivity({
      userId,
      action: `ai.${action}`,
      resourceType: 'ai',
      metadata,
      req
    });
  }

  async logSecurityEvent(userId, action, metadata = {}, req = null) {
    const enhancedMetadata = {
      ...metadata,
      severity: 'high',
      category: 'security'
    };

    return this.logActivity({
      userId,
      action: `security.${action}`,
      metadata: enhancedMetadata,
      req
    });
  }

  async getActivityLogs(filters = {}) {
    if (!this.useDatabase) {
      return [];
    }

    try {
      const {
        userId = null,
        workspaceId = null,
        action = null,
        resourceType = null,
        startDate = null,
        endDate = null,
        limit = 100,
        offset = 0
      } = filters;

      let query = `
        SELECT
          al.*,
          u.nickname,
          u.full_name,
          w.name as workspace_name
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN workspaces w ON al.workspace_id = w.id
        WHERE 1=1
      `;

      const params = [];
      let paramCount = 0;

      if (userId) {
        query += ` AND al.user_id = $${++paramCount}`;
        params.push(userId);
      }

      if (workspaceId) {
        query += ` AND al.workspace_id = $${++paramCount}`;
        params.push(workspaceId);
      }

      if (action) {
        query += ` AND al.action ILIKE $${++paramCount}`;
        params.push(`%${action}%`);
      }

      if (resourceType) {
        query += ` AND al.resource_type = $${++paramCount}`;
        params.push(resourceType);
      }

      if (startDate) {
        query += ` AND al.created_at >= $${++paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND al.created_at <= $${++paramCount}`;
        params.push(endDate);
      }

      query += ` ORDER BY al.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(limit, offset);

      const result = await database.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      return [];
    }
  }

  async getActivityStats(workspaceId = null, timeframe = '24h') {
    if (!this.useDatabase) {
      return {};
    }

    try {
      const timeCondition = this.getTimeCondition(timeframe);

      let query = `
        SELECT
          action,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users
        FROM activity_logs
        WHERE created_at >= $1
      `;

      const params = [timeCondition];

      if (workspaceId) {
        query += ` AND workspace_id = $2`;
        params.push(workspaceId);
      }

      query += ` GROUP BY action ORDER BY count DESC`;

      const result = await database.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching activity stats:', error);
      return {};
    }
  }

  getTimeCondition(timeframe) {
    const now = new Date();
    switch (timeframe) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }
}

module.exports = new ActivityLogger();