// Advanced User Profiles and Settings Component for Talk pAI
// Comprehensive user management with customization, privacy, and enterprise features

class UserProfiles {
    constructor() {
        this.currentUser = null;
        this.userSettings = new Map();
        this.privacySettings = new Map();
        this.notificationSettings = new Map();
        this.keyboardShortcuts = new Map();
        this.customThemes = new Map();
        this.linkedAccounts = new Map();
        this.securitySessions = new Map();

        this.init();
    }

    init() {
        this.setupDefaultSettings();
        this.setupEventListeners();
        this.loadUserData();
    }

    setupDefaultSettings() {
        this.defaultSettings = {
            profile: {
                displayName: '',
                bio: 'Hey there! I am using Talk pAI.',
                pronouns: '',
                timezone: 'UTC',
                language: 'en',
                phoneNumber: '',
                location: '',
                department: '',
                position: '',
                startDate: null,
                skills: [],
                interests: []
            },
            privacy: {
                profileVisibility: 'public', // public, contacts, private
                lastSeenVisibility: 'everyone', // everyone, contacts, nobody
                statusVisibility: 'everyone',
                readReceiptsEnabled: true,
                typingIndicatorsEnabled: true,
                allowDirectMessages: 'everyone', // everyone, contacts, nobody
                allowGroupInvites: 'everyone',
                allowMentions: 'everyone',
                shareContactInfo: false,
                shareLocation: false,
                dataRetention: '1year' // 30days, 90days, 1year, forever
            },
            notifications: {
                desktop: true,
                mobile: true,
                email: false,
                sounds: true,
                vibration: true,
                mentions: true,
                directMessages: true,
                groupMessages: false,
                reactions: true,
                threads: true,
                quietHours: {
                    enabled: false,
                    start: '22:00',
                    end: '08:00'
                },
                frequency: 'instant' // instant, bundled, daily, never
            },
            appearance: {
                theme: 'auto', // light, dark, auto
                accentColor: '#667eea',
                fontSize: 'medium', // small, medium, large
                density: 'comfortable', // compact, comfortable, spacious
                animations: true,
                glassmorphism: true,
                sidebar: 'expanded', // collapsed, expanded, auto
                layout: 'default' // default, wide, focused
            },
            keyboard: {
                sendMessage: 'Enter',
                newLine: 'Shift+Enter',
                search: 'Ctrl+K',
                toggleSidebar: 'Ctrl+B',
                quickSwitcher: 'Ctrl+T',
                markAsRead: 'Ctrl+Shift+R',
                createThread: 'Ctrl+Shift+T',
                editLastMessage: 'ArrowUp'
            },
            security: {
                twoFactorEnabled: false,
                sessionTimeout: '24hours', // 1hour, 8hours, 24hours, 7days, never
                loginAlerts: true,
                deviceTracking: true,
                passwordExpiry: '90days', // 30days, 90days, 1year, never
                allowedDevices: 'unlimited', // 1, 3, 5, unlimited
                encryptionEnabled: true
            }
        };
    }

