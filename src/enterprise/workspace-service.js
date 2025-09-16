const database = require('../database/optimized-connection');
const Logger = require('../utils/enhanced-logger');

class WorkspaceService {
  constructor() {
    this.logger = new Logger('WorkspaceService');
    this.useDatabase = database.isConnected;
  }

  /**
   * Create a new workspace within an organization
   */
  async createWorkspace(data) {
    const {
      organizationId,
      name,
      slug,
      description,
      settings = {},
      isPublic = false,
      createdBy
    } = data;

    if (!this.useDatabase) {
      throw new Error('Database required for workspace management');
    }

    try {
      // Validate slug uniqueness within organization
      const existingWorkspace = await database.query(`
        SELECT id FROM workspaces
        WHERE organization_id = $1 AND slug = $2
      `, [organizationId, slug]);

      if (existingWorkspace.rows.length > 0) {
        throw new Error('Workspace with this name already exists in the organization');
      }

      const result = await database.transaction(async (client) => {
        // Create workspace
        const workspaceResult = await client.query(`
          INSERT INTO workspaces (organization_id, name, slug, description, settings, is_public, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [organizationId, name, slug, description, JSON.stringify(settings), isPublic, createdBy]);

        const workspace = workspaceResult.rows[0];

        // Add creator as workspace admin
        await client.query(`
          INSERT INTO workspace_members (workspace_id, user_id, role, status)
          VALUES ($1, $2, 'admin', 'active')
        `, [workspace.id, createdBy]);

        // Create default general channel
        const channelResult = await client.query(`
          INSERT INTO channels (workspace_id, name, description, type, is_general, created_by)
          VALUES ($1, 'general', 'General discussion channel', 'public', true, $2)
          RETURNING id
        `, [workspace.id, createdBy]);

        // Add creator to general channel
        await client.query(`
          INSERT INTO channel_members (channel_id, user_id, role)
          VALUES ($1, $2, 'admin')
        `, [channelResult.rows[0].id, createdBy]);

        return workspace;
      });

      this.logger.info('Workspace created successfully', {
        workspaceId: result.id,
        organizationId,
        createdBy,
        name
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create workspace', {
        error: error.message,
        organizationId,
        name,
        createdBy
      });
      throw error;
    }
  }

  /**
   * Get workspaces for a user
   */
  async getUserWorkspaces(userId) {
    if (!this.useDatabase) {
      return [];
    }

    try {
      const result = await database.query(`
        SELECT
          w.*,
          o.name as organization_name,
          wm.role as user_role,
          wm.status as membership_status,
          (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id AND status = 'active') as member_count,
          (SELECT COUNT(*) FROM channels WHERE workspace_id = w.id) as channel_count
        FROM workspaces w
        INNER JOIN organizations o ON w.organization_id = o.id
        INNER JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = $1 AND wm.status = 'active'
        ORDER BY wm.joined_at DESC
      `, [userId]);

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get user workspaces', {
        error: error.message,
        userId
      });
      return [];
    }
  }

  /**
   * Get workspace details
   */
  async getWorkspace(workspaceId, userId = null) {
    if (!this.useDatabase) {
      throw new Error('Database required');
    }

    try {
      let query = `
        SELECT
          w.*,
          o.name as organization_name,
          o.id as organization_id,
          (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id AND status = 'active') as member_count,
          (SELECT COUNT(*) FROM channels WHERE workspace_id = w.id) as channel_count,
          (SELECT COUNT(*) FROM teams WHERE workspace_id = w.id) as team_count
      `;

      const params = [workspaceId];

      if (userId) {
        query += `,
          wm.role as user_role,
          wm.status as membership_status,
          wm.joined_at as user_joined_at
        FROM workspaces w
        INNER JOIN organizations o ON w.organization_id = o.id
        LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = $2
        WHERE w.id = $1
        `;
        params.push(userId);
      } else {
        query += `
        FROM workspaces w
        INNER JOIN organizations o ON w.organization_id = o.id
        WHERE w.id = $1
        `;
      }

      const result = await database.query(query, params);

      if (result.rows.length === 0) {
        throw new Error('Workspace not found');
      }

      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to get workspace', {
        error: error.message,
        workspaceId,
        userId
      });
      throw error;
    }
  }

  /**
   * Add member to workspace
   */
  async addMember(workspaceId, userId, invitedBy, role = 'member', teamId = null) {
    if (!this.useDatabase) {
      throw new Error('Database required');
    }

    try {
      // Check if inviter has permission
      const inviterCheck = await database.query(`
        SELECT role FROM workspace_members
        WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
      `, [workspaceId, invitedBy]);

      if (inviterCheck.rows.length === 0) {
        throw new Error('You are not a member of this workspace');
      }

      const inviterRole = inviterCheck.rows[0].role;
      if (!['admin', 'owner'].includes(inviterRole)) {
        throw new Error('Insufficient permissions to add members');
      }

      // Add member
      const result = await database.query(`
        INSERT INTO workspace_members (workspace_id, user_id, role, team_id, status, invited_by)
        VALUES ($1, $2, $3, $4, 'active', $5)
        ON CONFLICT (workspace_id, user_id)
        DO UPDATE SET
          role = EXCLUDED.role,
          team_id = EXCLUDED.team_id,
          status = 'active',
          invited_by = EXCLUDED.invited_by
        RETURNING *
      `, [workspaceId, userId, role, teamId, invitedBy]);

      // Add to general channel automatically
      const generalChannel = await database.query(`
        SELECT id FROM channels
        WHERE workspace_id = $1 AND is_general = true
      `, [workspaceId]);

      if (generalChannel.rows.length > 0) {
        await database.query(`
          INSERT INTO channel_members (channel_id, user_id, role)
          VALUES ($1, $2, 'member')
          ON CONFLICT (channel_id, user_id) DO NOTHING
        `, [generalChannel.rows[0].id, userId]);
      }

      this.logger.info('Member added to workspace', {
        workspaceId,
        userId,
        invitedBy,
        role
      });

      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to add workspace member', {
        error: error.message,
        workspaceId,
        userId,
        invitedBy
      });
      throw error;
    }
  }

  /**
   * Remove member from workspace
   */
  async removeMember(workspaceId, userId, removedBy) {
    if (!this.useDatabase) {
      throw new Error('Database required');
    }

    try {
      // Check permissions
      const removerCheck = await database.query(`
        SELECT role FROM workspace_members
        WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
      `, [workspaceId, removedBy]);

      if (removerCheck.rows.length === 0) {
        throw new Error('You are not a member of this workspace');
      }

      const removerRole = removerCheck.rows[0].role;
      if (!['admin', 'owner'].includes(removerRole) && removedBy !== userId) {
        throw new Error('Insufficient permissions to remove members');
      }

      await database.transaction(async (client) => {
        // Remove from workspace
        await client.query(`
          UPDATE workspace_members
          SET status = 'removed'
          WHERE workspace_id = $1 AND user_id = $2
        `, [workspaceId, userId]);

        // Remove from all channels in workspace
        await client.query(`
          DELETE FROM channel_members
          WHERE user_id = $1 AND channel_id IN (
            SELECT id FROM channels WHERE workspace_id = $2
          )
        `, [userId, workspaceId]);
      });

      this.logger.info('Member removed from workspace', {
        workspaceId,
        userId,
        removedBy
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to remove workspace member', {
        error: error.message,
        workspaceId,
        userId,
        removedBy
      });
      throw error;
    }
  }

  /**
   * Get workspace members
   */
  async getMembers(workspaceId, userId, options = {}) {
    const { limit = 50, offset = 0, teamId = null, role = null } = options;

    if (!this.useDatabase) {
      return [];
    }

    try {
      // Check if user has access to workspace
      const accessCheck = await database.query(`
        SELECT 1 FROM workspace_members
        WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
      `, [workspaceId, userId]);

      if (accessCheck.rows.length === 0) {
        throw new Error('Access denied');
      }

      let query = `
        SELECT
          u.id,
          u.nickname,
          u.full_name,
          u.avatar,
          u.title,
          u.department,
          u.status,
          u.last_seen,
          wm.role,
          wm.joined_at,
          wm.team_id,
          t.name as team_name,
          t.color as team_color
        FROM workspace_members wm
        INNER JOIN users u ON wm.user_id = u.id
        LEFT JOIN teams t ON wm.team_id = t.id
        WHERE wm.workspace_id = $1 AND wm.status = 'active'
      `;

      const params = [workspaceId];
      let paramCount = 1;

      if (teamId) {
        query += ` AND wm.team_id = $${++paramCount}`;
        params.push(teamId);
      }

      if (role) {
        query += ` AND wm.role = $${++paramCount}`;
        params.push(role);
      }

      query += ` ORDER BY wm.joined_at ASC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(limit, offset);

      const result = await database.query(query, params);
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get workspace members', {
        error: error.message,
        workspaceId,
        userId
      });
      throw error;
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(workspaceId, userId, newRole, updatedBy) {
    if (!this.useDatabase) {
      throw new Error('Database required');
    }

    try {
      // Check permissions
      const updaterCheck = await database.query(`
        SELECT role FROM workspace_members
        WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
      `, [workspaceId, updatedBy]);

      if (updaterCheck.rows.length === 0 || !['admin', 'owner'].includes(updaterCheck.rows[0].role)) {
        throw new Error('Insufficient permissions to update member roles');
      }

      const result = await database.query(`
        UPDATE workspace_members
        SET role = $1
        WHERE workspace_id = $2 AND user_id = $3 AND status = 'active'
        RETURNING *
      `, [newRole, workspaceId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Member not found');
      }

      this.logger.info('Member role updated', {
        workspaceId,
        userId,
        newRole,
        updatedBy
      });

      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to update member role', {
        error: error.message,
        workspaceId,
        userId,
        newRole,
        updatedBy
      });
      throw error;
    }
  }

  /**
   * Update workspace settings
   */
  async updateWorkspace(workspaceId, updates, updatedBy) {
    if (!this.useDatabase) {
      throw new Error('Database required');
    }

    try {
      // Check permissions
      const permissionCheck = await database.query(`
        SELECT role FROM workspace_members
        WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
      `, [workspaceId, updatedBy]);

      if (permissionCheck.rows.length === 0 || !['admin', 'owner'].includes(permissionCheck.rows[0].role)) {
        throw new Error('Insufficient permissions to update workspace');
      }

      const allowedFields = ['name', 'description', 'settings', 'is_public'];
      const updateFields = [];
      const params = [workspaceId];
      let paramCount = 1;

      for (const [field, value] of Object.entries(updates)) {
        if (allowedFields.includes(field)) {
          updateFields.push(`${field} = $${++paramCount}`);
          params.push(field === 'settings' ? JSON.stringify(value) : value);
        }
      }

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      const query = `
        UPDATE workspaces
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING *
      `;

      const result = await database.query(query, params);

      this.logger.info('Workspace updated', {
        workspaceId,
        updatedFields: Object.keys(updates),
        updatedBy
      });

      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to update workspace', {
        error: error.message,
        workspaceId,
        updatedBy
      });
      throw error;
    }
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(workspaceId, deletedBy) {
    if (!this.useDatabase) {
      throw new Error('Database required');
    }

    try {
      // Check if user is owner
      const ownerCheck = await database.query(`
        SELECT role FROM workspace_members
        WHERE workspace_id = $1 AND user_id = $2 AND role = 'owner'
      `, [workspaceId, deletedBy]);

      if (ownerCheck.rows.length === 0) {
        throw new Error('Only workspace owners can delete workspaces');
      }

      // Soft delete - just mark as inactive
      await database.query(`
        UPDATE workspaces
        SET is_public = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [workspaceId]);

      this.logger.info('Workspace deleted', {
        workspaceId,
        deletedBy
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to delete workspace', {
        error: error.message,
        workspaceId,
        deletedBy
      });
      throw error;
    }
  }

  /**
   * Search workspaces (for joining public workspaces)
   */
  async searchPublicWorkspaces(query, userId, organizationId = null) {
    if (!this.useDatabase) {
      return [];
    }

    try {
      let dbQuery = `
        SELECT
          w.*,
          o.name as organization_name,
          (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id AND status = 'active') as member_count,
          CASE WHEN wm.user_id IS NOT NULL THEN true ELSE false END as is_member
        FROM workspaces w
        INNER JOIN organizations o ON w.organization_id = o.id
        LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = $2 AND wm.status = 'active'
        WHERE w.is_public = true AND (w.name ILIKE $1 OR w.description ILIKE $1)
      `;

      const params = [`%${query}%`, userId];

      if (organizationId) {
        dbQuery += ` AND w.organization_id = $3`;
        params.push(organizationId);
      }

      dbQuery += ` ORDER BY member_count DESC, w.name ASC LIMIT 20`;

      const result = await database.query(dbQuery, params);
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to search public workspaces', {
        error: error.message,
        query,
        userId
      });
      return [];
    }
  }

  /**
   * Join public workspace
   */
  async joinPublicWorkspace(workspaceId, userId) {
    if (!this.useDatabase) {
      throw new Error('Database required');
    }

    try {
      // Check if workspace is public
      const workspaceCheck = await database.query(`
        SELECT is_public FROM workspaces WHERE id = $1
      `, [workspaceId]);

      if (workspaceCheck.rows.length === 0) {
        throw new Error('Workspace not found');
      }

      if (!workspaceCheck.rows[0].is_public) {
        throw new Error('This workspace is private and requires an invitation');
      }

      // Add member
      const result = await this.addMember(workspaceId, userId, null, 'member');

      this.logger.info('User joined public workspace', {
        workspaceId,
        userId
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to join public workspace', {
        error: error.message,
        workspaceId,
        userId
      });
      throw error;
    }
  }
}

module.exports = WorkspaceService;