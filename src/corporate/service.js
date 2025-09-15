const database = require('../database/connection');
const logger = require('../utils/logger');

class CorporateService {
  constructor() {
    this.useDatabase = database.isConnected;
  }

  // Organization Management
  async createOrganization({ name, slug, description, logoUrl, createdBy, settings = {} }) {
    if (!this.useDatabase) {
      throw new Error('Database required for corporate functionality');
    }

    try {
      const result = await database.query(`
        INSERT INTO organizations (name, slug, description, logo_url, created_by, settings)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [name, slug, description, logoUrl, createdBy, JSON.stringify(settings)]);

      await logger.logActivity({
        userId: createdBy,
        action: 'organization.created',
        resourceType: 'organization',
        resourceId: result.rows[0].id,
        metadata: { organizationName: name }
      });

      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Organization slug already exists');
      }
      throw error;
    }
  }

  async getOrganization(orgId) {
    if (!this.useDatabase) return null;

    const result = await database.query(`
      SELECT o.*,
             u.nickname as creator_name,
             (SELECT COUNT(*) FROM workspaces WHERE organization_id = o.id) as workspace_count,
             (SELECT COUNT(DISTINCT wm.user_id)
              FROM workspace_members wm
              JOIN workspaces w ON wm.workspace_id = w.id
              WHERE w.organization_id = o.id) as member_count
      FROM organizations o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.id = $1
    `, [orgId]);

    return result.rows[0] || null;
  }

  // Workspace Management
  async createWorkspace({ organizationId, name, slug, description, isPublic, createdBy, settings = {} }) {
    if (!this.useDatabase) {
      throw new Error('Database required for workspace functionality');
    }

    try {
      const workspace = await database.transaction(async (client) => {
        // Create workspace
        const workspaceResult = await client.query(`
          INSERT INTO workspaces (organization_id, name, slug, description, is_public, created_by, settings)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [organizationId, name, slug, description, isPublic, createdBy, JSON.stringify(settings)]);

        const workspace = workspaceResult.rows[0];

        // Add creator as workspace admin
        await client.query(`
          INSERT INTO workspace_members (workspace_id, user_id, role, invited_by)
          VALUES ($1, $2, 'admin', $3)
        `, [workspace.id, createdBy, createdBy]);

        // Create default general channel
        await client.query(`
          INSERT INTO chats (workspace_id, name, channel_type, is_private, created_by, description)
          VALUES ($1, 'general', 'channel', false, $2, 'General discussion channel')
        `, [workspace.id, createdBy]);

        return workspace;
      });

      await logger.logWorkspaceAction(createdBy, workspace.id, 'created', {
        workspaceName: name,
        organizationId
      });