    createProfileEditor() {
        const profileEditor = document.createElement('div');
        profileEditor.className = 'profile-editor glassmorphism';
        profileEditor.innerHTML = `
            <div class="profile-header">
                <h2>Edit Profile</h2>
                <button class="close-profile">×</button>
            </div>

            <div class="profile-content">
                <div class="profile-avatar-section">
                    <div class="avatar-upload">
                        <div class="current-avatar">
                            <img src="${this.currentUser?.avatar || '/assets/default-avatar.svg'}" alt="Profile Picture">
                            <div class="avatar-overlay">
                                <span>Change Photo</span>
                            </div>
                        </div>
                        <input type="file" id="avatar-input" accept="image/*" hidden>
                    </div>
                    <div class="avatar-options">
                        <button class="upload-avatar">Upload Photo</button>
                        <button class="remove-avatar">Remove</button>
                        <button class="generate-avatar">Generate AI Avatar</button>
                    </div>
                </div>

                <div class="profile-form">
                    <div class="form-section">
                        <h3>Basic Information</h3>
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Display Name</label>
                                <input type="text" name="displayName" placeholder="How others see you">
                            </div>
                            <div class="form-group">
                                <label>Username</label>
                                <input type="text" name="username" placeholder="@username">
                            </div>
                            <div class="form-group">
                                <label>Email</label>
                                <input type="email" name="email" placeholder="your@email.com">
                            </div>
                            <div class="form-group">
                                <label>Phone Number</label>
                                <input type="tel" name="phoneNumber" placeholder="+1 (555) 123-4567">
                            </div>
                            <div class="form-group">
                                <label>Pronouns</label>
                                <select name="pronouns">
                                    <option value="">Select pronouns</option>
                                    <option value="he/him">he/him</option>
                                    <option value="she/her">she/her</option>
                                    <option value="they/them">they/them</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>
                            <div class="form-group full-width">
                                <label>Bio</label>
                                <textarea name="bio" placeholder="Tell others about yourself..." rows="3"></textarea>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Work Information</h3>
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Department</label>
                                <input type="text" name="department" placeholder="Engineering">
                            </div>
                            <div class="form-group">
                                <label>Position</label>
                                <input type="text" name="position" placeholder="Senior Developer">
                            </div>
                            <div class="form-group">
                                <label>Location</label>
                                <input type="text" name="location" placeholder="San Francisco, CA">
                            </div>
                            <div class="form-group">
                                <label>Start Date</label>
                                <input type="date" name="startDate">
                            </div>
                        </div>
                        <div class="form-group full-width">
                            <label>Skills</label>
                            <div class="skills-input">
                                <input type="text" placeholder="Add skills..." class="skill-input">
                                <div class="skills-list"></div>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Regional Settings</h3>
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Timezone</label>
                                <select name="timezone">
                                    ${this.generateTimezoneOptions()}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Language</label>
                                <select name="language">
                                    ${this.generateLanguageOptions()}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="profile-actions">
                    <button class="cancel-btn">Cancel</button>
                    <button class="save-btn">Save Changes</button>
                </div>
            </div>
        `;

        this.populateProfileForm(profileEditor);
        return profileEditor;
    }

    createSettingsPanel() {
        const settingsPanel = document.createElement('div');
        settingsPanel.className = 'settings-panel glassmorphism';
        settingsPanel.innerHTML = `
            <div class="settings-header">
                <h2>Settings</h2>
                <button class="close-settings">×</button>
            </div>

            <div class="settings-navigation">
                <div class="settings-nav">
                    <button class="nav-item active" data-section="profile">👤 Profile</button>
                    <button class="nav-item" data-section="privacy">🔒 Privacy</button>
                    <button class="nav-item" data-section="notifications">🔔 Notifications</button>
                    <button class="nav-item" data-section="appearance">🎨 Appearance</button>
                    <button class="nav-item" data-section="keyboard">⌨️ Keyboard</button>
                    <button class="nav-item" data-section="security">🛡️ Security</button>
                    <button class="nav-item" data-section="data">📊 Data & Storage</button>
                    <button class="nav-item" data-section="advanced">⚙️ Advanced</button>
                </div>
            </div>

            <div class="settings-content">
                ${this.createPrivacySettings()}
                ${this.createNotificationSettings()}
                ${this.createAppearanceSettings()}
                ${this.createKeyboardSettings()}
                ${this.createSecuritySettings()}
                ${this.createDataSettings()}
                ${this.createAdvancedSettings()}
            </div>
        `;

        return settingsPanel;
    }

