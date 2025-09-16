const database = require('../database/optimized-connection');
const Logger = require('../utils/enhanced-logger');

class PermissionService {
  constructor() {
    this.logger = new Logger('PermissionService');
    this.useDatabase = database.isConnected;

    // Define role hierarchies and permissions
    this.roleHierarchy = {
      owner: 5,
      admin: 4,
      moderator: 3,
      member: 2,
      guest: 1
    };

    this.permissions = {
      // Organization permissions
      'organization.manage': ['owner'],
      'organization.view': ['owner', 'admin', 'moderator', 'member', 'guest'],
      'organization.invite': ['owner', 'admin'],
      'organization.settings': ['owner', 'admin'],

      // Workspace permissions
      'workspace.create': ['owner', 'admin'],
      'workspace.manage': ['owner', 'admin'],
      'workspace.view': ['owner', 'admin', 'moderator', 'member', 'guest'],
      'workspace.invite': ['owner', 'admin', 'moderator'],
      'workspace.settings': ['owner', 'admin'],

      // Team permissions
      'team.create': ['owner', 'admin', 'moderator'],
      'team.manage': ['owner', 'admin', 'moderator'],
      'team.view': ['owner', 'admin', 'moderator', 'member', 'guest'],
      'team.join': ['owner', 'admin', 'moderator', 'member'],

      // Channel permissions
      'channel.create': ['owner', 'admin', 'moderator', 'member'],
      'channel.manage': ['owner', 'admin', 'moderator'],
      'channel.view': ['owner', 'admin', 'moderator', 'member', 'guest'],
      'channel.join': ['owner', 'admin', 'moderator', 'member'],
      'channel.leave': ['owner', 'admin', 'moderator', 'member', 'guest'],

      // Message permissions
      'message.send': ['owner', 'admin', 'moderator', 'member'],
      'message.edit': ['owner', 'admin', 'moderator', 'member'], // Own messages
      'message.delete': ['owner', 'admin', 'moderator'], // Any message
      'message.delete.own': ['owner', 'admin', 'moderator', 'member'],
      'message.pin': ['owner', 'admin', 'moderator'],

      // User management permissions
      'user.manage': ['owner', 'admin'],
      'user.ban': ['owner', 'admin', 'moderator'],
      'user.kick': ['owner', 'admin', 'moderator'],
      'user.mute': ['owner', 'admin', 'moderator'],

      // AI permissions
      'ai.use': ['owner', 'admin', 'moderator', 'member'],
      'ai.manage': ['owner', 'admin'],
      'ai.agents': ['owner', 'admin', 'moderator']
    };
  }

  /**
   * Check if user has permission for a specific action
   */
  async hasPermission(userId, permission, context = {}) {
    if (!this.useDatabase) {
      return true; // Allow everything in development mode
    }

    try {
      const { workspaceId, organizationId, channelId, resourceOwnerId } = context;

      // Get user's roles in the relevant contexts
      const userRoles = await this.getUserRoles(userId, {
        workspaceId,
        organizationId,
        channelId
      });

      // Check if user has the required permission
      return this.checkPermission(permission, userRoles, { resourceOwnerId, userId });
    } catch (error) {
      this.logger.error('Permission check failed', {
        error: error.message,
        userId,
        permission,
        context
      });
      return false;
    }
  }

  /**
   * Get all roles for a user in various contexts
   */
  async getUserRoles(userId, context = {}) {
    const { workspaceId, organizationId, channelId } = context;
    const roles = [];

    try {
      // Global system roles
      const systemRoles = await this.getSystemRoles(userId);
      roles.push(...systemRoles);

      // Organization roles
      if (organizationId) {
        const orgRoles = await this.getOrganizationRoles(userId, organizationId);
        roles.push(...orgRoles);
      }

      // Workspace roles
      if (workspaceId) {
        const workspaceRoles = await this.getWorkspaceRoles(userId, workspaceId);
        roles.push(...workspaceRoles);
      }

      // Channel roles
      if (channelId) {
        const channelRoles = await this.getChannelRoles(userId, channelId);
        roles.push(...channelRoles);
      }

      return roles;
    } catch (error) {
      this.logger.error('Failed to get user roles', {
        error: error.message,
        userId,
        context
      });
      return [];
    }
  }

