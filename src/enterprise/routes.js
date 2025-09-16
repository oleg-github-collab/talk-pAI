const express = require('express');
const WorkspaceService = require('./workspace-service');
const TeamService = require('./team-service');
const PermissionService = require('./permission-service');
const authMiddleware = require('../middleware/auth');
const Logger = require('../utils/enhanced-logger');

class EnterpriseRoutes {
  constructor() {
    this.router = express.Router();
    this.workspaceService = new WorkspaceService();
    this.teamService = new TeamService();
    this.permissionService = new PermissionService();
    this.logger = new Logger('EnterpriseRoutes');
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Apply authentication to all enterprise routes
    this.router.use(authMiddleware);

    // Workspace routes
    this.router.post('/workspaces', this.createWorkspace.bind(this));
    this.router.get('/workspaces', this.getUserWorkspaces.bind(this));
    this.router.get('/workspaces/search', this.searchPublicWorkspaces.bind(this));
    this.router.get('/workspaces/:workspaceId', this.getWorkspace.bind(this));
    this.router.put('/workspaces/:workspaceId', this.updateWorkspace.bind(this));
    this.router.delete('/workspaces/:workspaceId', this.deleteWorkspace.bind(this));

    // Workspace member management
    this.router.get('/workspaces/:workspaceId/members', this.getWorkspaceMembers.bind(this));
    this.router.post('/workspaces/:workspaceId/members', this.addWorkspaceMember.bind(this));
    this.router.delete('/workspaces/:workspaceId/members/:userId', this.removeWorkspaceMember.bind(this));
    this.router.put('/workspaces/:workspaceId/members/:userId/role', this.updateMemberRole.bind(this));
    this.router.post('/workspaces/:workspaceId/join', this.joinPublicWorkspace.bind(this));

    // Team routes
    this.router.post('/workspaces/:workspaceId/teams', this.createTeam.bind(this));
    this.router.get('/workspaces/:workspaceId/teams', this.getWorkspaceTeams.bind(this));
    this.router.get('/workspaces/:workspaceId/teams/search', this.searchTeams.bind(this));
    this.router.get('/teams/:teamId', this.getTeam.bind(this));
    this.router.put('/teams/:teamId', this.updateTeam.bind(this));
    this.router.delete('/teams/:teamId', this.deleteTeam.bind(this));

    // Team member management
    this.router.get('/teams/:teamId/members', this.getTeamMembers.bind(this));
    this.router.post('/teams/:teamId/members/:userId', this.addTeamMember.bind(this));
    this.router.delete('/teams/:teamId/members/:userId', this.removeTeamMember.bind(this));

    // User teams
    this.router.get('/users/teams', this.getUserTeams.bind(this));

    // Permission management
    this.router.get('/users/:userId/roles', this.getUserRoles.bind(this));
    this.router.post('/users/:userId/roles', this.grantRole.bind(this));
    this.router.delete('/users/:userId/roles', this.revokeRole.bind(this));
    this.router.get('/users/:userId/permissions', this.getUserPermissions.bind(this));

    // Permission checking endpoint
    this.router.post('/permissions/check', this.checkPermission.bind(this));
  }

  // Workspace Management
  async createWorkspace(req, res) {
    try {
      const { organizationId, name, description, isPublic = false } = req.body;

      if (!organizationId || !name) {
        return res.status(400).json({ error: 'Organization ID and name are required' });
      }

      // Generate slug from name
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const workspace = await this.workspaceService.createWorkspace({
        organizationId,
        name,
        slug,
        description,
        isPublic,
        createdBy: req.user.id
      });

      this.logger.info('Workspace created via API', {
        workspaceId: workspace.id,
        userId: req.user.id,
        organizationId
      });

      res.status(201).json(workspace);
    } catch (error) {
      this.logger.error('Create workspace failed', {
        error: error.message,
        userId: req.user.id,
        body: req.body
      });
      res.status(400).json({ error: error.message });
    }
  }

