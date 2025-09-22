/**
 * Talk pAI Application Controller
 * Main application orchestrator following SOLID principles
 */

class TalkPAIController {
    constructor() {
        this.services = new Map();
        this.components = new Map();
        this.isInitialized = false;
        this.initializationSteps = [];
        this.currentStep = 0;

        // Service dependencies
        this.dependencies = {
            auth: [],
            messaging: ['auth'],
            contacts: ['auth'],
            calls: ['auth', 'messaging'],
            ui: ['auth']
        };

        this.initializeApplication();
    }

    async initializeApplication() {
        try {
            console.log('🚀 Starting Talk pAI Application...');

            // Step 1: Initialize core services
            await this.initializeCoreServices();

            // Step 2: Initialize components
            await this.initializeComponents();

            // Step 3: Setup event listeners
            this.setupGlobalEventListeners();

            // Step 4: Finalize initialization
            await this.finalizeInitialization();

            this.isInitialized = true;
            console.log('✅ Talk pAI Application fully initialized!');

            // Trigger application ready event
            this.triggerApplicationReady();

        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            this.handleInitializationError(error);
        }
    }

    async initializeCoreServices() {
        console.log('📦 Initializing core services...');

        // Initialize authentication service
        if (window.AuthManager) {
            this.services.set('auth', new AuthManager());
            console.log('✅ Authentication service initialized');
        }

        // Initialize messaging service (wait for auth)
        if (this.services.has('auth') && window.MessagingService) {
            this.services.set('messaging', new MessagingService());
            console.log('✅ Messaging service initialized');
        }

        // Initialize contact manager
        if (window.ContactManager) {
            this.services.set('contacts', new ContactManager());
            console.log('✅ Contact manager initialized');
        }

        // Initialize call manager
        if (window.CallManager) {
            this.services.set('calls', new CallManager());
            console.log('✅ Call manager initialized');
        }

        // Initialize WebRTC client
        if (window.WebRTCClient) {
            this.services.set('webrtc', new WebRTCClient());
            console.log('✅ WebRTC client initialized');
        }

        // Initialize theme manager
        if (window.ThemeCustomizer) {
            this.services.set('theme', new ThemeCustomizer());
            console.log('✅ Theme manager initialized');
        }

        // Wait for critical services to be ready
        await this.waitForServicesReady(['auth']);
    }

    async initializeComponents() {
        console.log('🧩 Initializing UI components...');

        // Initialize UI components
        if (window.UIComponents) {
            this.components.set('ui', new UIComponents());
            console.log('✅ UI components initialized');
        }

        // Initialize production interface
        if (window.ProductionInterface) {
            this.components.set('interface', new ProductionInterface());
            console.log('✅ Production interface initialized');
        }

        // Initialize emoji picker
        if (window.EmojiPicker) {
            this.components.set('emoji', new EmojiPicker());
            console.log('✅ Emoji picker initialized');
        }

        // Initialize mobile UX
        if (window.MobileUX) {
            this.components.set('mobile', new MobileUX());
            console.log('✅ Mobile UX initialized');
        }
    }

