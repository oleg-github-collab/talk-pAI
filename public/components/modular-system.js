/**
 * Modular Component System with Drag & Drop
 * Advanced UI system for Talk pAI with glassmorphism design
 */

class ModularComponentSystem {
    constructor() {
        this.components = new Map();
        this.layouts = new Map();
        this.dragState = null;
        this.resizeState = null;
        this.gridSize = 8;
        this.snapThreshold = 16;

        this.init();
    }

    init() {
        this.setupDragAndDrop();
        this.setupResizing();
        this.setupKeyboardNavigation();
        this.loadUserLayout();
    }

    // ================================
    // COMPONENT REGISTRATION SYSTEM
    // ================================

    registerComponent(id, config) {
        const component = {
            id,
            type: config.type || 'panel',
            title: config.title || 'Component',
            content: config.content || '',
            position: config.position || { x: 0, y: 0 },
            size: config.size || { width: 300, height: 200 },
            minSize: config.minSize || { width: 200, height: 150 },
            maxSize: config.maxSize || { width: 800, height: 600 },
            resizable: config.resizable !== false,
            draggable: config.draggable !== false,
            collapsible: config.collapsible !== false,
            closable: config.closable !== false,
            zIndex: config.zIndex || 100,
            isCollapsed: false,
            isVisible: true,
            data: config.data || {},
            callbacks: config.callbacks || {},
            style: config.style || {}
        };

        this.components.set(id, component);
        this.renderComponent(component);

        return component;
    }

    // ================================
    // COMPONENT RENDERING
    // ================================

    renderComponent(component) {
        const element = this.createComponentElement(component);
        document.body.appendChild(element);

        // Apply animations
        this.animateComponentIn(element);

        // Store reference
        component.element = element;

        return element;
    }

    createComponentElement(component) {
        const element = document.createElement('div');
        element.className = `modular-component glass ${component.type}`;
        element.dataset.componentId = component.id;
        element.style.cssText = `
            position: fixed;
            left: ${component.position.x}px;
            top: ${component.position.y}px;
            width: ${component.size.width}px;
            height: ${component.size.height}px;
            z-index: ${component.zIndex};
            transform: scale(0.8) translateY(20px);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        `;

        element.innerHTML = this.getComponentHTML(component);

        // Add event listeners
        this.bindComponentEvents(element, component);

        return element;
    }

    getComponentHTML(component) {
        const headerButtons = this.getHeaderButtons(component);

        return `
            <div class="component-header" data-drag-handle="true">
                <div class="component-title">
                    <span class="title-icon">${this.getComponentIcon(component.type)}</span>
                    <span class="title-text">${component.title}</span>
                </div>
                <div class="component-actions">
                    ${headerButtons}
                </div>
            </div>
            <div class="component-content ${component.isCollapsed ? 'collapsed' : ''}">
                ${this.getComponentContent(component)}
            </div>
            ${component.resizable ? this.getResizeHandles() : ''}
        `;
    }

    getComponentIcon(type) {
        const icons = {
            chat: '💬',
            panel: '📋',
            media: '🎵',
            settings: '⚙️',
            profile: '👤',
            ai: '🤖',
            files: '📁',
            search: '🔍',
            notifications: '🔔',
            calendar: '📅'
        };
        return icons[type] || '📋';
    }

    getHeaderButtons(component) {
        let buttons = '';

        if (component.collapsible) {
            buttons += `
                <button class="component-btn collapse-btn" title="${component.isCollapsed ? 'Expand' : 'Collapse'}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="${component.isCollapsed ? '6,9 12,15 18,9' : '18,15 12,9 6,15'}"/>
                    </svg>
                </button>
            `;
        }

        if (component.closable) {
            buttons += `
                <button class="component-btn close-btn" title="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            `;
        }

        return buttons;
    }

    getComponentContent(component) {
        switch (component.type) {
            case 'chat':
                return this.getChatContent(component);
            case 'ai':
                return this.getAIContent(component);
            case 'profile':
                return this.getProfileContent(component);
            case 'settings':
                return this.getSettingsContent(component);
            case 'media':
                return this.getMediaContent(component);
            default:
                return `<div class="component-body">${component.content}</div>`;
        }
    }

