const express = require('express');
const CorporateService = require('./service');
const AuthService = require('../auth/service');
const Logger = require('../utils/enhanced-logger');
const logger = new Logger('CorporateActivity');

class CorporateRoutes {
  constructor() {
    this.router = express.Router();
    this.corporateService = new CorporateService();
    this.authService = new AuthService();
    this.setupRoutes();
  }

  getRouter() {
    return this.router;
  }

  setupRoutes() {
    // Apply authentication middleware to all routes
    this.router.use(this.authenticate.bind(this));

    // Organization Management
    this.router.post('/organizations', this.createOrganization.bind(this));
    this.router.get('/organizations/:orgId', this.getOrganization.bind(this));
    this.router.get('/organizations/:orgId/workspaces', this.getOrganizationWorkspaces.bind(this));

    // Workspace Management
    this.router.post('/workspaces', this.createWorkspace.bind(this));
    this.router.get('/workspaces/my', this.getUserWorkspaces.bind(this));
    this.router.get('/workspaces/:workspaceId', this.getWorkspace.bind(this));
    this.router.get('/workspaces/:workspaceId/channels', this.getWorkspaceChannels.bind(this));
    this.router.get('/workspaces/:workspaceId/members', this.getWorkspaceMembers.bind(this));

    // Channel Management
    this.router.post('/workspaces/:workspaceId/channels', this.createChannel.bind(this));

    // Team Management
    this.router.post('/workspaces/:workspaceId/teams', this.createTeam.bind(this));
    this.router.get('/workspaces/:workspaceId/teams', this.getWorkspaceTeams.bind(this));

    // Member Management
    this.router.post('/workspaces/:workspaceId/members', this.addWorkspaceMember.bind(this));
    this.router.delete('/workspaces/:workspaceId/members/:userId', this.removeWorkspaceMember.bind(this));

    // Advanced User Search
    this.router.get('/search/users', this.searchUsers.bind(this));

    // Role Management
    this.router.post('/users/:userId/roles', this.assignUserRole.bind(this));
    this.router.get('/users/:userId/roles', this.getUserRoles.bind(this));

    // Activity Logs (for admins)
    this.router.get('/activity', this.getActivityLogs.bind(this));
    this.router.get('/activity/stats', this.getActivityStats.bind(this));
  }

