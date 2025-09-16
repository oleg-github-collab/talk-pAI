const database = require('../database/connection');
const Logger = require('../utils/logger');

class SearchService {
  constructor() {
    this.useDatabase = database.isConnected;
    this.logger = new Logger('SearchService');
  }

  /**
   * Search users with intelligent ranking and filtering
   * @param {string} query - Search query
   * @param {number} userId - Current user ID (to exclude from results)
   * @param {Object} options - Search options
   * @returns {Array} Sorted array of user results
   */
  async searchUsers(query, userId = null, options = {}) {
    const {
      limit = 10,
      includeInactive = false,
      workspaceId = null,
      organizationId = null
    } = options;

    if (!this.useDatabase) {
      return this._getMockUsers(query, userId, limit);
    }

    try {
      // Build dynamic query based on context
      let baseQuery = `
        SELECT DISTINCT
          u.id,
          u.nickname,
          u.full_name,
          u.avatar,
          u.title,
          u.department,
          u.status,
          u.last_seen,
          -- Ranking score for better sorting
          CASE
            WHEN u.nickname ILIKE $1 THEN 100
            WHEN u.nickname ILIKE $2 THEN 90
            WHEN u.full_name ILIKE $1 THEN 80
            WHEN u.full_name ILIKE $2 THEN 70
            WHEN u.title ILIKE $2 THEN 60
            WHEN u.department ILIKE $2 THEN 50
            ELSE 0
          END as relevance_score,
          -- Activity score (more recent activity = higher score)
          CASE
            WHEN u.last_seen > NOW() - INTERVAL '1 hour' THEN 20
            WHEN u.last_seen > NOW() - INTERVAL '1 day' THEN 15
            WHEN u.last_seen > NOW() - INTERVAL '1 week' THEN 10
            WHEN u.last_seen > NOW() - INTERVAL '1 month' THEN 5
            ELSE 0
          END as activity_score
        FROM users u
      `;

      const params = [query, `%${query}%`];
      let paramIndex = 2;

      // Add joins for workspace/organization filtering
      if (workspaceId) {
        baseQuery += `
          INNER JOIN workspace_members wm ON u.id = wm.user_id
        `;
      }

      // Build WHERE clause
      let whereConditions = [
        `(u.nickname ILIKE $2 OR u.full_name ILIKE $2 OR u.title ILIKE $2 OR u.department ILIKE $2)`
      ];

      if (!includeInactive) {
        whereConditions.push(`u.status = 'active'`);
      }

      if (userId) {
        whereConditions.push(`u.id != $${++paramIndex}`);
        params.push(userId);
      }

      if (workspaceId) {
        whereConditions.push(`wm.workspace_id = $${++paramIndex}`);
        params.push(workspaceId);
      }

      if (organizationId) {
        whereConditions.push(`u.organization_id = $${++paramIndex}`);
        params.push(organizationId);
      }

      baseQuery += ` WHERE ${whereConditions.join(' AND ')}`;

      // Add ordering and limit
      baseQuery += `
        ORDER BY
          (relevance_score + activity_score) DESC,
          u.nickname ASC
        LIMIT $${++paramIndex}
      `;
      params.push(limit);

      this.logger.debug('Executing user search query', { query, params: params.length });
      const result = await database.query(baseQuery, params);

      return result.rows.map(user => ({
        ...user,
        isOnline: this._isUserOnline(user.last_seen),
        statusIndicator: this._getStatusIndicator(user.status, user.last_seen)
      }));
    } catch (error) {
      this.logger.error('User search failed', { error: error.message, query });
      throw error;
    }
  }