    getChatContent(component) {
        return `
            <div class="chat-widget">
                <div class="chat-messages">
                    <div class="message">
                        <div class="message-avatar">👤</div>
                        <div class="message-content">
                            <div class="message-text">Hello! This is a modular chat component.</div>
                            <div class="message-time">Just now</div>
                        </div>
                    </div>
                </div>
                <div class="chat-input">
                    <input type="text" placeholder="Type a message..." />
                    <button class="send-btn">📤</button>
                </div>
            </div>
        `;
    }

    getAIContent(component) {
        return `
            <div class="ai-widget">
                <div class="ai-status">
                    <div class="status-indicator online"></div>
                    <span>AI Assistant is ready</span>
                </div>
                <div class="ai-quick-actions">
                    <button class="quick-action-btn">📊 Analyze Data</button>
                    <button class="quick-action-btn">🎨 Generate Image</button>
                    <button class="quick-action-btn">📝 Write Content</button>
                    <button class="quick-action-btn">🔍 Web Search</button>
                </div>
                <div class="ai-input">
                    <textarea placeholder="Ask AI anything..."></textarea>
                    <button class="ai-send-btn">🤖</button>
                </div>
            </div>
        `;
    }

    getProfileContent(component) {
        return `
            <div class="profile-widget">
                <div class="profile-header">
                    <div class="profile-avatar">👤</div>
                    <div class="profile-info">
                        <div class="profile-name">Your Name</div>
                        <div class="profile-status">Online</div>
                    </div>
                </div>
                <div class="profile-actions">
                    <button class="profile-btn">Edit Profile</button>
                    <button class="profile-btn">Settings</button>
                    <button class="profile-btn">Logout</button>
                </div>
            </div>
        `;
    }

    getSettingsContent(component) {
        return `
            <div class="settings-widget">
                <div class="setting-item">
                    <label>Theme</label>
                    <select>
                        <option>Light</option>
                        <option>Dark</option>
                        <option>AMOLED</option>
                    </select>
                </div>
                <div class="setting-item">
                    <label>Notifications</label>
                    <input type="checkbox" checked />
                </div>
                <div class="setting-item">
                    <label>Animations</label>
                    <input type="checkbox" checked />
                </div>
            </div>
        `;
    }

    getMediaContent(component) {
        return `
            <div class="media-widget">
                <div class="media-player">
                    <div class="media-info">
                        <div class="media-title">No media playing</div>
                        <div class="media-artist">Select a track</div>
                    </div>
                    <div class="media-controls">
                        <button>⏮️</button>
                        <button>▶️</button>
                        <button>⏭️</button>
                    </div>
                </div>
            </div>
        `;
    }

    getResizeHandles() {
        return `
            <div class="resize-handles">
                <div class="resize-handle resize-n" data-direction="n"></div>
                <div class="resize-handle resize-ne" data-direction="ne"></div>
                <div class="resize-handle resize-e" data-direction="e"></div>
                <div class="resize-handle resize-se" data-direction="se"></div>
                <div class="resize-handle resize-s" data-direction="s"></div>
                <div class="resize-handle resize-sw" data-direction="sw"></div>
                <div class="resize-handle resize-w" data-direction="w"></div>
                <div class="resize-handle resize-nw" data-direction="nw"></div>
            </div>
        `;
    }

    // ================================
    // EVENT BINDING
    // ================================