    createPrivacySettings() {
        return `
            <div class="settings-section" data-section="privacy" style="display: none;">
                <h3>Privacy Settings</h3>
                <div class="settings-grid">
                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Profile Visibility</h4>
                            <p>Who can see your profile information</p>
                        </div>
                        <select name="profileVisibility">
                            <option value="public">Everyone</option>
                            <option value="contacts">Contacts only</option>
                            <option value="private">Only me</option>
                        </select>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Last Seen</h4>
                            <p>Who can see when you were last online</p>
                        </div>
                        <select name="lastSeenVisibility">
                            <option value="everyone">Everyone</option>
                            <option value="contacts">Contacts only</option>
                            <option value="nobody">Nobody</option>
                        </select>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Read Receipts</h4>
                            <p>Let others know when you've read their messages</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="readReceiptsEnabled">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Typing Indicators</h4>
                            <p>Show when you're typing to others</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="typingIndicatorsEnabled">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Direct Messages</h4>
                            <p>Who can send you direct messages</p>
                        </div>
                        <select name="allowDirectMessages">
                            <option value="everyone">Everyone</option>
                            <option value="contacts">Contacts only</option>
                            <option value="nobody">Nobody</option>
                        </select>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Group Invites</h4>
                            <p>Who can add you to groups</p>
                        </div>
                        <select name="allowGroupInvites">
                            <option value="everyone">Everyone</option>
                            <option value="contacts">Contacts only</option>
                            <option value="nobody">Nobody</option>
                        </select>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Data Retention</h4>
                            <p>How long to keep your message history</p>
                        </div>
                        <select name="dataRetention">
                            <option value="30days">30 days</option>
                            <option value="90days">90 days</option>
                            <option value="1year">1 year</option>
                            <option value="forever">Forever</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    createNotificationSettings() {
        return `
            <div class="settings-section" data-section="notifications" style="display: none;">
                <h3>Notification Settings</h3>
                <div class="settings-grid">
                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Desktop Notifications</h4>
                            <p>Show notifications on your desktop</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="desktop">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Mobile Push</h4>
                            <p>Receive push notifications on mobile</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="mobile">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Email Notifications</h4>
                            <p>Get important updates via email</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="email">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Notification Sounds</h4>
                            <p>Play sounds for notifications</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="sounds">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Mentions</h4>
                            <p>Notify when someone mentions you</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="mentions">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Direct Messages</h4>
                            <p>Notify for direct messages</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="directMessages">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-item full-width">
                        <div class="setting-info">
                            <h4>Quiet Hours</h4>
                            <p>Don't send notifications during these hours</p>
                        </div>
                        <div class="quiet-hours">
                            <label class="toggle-switch">
                                <input type="checkbox" name="quietHoursEnabled">
                                <span class="toggle-slider"></span>
                            </label>
                            <input type="time" name="quietHoursStart" value="22:00">
                            <span>to</span>
                            <input type="time" name="quietHoursEnd" value="08:00">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createAppearanceSettings() {
        return `
            <div class="settings-section" data-section="appearance" style="display: none;">
                <h3>Appearance Settings</h3>
                <div class="settings-grid">
                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Theme</h4>
                            <p>Choose your preferred color scheme</p>
                        </div>
                        <div class="theme-selector">
                            <button class="theme-option" data-theme="light">☀️ Light</button>
                            <button class="theme-option" data-theme="dark">🌙 Dark</button>
                            <button class="theme-option active" data-theme="auto">🌓 Auto</button>
                        </div>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Accent Color</h4>
                            <p>Customize your accent color</p>
                        </div>
                        <div class="color-picker">
                            <input type="color" name="accentColor" value="#667eea">
                            <div class="color-presets">
                                <button class="color-preset" style="background: #667eea" data-color="#667eea"></button>
                                <button class="color-preset" style="background: #4ade80" data-color="#4ade80"></button>
                                <button class="color-preset" style="background: #f59e0b" data-color="#f59e0b"></button>
                                <button class="color-preset" style="background: #ef4444" data-color="#ef4444"></button>
                                <button class="color-preset" style="background: #8b5cf6" data-color="#8b5cf6"></button>
                            </div>
                        </div>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Font Size</h4>
                            <p>Adjust text size for better readability</p>
                        </div>
                        <select name="fontSize">
                            <option value="small">Small</option>
                            <option value="medium">Medium</option>
                            <option value="large">Large</option>
                        </select>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Density</h4>
                            <p>Adjust spacing between elements</p>
                        </div>
                        <select name="density">
                            <option value="compact">Compact</option>
                            <option value="comfortable">Comfortable</option>
                            <option value="spacious">Spacious</option>
                        </select>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Animations</h4>
                            <p>Enable smooth animations and transitions</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="animations">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Glassmorphism Effects</h4>
                            <p>Enable glass-like transparency effects</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="glassmorphism">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Sidebar</h4>
                            <p>Default sidebar state</p>
                        </div>
                        <select name="sidebar">
                            <option value="collapsed">Collapsed</option>
                            <option value="expanded">Expanded</option>
                            <option value="auto">Auto</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    createKeyboardSettings() {
        return `
            <div class="settings-section" data-section="keyboard" style="display: none;">
                <h3>Keyboard Shortcuts</h3>
                <div class="settings-grid">
                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Send Message</h4>
                            <p>Send a message</p>
                        </div>
                        <div class="shortcut-input">
                            <input type="text" name="sendMessage" value="Enter" readonly>
                            <button class="change-shortcut">Change</button>
                        </div>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>New Line</h4>
                            <p>Insert a new line in message</p>
                        </div>
                        <div class="shortcut-input">
                            <input type="text" name="newLine" value="Shift+Enter" readonly>
                            <button class="change-shortcut">Change</button>
                        </div>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Search</h4>
                            <p>Open global search</p>
                        </div>
                        <div class="shortcut-input">
                            <input type="text" name="search" value="Ctrl+K" readonly>
                            <button class="change-shortcut">Change</button>
                        </div>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Toggle Sidebar</h4>
                            <p>Show/hide sidebar</p>
                        </div>
                        <div class="shortcut-input">
                            <input type="text" name="toggleSidebar" value="Ctrl+B" readonly>
                            <button class="change-shortcut">Change</button>
                        </div>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Quick Switcher</h4>
                            <p>Switch between conversations</p>
                        </div>
                        <div class="shortcut-input">
                            <input type="text" name="quickSwitcher" value="Ctrl+T" readonly>
                            <button class="change-shortcut">Change</button>
                        </div>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Mark as Read</h4>
                            <p>Mark current conversation as read</p>
                        </div>
                        <div class="shortcut-input">
                            <input type="text" name="markAsRead" value="Ctrl+Shift+R" readonly>
                            <button class="change-shortcut">Change</button>
                        </div>
                    </div>
                </div>

                <div class="shortcut-actions">
                    <button class="reset-shortcuts">Reset to Defaults</button>
                    <button class="export-shortcuts">Export Shortcuts</button>
                </div>
            </div>
        `;
    }

    createSecuritySettings() {
        return `
            <div class="settings-section" data-section="security" style="display: none;">
                <h3>Security Settings</h3>
                <div class="settings-grid">
                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Two-Factor Authentication</h4>
                            <p>Add an extra layer of security</p>
                        </div>
                        <div class="security-action">
                            <label class="toggle-switch">
                                <input type="checkbox" name="twoFactorEnabled">
                                <span class="toggle-slider"></span>
                            </label>
                            <button class="setup-2fa">Setup</button>
                        </div>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Session Timeout</h4>
                            <p>Automatically sign out after inactivity</p>
                        </div>
                        <select name="sessionTimeout">
                            <option value="1hour">1 hour</option>
                            <option value="8hours">8 hours</option>
                            <option value="24hours">24 hours</option>
                            <option value="7days">7 days</option>
                            <option value="never">Never</option>
                        </select>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Login Alerts</h4>
                            <p>Get notified of new sign-ins</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="loginAlerts">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Device Tracking</h4>
                            <p>Monitor signed-in devices</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="deviceTracking">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-item full-width">
                        <div class="setting-info">
                            <h4>Active Sessions</h4>
                            <p>Manage your signed-in devices</p>
                        </div>
                        <div class="active-sessions">
                            ${this.renderActiveSessions()}
                        </div>
                    </div>

                    <div class="setting-item full-width">
                        <div class="setting-info">
                            <h4>Password & Recovery</h4>
                            <p>Update your password and recovery options</p>
                        </div>
                        <div class="password-actions">
                            <button class="change-password">Change Password</button>
                            <button class="recovery-options">Recovery Options</button>
                            <button class="download-data">Download My Data</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createDataSettings() {
        return `
            <div class="settings-section" data-section="data" style="display: none;">
                <h3>Data & Storage</h3>
                <div class="settings-grid">
                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Storage Usage</h4>
                            <p>View your data usage</p>
                        </div>
                        <div class="storage-info">
                            <div class="storage-bar">
                                <div class="storage-used" style="width: 65%"></div>
                            </div>
                            <span>2.3 GB of 5 GB used</span>
                        </div>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Auto-Delete Media</h4>
                            <p>Automatically delete old media files</p>
                        </div>
                        <select name="autoDeleteMedia">
                            <option value="never">Never</option>
                            <option value="30days">After 30 days</option>
                            <option value="90days">After 90 days</option>
                            <option value="1year">After 1 year</option>
                        </select>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Clear Cache</h4>
                            <p>Free up space by clearing cached data</p>
                        </div>
                        <button class="clear-cache">Clear Cache</button>
                    </div>

                    <div class="setting-item full-width">
                        <div class="setting-info">
                            <h4>Data Export</h4>
                            <p>Download your data in various formats</p>
                        </div>
                        <div class="export-options">
                            <button class="export-messages">Export Messages</button>
                            <button class="export-media">Export Media</button>
                            <button class="export-contacts">Export Contacts</button>
                            <button class="export-all">Export Everything</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createAdvancedSettings() {
        return `
            <div class="settings-section" data-section="advanced" style="display: none;">
                <h3>Advanced Settings</h3>
                <div class="settings-grid">
                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Developer Mode</h4>
                            <p>Enable developer features and debugging</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="developerMode">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Beta Features</h4>
                            <p>Access experimental features</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="betaFeatures">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Analytics</h4>
                            <p>Help improve Talk pAI by sharing usage data</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="analytics">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-item">
                        <div class="setting-info">
                            <h4>Crash Reports</h4>
                            <p>Automatically send crash reports</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" name="crashReports">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="setting-item full-width">
                        <div class="setting-info">
                            <h4>Linked Accounts</h4>
                            <p>Connect other services and accounts</p>
                        </div>
                        <div class="linked-accounts">
                            <div class="account-option">
                                <span>🟢 Google</span>
                                <button class="disconnect">Disconnect</button>
                            </div>
                            <div class="account-option">
                                <span>🔵 Microsoft</span>
                                <button class="connect">Connect</button>
                            </div>
                            <div class="account-option">
                                <span>🟣 GitHub</span>
                                <button class="connect">Connect</button>
                            </div>
                        </div>
                    </div>

                    <div class="setting-item full-width">
                        <div class="setting-info">
                            <h4>Reset & Cleanup</h4>
                            <p>Reset settings or delete account</p>
                        </div>
                        <div class="danger-zone">
                            <button class="reset-settings">Reset All Settings</button>
                            <button class="delete-account danger">Delete Account</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            // Navigation
            if (e.target.matches('.nav-item')) {
                this.switchSettingsSection(e.target.dataset.section);
            }

            // Avatar upload
            if (e.target.matches('.upload-avatar, .avatar-overlay')) {
                document.getElementById('avatar-input').click();
            }

            // Theme selection
            if (e.target.matches('.theme-option')) {
                this.setTheme(e.target.dataset.theme);
            }

            // Color presets
            if (e.target.matches('.color-preset')) {
                this.setAccentColor(e.target.dataset.color);
            }

            // Shortcut changes
            if (e.target.matches('.change-shortcut')) {
                this.changeKeyboardShortcut(e.target);
            }

            // Security actions
            if (e.target.matches('.setup-2fa')) {
                this.setup2FA();
            }

            if (e.target.matches('.change-password')) {
                this.showPasswordChange();
            }

            // Data actions
            if (e.target.matches('.clear-cache')) {
                this.clearCache();
            }

            if (e.target.matches('.export-all')) {
                this.exportAllData();
            }

            // Profile actions
            if (e.target.matches('.save-btn')) {
                this.saveProfile();
            }
        });

        // Avatar upload handler
        document.addEventListener('change', (e) => {
            if (e.target.matches('#avatar-input')) {
                this.handleAvatarUpload(e.target.files[0]);
            }
        });

        // Settings auto-save
        document.addEventListener('change', (e) => {
            if (e.target.matches('.settings-section input, .settings-section select')) {
                this.autoSaveSettings(e.target);
            }
        });
    }

