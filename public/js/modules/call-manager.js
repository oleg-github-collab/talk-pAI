/**
 * TalkPAI Call Manager Module
 * Bridges WebRTC client with UI controls and provides graceful fallbacks.
 */

class CallManager {
    constructor(messenger) {
        this.messenger = messenger;
        this.webrtcClient = null;
        this.currentTargetId = null;
        this.currentChatId = null;
        this.currentParticipants = [];
        this.callType = 'voice';
        this.isScreenSharing = false;
        this.isInitialized = false;

        this.init();
    }

    init() {
        try {
            this.setupCallInterface();
            this.bindInternalEvents();
            this.registerWebRTCListeners();
            this.isInitialized = true;
            window.callManager = this;
            console.log('📞 Call Manager initialized');
        } catch (error) {
            console.error('❌ Failed to initialize call manager:', error);
            this.messenger?.handleError?.(error, 'Call Manager Initialization');
        }
    }

    registerWebRTCListeners() {
        if (window.webrtcClient) {
            this.attachWebRTCClient(window.webrtcClient);
        }

        document.addEventListener('webrtc:ready', (event) => {
            this.attachWebRTCClient(event.detail);
        }, { once: true });
    }

    attachWebRTCClient(client) {
        if (!client) return;
        this.webrtcClient = client;
        this.ensureUserRegistration();
    }

    ensureUserRegistration() {
        if (!this.webrtcClient || typeof this.webrtcClient.register !== 'function') {
            return;
        }

        const authUser = window.authManager?.getCurrentUser?.() || window.currentUser;
        this.webrtcClient.register(authUser);
    }

    async startCall(type = 'voice', chatId = null, participants = []) {
        try {
            if (!this.isInitialized) {
                throw new Error('Call manager not initialized');
            }

            this.callType = type;
            this.currentChatId = chatId;
            this.currentParticipants = participants || [];

        const targetUserId = this.resolveTargetUserId();
        if (!targetUserId) {
            this.showNotification('No recipient available for this call. Starting demo preview.', 'info');
            this.showDemoCallInterface(type);
            return;
        }

            this.currentTargetId = targetUserId;

            if (this.webrtcClient && typeof this.webrtcClient.initiateCall === 'function') {
                this.ensureUserRegistration();
                await this.webrtcClient.initiateCall(targetUserId, type === 'video' ? 'video' : 'audio', chatId);
                return;
            }

            this.showDemoCallInterface(type);
        } catch (error) {
            console.error('❌ Failed to start call:', error);
            this.messenger?.handleError?.(error, 'Start Call');
            this.showNotification('Failed to start call. Please try again.', 'error');
        }
    }

    endCall() {
        try {
            if (this.webrtcClient && typeof this.webrtcClient.endCall === 'function') {
                this.webrtcClient.endCall();
            }
            this.hideCallInterface();
        } catch (error) {
            console.error('❌ Failed to end call:', error);
            this.messenger?.handleError?.(error, 'End Call');
        } finally {
            this.currentTargetId = null;
            this.currentChatId = null;
            this.isScreenSharing = false;
        }
    }

    toggleMute() {
        try {
            let muted = false;
            if (this.webrtcClient && typeof this.webrtcClient.toggleAudio === 'function') {
                muted = this.webrtcClient.toggleAudio();
            } else {
                muted = !this.messenger?.isMuted;
                this.messenger.isMuted = muted;
            }

            const muteBtn = document.getElementById('muteBtn');
            muteBtn?.classList.toggle('active', muted);
            this.showNotification(muted ? 'Microphone muted' : 'Microphone unmuted', muted ? 'info' : 'success');
        } catch (error) {
            console.error('❌ Toggle mute error:', error);
            this.messenger?.handleError?.(error, 'Toggle Mute');
        }
    }

    toggleVideo() {
        try {
            let disabled = false;
            if (this.webrtcClient && typeof this.webrtcClient.toggleVideo === 'function') {
                disabled = this.webrtcClient.toggleVideo();
            } else {
                disabled = !this.messenger?.isVideoOn;
                this.messenger.isVideoOn = !disabled;
            }

            const cameraBtn = document.getElementById('cameraBtn');
            cameraBtn?.classList.toggle('active', disabled);
            this.showNotification(disabled ? 'Camera off' : 'Camera on', disabled ? 'info' : 'success');
        } catch (error) {
            console.error('❌ Toggle video error:', error);
            this.messenger?.handleError?.(error, 'Toggle Video');
        }
    }

    toggleSpeaker() {
        try {
            this.messenger.isSpeakerOn = !this.messenger.isSpeakerOn;
            const speakerBtn = document.getElementById('speakerBtn');
            speakerBtn?.classList.toggle('active', this.messenger.isSpeakerOn);
            this.showNotification(this.messenger.isSpeakerOn ? 'Speaker on' : 'Speaker off', 'info');
        } catch (error) {
            console.error('❌ Toggle speaker error:', error);
            this.messenger?.handleError?.(error, 'Toggle Speaker');
        }
    }