    bindComponentEvents(element, component) {
        // Header button events
        const collapseBtn = element.querySelector('.collapse-btn');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleCollapse(component.id);
            });
        }

        const closeBtn = element.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeComponent(component.id);
            });
        }

        // Focus management
        element.addEventListener('mousedown', () => {
            this.bringToFront(component.id);
        });

        // Double-click to toggle maximize
        const header = element.querySelector('.component-header');
        header.addEventListener('dblclick', () => {
            this.toggleMaximize(component.id);
        });

        // Component-specific events
        if (component.callbacks.onClick) {
            element.addEventListener('click', component.callbacks.onClick);
        }
    }

    // ================================
    // DRAG AND DROP SYSTEM
    // ================================

    setupDragAndDrop() {
        let dragOffset = { x: 0, y: 0 };
        let isDragging = false;

        document.addEventListener('mousedown', (e) => {
            const dragHandle = e.target.closest('[data-drag-handle]');
            if (!dragHandle) return;

            const component = e.target.closest('.modular-component');
            if (!component) return;

            const componentData = this.components.get(component.dataset.componentId);
            if (!componentData || !componentData.draggable) return;

            isDragging = true;
            const rect = component.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;

            this.dragState = {
                component: componentData,
                element: component,
                offset: dragOffset,
                startPosition: { x: componentData.position.x, y: componentData.position.y }
            };

            component.style.cursor = 'grabbing';
            component.style.userSelect = 'none';
            component.style.transition = 'none';

            this.showDragHelpers();
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !this.dragState) return;

            const newX = e.clientX - this.dragState.offset.x;
            const newY = e.clientY - this.dragState.offset.y;

            // Snap to grid
            const snappedX = this.snapToGrid(newX);
            const snappedY = this.snapToGrid(newY);

            // Constrain to viewport
            const constrainedPos = this.constrainToViewport(snappedX, snappedY, this.dragState.component);

            this.updateComponentPosition(this.dragState.component.id, constrainedPos.x, constrainedPos.y);
            this.checkSnapTargets(e.clientX, e.clientY);
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging || !this.dragState) return;

            isDragging = false;

            const element = this.dragState.element;
            element.style.cursor = '';
            element.style.userSelect = '';
            element.style.transition = '';

            this.hideDragHelpers();
            this.checkForAutoGroup();
            this.saveUserLayout();

            this.dragState = null;
        });
    }

    snapToGrid(value) {
        return Math.round(value / this.gridSize) * this.gridSize;
    }

    constrainToViewport(x, y, component) {
        const maxX = window.innerWidth - component.size.width;
        const maxY = window.innerHeight - component.size.height;

        return {
            x: Math.max(0, Math.min(x, maxX)),
            y: Math.max(0, Math.min(y, maxY))
        };
    }

    updateComponentPosition(componentId, x, y) {
        const component = this.components.get(componentId);
        if (!component) return;

        component.position.x = x;
        component.position.y = y;

        if (component.element) {
            component.element.style.left = x + 'px';
            component.element.style.top = y + 'px';
        }
    }

    checkSnapTargets(mouseX, mouseY) {
        if (!this.dragState) return;

        const snapTargets = [];
        this.components.forEach((comp, id) => {
            if (id === this.dragState.component.id || !comp.isVisible) return;

            const element = comp.element;
            const rect = element.getBoundingClientRect();

            // Check for edge snapping
            const edges = {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom
            };

            Object.entries(edges).forEach(([edge, position]) => {
                const distance = Math.abs(mouseX - position);
                if (distance < this.snapThreshold) {
                    snapTargets.push({
                        type: 'edge',
                        edge,
                        position,
                        distance,
                        targetId: id
                    });
                }
            });
        });

        this.highlightSnapTargets(snapTargets);
    }

    highlightSnapTargets(targets) {
        // Remove existing highlights
        document.querySelectorAll('.snap-highlight').forEach(el => el.remove());

        if (targets.length === 0) return;

        // Find closest target
        const closest = targets.reduce((prev, current) =>
            prev.distance < current.distance ? prev : current
        );

        // Create highlight
        const highlight = document.createElement('div');
        highlight.className = 'snap-highlight';
        highlight.style.cssText = `
            position: fixed;
            background: rgba(102, 126, 234, 0.3);
            border: 2px solid var(--accent-primary);
            pointer-events: none;
            z-index: 10000;
            transition: all 0.15s ease;
        `;

        // Position highlight based on snap type
        if (closest.type === 'edge') {
            this.positionEdgeHighlight(highlight, closest);
        }

        document.body.appendChild(highlight);
    }

    positionEdgeHighlight(highlight, target) {
        const component = this.components.get(target.targetId);
        const element = component.element;
        const rect = element.getBoundingClientRect();

        switch (target.edge) {
            case 'left':
                highlight.style.left = (rect.left - 4) + 'px';
                highlight.style.top = rect.top + 'px';
                highlight.style.width = '4px';
                highlight.style.height = rect.height + 'px';
                break;
            case 'right':
                highlight.style.left = rect.right + 'px';
                highlight.style.top = rect.top + 'px';
                highlight.style.width = '4px';
                highlight.style.height = rect.height + 'px';
                break;
            case 'top':
                highlight.style.left = rect.left + 'px';
                highlight.style.top = (rect.top - 4) + 'px';
                highlight.style.width = rect.width + 'px';
                highlight.style.height = '4px';
                break;
            case 'bottom':
                highlight.style.left = rect.left + 'px';
                highlight.style.top = rect.bottom + 'px';
                highlight.style.width = rect.width + 'px';
                highlight.style.height = '4px';
                break;
        }
    }

    showDragHelpers() {
        // Show grid overlay
        const gridOverlay = document.createElement('div');
        gridOverlay.id = 'grid-overlay';
        gridOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            z-index: 9999;
            background-image:
                linear-gradient(rgba(102, 126, 234, 0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(102, 126, 234, 0.1) 1px, transparent 1px);
            background-size: ${this.gridSize}px ${this.gridSize}px;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(gridOverlay);

        setTimeout(() => {
            gridOverlay.style.opacity = '1';
        }, 10);
    }

    hideDragHelpers() {
        const gridOverlay = document.getElementById('grid-overlay');
        if (gridOverlay) {
            gridOverlay.style.opacity = '0';
            setTimeout(() => gridOverlay.remove(), 300);
        }

        document.querySelectorAll('.snap-highlight').forEach(el => el.remove());
    }

    checkForAutoGroup() {
        if (!this.dragState) return;

        const draggedComponent = this.dragState.component;
        const threshold = 50;

        // Check if dropped near another component
        this.components.forEach((comp, id) => {
            if (id === draggedComponent.id || !comp.isVisible) return;

            const distance = this.calculateDistance(
                draggedComponent.position,
                comp.position
            );

            if (distance < threshold) {
                this.showGroupDialog(draggedComponent.id, id);
            }
        });
    }

    calculateDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // ================================
    // RESIZE SYSTEM
    // ================================

    setupResizing() {
        document.addEventListener('mousedown', (e) => {
            const resizeHandle = e.target.closest('.resize-handle');
            if (!resizeHandle) return;

            const component = e.target.closest('.modular-component');
            if (!component) return;

            const componentData = this.components.get(component.dataset.componentId);
            if (!componentData || !componentData.resizable) return;

            this.resizeState = {
                component: componentData,
                element: component,
                direction: resizeHandle.dataset.direction,
                startMouseX: e.clientX,
                startMouseY: e.clientY,
                startWidth: componentData.size.width,
                startHeight: componentData.size.height,
                startX: componentData.position.x,
                startY: componentData.position.y
            };

            component.style.transition = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.resizeState) return;

            const deltaX = e.clientX - this.resizeState.startMouseX;
            const deltaY = e.clientY - this.resizeState.startMouseY;

            const newDimensions = this.calculateNewDimensions(deltaX, deltaY);
            this.updateComponentSize(this.resizeState.component.id, newDimensions);
        });

        document.addEventListener('mouseup', () => {
            if (!this.resizeState) return;

            this.resizeState.element.style.transition = '';
            this.resizeState = null;
            this.saveUserLayout();
        });
    }

    calculateNewDimensions(deltaX, deltaY) {
        const { component, direction, startWidth, startHeight, startX, startY } = this.resizeState;
        const { minSize, maxSize } = component;

        let newWidth = startWidth;
        let newHeight = startHeight;
        let newX = startX;
        let newY = startY;

        // Calculate new dimensions based on resize direction
        switch (direction) {
            case 'e':
                newWidth = startWidth + deltaX;
                break;
            case 'w':
                newWidth = startWidth - deltaX;
                newX = startX + deltaX;
                break;
            case 's':
                newHeight = startHeight + deltaY;
                break;
            case 'n':
                newHeight = startHeight - deltaY;
                newY = startY + deltaY;
                break;
            case 'se':
                newWidth = startWidth + deltaX;
                newHeight = startHeight + deltaY;
                break;
            case 'sw':
                newWidth = startWidth - deltaX;
                newHeight = startHeight + deltaY;
                newX = startX + deltaX;
                break;
            case 'ne':
                newWidth = startWidth + deltaX;
                newHeight = startHeight - deltaY;
                newY = startY + deltaY;
                break;
            case 'nw':
                newWidth = startWidth - deltaX;
                newHeight = startHeight - deltaY;
                newX = startX + deltaX;
                newY = startY + deltaY;
                break;
        }

        // Constrain to min/max sizes
        newWidth = Math.max(minSize.width, Math.min(maxSize.width, newWidth));
        newHeight = Math.max(minSize.height, Math.min(maxSize.height, newHeight));

        // Adjust position if constrained by min size
        if (direction.includes('w') && newWidth === minSize.width) {
            newX = startX + startWidth - minSize.width;
        }
        if (direction.includes('n') && newHeight === minSize.height) {
            newY = startY + startHeight - minSize.height;
        }

        return {
            width: newWidth,
            height: newHeight,
            x: newX,
            y: newY
        };
    }

    updateComponentSize(componentId, dimensions) {
        const component = this.components.get(componentId);
        if (!component) return;

        component.size.width = dimensions.width;
        component.size.height = dimensions.height;
        component.position.x = dimensions.x;
        component.position.y = dimensions.y;

        if (component.element) {
            const element = component.element;
            element.style.width = dimensions.width + 'px';
            element.style.height = dimensions.height + 'px';
            element.style.left = dimensions.x + 'px';
            element.style.top = dimensions.y + 'px';
        }
    }

    // ================================
    // COMPONENT ACTIONS
    // ================================

    toggleCollapse(componentId) {
        const component = this.components.get(componentId);
        if (!component) return;

        component.isCollapsed = !component.isCollapsed;

        const element = component.element;
        const content = element.querySelector('.component-content');
        const collapseBtn = element.querySelector('.collapse-btn svg polyline');

        if (component.isCollapsed) {
            content.style.height = '0';
            content.style.opacity = '0';
            content.style.overflow = 'hidden';
            element.style.height = '60px'; // Header height only

            if (collapseBtn) {
                collapseBtn.setAttribute('points', '6,9 12,15 18,9');
            }
        } else {
            content.style.height = '';
            content.style.opacity = '';
            content.style.overflow = '';
            element.style.height = component.size.height + 'px';

            if (collapseBtn) {
                collapseBtn.setAttribute('points', '18,15 12,9 6,15');
            }
        }

        this.animateCollapse(element, component.isCollapsed);
    }

    animateCollapse(element, isCollapsing) {
        element.style.transition = 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';

        setTimeout(() => {
            element.style.transition = '';
        }, 300);
    }

    closeComponent(componentId) {
        const component = this.components.get(componentId);
        if (!component) return;

        component.isVisible = false;

        if (component.element) {
            this.animateComponentOut(component.element, () => {
                component.element.remove();
                component.element = null;
            });
        }

        this.saveUserLayout();
    }

    bringToFront(componentId) {
        const component = this.components.get(componentId);
        if (!component) return;

        // Find highest z-index
        let maxZ = 100;
        this.components.forEach(comp => {
            if (comp.zIndex > maxZ) {
                maxZ = comp.zIndex;
            }
        });

        component.zIndex = maxZ + 1;

        if (component.element) {
            component.element.style.zIndex = component.zIndex;
        }
    }

    toggleMaximize(componentId) {
        const component = this.components.get(componentId);
        if (!component) return;

        if (!component.isMaximized) {
            // Store current size and position
            component.restoreState = {
                position: { ...component.position },
                size: { ...component.size }
            };

            // Maximize
            component.position = { x: 20, y: 20 };
            component.size = {
                width: window.innerWidth - 40,
                height: window.innerHeight - 40
            };
            component.isMaximized = true;
        } else {
            // Restore
            if (component.restoreState) {
                component.position = { ...component.restoreState.position };
                component.size = { ...component.restoreState.size };
            }
            component.isMaximized = false;
        }

        this.updateComponentElement(component);
    }

    updateComponentElement(component) {
        if (!component.element) return;

        const element = component.element;
        element.style.transition = 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
        element.style.left = component.position.x + 'px';
        element.style.top = component.position.y + 'px';
        element.style.width = component.size.width + 'px';
        element.style.height = component.size.height + 'px';

        setTimeout(() => {
            element.style.transition = '';
        }, 300);
    }

    // ================================
    // ANIMATIONS
    // ================================

    animateComponentIn(element) {
        requestAnimationFrame(() => {
            element.style.transform = 'scale(1) translateY(0)';
            element.style.opacity = '1';
        });
    }

    animateComponentOut(element, callback) {
        element.style.transition = 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
        element.style.transform = 'scale(0.8) translateY(20px)';
        element.style.opacity = '0';

        setTimeout(() => {
            if (callback) callback();
        }, 300);
    }

    // ================================
    // KEYBOARD NAVIGATION
    // ================================

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Esc to close focused component
            if (e.key === 'Escape') {
                const focusedComponent = document.querySelector('.modular-component:focus');
                if (focusedComponent) {
                    this.closeComponent(focusedComponent.dataset.componentId);
                }
            }

            // Alt + Tab to cycle through components
            if (e.altKey && e.key === 'Tab') {
                e.preventDefault();
                this.cycleComponents();
            }

            // Space to toggle collapse on focused component
            if (e.key === ' ' && e.target.closest('.modular-component')) {
                e.preventDefault();
                const component = e.target.closest('.modular-component');
                this.toggleCollapse(component.dataset.componentId);
            }
        });
    }

    cycleComponents() {
        const visibleComponents = Array.from(this.components.values())
            .filter(comp => comp.isVisible)
            .sort((a, b) => a.zIndex - b.zIndex);

        if (visibleComponents.length === 0) return;

        const currentFocused = document.activeElement?.closest('.modular-component');
        let nextIndex = 0;

        if (currentFocused) {
            const currentId = currentFocused.dataset.componentId;
            const currentIndex = visibleComponents.findIndex(comp => comp.id === currentId);
            nextIndex = (currentIndex + 1) % visibleComponents.length;
        }

        const nextComponent = visibleComponents[nextIndex];
        if (nextComponent.element) {
            nextComponent.element.focus();
            this.bringToFront(nextComponent.id);
        }
    }

    // ================================
    // LAYOUT MANAGEMENT
    // ================================

    saveUserLayout() {
        const layout = {};
        this.components.forEach((component, id) => {
            layout[id] = {
                position: component.position,
                size: component.size,
                isCollapsed: component.isCollapsed,
                isVisible: component.isVisible,
                zIndex: component.zIndex
            };
        });

        localStorage.setItem('modularLayout', JSON.stringify(layout));
    }

    loadUserLayout() {
        try {
            const savedLayout = localStorage.getItem('modularLayout');
            if (!savedLayout) return;

            const layout = JSON.parse(savedLayout);

            Object.entries(layout).forEach(([id, data]) => {
                const component = this.components.get(id);
                if (component) {
                    Object.assign(component, data);
                    if (component.element) {
                        this.updateComponentElement(component);
                    }
                }
            });
        } catch (error) {
            console.warn('Failed to load user layout:', error);
        }
    }

    resetLayout() {
        this.components.forEach((component, id) => {
            // Reset to default positions
            component.position = { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };
            component.size = { width: 300, height: 200 };
            component.isCollapsed = false;
            component.isMaximized = false;
            component.zIndex = 100;

            if (component.element) {
                this.updateComponentElement(component);
            }
        });

        this.saveUserLayout();
    }

    // ================================
    // GROUPING SYSTEM
    // ================================

    showGroupDialog(componentId1, componentId2) {
        const component1 = this.components.get(componentId1);
        const component2 = this.components.get(componentId2);

        const dialog = document.createElement('div');
        dialog.className = 'group-dialog glass';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 2rem;
            border-radius: 16px;
            z-index: 10000;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 12px 48px rgba(0, 0, 0, 0.3);
        `;

        dialog.innerHTML = `
            <h3>Create Component Group</h3>
            <p>Would you like to group "${component1.title}" and "${component2.title}" together?</p>
            <div class="dialog-actions">
                <button class="dialog-btn primary" id="createGroup">Create Group</button>
                <button class="dialog-btn secondary" id="cancelGroup">Cancel</button>
            </div>
        `;

        document.body.appendChild(dialog);

        // Handle actions
        dialog.querySelector('#createGroup').addEventListener('click', () => {
            this.createComponentGroup([componentId1, componentId2]);
            dialog.remove();
        });

        dialog.querySelector('#cancelGroup').addEventListener('click', () => {
            dialog.remove();
        });

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (dialog.parentNode) {
                dialog.remove();
            }
        }, 5000);
    }

    createComponentGroup(componentIds) {
        const groupId = `group_${Date.now()}`;
        const groupComponents = componentIds.map(id => this.components.get(id));

        // Calculate group bounds
        const bounds = this.calculateGroupBounds(groupComponents);

        // Create group container
        const groupComponent = this.registerComponent(groupId, {
            type: 'group',
            title: `Group (${groupComponents.length} items)`,
            position: bounds.position,
            size: bounds.size,
            content: this.createGroupContent(groupComponents)
        });

        // Hide individual components
        groupComponents.forEach(comp => {
            comp.isVisible = false;
            if (comp.element) {
                comp.element.style.display = 'none';
            }
        });

        return groupId;
    }

    calculateGroupBounds(components) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        components.forEach(comp => {
            minX = Math.min(minX, comp.position.x);
            minY = Math.min(minY, comp.position.y);
            maxX = Math.max(maxX, comp.position.x + comp.size.width);
            maxY = Math.max(maxY, comp.position.y + comp.size.height);
        });

        return {
            position: { x: minX - 10, y: minY - 10 },
            size: { width: maxX - minX + 20, height: maxY - minY + 20 }
        };
    }

    createGroupContent(components) {
        return `
            <div class="group-container">
                ${components.map(comp => `
                    <div class="group-item">
                        <span class="group-item-icon">${this.getComponentIcon(comp.type)}</span>
                        <span class="group-item-title">${comp.title}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ================================
    // PUBLIC API METHODS
    // ================================

    createComponent(config) {
        return this.registerComponent(Utils.generateId(), config);
    }

    getComponent(id) {
        return this.components.get(id);
    }

    updateComponent(id, updates) {
        const component = this.components.get(id);
        if (!component) return;

        Object.assign(component, updates);

        if (component.element) {
            this.updateComponentElement(component);
        }
    }

    removeComponent(id) {
        return this.closeComponent(id);
    }

    getAllComponents() {
        return Array.from(this.components.values());
    }

    getVisibleComponents() {
        return Array.from(this.components.values()).filter(comp => comp.isVisible);
    }

    // ================================
    // UTILITY METHODS
    // ================================

    generateId() {
        return 'comp_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
}

// Add required CSS styles
const modularCSS = `
/* Modular Component System Styles */
.modular-component {
    background: var(--glass-primary);
    backdrop-filter: var(--blur-glass);
    border: var(--border-glass);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-glass);
    overflow: hidden;
    user-select: none;
    outline: none;
}

.modular-component:focus {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1), var(--shadow-glass);
}

.component-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background: var(--glass-secondary);
    border-bottom: var(--border-glass);
    cursor: grab;
    min-height: 60px;
}

.component-header:active {
    cursor: grabbing;
}

.component-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: var(--text-primary);
}

.title-icon {
    font-size: 1.2rem;
}

.component-actions {
    display: flex;
    gap: 0.25rem;
}

.component-btn {
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--transition-fast);
}

.component-btn:hover {
    background: var(--glass-hover);
    color: var(--text-primary);
}

.component-content {
    transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
    overflow: hidden;
}

.component-content.collapsed {
    height: 0 !important;
    opacity: 0;
}

.component-body {
    padding: 1rem;
    color: var(--text-secondary);
    line-height: 1.5;
}

/* Resize Handles */
.resize-handles {
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.resize-handle {
    position: absolute;
    pointer-events: all;
    background: transparent;
    transition: background 0.2s ease;
}

.resize-handle:hover {
    background: rgba(102, 126, 234, 0.2);
}

.resize-n, .resize-s {
    left: 8px;
    right: 8px;
    height: 8px;
    cursor: ns-resize;
}

.resize-e, .resize-w {
    top: 8px;
    bottom: 8px;
    width: 8px;
    cursor: ew-resize;
}

.resize-n { top: -4px; }
.resize-s { bottom: -4px; }
.resize-e { right: -4px; }
.resize-w { left: -4px; }

.resize-ne, .resize-nw, .resize-se, .resize-sw {
    width: 16px;
    height: 16px;
}

.resize-ne { top: -8px; right: -8px; cursor: ne-resize; }
.resize-nw { top: -8px; left: -8px; cursor: nw-resize; }
.resize-se { bottom: -8px; right: -8px; cursor: se-resize; }
.resize-sw { bottom: -8px; left: -8px; cursor: sw-resize; }

/* Component Type Styles */
.chat-widget {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.chat-messages {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
}

.message {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.message-avatar {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: var(--glass-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.message-content {
    flex: 1;
}

.message-text {
    background: var(--glass-secondary);
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
}

.message-time {
    font-size: 0.75rem;
    color: var(--text-tertiary);
}

.chat-input {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    border-top: var(--border-glass);
}

.chat-input input {
    flex: 1;
    padding: 0.5rem;
    background: var(--glass-secondary);
    border: var(--border-glass);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    outline: none;
}

.send-btn {
    padding: 0.5rem;
    background: var(--accent-primary);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
}

/* AI Widget */
.ai-widget {
    padding: 1rem;
}

.ai-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-success);
}

.ai-quick-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.quick-action-btn {
    padding: 0.5rem;
    background: var(--glass-secondary);
    border: var(--border-glass);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.75rem;
    transition: var(--transition-fast);
}

.quick-action-btn:hover {
    background: var(--glass-hover);
    color: var(--text-primary);
}

.ai-input {
    display: flex;
    gap: 0.5rem;
}

.ai-input textarea {
    flex: 1;
    padding: 0.5rem;
    background: var(--glass-secondary);
    border: var(--border-glass);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    resize: none;
    outline: none;
    height: 60px;
}

.ai-send-btn {
    padding: 0.5rem;
    background: var(--accent-primary);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
}

/* Profile Widget */
.profile-widget {
    padding: 1rem;
}

.profile-header {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
}

.profile-avatar {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    background: var(--glass-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
}

.profile-info {
    flex: 1;
}

.profile-name {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.profile-status {
    font-size: 0.875rem;
    color: var(--accent-success);
}

.profile-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.profile-btn {
    padding: 0.5rem;
    background: var(--glass-secondary);
    border: var(--border-glass);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
    transition: var(--transition-fast);
}

.profile-btn:hover {
    background: var(--glass-hover);
    color: var(--text-primary);
}

/* Settings Widget */
.settings-widget {
    padding: 1rem;
}

.setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: var(--border-glass);
}

.setting-item:last-child {
    border-bottom: none;
}

.setting-item label {
    color: var(--text-secondary);
    font-size: 0.875rem;
}

.setting-item select,
.setting-item input {
    background: var(--glass-secondary);
    border: var(--border-glass);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    padding: 0.25rem 0.5rem;
}

/* Media Widget */
.media-widget {
    padding: 1rem;
}

.media-player {
    text-align: center;
}

.media-info {
    margin-bottom: 1rem;
}

.media-title {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.media-artist {
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.media-controls {
    display: flex;
    justify-content: center;
    gap: 1rem;
}

.media-controls button {
    width: 40px;
    height: 40px;
    background: var(--glass-secondary);
    border: var(--border-glass);
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    transition: var(--transition-fast);
}

.media-controls button:hover {
    background: var(--glass-hover);
    transform: scale(1.1);
}

/* Group Dialog */
.group-dialog {
    min-width: 300px;
    text-align: center;
    animation: slideInScale 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes slideInScale {
    from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
    }
    to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
    }
}

.group-dialog h3 {
    color: var(--text-primary);
    margin-bottom: 1rem;
}

.group-dialog p {
    color: var(--text-secondary);
    margin-bottom: 2rem;
    line-height: 1.5;
}

.dialog-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
}

.dialog-btn {
    padding: 0.75rem 1.5rem;
    border: var(--border-glass);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-weight: 500;
    transition: var(--transition-fast);
}

.dialog-btn.primary {
    background: var(--accent-primary);
    color: white;
    border-color: var(--accent-primary);
}

.dialog-btn.secondary {
    background: var(--glass-secondary);
    color: var(--text-secondary);
}

.dialog-btn:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-glass-hover);
}

/* Snap Highlight */
.snap-highlight {
    border-radius: 4px;
    animation: snapPulse 0.5s ease-in-out infinite alternate;
}

@keyframes snapPulse {
    from { opacity: 0.6; }
    to { opacity: 1; }
}

/* Group Container */
.group-container {
    padding: 1rem;
}

.group-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--glass-secondary);
    border-radius: var(--radius-sm);
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: var(--transition-fast);
}

.group-item:hover {
    background: var(--glass-hover);
}

.group-item-icon {
    font-size: 1.1rem;
}

.group-item-title {
    flex: 1;
    font-size: 0.875rem;
    color: var(--text-secondary);
}
`;

// Inject CSS
const styleSheet = document.createElement('style');
styleSheet.textContent = modularCSS;
document.head.appendChild(styleSheet);

// Export for global use
window.ModularComponentSystem = ModularComponentSystem;