    // Helper methods for generating options
    generateTimezoneOptions() {
        const timezones = [
            'UTC', 'America/New_York', 'America/Los_Angeles', 'America/Chicago',
            'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo',
            'Asia/Shanghai', 'Australia/Sydney'
        ];

        return timezones.map(tz => `<option value="${tz}">${tz}</option>`).join('');
    }

    generateLanguageOptions() {
        const languages = [
            { code: 'en', name: 'English' },
            { code: 'es', name: 'Español' },
            { code: 'fr', name: 'Français' },
            { code: 'de', name: 'Deutsch' },
            { code: 'it', name: 'Italiano' },
            { code: 'pt', name: 'Português' },
            { code: 'ru', name: 'Русский' },
            { code: 'ja', name: '日本語' },
            { code: 'ko', name: '한국어' },
            { code: 'zh', name: '中文' }
        ];

        return languages.map(lang =>
            `<option value="${lang.code}">${lang.name}</option>`
        ).join('');
    }

    renderActiveSessions() {
        const sessions = [
            { device: 'MacBook Pro', location: 'San Francisco, CA', lastActive: '2 minutes ago', current: true },
            { device: 'iPhone 14', location: 'San Francisco, CA', lastActive: '1 hour ago', current: false },
            { device: 'Chrome (Windows)', location: 'New York, NY', lastActive: '2 days ago', current: false }
        ];

        return sessions.map(session => `
            <div class="session-item ${session.current ? 'current' : ''}">
                <div class="session-info">
                    <span class="device">${session.device}</span>
                    <span class="location">${session.location}</span>
                    <span class="last-active">${session.lastActive}</span>
                </div>
                <div class="session-actions">
                    ${session.current ? '<span class="current-badge">Current</span>' : '<button class="revoke-session">Revoke</button>'}
                </div>
            </div>
        `).join('');
    }

