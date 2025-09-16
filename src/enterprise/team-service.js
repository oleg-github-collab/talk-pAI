const database = require('../database/optimized-connection');
const Logger = require('../utils/enhanced-logger');

class TeamService {
  constructor() {
    this.logger = new Logger('TeamService');
    this.useDatabase = database.isConnected;
  }

  /**
   * Create a new team within a workspace
   */
  async createTeam(data) {
    const {
      workspaceId,
      name,
      description,
      color = '#6366f1',
      settings = {},
      createdBy
    } = data;

    if (!this.useDatabase) {
      throw new Error('Database required for team management');
    }

    try {
      // Check if user has permission to create teams in workspace
      const permissionCheck = await database.query(`
        SELECT role FROM workspace_members
        WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
      `, [workspaceId, createdBy]);

      if (permissionCheck.rows.length === 0) {
        throw new Error('You are not a member of this workspace');
      }

      const userRole = permissionCheck.rows[0].role;
      if (!['admin', 'owner'].includes(userRole)) {
        throw new Error('Insufficient permissions to create teams');
      }

      // Check for duplicate team name in workspace
      const existingTeam = await database.query(`
        SELECT id FROM teams
        WHERE workspace_id = $1 AND name = $2
      `, [workspaceId, name]);

      if (existingTeam.rows.length > 0) {
        throw new Error('A team with this name already exists in the workspace');
      }

      const result = await database.query(`
        INSERT INTO teams (workspace_id, name, description, color, settings, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [workspaceId, name, description, color, JSON.stringify(settings), createdBy]);

      this.logger.info('Team created successfully', {
        teamId: result.rows[0].id,
        workspaceId,
        name,
        createdBy
      });

      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to create team', {
        error: error.message,
        workspaceId,
        name,
        createdBy
      });
      throw error;
    }
  }

  /**
   * Get teams in a workspace
   */
  async getWorkspaceTeams(workspaceId, userId) {
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

      const result = await database.query(`
        SELECT
          t.*,
          u.nickname as creator_name,
          (SELECT COUNT(*)
           FROM workspace_members wm
           WHERE wm.workspace_id = t.workspace_id
           AND wm.team_id = t.id
           AND wm.status = 'active') as member_count,
          CASE WHEN wm_user.team_id = t.id THEN true ELSE false END as is_member
        FROM teams t
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN workspace_members wm_user ON wm_user.workspace_id = t.workspace_id
          AND wm_user.user_id = $2
          AND wm_user.status = 'active'
        WHERE t.workspace_id = $1
        ORDER BY t.name ASC
      `, [workspaceId, userId]);

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get workspace teams', {
        error: error.message,
        workspaceId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get team details
   */
  async getTeam(teamId, userId) {
    if (!this.useDatabase) {
      throw new Error('Database required');
    }

    try {
      const result = await database.query(`
        SELECT
          t.*,
          w.name as workspace_name,
          w.organization_id,
          u.nickname as creator_name,
          (SELECT COUNT(*)
           FROM workspace_members wm
           WHERE wm.team_id = t.id
           AND wm.status = 'active') as member_count,
          wm_check.role as user_workspace_role,
          CASE WHEN wm_check.team_id = t.id THEN true ELSE false END as is_member
        FROM teams t
        INNER JOIN workspaces w ON t.workspace_id = w.id
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN workspace_members wm_check ON wm_check.workspace_id = t.workspace_id
          AND wm_check.user_id = $2
          AND wm_check.status = 'active'
        WHERE t.id = $1
      `, [teamId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Team not found');
      }

      const team = result.rows[0];

      if (!team.user_workspace_role) {
        throw new Error('Access denied: You are not a member of this workspace');
      }

      return team;
    } catch (error) {
      this.logger.error('Failed to get team', {
        error: error.message,
        teamId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get team members
   */
  async getTeamMembers(teamId, userId) {
    if (!this.useDatabase) {
      return [];
    }

    try {
      // Check access
      const accessCheck = await database.query(`
        SELECT 1 FROM teams t
        INNER JOIN workspace_members wm ON t.workspace_id = wm.workspace_id
        WHERE t.id = $1 AND wm.user_id = $2 AND wm.status = 'active'
      `, [teamId, userId]);

      if (accessCheck.rows.length === 0) {
        throw new Error('Access denied');
      }

      const result = await database.query(`
        SELECT
          u.id,
          u.nickname,
          u.full_name,
          u.avatar,
          u.title,
          u.department,
          u.status,
          u.last_seen,
          wm.role as workspace_role,
          wm.joined_at
        FROM workspace_members wm
        INNER JOIN users u ON wm.user_id = u.id
        WHERE wm.team_id = $1 AND wm.status = 'active'
        ORDER BY u.nickname ASC
      `, [teamId]);

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get team members', {
        error: error.message,
        teamId,
        userId
      });
      throw error;
    }
  }

  /**
   * Add member to team
   */
  async addMemberToTeam(teamId, userId, addedBy) {
    if (!this.useDatabase) {
      throw new Error('Database required');
    }

    try {
      // Get team info and check permissions
      const teamCheck = await database.query(`
        SELECT
          t.workspace_id,
          wm_adder.role as adder_role,
          wm_user.user_id as existing_member
        FROM teams t
        LEFT JOIN workspace_members wm_adder ON t.workspace_id = wm_adder.workspace_id
          AND wm_adder.user_id = $2 AND wm_adder.status = 'active'
        LEFT JOIN workspace_members wm_user ON t.workspace_id = wm_user.workspace_id
          AND wm_user.user_id = $3 AND wm_user.status = 'active'
        WHERE t.id = $1
      `, [teamId, addedBy, userId]);

      if (teamCheck.rows.length === 0) {
        throw new Error('Team not found');
      }

      const team = teamCheck.rows[0];

      if (!team.adder_role) {
        throw new Error('You are not a member of this workspace');
      }

      if (!['admin', 'owner'].includes(team.adder_role)) {
        throw new Error('Insufficient permissions to add members to teams');
      }

      if (!team.existing_member) {
        throw new Error('User is not a member of this workspace');
      }

      // Update workspace member to assign team
      const result = await database.query(`
        UPDATE workspace_members
        SET team_id = $1
        WHERE workspace_id = $2 AND user_id = $3 AND status = 'active'
        RETURNING *
      `, [teamId, team.workspace_id, userId]);

      if (result.rows.length === 0) {
        throw new Error('Failed to add member to team');
      }

      this.logger.info('Member added to team', {
        teamId,
        userId,
        addedBy,
        workspaceId: team.workspace_id
      });

      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to add member to team', {
        error: error.message,
        teamId,
        userId,
        addedBy
      });
      throw error;
    }
  }

  /**
   * Remove member from team
   */
  async removeMemberFromTeam(teamId, userId, removedBy) {
    if (!this.useDatabase) {
      throw new Error('Database required');
    }

    try {
      // Get team info and check permissions
      const teamCheck = await database.query(`
        SELECT
          t.workspace_id,
          wm_remover.role as remover_role
        FROM teams t
        LEFT JOIN workspace_members wm_remover ON t.workspace_id = wm_remover.workspace_id
          AND wm_remover.user_id = $2 AND wm_remover.status = 'active'
        WHERE t.id = $1
      `, [teamId, removedBy]);

      if (teamCheck.rows.length === 0) {
        throw new Error('Team not found');
      }

      const team = teamCheck.rows[0];

      if (!team.remover_role) {
        throw new Error('You are not a member of this workspace');
      }

      // Allow users to remove themselves or admins to remove others
      if (!['admin', 'owner'].includes(team.remover_role) && removedBy !== userId) {
        throw new Error('Insufficient permissions to remove team members');
      }

      // Remove from team (set team_id to null)
      const result = await database.query(`
        UPDATE workspace_members
        SET team_id = NULL
        WHERE workspace_id = $1 AND user_id = $2 AND team_id = $3 AND status = 'active'
        RETURNING *
      `, [team.workspace_id, userId, teamId]);

      if (result.rows.length === 0) {
        throw new Error('Member not found in team');
      }

      this.logger.info('Member removed from team', {
        teamId,
        userId,
        removedBy,
        workspaceId: team.workspace_id
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to remove member from team', {
        error: error.message,
        teamId,
        userId,
        removedBy
      });
      throw error;
    }
  }

  /**
   * Update team
   */
  async updateTeam(teamId, updates, updatedBy) {
    if (!this.useDatabase) {
      throw new Error('Database required');
    }

    try {
      // Check permissions
      const permissionCheck = await database.query(`
        SELECT wm.role
        FROM teams t
        INNER JOIN workspace_members wm ON t.workspace_id = wm.workspace_id
        WHERE t.id = $1 AND wm.user_id = $2 AND wm.status = 'active'
      `, [teamId, updatedBy]);

      if (permissionCheck.rows.length === 0) {
        throw new Error('Access denied');
      }

      const userRole = permissionCheck.rows[0].role;
      if (!['admin', 'owner'].includes(userRole)) {
        throw new Error('Insufficient permissions to update team');
      }

      const allowedFields = ['name', 'description', 'color', 'settings'];
      const updateFields = [];
      const params = [teamId];
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
        UPDATE teams
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING *
      `;

      const result = await database.query(query, params);

      this.logger.info('Team updated', {
        teamId,
        updatedFields: Object.keys(updates),
        updatedBy
      });

      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to update team', {
        error: error.message,
        teamId,
        updatedBy
      });
      throw error;
    }
  }

  /**
   * Delete team
   */
  async deleteTeam(teamId, deletedBy) {
    if (!this.useDatabase) {
      throw new Error('Database required');
    }

    try {
      // Check permissions
      const permissionCheck = await database.query(`
        SELECT t.workspace_id, wm.role
        FROM teams t
        INNER JOIN workspace_members wm ON t.workspace_id = wm.workspace_id
        WHERE t.id = $1 AND wm.user_id = $2 AND wm.status = 'active'
      `, [teamId, deletedBy]);

      if (permissionCheck.rows.length === 0) {
        throw new Error('Access denied');
      }

      const { workspace_id, role } = permissionCheck.rows[0];
      if (!['admin', 'owner'].includes(role)) {
        throw new Error('Insufficient permissions to delete team');
      }

      await database.transaction(async (client) => {
        // Remove team assignment from all members
        await client.query(`
          UPDATE workspace_members
          SET team_id = NULL
          WHERE workspace_id = $1 AND team_id = $2
        `, [workspace_id, teamId]);

        // Delete the team
        await client.query(`
          DELETE FROM teams
          WHERE id = $1
        `, [teamId]);
      });

      this.logger.info('Team deleted', {
        teamId,
        workspaceId: workspace_id,
        deletedBy
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to delete team', {
        error: error.message,
        teamId,
        deletedBy
      });
      throw error;
    }
  }

  /**
   * Get teams for a user across all workspaces
   */
  async getUserTeams(userId) {
    if (!this.useDatabase) {
      return [];
    }

    try {
      const result = await database.query(`
        SELECT
          t.*,
          w.name as workspace_name,
          o.name as organization_name,
          (SELECT COUNT(*)
           FROM workspace_members wm2
           WHERE wm2.team_id = t.id
           AND wm2.status = 'active') as member_count
        FROM workspace_members wm
        INNER JOIN teams t ON wm.team_id = t.id
        INNER JOIN workspaces w ON t.workspace_id = w.id
        INNER JOIN organizations o ON w.organization_id = o.id
        WHERE wm.user_id = $1 AND wm.status = 'active'
        ORDER BY o.name, w.name, t.name
      `, [userId]);

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get user teams', {
        error: error.message,
        userId
      });
      return [];
    }
  }

  /**
   * Search teams within a workspace
   */
  async searchTeams(workspaceId, query, userId) {
    if (!this.useDatabase) {
      return [];
    }

    try {
      // Check access
      const accessCheck = await database.query(`
        SELECT 1 FROM workspace_members
        WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
      `, [workspaceId, userId]);

      if (accessCheck.rows.length === 0) {
        throw new Error('Access denied');
      }

      const result = await database.query(`
        SELECT
          t.*,
          (SELECT COUNT(*)
           FROM workspace_members wm
           WHERE wm.team_id = t.id
           AND wm.status = 'active') as member_count,
          CASE WHEN wm_user.team_id = t.id THEN true ELSE false END as is_member
        FROM teams t
        LEFT JOIN workspace_members wm_user ON wm_user.workspace_id = t.workspace_id
          AND wm_user.user_id = $3
          AND wm_user.status = 'active'
        WHERE t.workspace_id = $1
          AND (t.name ILIKE $2 OR t.description ILIKE $2)
        ORDER BY t.name ASC
        LIMIT 20
      `, [workspaceId, `%${query}%`, userId]);

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to search teams', {
        error: error.message,
        workspaceId,
        query,
        userId
      });
      return [];
    }
  }
}

module.exports = TeamService;