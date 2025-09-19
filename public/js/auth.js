/**
 * Talk pAI Authentication Module
 * Handles login, registration, and session management
 */

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('talkpai-token');
        this.isAuthenticated = false;

        this.init();
    }

    init() {
        // Check existing session
        if (this.token) {
            this.validateToken();
        } else {
            this.showAuthModal();
        }

        // Bind auth tab switching
        this.bindAuthTabs();
    }

    bindAuthTabs() {
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetTab = e.target.dataset.tab;
                this.switchAuthTab(targetTab);
            });
        });
    }

    switchAuthTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

        // Show/hide forms
        document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
        document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
    }

    async validateToken() {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                this.setUser(userData.user);
                this.hideAuthModal();
            } else {
                localStorage.removeItem('talkpai-token');
                this.showAuthModal();
            }
        } catch (error) {
            console.warn('Token validation failed:', error);
            this.showAuthModal();
        }
    }

    async handleLogin() {
        const nickname = document.getElementById('loginEmail').value; // Using nickname field
        const password = document.getElementById('loginPassword').value;

        if (!nickname || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ nickname, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.setUser({
                    id: data.id,
                    nickname: data.nickname,
                    username: data.nickname,
                    displayName: data.nickname,
                    avatar: data.avatar
                });
                this.setToken(data.token);
                this.hideAuthModal();
                this.showSuccess(data.message || 'Login successful!');
            } else {
                this.showError(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Network error. Please try again.');
        }
    }

    async handleRegister() {
        const nickname = document.getElementById('registerUsername').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Валідація nickname
        if (!nickname) {
            this.showError('Nickname is required');
            return;
        }

        if (nickname.length < 3 || nickname.length > 30) {
            this.showError('Nickname must be 3-30 characters');
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
            this.showError('Nickname can only contain letters, numbers and underscores');
            return;
        }

        if (!password || !confirmPassword) {
            this.showError('Password is required');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            this.showError('Password must be at least 6 characters');
            return;
        }

        // Валідація email (якщо вказаний)
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ nickname, email, password, avatar: null })
            });

            const data = await response.json();

            if (response.ok) {
                this.setUser({
                    id: data.user.id,
                    nickname: data.user.nickname,
                    username: data.user.nickname,
                    displayName: data.user.nickname,
                    avatar: data.user.avatar
                });
                this.setToken(data.user.token);
                this.hideAuthModal();
                this.showSuccess(data.message || 'Registration successful! Welcome to Talk pAI!');
            } else {
                this.showError(data.error || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showError('Network error. Please try again.');
        }
    }

    demoLogin() {
        // Demo login with predefined user
        const demoUser = {
            id: 'demo-user-' + Math.random().toString(36).substr(2, 9),
            username: 'demo_user',
            email: 'demo@talkpai.com',
            displayName: 'Demo User',
            avatar: '/avatars/demo-user.jpg'
        };

        this.setUser(demoUser);
        this.setToken('demo-token-' + Math.random().toString(36).substr(2, 16));
        this.hideAuthModal();
        this.showSuccess('Demo login successful!');
    }

    setUser(user) {
        this.currentUser = user;
        this.isAuthenticated = true;

        // Update UI with user info
        this.updateUIWithUser(user);

        // Register user with WebRTC if available
        if (window.webrtc) {
            window.webrtc.registerUser(user.id, user.displayName || user.username);
        }
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('talkpai-token', token);
    }

    updateUIWithUser(user) {
        // Update profile information
        const profileBtn = document.getElementById('profileBtn');
        if (profileBtn) {
            profileBtn.textContent = user.displayName || user.username;
        }

        // Update chat header
        const chatHeaderName = document.querySelector('.chat-header-name');
        if (chatHeaderName) {
            chatHeaderName.textContent = user.displayName || user.username;
        }

        // Update sidebar avatar
        const sidebarAvatar = document.querySelector('.sidebar-header .user-info .user-avatar');
        if (sidebarAvatar) {
            sidebarAvatar.textContent = (user.displayName || user.username).charAt(0).toUpperCase();
        }
    }

    showAuthModal() {
        const overlay = document.getElementById('authModalOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            document.body.classList.add('auth-mode');
        }
    }

    hideAuthModal() {
        const overlay = document.getElementById('authModalOverlay');
        if (overlay) {
            overlay.style.display = 'none';
            document.body.classList.remove('auth-mode');
        }
    }

    logout() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.token = null;
        localStorage.removeItem('talkpai-token');

        // Clear UI
        this.showAuthModal();

        // Disconnect WebRTC
        if (window.webrtc) {
            window.webrtc.cleanup();
        }

        this.showSuccess('Logged out successfully');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `auth-notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 12px;
            color: white;
            font-weight: 500;
            z-index: 10001;
            opacity: 0;
            transform: translateX(100px);
            transition: all 0.3s ease;
            max-width: 300px;
            backdrop-filter: blur(20px);
        `;

        if (type === 'error') {
            notification.style.background = 'linear-gradient(135deg, #EF4444, #DC2626)';
        } else if (type === 'success') {
            notification.style.background = 'linear-gradient(135deg, #10B981, #059669)';
        } else {
            notification.style.background = 'linear-gradient(135deg, #3B82F6, #1D4ED8)';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        });

        // Remove after 4 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    // Get current user info
    getCurrentUser() {
        return this.currentUser;
    }

    // Check if user is authenticated
    isUserAuthenticated() {
        return this.isAuthenticated;
    }

    // Get auth token for API requests
    getAuthToken() {
        return this.token;
    }
}

// Global auth manager instance
window.authManager = new AuthManager();

// Global functions for HTML onclick handlers
window.handleLogin = () => window.authManager.handleLogin();
window.handleRegister = () => window.authManager.handleRegister();
window.demoLogin = () => window.authManager.demoLogin();
window.logout = () => window.authManager.logout();

console.log('🔐 Authentication module loaded successfully');