  /**
   * Get live search suggestions as user types
   * @param {string} query - Partial query
   * @param {number} userId - Current user ID
   * @param {Object} options - Search options
   * @returns {Array} Quick suggestions
   */
  async getSuggestions(query, userId = null, options = {}) {
    const { limit = 5, minLength = 1 } = options;

    if (query.length < minLength) {
      return [];
    }

    if (!this.useDatabase) {
      return this._getMockUsers(query, userId, limit);
    }

    try {
      // Fast query for quick suggestions
      const result = await database.query(`
        SELECT
          u.id,
          u.nickname,
          u.full_name,
          u.avatar,
          u.status
        FROM users u
        WHERE (u.nickname ILIKE $1 OR u.full_name ILIKE $1)
          AND u.status = 'active'
          AND u.id != COALESCE($2, 0)
        ORDER BY
          CASE
            WHEN u.nickname ILIKE $3 THEN 1
            ELSE 2
          END,
          u.nickname ASC
        LIMIT $4
      `, [`${query}%`, userId, `${query}%`, limit]);

      return result.rows;
    } catch (error) {
      this.logger.error('Suggestions failed', { error: error.message, query });
      return [];
    }
  }

  /**
   * Search messages with full-text search
   * @param {string} query - Search query
   * @param {number} userId - Current user ID
   * @param {Object} options - Search options
   * @returns {Array} Message search results
   */
  async searchMessages(query, userId, options = {}) {
    const {
      chatId = null,
      workspaceId = null,
      limit = 20,
      offset = 0,
      messageType = null
    } = options;

    if (!this.useDatabase) {
      return { messages: [], total: 0 };
    }

    try {
      let baseQuery = `
        SELECT
          m.id,
          m.content,
          m.message_type,
          m.created_at,
          m.chat_id,
          u.nickname,
          u.avatar,
          c.name as chat_name,
          c.type as chat_type,
          -- Text search ranking
          ts_rank(ms.search_vector, plainto_tsquery('english', $1)) as rank
        FROM messages m
        INNER JOIN message_search ms ON m.id = ms.message_id
        INNER JOIN users u ON m.user_id = u.id
        INNER JOIN chats c ON m.chat_id = c.id
        INNER JOIN chat_participants cp ON c.id = cp.chat_id
      `;

      const params = [query];
      let paramIndex = 1;

      let whereConditions = [
        `ms.search_vector @@ plainto_tsquery('english', $1)`,
        `cp.user_id = $${++paramIndex}`, // User has access to chat
        `m.is_deleted = false`
      ];
      params.push(userId);

      if (chatId) {
        whereConditions.push(`m.chat_id = $${++paramIndex}`);
        params.push(chatId);
      }

      if (workspaceId) {
        whereConditions.push(`c.workspace_id = $${++paramIndex}`);
        params.push(workspaceId);
      }

      if (messageType) {
        whereConditions.push(`m.message_type = $${++paramIndex}`);
        params.push(messageType);
      }

      baseQuery += ` WHERE ${whereConditions.join(' AND ')}`;
      baseQuery += ` ORDER BY rank DESC, m.created_at DESC`;
      baseQuery += ` LIMIT $${++paramIndex} OFFSET $${++paramIndex}`;
      params.push(limit, offset);

      const [messagesResult, countResult] = await Promise.all([
        database.query(baseQuery, params),
        database.query(`
          SELECT COUNT(DISTINCT m.id) as total
          FROM messages m
          INNER JOIN message_search ms ON m.id = ms.message_id
          INNER JOIN chats c ON m.chat_id = c.id
          INNER JOIN chat_participants cp ON c.id = cp.chat_id
          WHERE ${whereConditions.slice(0, -2).join(' AND ')}
        `, params.slice(0, -2))
      ]);

      return {
        messages: messagesResult.rows,
        total: parseInt(countResult.rows[0].total)
      };
    } catch (error) {
      this.logger.error('Message search failed', { error: error.message, query });
      throw error;
    }
  }