      return workspace;
    } catch (error) {
      if (error.code === '23505') {
        throw new Error('Workspace slug already exists in this organization');
      }
      throw error;
    }
  }

  async getWorkspacesByOrganization(organizationId) {
    if (!this.useDatabase) return [];

    const result = await database.query(`
      SELECT w.*,
             u.nickname as creator_name,
             (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id AND status = 'active') as member_count,
             (SELECT COUNT(*) FROM chats WHERE workspace_id = w.id) as channel_count
      FROM workspaces w
      LEFT JOIN users u ON w.created_by = u.id
      WHERE w.organization_id = $1
      ORDER BY w.created_at DESC
    `, [organizationId]);

    return result.rows;
  }

  async getUserWorkspaces(userId) {
    if (!this.useDatabase) return [];

    const result = await database.query(`
      SELECT w.*, wm.role, wm.joined_at,
             o.name as organization_name,
             (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id AND status = 'active') as member_count,
             (SELECT COUNT(*) FROM chats WHERE workspace_id = w.id) as channel_count
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      JOIN organizations o ON w.organization_id = o.id
      WHERE wm.user_id = $1 AND wm.status = 'active'
      ORDER BY wm.joined_at DESC
    `, [userId]);

    return result.rows;
  }

  // Team Management
  async createTeam({ workspaceId, name, description, color, createdBy, settings = {} }) {
    if (!this.useDatabase) {
      throw new Error('Database required for team functionality');
    }

    const result = await database.query(`
      INSERT INTO teams (workspace_id, name, description, color, created_by, settings)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [workspaceId, name, description, color, createdBy, JSON.stringify(settings)]);

    await logger.logWorkspaceAction(createdBy, workspaceId, 'team.created', {
      teamName: name,
      teamId: result.rows[0].id
    });

    return result.rows[0];
  }

  async getWorkspaceTeams(workspaceId) {
    if (!this.useDatabase) return [];

    const result = await database.query(`
      SELECT t.*,
             u.nickname as creator_name,
             (SELECT COUNT(*) FROM workspace_members WHERE team_id = t.id) as member_count
      FROM teams t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.workspace_id = $1
      ORDER BY t.created_at ASC
    `, [workspaceId]);

    return result.rows;
  }

  // Member Management
  async addWorkspaceMember({ workspaceId, userId, role = 'member', teamId = null, invitedBy }) {
    if (!this.useDatabase) {
      throw new Error('Database required for member functionality');
    }

    try {
      const result = await database.query(`
        INSERT INTO workspace_members (workspace_id, user_id, role, team_id, invited_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (workspace_id, user_id)
        DO UPDATE SET
          status = 'active',
          role = EXCLUDED.role,
          team_id = EXCLUDED.team_id,
          invited_by = EXCLUDED.invited_by,
          joined_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [workspaceId, userId, role, teamId, invitedBy]);

      await logger.logWorkspaceAction(invitedBy, workspaceId, 'member.added', {
        newMemberId: userId,
        role,
        teamId
      });

      return result.rows[0];
    } catch (error) {
      throw new Error('Failed to add workspace member: ' + error.message);
    }
  }

  async removeWorkspaceMember({ workspaceId, userId, removedBy }) {
    if (!this.useDatabase) {
      throw new Error('Database required for member functionality');
    }

    const result = await database.query(`
      UPDATE workspace_members
      SET status = 'removed', updated_at = CURRENT_TIMESTAMP
      WHERE workspace_id = $1 AND user_id = $2
      RETURNING *
    `, [workspaceId, userId]);

    if (result.rows.length === 0) {
      throw new Error('Member not found in workspace');
    }

    await logger.logWorkspaceAction(removedBy, workspaceId, 'member.removed', {
      removedMemberId: userId
    });

    return result.rows[0];
  }

  async getWorkspaceMembers(workspaceId, includeInactive = false) {
    if (!this.useDatabase) return [];

    let query = `
      SELECT wm.*, u.nickname, u.full_name, u.avatar, u.title, u.department,
             t.name as team_name, t.color as team_color,
             inviter.nickname as invited_by_name
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      LEFT JOIN teams t ON wm.team_id = t.id
      LEFT JOIN users inviter ON wm.invited_by = inviter.id
      WHERE wm.workspace_id = $1
    `;

    if (!includeInactive) {
      query += ` AND wm.status = 'active'`;
    }

    query += ` ORDER BY wm.joined_at ASC`;

    const result = await database.query(query, [workspaceId]);
    return result.rows;
  }

  // Channel/Chat Management for Workspaces
  async createChannel({ workspaceId, name, description, channelType = 'channel', isPrivate = false, createdBy, settings = {} }) {
    if (!this.useDatabase) {
      throw new Error('Database required for channel functionality');
    }

    const result = await database.query(`
      INSERT INTO chats (workspace_id, name, channel_type, is_private, description, created_by, settings)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [workspaceId, name, channelType, isPrivate, description, createdBy, JSON.stringify(settings)]);

    const channel = result.rows[0];

    // Add creator as admin of the channel
    await database.query(`
      INSERT INTO chat_participants (chat_id, user_id, role)
      VALUES ($1, $2, 'admin')
    `, [channel.id, createdBy]);

    await logger.logWorkspaceAction(createdBy, workspaceId, 'channel.created', {
      channelName: name,
      channelId: channel.id,
      channelType,
      isPrivate
    });

    return channel;
  }

  async getWorkspaceChannels(workspaceId, userId = null) {
    if (!this.useDatabase) return [];

    let query = `
      SELECT c.*,
             u.nickname as creator_name,
             (SELECT COUNT(*) FROM chat_participants WHERE chat_id = c.id) as member_count,
             (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) as message_count,
             (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
             (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
    `;

    if (userId) {
      query += `,
               (SELECT role FROM chat_participants WHERE chat_id = c.id AND user_id = $2) as user_role,
               (SELECT 1 FROM chat_participants WHERE chat_id = c.id AND user_id = $2) as is_member
      `;
    }

    query += `
      FROM chats c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.workspace_id = $1
    `;

    if (userId) {
      query += ` AND (c.is_private = false OR EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = c.id AND user_id = $2))`;
    } else {
      query += ` AND c.is_private = false`;
    }

    query += ` ORDER BY c.created_at ASC`;

    const params = userId ? [workspaceId, userId] : [workspaceId];
    const result = await database.query(query, params);
    return result.rows;
  }

  // Advanced User Search
  async searchUsers(query, options = {}) {
    if (!this.useDatabase) return [];

    const {
      workspaceId = null,
      organizationId = null,
      limit = 20,
      includeInactive = false,
      searchBy = ['nickname', 'full_name', 'title']
    } = options;

    let searchQuery = `
      SELECT DISTINCT u.id, u.nickname, u.full_name, u.avatar, u.title, u.department, u.status,
             ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
      FROM users u
    `;

    const params = [query];
    let paramCount = 1;
    let whereConditions = [];

    // Add search vector for full-text search
    searchQuery += `,
      to_tsvector('english',
        COALESCE(u.nickname, '') || ' ' ||
        COALESCE(u.full_name, '') || ' ' ||
        COALESCE(u.title, '') || ' ' ||
        COALESCE(u.department, '')
      ) as search_vector
    `;

    if (workspaceId) {
      searchQuery += ` JOIN workspace_members wm ON u.id = wm.user_id`;
      whereConditions.push(`wm.workspace_id = $${++paramCount}`);
      params.push(workspaceId);

      if (!includeInactive) {
        whereConditions.push(`wm.status = 'active'`);
      }
    }

    if (organizationId && !workspaceId) {
      searchQuery += `
        JOIN workspace_members wm ON u.id = wm.user_id
        JOIN workspaces w ON wm.workspace_id = w.id
      `;
      whereConditions.push(`w.organization_id = $${++paramCount}`);
      params.push(organizationId);
    }

    // Add search conditions
    const searchConditions = [];
    if (searchBy.includes('nickname')) {
      searchConditions.push(`u.nickname ILIKE $${++paramCount}`);
      params.push(`%${query}%`);
    }
    if (searchBy.includes('full_name')) {
      searchConditions.push(`u.full_name ILIKE $${++paramCount}`);
      params.push(`%${query}%`);
    }
    if (searchBy.includes('title')) {
      searchConditions.push(`u.title ILIKE $${++paramCount}`);
      params.push(`%${query}%`);
    }

    if (searchConditions.length > 0) {
      whereConditions.push(`(${searchConditions.join(' OR ')})`);
    }

    if (!includeInactive) {
      whereConditions.push(`u.status = 'active'`);
    }

    if (whereConditions.length > 0) {
      searchQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    searchQuery += ` ORDER BY rank DESC, u.full_name ASC, u.nickname ASC LIMIT $${++paramCount}`;
    params.push(limit);

    const result = await database.query(searchQuery, params);
    return result.rows;
  }

  // User Role Management
  async assignUserRole({ userId, role, scope, scopeId, grantedBy, expiresAt = null }) {
    if (!this.useDatabase) {
      throw new Error('Database required for role management');
    }

    const result = await database.query(`
      INSERT INTO user_roles (user_id, role, scope, scope_id, granted_by, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, role, scope, scope_id)
      DO UPDATE SET
        granted_by = EXCLUDED.granted_by,
        granted_at = CURRENT_TIMESTAMP,
        expires_at = EXCLUDED.expires_at
      RETURNING *
    `, [userId, role, scope, scopeId, grantedBy, expiresAt]);

    await logger.logActivity({
      userId: grantedBy,
      action: 'role.assigned',
      resourceType: 'user_role',
      metadata: { targetUserId: userId, role, scope, scopeId }
    });

    return result.rows[0];
  }

  async getUserRoles(userId, scope = null) {
    if (!this.useDatabase) return [];

    let query = `
      SELECT ur.*, granter.nickname as granted_by_name
      FROM user_roles ur
      LEFT JOIN users granter ON ur.granted_by = granter.id
      WHERE ur.user_id = $1
        AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
    `;

    const params = [userId];

    if (scope) {
      query += ` AND ur.scope = $2`;
      params.push(scope);
    }

    query += ` ORDER BY ur.granted_at DESC`;

    const result = await database.query(query, params);
    return result.rows;
  }

  async checkUserPermission(userId, permission, scope, scopeId) {
    if (!this.useDatabase) return false;

    // Define role hierarchy and permissions
    const rolePermissions = {
      'superadmin': ['*'],
      'org_admin': ['org.*', 'workspace.*', 'user.*'],
      'workspace_admin': ['workspace.*', 'channel.*', 'member.*'],
      'channel_admin': ['channel.manage', 'channel.moderate'],
      'member': ['channel.read', 'channel.write']
    };

    const userRoles = await this.getUserRoles(userId, scope);

    for (const userRole of userRoles) {
      const permissions = rolePermissions[userRole.role] || [];
      if (permissions.includes('*') || permissions.includes(permission) || permissions.includes(`${scope}.*`)) {
        return true;
      }
    }

    return false;
  }
}

module.exports = CorporateService;