  async getUserWorkspaces(req, res) {
    try {
      const workspaces = await this.workspaceService.getUserWorkspaces(req.user.id);
      res.json(workspaces);
    } catch (error) {
      this.logger.error('Get user workspaces failed', {
        error: error.message,
        userId: req.user.id
      });
      res.status(500).json({ error: 'Failed to fetch workspaces' });
    }
  }

  async getWorkspace(req, res) {
    try {
      const { workspaceId } = req.params;
      const workspace = await this.workspaceService.getWorkspace(workspaceId, req.user.id);

      if (!workspace.user_role) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(workspace);
    } catch (error) {
      this.logger.error('Get workspace failed', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        userId: req.user.id
      });
      res.status(404).json({ error: error.message });
    }
  }

  async updateWorkspace(req, res) {
    try {
      const { workspaceId } = req.params;
      const updates = req.body;

      const workspace = await this.workspaceService.updateWorkspace(
        workspaceId,
        updates,
        req.user.id
      );

      res.json(workspace);
    } catch (error) {
      this.logger.error('Update workspace failed', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        userId: req.user.id
      });
      res.status(400).json({ error: error.message });
    }
  }

  async deleteWorkspace(req, res) {
    try {
      const { workspaceId } = req.params;
      await this.workspaceService.deleteWorkspace(workspaceId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      this.logger.error('Delete workspace failed', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        userId: req.user.id
      });
      res.status(400).json({ error: error.message });
    }
  }

  async searchPublicWorkspaces(req, res) {
    try {
      const { q: query, organization_id } = req.query;

      if (!query || query.trim().length < 2) {
        return res.json([]);
      }

      const workspaces = await this.workspaceService.searchPublicWorkspaces(
        query.trim(),
        req.user.id,
        organization_id ? parseInt(organization_id) : null
      );

      res.json(workspaces);
    } catch (error) {
      this.logger.error('Search public workspaces failed', {
        error: error.message,
        userId: req.user.id,
        query: req.query.q
      });
      res.status(500).json({ error: 'Search failed' });
    }
  }

  async joinPublicWorkspace(req, res) {
    try {
      const { workspaceId } = req.params;
      const membership = await this.workspaceService.joinPublicWorkspace(workspaceId, req.user.id);
      res.json(membership);
    } catch (error) {
      this.logger.error('Join public workspace failed', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        userId: req.user.id
      });
      res.status(400).json({ error: error.message });
    }
  }

  // Workspace Member Management
  async getWorkspaceMembers(req, res) {
    try {
      const { workspaceId } = req.params;
      const { limit = 50, offset = 0, team_id, role } = req.query;

      const members = await this.workspaceService.getMembers(workspaceId, req.user.id, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        teamId: team_id ? parseInt(team_id) : null,
        role
      });

      res.json(members);
    } catch (error) {
      this.logger.error('Get workspace members failed', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        userId: req.user.id
      });
      res.status(400).json({ error: error.message });
    }
  }

  async addWorkspaceMember(req, res) {
    try {
      const { workspaceId } = req.params;
      const { userId, role = 'member', teamId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const membership = await this.workspaceService.addMember(
        workspaceId,
        userId,
        req.user.id,
        role,
        teamId
      );

      res.status(201).json(membership);
    } catch (error) {
      this.logger.error('Add workspace member failed', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        userId: req.user.id,
        targetUserId: req.body.userId
      });
      res.status(400).json({ error: error.message });
    }
  }

  async removeWorkspaceMember(req, res) {
    try {
      const { workspaceId, userId } = req.params;
      await this.workspaceService.removeMember(workspaceId, userId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      this.logger.error('Remove workspace member failed', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        userId: req.user.id,
        targetUserId: req.params.userId
      });
      res.status(400).json({ error: error.message });
    }
  }

  async updateMemberRole(req, res) {
    try {
      const { workspaceId, userId } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ error: 'Role is required' });
      }

      const membership = await this.workspaceService.updateMemberRole(
        workspaceId,
        userId,
        role,
        req.user.id
      );

      res.json(membership);
    } catch (error) {
      this.logger.error('Update member role failed', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        userId: req.user.id,
        targetUserId: req.params.userId
      });
      res.status(400).json({ error: error.message });
    }
  }

  // Team Management
  async createTeam(req, res) {
    try {
      const { workspaceId } = req.params;
      const { name, description, color } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Team name is required' });
      }

      const team = await this.teamService.createTeam({
        workspaceId,
        name,
        description,
        color,
        createdBy: req.user.id
      });

      res.status(201).json(team);
    } catch (error) {
      this.logger.error('Create team failed', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        userId: req.user.id
      });
      res.status(400).json({ error: error.message });
    }
  }

  async getWorkspaceTeams(req, res) {
    try {
      const { workspaceId } = req.params;
      const teams = await this.teamService.getWorkspaceTeams(workspaceId, req.user.id);
      res.json(teams);
    } catch (error) {
      this.logger.error('Get workspace teams failed', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        userId: req.user.id
      });
      res.status(400).json({ error: error.message });
    }
  }

  async getTeam(req, res) {
    try {
      const { teamId } = req.params;
      const team = await this.teamService.getTeam(teamId, req.user.id);
      res.json(team);
    } catch (error) {
      this.logger.error('Get team failed', {
        error: error.message,
        teamId: req.params.teamId,
        userId: req.user.id
      });
      res.status(404).json({ error: error.message });
    }
  }

  async updateTeam(req, res) {
    try {
      const { teamId } = req.params;
      const updates = req.body;

      const team = await this.teamService.updateTeam(teamId, updates, req.user.id);
      res.json(team);
    } catch (error) {
      this.logger.error('Update team failed', {
        error: error.message,
        teamId: req.params.teamId,
        userId: req.user.id
      });
      res.status(400).json({ error: error.message });
    }
  }

  async deleteTeam(req, res) {
    try {
      const { teamId } = req.params;
      await this.teamService.deleteTeam(teamId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      this.logger.error('Delete team failed', {
        error: error.message,
        teamId: req.params.teamId,
        userId: req.user.id
      });
      res.status(400).json({ error: error.message });
    }
  }

  async searchTeams(req, res) {
    try {
      const { workspaceId } = req.params;
      const { q: query } = req.query;

      if (!query || query.trim().length < 2) {
        return res.json([]);
      }

      const teams = await this.teamService.searchTeams(workspaceId, query.trim(), req.user.id);
      res.json(teams);
    } catch (error) {
      this.logger.error('Search teams failed', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        userId: req.user.id
      });
      res.status(500).json({ error: 'Search failed' });
    }
  }

  // Team Member Management
  async getTeamMembers(req, res) {
    try {
      const { teamId } = req.params;
      const members = await this.teamService.getTeamMembers(teamId, req.user.id);
      res.json(members);
    } catch (error) {
      this.logger.error('Get team members failed', {
        error: error.message,
        teamId: req.params.teamId,
        userId: req.user.id
      });
      res.status(400).json({ error: error.message });
    }
  }

  async addTeamMember(req, res) {
    try {
      const { teamId, userId } = req.params;
      const membership = await this.teamService.addMemberToTeam(teamId, userId, req.user.id);
      res.json(membership);
    } catch (error) {
      this.logger.error('Add team member failed', {
        error: error.message,
        teamId: req.params.teamId,
        userId: req.user.id,
        targetUserId: req.params.userId
      });
      res.status(400).json({ error: error.message });
    }
  }

  async removeTeamMember(req, res) {
    try {
      const { teamId, userId } = req.params;
      await this.teamService.removeMemberFromTeam(teamId, userId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      this.logger.error('Remove team member failed', {
        error: error.message,
        teamId: req.params.teamId,
        userId: req.user.id,
        targetUserId: req.params.userId
      });
      res.status(400).json({ error: error.message });
    }
  }

  async getUserTeams(req, res) {
    try {
      const teams = await this.teamService.getUserTeams(req.user.id);
      res.json(teams);
    } catch (error) {
      this.logger.error('Get user teams failed', {
        error: error.message,
        userId: req.user.id
      });
      res.status(500).json({ error: 'Failed to fetch teams' });
    }
  }

  // Permission Management
  async getUserRoles(req, res) {
    try {
      const { userId } = req.params;

      // Check if user can view roles (admin permission or viewing own roles)
      if (userId !== req.user.id.toString()) {
        const canManage = await this.permissionService.hasPermission(req.user.id, 'user.manage');
        if (!canManage) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
      }

      const roles = await this.permissionService.getAllUserRoles(parseInt(userId));
      res.json(roles);
    } catch (error) {
      this.logger.error('Get user roles failed', {
        error: error.message,
        userId: req.user.id,
        targetUserId: req.params.userId
      });
      res.status(500).json({ error: 'Failed to fetch roles' });
    }
  }

  async grantRole(req, res) {
    try {
      const { userId } = req.params;
      const { role, scope, scopeId, expiresAt } = req.body;

      if (!role || !scope) {
        return res.status(400).json({ error: 'Role and scope are required' });
      }

      const granted = await this.permissionService.grantRole(
        parseInt(userId),
        role,
        scope,
        scopeId,
        req.user.id,
        expiresAt
      );

      res.json(granted);
    } catch (error) {
      this.logger.error('Grant role failed', {
        error: error.message,
        userId: req.user.id,
        targetUserId: req.params.userId
      });
      res.status(400).json({ error: error.message });
    }
  }

  async revokeRole(req, res) {
    try {
      const { userId } = req.params;
      const { role, scope, scopeId } = req.body;

      if (!role || !scope) {
        return res.status(400).json({ error: 'Role and scope are required' });
      }

      await this.permissionService.revokeRole(
        parseInt(userId),
        role,
        scope,
        scopeId,
        req.user.id
      );

      res.json({ success: true });
    } catch (error) {
      this.logger.error('Revoke role failed', {
        error: error.message,
        userId: req.user.id,
        targetUserId: req.params.userId
      });
      res.status(400).json({ error: error.message });
    }
  }

  async getUserPermissions(req, res) {
    try {
      const { userId } = req.params;
      const { workspaceId, organizationId, channelId } = req.query;

      // Check if user can view permissions
      if (userId !== req.user.id.toString()) {
        const canManage = await this.permissionService.hasPermission(req.user.id, 'user.manage');
        if (!canManage) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
      }

      const context = {
        workspaceId: workspaceId ? parseInt(workspaceId) : null,
        organizationId: organizationId ? parseInt(organizationId) : null,
        channelId: channelId ? parseInt(channelId) : null
      };

      const permissions = await this.permissionService.getUserPermissions(parseInt(userId), context);
      res.json({ permissions });
    } catch (error) {
      this.logger.error('Get user permissions failed', {
        error: error.message,
        userId: req.user.id,
        targetUserId: req.params.userId
      });
      res.status(500).json({ error: 'Failed to fetch permissions' });
    }
  }

  async checkPermission(req, res) {
    try {
      const { permission, context = {} } = req.body;

      if (!permission) {
        return res.status(400).json({ error: 'Permission is required' });
      }

      const hasPermission = await this.permissionService.hasPermission(
        req.user.id,
        permission,
        context
      );

      res.json({ hasPermission });
    } catch (error) {
      this.logger.error('Check permission failed', {
        error: error.message,
        userId: req.user.id,
        permission: req.body.permission
      });
      res.status(500).json({ error: 'Permission check failed' });
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = EnterpriseRoutes;