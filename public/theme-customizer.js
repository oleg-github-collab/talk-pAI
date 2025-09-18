/**
 * Ultra-Modern Theme Customizer for Talk pAI
 * Apple Vision Pro + Glassmorphism + Neumorphism
 */

class ThemeCustomizer {
    constructor() {
        this.themes = {
            light: {
                name: 'Light Glass',
                bgGradient: 'linear-gradient(135deg, #ffffff 0%, #F5F7FA 50%, #E8EBF0 100%)',
                primaryColor: '#3B82F6',
                secondaryColor: '#A855F7',
                glassOpacity: 0.15,
                glassBlur: 25,
                textPrimary: '#1E293B',
                textSecondary: '#475569',
                shadowColor: 'rgba(203, 213, 225, 0.3)',
                isAmoled: false
            },
            dark: {
                name: 'Dark AMOLED',
                bgGradient: 'linear-gradient(135deg, #000000 0%, #0F172A 100%)',
                primaryColor: '#22D3EE',
                secondaryColor: '#E879F9',
                glassOpacity: 0.08,
                glassBlur: 20,
                textPrimary: '#E2E8F0',
                textSecondary: '#FFFFFF',
                shadowColor: 'rgba(34, 211, 238, 0.2)',
                isAmoled: true
            },
            custom: {
                name: 'Custom Theme',
                bgGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                primaryColor: '#FF6B6B',
                secondaryColor: '#4ECDC4',
                glassOpacity: 0.12,
                glassBlur: 22,
                textPrimary: '#FFFFFF',
                textSecondary: '#E0E0E0',
                shadowColor: 'rgba(255, 107, 107, 0.3)',
                isAmoled: false
            }
        };

        this.currentTheme = 'light';
        this.isCustomizing = false;
        this.init();
    }

    init() {
        this.loadSavedTheme();
        this.createCustomizerUI();
        this.bindEvents();
    }

    loadSavedTheme() {
        const saved = localStorage.getItem('talkpai-custom-theme');
        if (saved) {
            this.themes.custom = { ...this.themes.custom, ...JSON.parse(saved) };
        }

        const currentTheme = localStorage.getItem('talkpai-theme') || 'light';
        this.applyTheme(currentTheme);
    }

    createCustomizerUI() {
        const customizer = document.createElement('div');
        customizer.id = 'themeCustomizer';
        customizer.className = 'theme-customizer';
        customizer.style.display = 'none';

        customizer.innerHTML = `
            <div class="customizer-modal glass-effect">
                <div class="customizer-header">
                    <h2>🎨 Theme Customizer</h2>
                    <button class="close-btn" id="closeCustomizer">
                        <svg viewBox="0 0 24 24" width="20" height="20">
                            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>

                <div class="customizer-content">
                    <!-- Theme Presets -->
                    <div class="section">
                        <h3>🌟 Presets</h3>
                        <div class="theme-presets">
                            <div class="preset-card" data-theme="light">
                                <div class="preset-preview light-preview"></div>
                                <span>Light Glass</span>
                            </div>
                            <div class="preset-card" data-theme="dark">
                                <div class="preset-preview dark-preview"></div>
                                <span>Dark AMOLED</span>
                            </div>
                            <div class="preset-card" data-theme="custom">
                                <div class="preset-preview custom-preview"></div>
                                <span>Custom</span>
                            </div>
                        </div>
                    </div>

                    <!-- Live Preview -->
                    <div class="section">
                        <h3>👁️ Live Preview</h3>
                        <div class="mini-messenger-preview" id="miniPreview">
                            <div class="mini-header">
                                <div class="mini-avatar"></div>
                                <div class="mini-info">
                                    <div class="mini-name"></div>
                                    <div class="mini-status"></div>
                                </div>
                            </div>
                            <div class="mini-messages">
                                <div class="mini-message received">
                                    <div class="mini-bubble">Hello! How are you?</div>
                                </div>
                                <div class="mini-message sent">
                                    <div class="mini-bubble">Great! Love this theme.</div>
                                </div>
                            </div>
                            <div class="mini-input">
                                <div class="mini-input-field"></div>
                                <div class="mini-send-btn"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Custom Theme Controls -->
                    <div class="section custom-controls" id="customControls">
                        <h3>🎛️ Custom Theme</h3>

                        <!-- Background Gradient -->
                        <div class="control-group">
                            <label>Background Gradient</label>
                            <div class="gradient-picker">
                                <input type="color" id="gradientStart" value="#667eea">
                                <span>to</span>
                                <input type="color" id="gradientEnd" value="#764ba2">
                                <input type="range" id="gradientAngle" min="0" max="360" value="135">
                                <span id="angleValue">135°</span>
                            </div>
                        </div>

                        <!-- Primary Color -->
                        <div class="control-group">
                            <label>Primary Color (Neon)</label>
                            <input type="color" id="primaryColor" value="#FF6B6B">
                        </div>

                        <!-- Secondary Color -->
                        <div class="control-group">
                            <label>Secondary Color</label>
                            <input type="color" id="secondaryColor" value="#4ECDC4">
                        </div>

                        <!-- Glass Settings -->
                        <div class="control-group">
                            <label>Glass Intensity</label>
                            <div class="slider-container">
                                <input type="range" id="glassOpacity" min="0" max="30" value="12" step="1">
                                <span id="glassValue">12%</span>
                            </div>
                        </div>

                        <div class="control-group">
                            <label>Blur Intensity</label>
                            <div class="slider-container">
                                <input type="range" id="glassBlur" min="5" max="50" value="22" step="1">
                                <span id="blurValue">22px</span>
                            </div>
                        </div>

                        <!-- Animation Speed -->
                        <div class="control-group">
                            <label>Animation Speed</label>
                            <div class="slider-container">
                                <input type="range" id="animationSpeed" min="0.5" max="2" value="1" step="0.1">
                                <span id="speedValue">1x</span>
                            </div>
                        </div>

                        <!-- AMOLED Mode -->
                        <div class="control-group">
                            <label class="toggle-label">
                                <input type="checkbox" id="amoledMode">
                                <span class="toggle-slider"></span>
                                Force Pure Black (AMOLED)
                            </label>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="customizer-actions">
                        <button class="action-btn primary" id="applyTheme">Apply Theme</button>
                        <button class="action-btn secondary" id="resetTheme">Reset</button>
                        <button class="action-btn tertiary" id="exportTheme">Export</button>
                        <button class="action-btn tertiary" id="importTheme">Import</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(customizer);
        this.addCustomizerStyles();
    }

    addCustomizerStyles() {
        const styles = document.createElement('style');
        styles.textContent = `
            .theme-customizer {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(10px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.3s ease-out;
            }

            .customizer-modal {
                width: 90%;
                max-width: 480px;
                max-height: 90vh;
                background: var(--glass-bg);
                backdrop-filter: blur(var(--glass-blur));
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .customizer-header {
                padding: 24px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .customizer-header h2 {
                margin: 0;
                color: var(--text-primary);
                font-size: 20px;
                font-weight: 600;
            }

            .close-btn {
                width: 32px;
                height: 32px;
                background: none;
                border: none;
                border-radius: 8px;
                color: var(--text-secondary);
                cursor: pointer;
                transition: all 0.2s;
            }

            .close-btn:hover {
                background: var(--glass-bg);
                color: var(--primary-color);
            }

            .customizer-content {
                padding: 24px;
                max-height: calc(90vh - 140px);
                overflow-y: auto;
            }

            .section {
                margin-bottom: 32px;
            }

            .section h3 {
                margin: 0 0 16px 0;
                color: var(--text-primary);
                font-size: 16px;
                font-weight: 600;
            }

            .theme-presets {
                display: flex;
                gap: 12px;
                margin-bottom: 24px;
            }

            .preset-card {
                flex: 1;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s;
                border-radius: 12px;
                padding: 12px;
                border: 2px solid transparent;
            }

            .preset-card:hover {
                border-color: var(--primary-color);
                transform: translateY(-2px);
            }

            .preset-card.active {
                border-color: var(--primary-color);
                background: var(--glass-bg);
            }

            .preset-preview {
                width: 100%;
                height: 60px;
                border-radius: 8px;
                margin-bottom: 8px;
                position: relative;
                overflow: hidden;
            }

            .light-preview {
                background: linear-gradient(135deg, #ffffff 0%, #F5F7FA 50%, #E8EBF0 100%);
            }

            .dark-preview {
                background: linear-gradient(135deg, #000000 0%, #0F172A 100%);
            }

            .custom-preview {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }

            .preset-preview::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 20px;
                height: 20px;
                background: var(--primary-color);
                border-radius: 50%;
                opacity: 0.8;
            }

            .preset-card span {
                font-size: 12px;
                color: var(--text-secondary);
                font-weight: 500;
            }

            .mini-messenger-preview {
                background: var(--glass-bg);
                backdrop-filter: blur(var(--glass-blur));
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                overflow: hidden;
                height: 200px;
                display: flex;
                flex-direction: column;
            }

            .mini-header {
                padding: 12px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .mini-avatar {
                width: 24px;
                height: 24px;
                background: var(--primary-color);
                border-radius: 6px;
            }

            .mini-info {
                flex: 1;
            }

            .mini-name {
                height: 8px;
                background: var(--text-primary);
                border-radius: 4px;
                width: 60px;
                margin-bottom: 4px;
                opacity: 0.8;
            }

            .mini-status {
                height: 6px;
                background: var(--text-secondary);
                border-radius: 3px;
                width: 40px;
                opacity: 0.6;
            }

            .mini-messages {
                flex: 1;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .mini-message {
                display: flex;
            }

            .mini-message.sent {
                justify-content: flex-end;
            }

            .mini-bubble {
                padding: 6px 10px;
                border-radius: 12px;
                font-size: 10px;
                max-width: 70%;
                background: var(--glass-bg);
                backdrop-filter: blur(var(--glass-blur));
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: var(--text-primary);
            }

            .mini-message.sent .mini-bubble {
                background: var(--primary-color);
                color: white;
            }

            .mini-input {
                padding: 8px 12px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .mini-input-field {
                flex: 1;
                height: 20px;
                background: var(--glass-bg);
                backdrop-filter: blur(var(--glass-blur));
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 10px;
            }

            .mini-send-btn {
                width: 20px;
                height: 20px;
                background: var(--primary-color);
                border-radius: 50%;
            }

            .control-group {
                margin-bottom: 20px;
            }

            .control-group label {
                display: block;
                margin-bottom: 8px;
                color: var(--text-primary);
                font-size: 14px;
                font-weight: 500;
            }

            .gradient-picker {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }

            .gradient-picker input[type="color"] {
                width: 40px;
                height: 32px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
            }

            .gradient-picker span {
                color: var(--text-secondary);
                font-size: 12px;
            }

            .slider-container {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .slider-container input[type="range"] {
                flex: 1;
                -webkit-appearance: none;
                height: 6px;
                border-radius: 3px;
                background: var(--glass-bg);
                outline: none;
            }

            .slider-container input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: var(--primary-color);
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            }

            .slider-container span {
                min-width: 40px;
                text-align: right;
                color: var(--text-secondary);
                font-size: 12px;
                font-weight: 500;
            }

            .toggle-label {
                display: flex !important;
                align-items: center;
                gap: 12px;
                cursor: pointer;
            }

            .toggle-label input[type="checkbox"] {
                display: none;
            }

            .toggle-slider {
                width: 44px;
                height: 24px;
                background: var(--glass-bg);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                position: relative;
                transition: all 0.3s;
            }

            .toggle-slider::after {
                content: '';
                position: absolute;
                top: 2px;
                left: 2px;
                width: 18px;
                height: 18px;
                background: var(--text-secondary);
                border-radius: 50%;
                transition: all 0.3s;
            }

            .toggle-label input:checked + .toggle-slider {
                background: var(--primary-color);
            }

            .toggle-label input:checked + .toggle-slider::after {
                transform: translateX(20px);
                background: white;
            }

            .customizer-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-top: 24px;
                padding-top: 24px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }

            .action-btn {
                flex: 1;
                min-width: 100px;
                padding: 12px 16px;
                border: none;
                border-radius: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
                font-size: 14px;
            }

            .action-btn.primary {
                background: var(--primary-color);
                color: white;
            }

            .action-btn.secondary {
                background: var(--glass-bg);
                backdrop-filter: blur(var(--glass-blur));
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: var(--text-primary);
            }

            .action-btn.tertiary {
                background: none;
                border: 1px solid var(--primary-color);
                color: var(--primary-color);
            }

            .action-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }

            .custom-controls {
                display: none;
            }

            .custom-controls.active {
                display: block;
            }
        `;

        document.head.appendChild(styles);
    }

    bindEvents() {
        // Theme toggle in header
        document.getElementById('themeToggle')?.addEventListener('click', () => {
            this.showCustomizer();
        });

        // Close customizer
        document.getElementById('closeCustomizer')?.addEventListener('click', () => {
            this.hideCustomizer();
        });

        // Preset selection
        document.querySelectorAll('.preset-card').forEach(card => {
            card.addEventListener('click', () => {
                const theme = card.dataset.theme;
                this.selectPreset(theme);
            });
        });

        // Custom controls
        this.bindCustomControls();

        // Actions
        document.getElementById('applyTheme')?.addEventListener('click', () => {
            this.applyCurrentTheme();
        });

        document.getElementById('resetTheme')?.addEventListener('click', () => {
            this.resetTheme();
        });

        document.getElementById('exportTheme')?.addEventListener('click', () => {
            this.exportTheme();
        });

        document.getElementById('importTheme')?.addEventListener('click', () => {
            this.importTheme();
        });
    }

    bindCustomControls() {
        // Gradient controls
        ['gradientStart', 'gradientEnd', 'gradientAngle'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => {
                this.updateCustomTheme();
            });
        });

        // Color controls
        ['primaryColor', 'secondaryColor'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => {
                this.updateCustomTheme();
            });
        });

        // Slider controls
        ['glassOpacity', 'glassBlur', 'animationSpeed'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => {
                this.updateCustomTheme();
            });
        });

        // AMOLED toggle
        document.getElementById('amoledMode')?.addEventListener('change', () => {
            this.updateCustomTheme();
        });
    }

    showCustomizer() {
        document.getElementById('themeCustomizer').style.display = 'flex';
        this.isCustomizing = true;
        this.updatePresetSelection();
        this.updateLivePreview();
    }

    hideCustomizer() {
        document.getElementById('themeCustomizer').style.display = 'none';
        this.isCustomizing = false;
    }

    selectPreset(theme) {
        this.currentTheme = theme;
        this.updatePresetSelection();
        this.updateLivePreview();

        // Show/hide custom controls
        const customControls = document.getElementById('customControls');
        if (theme === 'custom') {
            customControls.classList.add('active');
            this.loadCustomControls();
        } else {
            customControls.classList.remove('active');
        }
    }

    updatePresetSelection() {
        document.querySelectorAll('.preset-card').forEach(card => {
            card.classList.toggle('active', card.dataset.theme === this.currentTheme);
        });
    }

    loadCustomControls() {
        const theme = this.themes.custom;

        // Extract gradient colors
        const gradientMatch = theme.bgGradient.match(/linear-gradient\((\d+)deg, ([^)]+)\)/);
        if (gradientMatch) {
            const angle = gradientMatch[1];
            const colors = gradientMatch[2].split(', ');

            document.getElementById('gradientAngle').value = angle;
            document.getElementById('angleValue').textContent = angle + '°';

            if (colors.length >= 2) {
                document.getElementById('gradientStart').value = this.extractColor(colors[0]);
                document.getElementById('gradientEnd').value = this.extractColor(colors[1]);
            }
        }

        document.getElementById('primaryColor').value = theme.primaryColor;
        document.getElementById('secondaryColor').value = theme.secondaryColor;

        document.getElementById('glassOpacity').value = Math.round(theme.glassOpacity * 100);
        document.getElementById('glassValue').textContent = Math.round(theme.glassOpacity * 100) + '%';

        document.getElementById('glassBlur').value = theme.glassBlur;
        document.getElementById('blurValue').textContent = theme.glassBlur + 'px';

        document.getElementById('amoledMode').checked = theme.isAmoled;
    }

    extractColor(colorString) {
        // Extract hex color from gradient color stop
        const hexMatch = colorString.match(/#[0-9a-fA-F]{6}/);
        return hexMatch ? hexMatch[0] : '#000000';
    }

    updateCustomTheme() {
        const startColor = document.getElementById('gradientStart')?.value || '#667eea';
        const endColor = document.getElementById('gradientEnd')?.value || '#764ba2';
        const angle = document.getElementById('gradientAngle')?.value || '135';
        const primaryColor = document.getElementById('primaryColor')?.value || '#FF6B6B';
        const secondaryColor = document.getElementById('secondaryColor')?.value || '#4ECDC4';
        const glassOpacity = (document.getElementById('glassOpacity')?.value || 12) / 100;
        const glassBlur = document.getElementById('glassBlur')?.value || 22;
        const isAmoled = document.getElementById('amoledMode')?.checked || false;

        // Update angle display
        document.getElementById('angleValue').textContent = angle + '°';
        document.getElementById('glassValue').textContent = Math.round(glassOpacity * 100) + '%';
        document.getElementById('blurValue').textContent = glassBlur + 'px';

        // Update custom theme
        this.themes.custom = {
            ...this.themes.custom,
            bgGradient: isAmoled ?
                'linear-gradient(135deg, #000000 0%, #000000 100%)' :
                `linear-gradient(${angle}deg, ${startColor} 0%, ${endColor} 100%)`,
            primaryColor,
            secondaryColor,
            glassOpacity,
            glassBlur: parseInt(glassBlur),
            textPrimary: isAmoled ? '#FFFFFF' : this.getContrastColor(startColor),
            textSecondary: isAmoled ? '#E0E0E0' : this.getContrastColor(startColor, 0.7),
            shadowColor: `${primaryColor}33`,
            isAmoled
        };

        this.updateLivePreview();
    }

    getContrastColor(bgColor, opacity = 1) {
        // Simple contrast calculation
        const hex = bgColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;

        const color = brightness > 128 ? '#000000' : '#FFFFFF';
        return opacity < 1 ? `${color}${Math.round(opacity * 255).toString(16)}` : color;
    }

    updateLivePreview() {
        const theme = this.themes[this.currentTheme];
        const preview = document.getElementById('miniPreview');

        if (preview) {
            preview.style.setProperty('--preview-bg', theme.bgGradient);
            preview.style.setProperty('--preview-primary', theme.primaryColor);
            preview.style.setProperty('--preview-secondary', theme.secondaryColor);
            preview.style.setProperty('--preview-glass', `rgba(255, 255, 255, ${theme.glassOpacity})`);
            preview.style.setProperty('--preview-blur', `${theme.glassBlur}px`);
            preview.style.setProperty('--preview-text-primary', theme.textPrimary);
            preview.style.setProperty('--preview-text-secondary', theme.textSecondary);

            // Apply styles
            preview.style.background = theme.bgGradient;
        }
    }

    applyCurrentTheme() {
        this.applyTheme(this.currentTheme);

        if (this.currentTheme === 'custom') {
            localStorage.setItem('talkpai-custom-theme', JSON.stringify(this.themes.custom));
        }

        this.hideCustomizer();

        // Show success feedback
        this.showNotification('✨ Theme applied successfully!');
    }

    applyTheme(themeName) {
        const theme = this.themes[themeName];
        const root = document.documentElement;

        root.style.setProperty('--bg-gradient', theme.bgGradient);
        root.style.setProperty('--primary-color', theme.primaryColor);
        root.style.setProperty('--secondary-color', theme.secondaryColor);
        root.style.setProperty('--glass-bg', `rgba(255, 255, 255, ${theme.glassOpacity})`);
        root.style.setProperty('--glass-blur', `${theme.glassBlur}px`);
        root.style.setProperty('--text-primary', theme.textPrimary);
        root.style.setProperty('--text-secondary', theme.textSecondary);
        root.style.setProperty('--shadow-color', theme.shadowColor);

        document.body.setAttribute('data-theme', themeName);
        localStorage.setItem('talkpai-theme', themeName);

        // Update particles color
        const particles = document.querySelectorAll('.particle');
        particles.forEach(particle => {
            particle.style.background = theme.primaryColor;
        });

        this.currentTheme = themeName;
    }

    resetTheme() {
        this.currentTheme = 'light';
        this.applyTheme('light');
        this.selectPreset('light');
        this.showNotification('🔄 Theme reset to Light Glass');
    }

    exportTheme() {
        const themeData = {
            version: '1.0',
            theme: this.themes[this.currentTheme],
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(themeData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `talkpai-theme-${this.currentTheme}-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
        this.showNotification('💾 Theme exported successfully!');
    }

    importTheme() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const themeData = JSON.parse(event.target.result);

                    if (themeData.theme) {
                        this.themes.custom = { ...this.themes.custom, ...themeData.theme };
                        this.selectPreset('custom');
                        this.loadCustomControls();
                        this.showNotification('📂 Theme imported successfully!');
                    } else {
                        throw new Error('Invalid theme file');
                    }
                } catch (error) {
                    this.showNotification('❌ Failed to import theme file');
                }
            };

            reader.readAsText(file);
        };

        input.click();
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'theme-notification';
        notification.textContent = message;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--glass-bg);
            backdrop-filter: blur(var(--glass-blur));
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 16px 20px;
            color: var(--text-primary);
            font-weight: 500;
            z-index: 10001;
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => notification.remove(), 300);
        }, 3000);

        // Add animation styles
        if (!document.getElementById('notificationStyles')) {
            const styles = document.createElement('style');
            styles.id = 'notificationStyles';
            styles.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(styles);
        }
    }
}

// Initialize theme customizer
window.themeCustomizer = new ThemeCustomizer();