  async authenticate(req, res, next) {
    try {
      const token = req.headers['authorization']?.split(' ')[1];
      const user = await this.authService.authenticate(token);
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ error: error.message });
    }
  }

  async createOrganization(req, res) {
    try {
      const { name, slug, description, logoUrl, settings } = req.body;
      const userId = req.user.id;

      if (!name || !slug) {
        return res.status(400).json({ error: 'Name and slug are required' });
      }

      const organization = await this.corporateService.createOrganization({
        name,
        slug,
        description,
        logoUrl,
        createdBy: userId,
        settings
      });

      logger.info('Organization created', {
        userId,
        action: 'organization.created',
        resourceType: 'organization',
        resourceId: organization.id,
        organizationName: name
      });

      res.json({
        success: true,
        organization
      });
    } catch (error) {
      console.error('Create organization error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async getOrganization(req, res) {
    try {
      const { orgId } = req.params;
      const userId = req.user.id;

      const organization = await this.corporateService.getOrganization(parseInt(orgId));

      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      logger.info('Organization viewed', {
        userId,
        action: 'organization.viewed',
        resourceType: 'organization',
        resourceId: organization.id
      });

      res.json({
        success: true,
        organization
      });
    } catch (error) {
      console.error('Get organization error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getOrganizationWorkspaces(req, res) {
    try {
      const { orgId } = req.params;
      const userId = req.user.id;

      const workspaces = await this.corporateService.getWorkspacesByOrganization(parseInt(orgId));

      res.json({
        success: true,
        workspaces
      });
    } catch (error) {
      console.error('Get organization workspaces error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async createWorkspace(req, res) {
    try {
      const { organizationId, name, slug, description, isPublic, settings } = req.body;
      const userId = req.user.id;

      if (!organizationId || !name || !slug) {
        return res.status(400).json({ error: 'Organization ID, name, and slug are required' });
      }

      const workspace = await this.corporateService.createWorkspace({
        organizationId: parseInt(organizationId),
        name,
        slug,
        description,
        isPublic: isPublic || false,
        createdBy: userId,
        settings
      });

      logger.info('Workspace created', {
        userId,
        workspaceId: workspace.id,
        action: 'workspace.created',
        workspaceName: name,
        organizationId
      });

      res.json({
        success: true,
        workspace
      });
    } catch (error) {
      console.error('Create workspace error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async getUserWorkspaces(req, res) {
    try {
      const userId = req.user.id;

      const workspaces = await this.corporateService.getUserWorkspaces(userId);

      res.json({
        success: true,
        workspaces
      });
    } catch (error) {
      console.error('Get user workspaces error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getWorkspace(req, res) {
    try {
      const { workspaceId } = req.params;
      const userId = req.user.id;

      // Check if user is workspace member
      const members = await this.corporateService.getWorkspaceMembers(parseInt(workspaceId));
      const isMember = members.some(member => member.user_id === userId);

      if (!isMember) {
        return res.status(403).json({ error: 'Access denied: Not a workspace member' });
      }

      const workspace = await this.corporateService.getWorkspace(parseInt(workspaceId));

      res.json({
        success: true,
        workspace
      });
    } catch (error) {
      console.error('Get workspace error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getWorkspaceChannels(req, res) {
    try {
      const { workspaceId } = req.params;
      const userId = req.user.id;

      const channels = await this.corporateService.getWorkspaceChannels(parseInt(workspaceId), userId);

      res.json({
        success: true,
        channels
      });
    } catch (error) {
      console.error('Get workspace channels error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getWorkspaceMembers(req, res) {
    try {
      const { workspaceId } = req.params;
      const { includeInactive } = req.query;
      const userId = req.user.id;

      const members = await this.corporateService.getWorkspaceMembers(
        parseInt(workspaceId),
        includeInactive === 'true'
      );

      res.json({
        success: true,
        members
      });
    } catch (error) {
      console.error('Get workspace members error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async createChannel(req, res) {
    try {
      const { workspaceId } = req.params;
      const { name, description, channelType, isPrivate, settings } = req.body;
      const userId = req.user.id;

      if (!name) {
        return res.status(400).json({ error: 'Channel name is required' });
      }

      const channel = await this.corporateService.createChannel({
        workspaceId: parseInt(workspaceId),
        name,
        description,
        channelType: channelType || 'channel',
        isPrivate: isPrivate || false,
        createdBy: userId,
        settings
      });

      logger.info('Channel created', {
        userId,
        workspaceId: parseInt(workspaceId),
        action: 'channel.created',
        channelName: name,
        channelId: channel.id
      });

      res.json({
        success: true,
        channel
      });
    } catch (error) {
      console.error('Create channel error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async createTeam(req, res) {
    try {
      const { workspaceId } = req.params;
      const { name, description, color, settings } = req.body;
      const userId = req.user.id;

      if (!name) {
        return res.status(400).json({ error: 'Team name is required' });
      }

      const team = await this.corporateService.createTeam({
        workspaceId: parseInt(workspaceId),
        name,
        description,
        color: color || '#6366f1',
        createdBy: userId,
        settings
      });

      res.json({
        success: true,
        team
      });
    } catch (error) {
      console.error('Create team error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async getWorkspaceTeams(req, res) {
    try {
      const { workspaceId } = req.params;

      const teams = await this.corporateService.getWorkspaceTeams(parseInt(workspaceId));

      res.json({
        success: true,
        teams
      });
    } catch (error) {
      console.error('Get workspace teams error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async addWorkspaceMember(req, res) {
    try {
      const { workspaceId } = req.params;
      const { userId: newUserId, role, teamId } = req.body;
      const userId = req.user.id;

      if (!newUserId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const member = await this.corporateService.addWorkspaceMember({
        workspaceId: parseInt(workspaceId),
        userId: parseInt(newUserId),
        role: role || 'member',
        teamId: teamId ? parseInt(teamId) : null,
        invitedBy: userId
      });

      res.json({
        success: true,
        member
      });
    } catch (error) {
      console.error('Add workspace member error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async removeWorkspaceMember(req, res) {
    try {
      const { workspaceId, userId: targetUserId } = req.params;
      const userId = req.user.id;

      await this.corporateService.removeWorkspaceMember({
        workspaceId: parseInt(workspaceId),
        userId: parseInt(targetUserId),
        removedBy: userId
      });

      res.json({
        success: true,
        message: 'Member removed successfully'
      });
    } catch (error) {
      console.error('Remove workspace member error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async searchUsers(req, res) {
    try {
      const { q: query, workspaceId, organizationId, limit, includeInactive } = req.query;
      const userId = req.user.id;

      if (!query || query.length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters' });
      }

      const options = {
        workspaceId: workspaceId ? parseInt(workspaceId) : null,
        organizationId: organizationId ? parseInt(organizationId) : null,
        limit: limit ? parseInt(limit) : 20,
        includeInactive: includeInactive === 'true'
      };

      const users = await this.corporateService.searchUsers(query, options);

      logger.info('User search performed', {
        userId,
        action: 'search.users',
        query,
        options
      });

      res.json({
        success: true,
        users
      });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async assignUserRole(req, res) {
    try {
      const { userId: targetUserId } = req.params;
      const { role, scope, scopeId, expiresAt } = req.body;
      const userId = req.user.id;

      if (!role || !scope) {
        return res.status(400).json({ error: 'Role and scope are required' });
      }

      const userRole = await this.corporateService.assignUserRole({
        userId: parseInt(targetUserId),
        role,
        scope,
        scopeId: scopeId ? parseInt(scopeId) : null,
        grantedBy: userId,
        expiresAt
      });

      res.json({
        success: true,
        userRole
      });
    } catch (error) {
      console.error('Assign user role error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async getUserRoles(req, res) {
    try {
      const { userId: targetUserId } = req.params;
      const { scope } = req.query;

      const roles = await this.corporateService.getUserRoles(
        parseInt(targetUserId),
        scope
      );

      res.json({
        success: true,
        roles
      });
    } catch (error) {
      console.error('Get user roles error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getActivityLogs(req, res) {
    try {
      const {
        userId: filterUserId,
        workspaceId,
        action,
        resourceType,
        startDate,
        endDate,
        limit,
        offset
      } = req.query;

      const filters = {
        userId: filterUserId ? parseInt(filterUserId) : null,
        workspaceId: workspaceId ? parseInt(workspaceId) : null,
        action,
        resourceType,
        startDate,
        endDate,
        limit: limit ? parseInt(limit) : 100,
        offset: offset ? parseInt(offset) : 0
      };

      // For now, return empty logs array - in production this would query audit_logs table
      const logs = [];

      res.json({
        success: true,
        logs,
        message: 'Activity logs feature available in production mode'
      });
    } catch (error) {
      console.error('Get activity logs error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getActivityStats(req, res) {
    try {
      const { workspaceId, timeframe } = req.query;

      // For now, return mock stats - in production this would query analytics
      const stats = {
        timeframe: timeframe || '24h',
        totalActions: 0,
        topActions: [],
        activeUsers: 0,
        message: 'Activity statistics available in production mode'
      };

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Get activity stats error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = CorporateRoutes;