    setupGlobalEventListeners() {
        console.log('🔗 Setting up global event listeners...');

        // Authentication events
        document.addEventListener('user-authenticated', (event) => {
            this.handleUserAuthenticated(event.detail);
        });

        document.addEventListener('user-logout', () => {
            this.handleUserLogout();
        });

        // Application lifecycle events
        window.addEventListener('beforeunload', () => {
            this.handleApplicationClose();
        });

        // Network events
        window.addEventListener('online', () => {
            this.handleNetworkOnline();
        });

        window.addEventListener('offline', () => {
            this.handleNetworkOffline();
        });

        // Error handling
        window.addEventListener('error', (event) => {
            this.handleGlobalError(event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.handleUnhandledRejection(event.reason);
        });

        console.log('✅ Global event listeners configured');
    }

    async finalizeInitialization() {
        console.log('🎯 Finalizing initialization...');

        // Connect services
        this.connectServices();

        // Setup service cross-references
        this.setupServiceReferences();

        // Validate all services are working
        await this.validateServices();

        // Load user preferences
        await this.loadUserPreferences();

        console.log('✅ Initialization finalized');
    }

    connectServices() {
        // Connect messaging service to auth
        const auth = this.services.get('auth');
        const messaging = this.services.get('messaging');

        if (auth && messaging) {
            auth.onUserChange = (user) => {
                messaging.currentUser = user;
                if (user) {
                    messaging.init();
                }
            };
        }

        // Connect contacts to auth
        const contacts = this.services.get('contacts');
        if (auth && contacts) {
            auth.onUserChange = (user) => {
                if (user) {
                    contacts.loadContacts();
                }
            };
        }

        // Connect UI to theme
        const theme = this.services.get('theme');
        const ui = this.components.get('interface');

        if (theme && ui) {
            theme.onThemeChange = (newTheme) => {
                ui.applyTheme(newTheme);
            };
        }
    }

    setupServiceReferences() {
        // Make services globally available
        window.app = this;

        // Legacy compatibility
        if (this.services.has('auth')) {
            window.auth = this.services.get('auth');
        }

        if (this.services.has('messaging')) {
            window.messagingService = this.services.get('messaging');
        }

        if (this.services.has('contacts')) {
            window.contactManager = this.services.get('contacts');
        }

        if (this.services.has('calls')) {
            window.callManager = this.services.get('calls');
        }
    }

    async validateServices() {
        console.log('✅ Validating services...');

        for (const [name, service] of this.services) {
            try {
                if (service.validate && typeof service.validate === 'function') {
                    await service.validate();
                    console.log(`✅ ${name} service validated`);
                }
            } catch (error) {
                console.warn(`⚠️ ${name} service validation failed:`, error);
            }
        }
    }

    async loadUserPreferences() {
        try {
            // Load theme preference
            const savedTheme = localStorage.getItem('talkpai-theme');
            if (savedTheme && this.services.has('theme')) {
                this.services.get('theme').setTheme(savedTheme);
            }

            // Load other preferences
            const preferences = JSON.parse(localStorage.getItem('talkpai-preferences') || '{}');
            this.applyUserPreferences(preferences);

        } catch (error) {
            console.warn('⚠️ Failed to load user preferences:', error);
        }
    }

    applyUserPreferences(preferences) {
        // Apply notification settings
        if (preferences.notifications !== undefined) {
            this.setNotificationPreference(preferences.notifications);
        }

        // Apply UI preferences
        if (preferences.sidebarCollapsed !== undefined) {
            this.setSidebarState(preferences.sidebarCollapsed);
        }

        // Apply other preferences
        Object.entries(preferences).forEach(([key, value]) => {
            this.applyPreference(key, value);
        });
    }

    async waitForServicesReady(serviceNames, timeout = 10000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const allReady = serviceNames.every(name => {
                const service = this.services.get(name);
                return service && (service.isReady === undefined || service.isReady);
            });

            if (allReady) {
                return true;
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        throw new Error(`Services not ready within ${timeout}ms: ${serviceNames.join(', ')}`);
    }

    triggerApplicationReady() {
        const event = new CustomEvent('talkpai:ready', {
            detail: {
                services: Array.from(this.services.keys()),
                components: Array.from(this.components.keys()),
                timestamp: new Date()
            }
        });

        window.dispatchEvent(event);
        console.log('📢 Application ready event dispatched');
    }

    // Event Handlers
    handleUserAuthenticated(userData) {
        console.log('👤 User authenticated:', userData.nickname);

        // Initialize user-specific services
        this.services.forEach((service, name) => {
            if (service.onUserAuthenticated) {
                service.onUserAuthenticated(userData);
            }
        });
    }

    handleUserLogout() {
        console.log('👋 User logged out');

        // Clean up user-specific data
        this.services.forEach((service, name) => {
            if (service.onUserLogout) {
                service.onUserLogout();
            }
        });
    }

    handleApplicationClose() {
        console.log('🔄 Application closing...');

        // Save user preferences
        this.saveUserPreferences();

        // Clean up services
        this.cleanup();
    }

    handleNetworkOnline() {
        console.log('🌐 Network connected');

        this.services.forEach((service, name) => {
            if (service.onNetworkOnline) {
                service.onNetworkOnline();
            }
        });
    }

    handleNetworkOffline() {
        console.log('📵 Network disconnected');

        this.services.forEach((service, name) => {
            if (service.onNetworkOffline) {
                service.onNetworkOffline();
            }
        });
    }

    handleGlobalError(error) {
        console.error('🚨 Global error:', error);

        // Report to error tracking service if available
        if (this.services.has('errorTracking')) {
            this.services.get('errorTracking').reportError(error);
        }
    }

    handleUnhandledRejection(reason) {
        console.error('🚨 Unhandled promise rejection:', reason);

        // Handle unhandled promise rejections
        if (this.services.has('errorTracking')) {
            this.services.get('errorTracking').reportRejection(reason);
        }
    }

    handleInitializationError(error) {
        console.error('💥 Initialization failed:', error);

        // Show error message to user
        this.showCriticalError('Failed to initialize application. Please refresh the page.');
    }

    // Utility Methods
    getService(name) {
        return this.services.get(name);
    }

    getComponent(name) {
        return this.components.get(name);
    }

    saveUserPreferences() {
        try {
            const preferences = {
                theme: localStorage.getItem('talkpai-theme'),
                sidebarCollapsed: localStorage.getItem('talkpai-sidebar-collapsed'),
                notifications: this.getNotificationPreference(),
                timestamp: new Date().toISOString()
            };

            localStorage.setItem('talkpai-preferences', JSON.stringify(preferences));
        } catch (error) {
            console.warn('⚠️ Failed to save user preferences:', error);
        }
    }

    cleanup() {
        this.services.forEach((service, name) => {
            if (service.cleanup && typeof service.cleanup === 'function') {
                try {
                    service.cleanup();
                } catch (error) {
                    console.warn(`⚠️ Cleanup failed for ${name}:`, error);
                }
            }
        });
    }

    showCriticalError(message) {
        // Create error overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        `;

        overlay.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <h2>⚠️ Application Error</h2>
                <p>${message}</p>
                <button onclick="window.location.reload()"
                        style="padding: 0.5rem 1rem; margin-top: 1rem; cursor: pointer;">
                    Refresh Page
                </button>
            </div>
        `;

        document.body.appendChild(overlay);
    }

    // Preference methods (stubs for now)
    setNotificationPreference(enabled) {
        localStorage.setItem('talkpai-notifications', enabled.toString());
    }

    getNotificationPreference() {
        return localStorage.getItem('talkpai-notifications') !== 'false';
    }

    setSidebarState(collapsed) {
        localStorage.setItem('talkpai-sidebar-collapsed', collapsed.toString());
    }

    applyPreference(key, value) {
        // Apply individual preferences
        console.log(`Applying preference: ${key} = ${value}`);
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.talkPAIController = new TalkPAIController();
});

// Also initialize if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading, event listener will handle it
} else {
    // DOM is already loaded
    window.talkPAIController = new TalkPAIController();
}