    // API Integration
    async loadUserData() {
        try {
            const response = await fetch('/api/enhanced/users/profile');
            if (response.ok) {
                this.currentUser = await response.json();
                this.updateProfileDisplay();
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    async saveProfile() {
        const formData = new FormData(document.querySelector('.profile-form'));
        const profileData = Object.fromEntries(formData);

        try {
            const response = await fetch('/api/enhanced/users/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData)
            });

            if (response.ok) {
                this.showNotification('Profile updated successfully', 'success');
                this.currentUser = { ...this.currentUser, ...profileData };
            }
        } catch (error) {
            console.error('Failed to save profile:', error);
            this.showNotification('Failed to update profile', 'error');
        }
    }

    async updateSettings(category, settings) {
        try {
            const response = await fetch(`/api/enhanced/users/settings/${category}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            return response.ok;
        } catch (error) {
            console.error('Failed to update settings:', error);
            return false;
        }
    }

    // Utility methods
    populateProfileForm(container) {
        if (!this.currentUser) return;

        Object.entries(this.currentUser).forEach(([key, value]) => {
            const input = container.querySelector(`[name="${key}"]`);
            if (input) {
                input.value = value || '';
            }
        });
    }

    switchSettingsSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });

        // Show/hide sections
        document.querySelectorAll('.settings-section').forEach(sectionEl => {
            sectionEl.style.display = sectionEl.dataset.section === section ? 'block' : 'none';
        });
    }

    setTheme(theme) {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.toggle('active', option.dataset.theme === theme);
        });

        document.body.className = document.body.className.replace(/theme-\w+/, `theme-${theme}`);
        this.updateSettings('appearance', { theme });
    }

    setAccentColor(color) {
        document.documentElement.style.setProperty('--accent-color', color);
        this.updateSettings('appearance', { accentColor: color });
    }

    showNotification(message, type = 'info') {
        // Implementation for showing notifications
        console.log(`${type.toUpperCase()}: ${message}`);
    }

    autoSaveSettings(input) {
        const category = input.closest('.settings-section').dataset.section;
        const setting = { [input.name]: input.type === 'checkbox' ? input.checked : input.value };
        this.updateSettings(category, setting);
    }

    // Cleanup
    destroy() {
        // Remove event listeners and cleanup
    }
}

// Export for use in other components
window.UserProfiles = UserProfiles;