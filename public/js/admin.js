// Admin Panel JavaScript
class AdminPanel {
  constructor() {
    this.currentUser = null;
    this.currentSection = 'dashboard';
    this.init();
  }

  async init() {
    await this.checkAuthentication();
    this.loadDashboardData();
    this.setupEventListeners();
  }

  async checkAuthentication() {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/';
      return;
    }

    try {
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!data.success || data.user.role !== 'superadmin') {
        alert('Access denied. Superadmin privileges required.');
        window.location.href = '/messenger.html';
        return;
      }

      this.currentUser = data.user;
      this.updateUserInfo();
    } catch (error) {
      console.error('Auth check failed:', error);
      window.location.href = '/';
    }
  }

  updateUserInfo() {
    if (this.currentUser) {
      document.getElementById('userName').textContent = this.currentUser.nickname;
      document.getElementById('userAvatar').textContent = this.currentUser.nickname.charAt(0).toUpperCase();
    }
  }

  setupEventListeners() {
    // Auth type change for agent modal
    document.getElementById('agentAuthType').addEventListener('change', (e) => {
      const authTokenGroup = document.getElementById('authTokenGroup');
      if (e.target.value === 'none') {
        authTokenGroup.style.display = 'none';
      } else {
        authTokenGroup.style.display = 'block';
      }
    });

    // Modal click outside to close
    document.getElementById('addAgentModal').addEventListener('click', (e) => {
      if (e.target.id === 'addAgentModal') {
        this.hideAddAgentModal();
      }
    });
  }

  async loadDashboardData() {
    try {
      await Promise.all([
        this.loadStats(),
        this.loadRecentActivity()
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  }

  async loadStats() {
    try {
      const [usersResponse, agentsResponse, orgsResponse, activityResponse] = await Promise.all([
        this.makeRequest('/api/auth/users/count'),
        this.makeRequest('/api/ai/agents'),
        this.makeRequest('/api/corporate/organizations/count'),
        this.makeRequest('/api/corporate/activity/stats?timeframe=24h')
      ]);

      document.getElementById('totalUsers').textContent = usersResponse.count || '0';
      document.getElementById('activeAgents').textContent = agentsResponse.agents?.filter(a => a.status === 'active').length || '0';
      document.getElementById('totalOrganizations').textContent = orgsResponse.count || '0';
      document.getElementById('todayMessages').textContent = activityResponse.stats?.find(s => s.action.includes('message'))?.count || '0';
    } catch (error) {
      console.error('Failed to load stats:', error);
      // Set default values
      document.getElementById('totalUsers').textContent = '0';
      document.getElementById('activeAgents').textContent = '0';
      document.getElementById('totalOrganizations').textContent = '0';
      document.getElementById('todayMessages').textContent = '0';
    }
  }

  async loadRecentActivity() {
    try {
      const response = await this.makeRequest('/api/corporate/activity?limit=10');
      const tbody = document.getElementById('recentActivityTable');

      if (!response.logs || response.logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #64748b;">No recent activity found</td></tr>';
        return;
      }

      tbody.innerHTML = response.logs.map(log => `
        <tr>
          <td>${log.nickname || 'Unknown'}</td>
          <td><span class="status-badge ${this.getActionClass(log.action)}">${log.action}</span></td>
          <td>${log.resource_type || '-'}</td>
          <td>${new Date(log.created_at).toLocaleString()}</td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Failed to load recent activity:', error);
      document.getElementById('recentActivityTable').innerHTML =
        '<tr><td colspan="4" style="text-align: center; color: #ef4444;">Failed to load activity</td></tr>';
    }
  }

  async loadAIAgents() {
    try {
      const response = await this.makeRequest('/api/ai/agents?includeInactive=true');
      const tbody = document.getElementById('agentsTable');

      if (!response.agents || response.agents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">No AI agents found</td></tr>';
        return;
      }

      tbody.innerHTML = response.agents.map(agent => `
        <tr>
          <td>
            <strong>${agent.name}</strong>
            ${agent.description ? `<br><small style="color: #64748b;">${agent.description}</small>` : ''}
          </td>
          <td><code>${agent.endpoint}</code></td>
          <td><span class="status-badge status-${agent.status}">${agent.status}</span></td>
          <td>${new Date(agent.created_at).toLocaleDateString()}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="adminPanel.testAgent(${agent.id})" style="margin-right: 8px;">
              <i class="fas fa-vial"></i> Test
            </button>
            <button class="btn btn-secondary btn-sm" onclick="adminPanel.toggleAgentStatus(${agent.id}, '${agent.status}')" style="margin-right: 8px;">
              <i class="fas fa-power-off"></i> ${agent.status === 'active' ? 'Disable' : 'Enable'}
            </button>
            <button class="btn btn-danger btn-sm" onclick="adminPanel.deleteAgent(${agent.id})">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Failed to load AI agents:', error);
      document.getElementById('agentsTable').innerHTML =
        '<tr><td colspan="5" style="text-align: center; color: #ef4444;">Failed to load agents</td></tr>';
    }
  }

  async loadOrganizations() {
    try {
      const response = await this.makeRequest('/api/corporate/organizations');
      const tbody = document.getElementById('organizationsTable');

      if (!response.organizations || response.organizations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b;">No organizations found</td></tr>';
        return;
      }

      tbody.innerHTML = response.organizations.map(org => `
        <tr>
          <td>
            <strong>${org.name}</strong>
            ${org.description ? `<br><small style="color: #64748b;">${org.description}</small>` : ''}
          </td>
          <td><code>${org.slug}</code></td>
          <td>${org.workspace_count || 0}</td>
          <td>${org.member_count || 0}</td>
          <td>${new Date(org.created_at).toLocaleDateString()}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="adminPanel.viewOrganization(${org.id})" style="margin-right: 8px;">
              <i class="fas fa-eye"></i> View
            </button>
            <button class="btn btn-danger btn-sm" onclick="adminPanel.deleteOrganization(${org.id})">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Failed to load organizations:', error);
      document.getElementById('organizationsTable').innerHTML =
        '<tr><td colspan="6" style="text-align: center; color: #ef4444;">Failed to load organizations</td></tr>';
    }
  }

  async loadUsers() {
    try {
      const response = await this.makeRequest('/api/corporate/search/users?q=&limit=100');
      const tbody = document.getElementById('usersTable');

      if (!response.users || response.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b;">No users found</td></tr>';
        return;
      }

      tbody.innerHTML = response.users.map(user => `
        <tr>
          <td>
            <strong>${user.nickname}</strong>
            ${user.department ? `<br><small style="color: #64748b;">${user.department}</small>` : ''}
          </td>
          <td>${user.full_name || '-'}</td>
          <td><span class="status-badge status-${user.role || 'user'}">${user.role || 'user'}</span></td>
          <td><span class="status-badge status-${user.status}">${user.status}</span></td>
          <td>${new Date(user.created_at).toLocaleDateString()}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="adminPanel.editUser(${user.id})" style="margin-right: 8px;">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-danger btn-sm" onclick="adminPanel.suspendUser(${user.id})">
              <i class="fas fa-ban"></i> Suspend
            </button>
          </td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Failed to load users:', error);
      document.getElementById('usersTable').innerHTML =
        '<tr><td colspan="6" style="text-align: center; color: #ef4444;">Failed to load users</td></tr>';
    }
  }

  async loadActivityLogs() {
    try {
      const userFilter = document.getElementById('activityUserFilter').value;
      const actionFilter = document.getElementById('activityActionFilter').value;
      const dateFilter = document.getElementById('activityDateFilter').value;

      const params = new URLSearchParams({
        limit: '50',
        ...(userFilter && { userId: userFilter }),
        ...(actionFilter && { action: actionFilter }),
        ...(dateFilter && { timeframe: dateFilter })
      });

      const response = await this.makeRequest(`/api/corporate/activity?${params}`);
      const tbody = document.getElementById('activityTable');

      if (!response.logs || response.logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">No activity logs found</td></tr>';
        return;
      }

      tbody.innerHTML = response.logs.map(log => `
        <tr>
          <td>${log.nickname || 'Unknown'}</td>
          <td><span class="status-badge ${this.getActionClass(log.action)}">${log.action}</span></td>
          <td>${log.resource_type || '-'}</td>
          <td><code>${log.ip_address || '-'}</code></td>
          <td>${new Date(log.created_at).toLocaleString()}</td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Failed to load activity logs:', error);
      document.getElementById('activityTable').innerHTML =
        '<tr><td colspan="5" style="text-align: center; color: #ef4444;">Failed to load activity logs</td></tr>';
    }
  }

  getActionClass(action) {
    if (action.includes('created') || action.includes('login')) return 'status-active';
    if (action.includes('deleted') || action.includes('error')) return 'status-inactive';
    if (action.includes('updated') || action.includes('modified')) return 'status-maintenance';
    return 'status-active';
  }

  showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.remove('active');
    });

    // Remove active class from nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });

    // Show selected section
    document.getElementById(sectionId).classList.add('active');

    // Add active class to clicked nav link
    event.target.classList.add('active');

    this.currentSection = sectionId;

    // Load section-specific data
    switch (sectionId) {
      case 'dashboard':
        this.loadDashboardData();
        break;
      case 'ai-agents':
        this.loadAIAgents();
        break;
      case 'organizations':
        this.loadOrganizations();
        break;
      case 'users':
        this.loadUsers();
        break;
      case 'activity':
        this.loadActivityLogs();
        break;
    }
  }

  showAddAgentModal() {
    document.getElementById('addAgentModal').classList.add('active');
  }

  hideAddAgentModal() {
    document.getElementById('addAgentModal').classList.remove('active');
    // Reset form
    document.getElementById('agentName').value = '';
    document.getElementById('agentDescription').value = '';
    document.getElementById('agentEndpoint').value = '';
    document.getElementById('agentAuthType').value = 'none';
    document.getElementById('agentAuthToken').value = '';
    document.getElementById('authTokenGroup').style.display = 'none';
  }

  async addAgent() {
    const name = document.getElementById('agentName').value.trim();
    const description = document.getElementById('agentDescription').value.trim();
    const endpoint = document.getElementById('agentEndpoint').value.trim();
    const authType = document.getElementById('agentAuthType').value;
    const authToken = document.getElementById('agentAuthToken').value.trim();

    if (!name || !endpoint) {
      alert('Please fill in required fields (Name and Endpoint)');
      return;
    }

    try {
      const authentication = {};
      if (authType !== 'none' && authToken) {
        authentication.type = authType;
        authentication.token = authToken;
      }

      const response = await this.makeRequest('/api/ai/agents', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          endpoint,
          authentication,
          settings: {}
        })
      });

      if (response.success) {
        alert('AI Agent added successfully!');
        this.hideAddAgentModal();
        this.loadAIAgents();
      } else {
        alert('Failed to add agent: ' + response.error);
      }
    } catch (error) {
      console.error('Failed to add agent:', error);
      alert('Failed to add agent. Please try again.');
    }
  }

  async testAgent(agentId) {
    try {
      const response = await this.makeRequest(`/api/ai/agents/${agentId}/call`, {
        method: 'POST',
        body: JSON.stringify({
          message: 'Test connection',
          context: [],
          parameters: {}
        })
      });

      if (response.success) {
        alert('Agent test successful!\n\nResponse: ' + JSON.stringify(response.response, null, 2));
      } else {
        alert('Agent test failed: ' + response.error);
      }
    } catch (error) {
      console.error('Agent test failed:', error);
      alert('Agent test failed. Please check the endpoint and authentication.');
    }
  }

  async toggleAgentStatus(agentId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    try {
      const response = await this.makeRequest(`/api/ai/agents/${agentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus
        })
      });

      if (response.success) {
        alert(`Agent ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully!`);
        this.loadAIAgents();
      } else {
        alert('Failed to update agent status: ' + response.error);
      }
    } catch (error) {
      console.error('Failed to update agent status:', error);
      alert('Failed to update agent status. Please try again.');
    }
  }

  async deleteAgent(agentId) {
    if (!confirm('Are you sure you want to delete this AI agent? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await this.makeRequest(`/api/ai/agents/${agentId}`, {
        method: 'DELETE'
      });

      if (response.success) {
        alert('Agent deleted successfully!');
        this.loadAIAgents();
      } else {
        alert('Failed to delete agent: ' + response.error);
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
      alert('Failed to delete agent. Please try again.');
    }
  }

  async viewOrganization(orgId) {
    // This would open a detailed view of the organization
    alert(`View organization ${orgId} - Feature to be implemented`);
  }

  async deleteOrganization(orgId) {
    if (!confirm('Are you sure you want to delete this organization? This will also delete all associated workspaces and data.')) {
      return;
    }

    alert(`Delete organization ${orgId} - Feature to be implemented`);
  }

  async editUser(userId) {
    alert(`Edit user ${userId} - Feature to be implemented`);
  }

  async suspendUser(userId) {
    if (!confirm('Are you sure you want to suspend this user?')) {
      return;
    }

    alert(`Suspend user ${userId} - Feature to be implemented`);
  }

  async saveSettings() {
    const settings = {
      openaiApiKey: document.getElementById('openaiApiKey').value,
      defaultAiModel: document.getElementById('defaultAiModel').value,
      maxMessageLength: parseInt(document.getElementById('maxMessageLength').value),
      enableRegistration: document.getElementById('enableRegistration').value === 'true'
    };

    try {
      const response = await this.makeRequest('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });

      if (response.success) {
        alert('Settings saved successfully!');
      } else {
        alert('Failed to save settings: ' + response.error);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  }

  async makeRequest(url, options = {}) {
    const token = localStorage.getItem('token');

    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    const response = await fetch(url, { ...defaultOptions, ...options });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  logout() {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.clear();
      window.location.href = '/';
    }
  }
}

// Global functions for onclick handlers
let adminPanel;

function showSection(sectionId) {
  adminPanel.showSection(sectionId);
}

function showAddAgentModal() {
  adminPanel.showAddAgentModal();
}

function hideAddAgentModal() {
  adminPanel.hideAddAgentModal();
}

function addAgent() {
  adminPanel.addAgent();
}

function loadActivityLogs() {
  adminPanel.loadActivityLogs();
}

function saveSettings() {
  adminPanel.saveSettings();
}

function logout() {
  adminPanel.logout();
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  adminPanel = new AdminPanel();
});