  /**
   * Search channels and chats
   * @param {string} query - Search query
   * @param {number} userId - Current user ID
   * @param {Object} options - Search options
   * @returns {Array} Channel search results
   */
  async searchChats(query, userId, options = {}) {
    const { workspaceId = null, includePrivate = true, limit = 10 } = options;

    if (!this.useDatabase) {
      return [];
    }

    try {
      let baseQuery = `
        SELECT DISTINCT
          c.id,
          c.name,
          c.type,
          c.description,
          c.channel_type,
          c.is_private,
          c.created_at,
          (SELECT COUNT(*) FROM chat_participants WHERE chat_id = c.id) as member_count,
          CASE
            WHEN c.name ILIKE $1 THEN 100
            WHEN c.name ILIKE $2 THEN 80
            WHEN c.description ILIKE $2 THEN 60
            ELSE 0
          END as relevance_score
        FROM chats c
        LEFT JOIN chat_participants cp ON c.id = cp.chat_id
      `;

      const params = [query, `%${query}%`];
      let paramIndex = 2;

      let whereConditions = [
        `(c.name ILIKE $2 OR c.description ILIKE $2)`
      ];

      if (!includePrivate) {
        whereConditions.push(`c.is_private = false`);
      } else {
        // If including private, user must be a participant
        whereConditions.push(`(c.is_private = false OR cp.user_id = $${++paramIndex})`);
        params.push(userId);
      }

      if (workspaceId) {
        whereConditions.push(`c.workspace_id = $${++paramIndex}`);
        params.push(workspaceId);
      }

      baseQuery += ` WHERE ${whereConditions.join(' AND ')}`;
      baseQuery += ` ORDER BY relevance_score DESC, member_count DESC, c.name ASC`;
      baseQuery += ` LIMIT $${++paramIndex}`;
      params.push(limit);

      const result = await database.query(baseQuery, params);
      return result.rows;
    } catch (error) {
      this.logger.error('Chat search failed', { error: error.message, query });
      throw error;
    }
  }

  /**
   * Global search across all content types
   * @param {string} query - Search query
   * @param {number} userId - Current user ID
   * @param {Object} options - Search options
   * @returns {Object} Combined search results
   */
  async globalSearch(query, userId, options = {}) {
    const { limit = 20 } = options;

    try {
      const [users, messages, chats] = await Promise.all([
        this.searchUsers(query, userId, { limit: Math.ceil(limit * 0.3) }),
        this.searchMessages(query, userId, { limit: Math.ceil(limit * 0.5) }),
        this.searchChats(query, userId, { limit: Math.ceil(limit * 0.2) })
      ]);

      return {
        users,
        messages: messages.messages || messages,
        chats,
        total: {
          users: users.length,
          messages: messages.total || messages.length,
          chats: chats.length
        }
      };
    } catch (error) {
      this.logger.error('Global search failed', { error: error.message, query });
      throw error;
    }
  }

  // Private helper methods
  _getMockUsers(query, excludeUserId, limit) {
    const mockUsers = [
      { id: 1, nickname: 'admin', full_name: 'Administrator', avatar: '👨‍💼', status: 'active' },
      { id: 2, nickname: 'alice', full_name: 'Alice Johnson', avatar: '👩‍💻', status: 'active' },
      { id: 3, nickname: 'bob', full_name: 'Bob Smith', avatar: '👨‍🔧', status: 'active' },
      { id: 4, nickname: 'carol', full_name: 'Carol Williams', avatar: '👩‍🎨', status: 'active' },
      { id: 5, nickname: 'david', full_name: 'David Brown', avatar: '👨‍🚀', status: 'active' },
    ];

    return mockUsers
      .filter(user =>
        user.id !== excludeUserId &&
        (user.nickname.toLowerCase().includes(query.toLowerCase()) ||
         user.full_name.toLowerCase().includes(query.toLowerCase()))
      )
      .slice(0, limit);
  }

  _isUserOnline(lastSeen) {
    if (!lastSeen) return false;
    return (new Date() - new Date(lastSeen)) < 5 * 60 * 1000; // 5 minutes
  }

  _getStatusIndicator(status, lastSeen) {
    if (status === 'offline') return '⚫';
    if (this._isUserOnline(lastSeen)) return '🟢';
    if (status === 'away') return '🟡';
    if (status === 'dnd') return '🔴';
    return '⚪';
  }
}

module.exports = SearchService;