  /**
   * Check permission based on roles
   */
  checkPermission(permission, userRoles, context = {}) {
    const { resourceOwnerId, userId } = context;

    // System admin can do anything
    if (userRoles.some(role => role.role === 'superadmin')) {
      return true;
    }

    // Special case: user can edit/delete their own content
    if (permission.includes('.own') && resourceOwnerId === userId) {
      const basePermission = permission.replace('.own', '');
      const requiredRoles = this.permissions[permission] || this.permissions[basePermission];
      if (requiredRoles) {
        return userRoles.some(role => requiredRoles.includes(role.role));
      }
    }

    // Check if any user role has the required permission
    const requiredRoles = this.permissions[permission];
    if (!requiredRoles) {
      this.logger.warn('Unknown permission requested', { permission });
      return false;
    }

    return userRoles.some(role => requiredRoles.includes(role.role));
  }

  /**
   * Get system-level roles for a user
   */
  async getSystemRoles(userId) {
    try {
      const result = await database.query(`
        SELECT 'superadmin' as role, 'system' as scope, NULL as scope_id
        FROM users
        WHERE id = $1 AND is_superadmin = true
      `, [userId]);

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get system roles', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Get organization roles for a user
   */
  async getOrganizationRoles(userId, organizationId) {
    try {
      const result = await database.query(`
        SELECT
          ur.role,
          'organization' as scope,
          ur.scope_id
        FROM user_roles ur
        WHERE ur.user_id = $1
          AND ur.scope = 'organization'
          AND ur.scope_id = $2
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      `, [userId, organizationId]);

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get organization roles', {
        error: error.message,
        userId,
        organizationId
      });
      return [];
    }
  }