    async toggleScreenShare() {
        try {
            if (!this.webrtcClient) {
                this.showNotification('Screen sharing requires WebRTC connection.', 'error');
                return;
            }

            if (!this.isScreenSharing && typeof this.webrtcClient.startScreenShare === 'function') {
                await this.webrtcClient.startScreenShare();
                this.isScreenSharing = true;
            } else if (this.isScreenSharing && typeof this.webrtcClient.stopScreenShare === 'function') {
                await this.webrtcClient.stopScreenShare();
                this.isScreenSharing = false;
            }

            const screenBtn = document.getElementById('screenShareBtn');
            screenBtn?.classList.toggle('active', this.isScreenSharing);
        } catch (error) {
            console.error('❌ Screen share error:', error);
            this.messenger?.handleError?.(error, 'Toggle Screen Share');
        }
    }

    showDemoCallInterface(callType) {
        const overlay = document.createElement('div');
        overlay.className = 'call-ui-overlay active';
        overlay.innerHTML = `
            <div class="call-interface calling">
                <div class="call-info">
                    <div class="call-avatar">${callType === 'video' ? '📹' : '📞'}</div>
                    <h3>${callType === 'video' ? 'Video' : 'Voice'} Call (Demo)</h3>
                    <p>WebRTC server not connected. Running in demo mode.</p>
                </div>
                <div class="call-controls">
                    <button class="call-btn end-call" id="demoEndCallBtn">📞 End Call</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.getElementById('demoEndCallBtn')?.addEventListener('click', () => {
            overlay.remove();
        });

        setTimeout(() => {
            overlay.remove();
        }, 5000);
    }

    setupCallInterface() {
        if (document.getElementById('callOverlay')) {
            return;
        }

        const callOverlay = document.createElement('div');
        callOverlay.id = 'callOverlay';
        callOverlay.className = 'call-overlay';
        callOverlay.innerHTML = this.createCallInterface();
        document.body.appendChild(callOverlay);
    }

    bindInternalEvents() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.webrtcClient?.currentCall) {
                this.showNotification('Call is running in the background.', 'info');
            }
        });
    }

    createCallInterface() {
        return `
            <div class="call-interface">
                <div class="call-header">
                    <div class="call-info">
                        <div class="caller-avatar" id="callerAvatar">👤</div>
                        <div class="caller-details">
                            <h3 class="caller-name" id="callerName">Contact</h3>
                            <p class="call-status" id="callStatus">Connecting...</p>
                            <div class="call-timer" id="callTimer" style="display: none;">00:00</div>
                        </div>
                    </div>
                </div>

                <div class="video-container" id="videoContainer" style="display: none;">
                    <video id="remoteVideo" class="remote-video" autoplay playsinline></video>
                    <video id="localVideo" class="local-video" autoplay playsinline muted></video>
                </div>

                <div class="audio-visualization" id="audioVisualization">
                    <div class="audio-wave">
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                    </div>
                </div>

                <div class="call-controls">
                    <div class="primary-controls">
                        <button class="control-btn mute-btn" id="muteBtn" title="Mute">
                            <span class="btn-icon">🎤</span>
                            <span class="btn-label">Mute</span>
                        </button>
                        <button class="control-btn end-call-btn" id="endCallBtn" title="End Call">
                            <span class="btn-icon">📞</span>
                            <span class="btn-label">End</span>
                        </button>
                        <button class="control-btn video-btn" id="cameraBtn" title="Toggle Video">
                            <span class="btn-icon">📹</span>
                            <span class="btn-label">Video</span>
                        </button>
                    </div>
                    <div class="secondary-controls">
                        <button class="control-btn speaker-btn" id="speakerBtn" title="Speaker">
                            <span class="btn-icon">🔊</span>
                        </button>
                        <button class="control-btn screen-btn" id="screenShareBtn" title="Share Screen">
                            <span class="btn-icon">📺</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    hideCallInterface() {
        const overlay = document.getElementById('callOverlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    resolveTargetUserId() {
        const authUser = window.authManager?.getCurrentUser?.();
        const currentUserId = authUser?.id?.toString();

        if (Array.isArray(this.currentParticipants) && this.currentParticipants.length > 0) {
            for (const participant of this.currentParticipants) {
                if (!participant) continue;

                if (typeof participant === 'object' && participant.id) {
                    if (participant.id.toString() !== currentUserId) {
                        return participant.id.toString();
                    }
                } else if (typeof participant === 'string') {
                    if (!currentUserId || participant !== currentUserId) {
                        return participant;
                    }
                }
            }
        }

        if (this.currentTargetId) {
            return this.currentTargetId;
        }

        if (this.currentChatId) {
            return this.currentChatId.toString();
        }

        return null;
    }

    showNotification(message, type = 'info') {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
            return;
        }

        // Minimal fallback notification
        const toast = document.createElement('div');
        toast.className = `call-toast ${type}`;
        toast.textContent = message;
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: type === 'error' ? '#DC2626' : '#2563EB',
            color: '#fff',
            zIndex: 10001,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            opacity: '0',
            transition: 'opacity 0.2s ease'
        });

        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 200);
        }, 2500);
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CallManager;
}

// Global access
window.CallManager = CallManager;