  /**
   * Get workspace roles for a user
   */
  async getWorkspaceRoles(userId, workspaceId) {
    try {
      const result = await database.query(`
        SELECT
          wm.role,
          'workspace' as scope,
          wm.workspace_id as scope_id
        FROM workspace_members wm
        WHERE wm.user_id = $1
          AND wm.workspace_id = $2
          AND wm.status = 'active'
      `, [userId, workspaceId]);

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get workspace roles', {
        error: error.message,
        userId,
        workspaceId
      });
      return [];
    }
  }

  /**
   * Get channel roles for a user
   */
  async getChannelRoles(userId, channelId) {
    try {
      const result = await database.query(`
        SELECT
          cm.role,
          'channel' as scope,
          cm.channel_id as scope_id
        FROM channel_members cm
        WHERE cm.user_id = $1
          AND cm.channel_id = $2
      `, [userId, channelId]);

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get channel roles', {
        error: error.message,
        userId,
        channelId
      });
      return [];
    }
  }

  /**
   * Grant role to user
   */
  async grantRole(userId, role, scope, scopeId, grantedBy, expiresAt = null) {
    if (!this.useDatabase) {
      throw new Error('Database required');
    }

    try {
      // Check if granter has permission to grant this role
      const canGrant = await this.hasPermission(grantedBy, 'user.manage', {
        workspaceId: scope === 'workspace' ? scopeId : null,
        organizationId: scope === 'organization' ? scopeId : null
      });

      if (!canGrant) {
        throw new Error('Insufficient permissions to grant roles');
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

      this.logger.info('Role granted', {
        userId,
        role,
        scope,
        scopeId,
        grantedBy
      });

      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to grant role', {
        error: error.message,
        userId,
        role,
        scope,
        scopeId,
        grantedBy
      });
      throw error;
    }
  }

  /**
   * Revoke role from user
   */
  async revokeRole(userId, role, scope, scopeId, revokedBy) {
    if (!this.useDatabase) {
      throw new Error('Database required');
    }

    try {
      // Check if revoker has permission
      const canRevoke = await this.hasPermission(revokedBy, 'user.manage', {
        workspaceId: scope === 'workspace' ? scopeId : null,
        organizationId: scope === 'organization' ? scopeId : null
      });

      if (!canRevoke) {
        throw new Error('Insufficient permissions to revoke roles');
      }

      const result = await database.query(`
        DELETE FROM user_roles
        WHERE user_id = $1 AND role = $2 AND scope = $3 AND scope_id = $4
        RETURNING *
      `, [userId, role, scope, scopeId]);

      if (result.rows.length === 0) {
        throw new Error('Role not found');
      }

      this.logger.info('Role revoked', {
        userId,
        role,
        scope,
        scopeId,
        revokedBy
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to revoke role', {
        error: error.message,
        userId,
        role,
        scope,
        scopeId,
        revokedBy
      });
      throw error;
    }
  }

  /**
   * Get all roles for a user
   */
  async getAllUserRoles(userId) {
    if (!this.useDatabase) {
      return [];
    }

    try {
      const result = await database.query(`
        SELECT
          ur.*,
          CASE
            WHEN ur.scope = 'organization' THEN o.name
            WHEN ur.scope = 'workspace' THEN w.name
            WHEN ur.scope = 'channel' THEN c.name
            ELSE 'System'
          END as scope_name
        FROM user_roles ur
        LEFT JOIN organizations o ON ur.scope = 'organization' AND ur.scope_id = o.id
        LEFT JOIN workspaces w ON ur.scope = 'workspace' AND ur.scope_id = w.id
        LEFT JOIN channels c ON ur.scope = 'channel' AND ur.scope_id = c.id
        WHERE ur.user_id = $1
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        ORDER BY ur.granted_at DESC
      `, [userId]);

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get user roles', {
        error: error.message,
        userId
      });
      return [];
    }
  }

  /**
   * Check if user can access workspace
   */
  async canAccessWorkspace(userId, workspaceId) {
    return await this.hasPermission(userId, 'workspace.view', { workspaceId });
  }

  /**
   * Check if user can access channel
   */
  async canAccessChannel(userId, channelId) {
    if (!this.useDatabase) {
      return true;
    }

    try {
      // Get channel info
      const channelResult = await database.query(`
        SELECT workspace_id, type, is_private FROM channels WHERE id = $1
      `, [channelId]);

      if (channelResult.rows.length === 0) {
        return false;
      }

      const channel = channelResult.rows[0];

      // Check workspace access first
      const hasWorkspaceAccess = await this.canAccessWorkspace(userId, channel.workspace_id);
      if (!hasWorkspaceAccess) {
        return false;
      }

      // For public channels, workspace access is enough
      if (channel.type === 'public' && !channel.is_private) {
        return true;
      }

      // For private channels, need explicit membership
      const memberResult = await database.query(`
        SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2
      `, [channelId, userId]);

      return memberResult.rows.length > 0;
    } catch (error) {
      this.logger.error('Failed to check channel access', {
        error: error.message,
        userId,
        channelId
      });
      return false;
    }
  }

  /**
   * Get user permissions for a context
   */
  async getUserPermissions(userId, context = {}) {
    try {
      const userRoles = await this.getUserRoles(userId, context);
      const userPermissions = new Set();

      // Add all permissions for user's roles
      for (const roleData of userRoles) {
        for (const [permission, allowedRoles] of Object.entries(this.permissions)) {
          if (allowedRoles.includes(roleData.role)) {
            userPermissions.add(permission);
          }
        }
      }

      return Array.from(userPermissions);
    } catch (error) {
      this.logger.error('Failed to get user permissions', {
        error: error.message,
        userId,
        context
      });
      return [];
    }
  }

  /**
   * Create permission middleware for Express routes
   */
  createPermissionMiddleware(requiredPermission, contextBuilder = null) {
    return async (req, res, next) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        // Build context from request
        let context = {};
        if (contextBuilder) {
          context = contextBuilder(req);
        } else {
          // Default context building
          context = {
            workspaceId: req.params.workspaceId || req.body.workspaceId,
            organizationId: req.params.organizationId || req.body.organizationId,
            channelId: req.params.channelId || req.body.channelId
          };
        }

        const hasPermission = await this.hasPermission(userId, requiredPermission, context);

        if (!hasPermission) {
          this.logger.warn('Permission denied', {
            userId,
            permission: requiredPermission,
            context,
            path: req.path
          });
          return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
      } catch (error) {
        this.logger.error('Permission middleware error', {
          error: error.message,
          path: req.path
        });
        res.status(500).json({ error: 'Permission check failed' });
      }
    };
  }

  /**
   * Get role hierarchy level
   */
  getRoleLevel(role) {
    return this.roleHierarchy[role] || 0;
  }

  /**
   * Check if one role is higher than another
   */
  isRoleHigher(role1, role2) {
    return this.getRoleLevel(role1) > this.getRoleLevel(role2);
  }
}

module.exports = PermissionService;