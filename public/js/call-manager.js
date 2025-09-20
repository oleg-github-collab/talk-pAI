/**
 * Professional Call Manager with WebRTC
 * Production-grade audio/video calling system
 */

class CallManager {
    constructor() {
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.currentCall = null;
        this.isInCall = false;
        this.callType = null; // 'voice' or 'video'
        this.callStartTime = null;
        this.callTimer = null;
        this.isInitialized = false;
        this.isMuted = false;
        this.isVideoEnabled = true;
        this.isSpeakerOn = false;
        this.currentVolume = 100;

        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.init();
    }

    async init() {
        this.setupCallInterface();
        this.bindEvents();
        this.isInitialized = true;
        console.log('✅ Call Manager initialized');
    }

    setupCallInterface() {
        // Create call overlay if it doesn't exist
        if (!document.getElementById('callOverlay')) {
            const callOverlay = document.createElement('div');
            callOverlay.id = 'callOverlay';
            callOverlay.className = 'call-overlay';
            callOverlay.innerHTML = this.createCallInterface();
            document.body.appendChild(callOverlay);
        }
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
                        <button class="control-btn mute-btn" id="muteBtn" onclick="callManager.toggleMute()" title="Mute">
                            <span class="btn-icon">🎤</span>
                            <span class="btn-label">Mute</span>
                        </button>

                        <button class="control-btn end-call-btn" id="endCallBtn" onclick="callManager.endCall()" title="End Call">
                            <span class="btn-icon">📞</span>
                            <span class="btn-label">End</span>
                        </button>

                        <button class="control-btn video-btn" id="videoBtn" onclick="callManager.toggleVideo()" title="Toggle Video">
                            <span class="btn-icon">📹</span>
                            <span class="btn-label">Video</span>
                        </button>
                    </div>

                    <div class="secondary-controls" id="secondaryControls">
                        <div class="volume-control">
                            <button class="control-btn speaker-btn" onclick="callManager.toggleSpeaker()" title="Speaker">
                                <span class="btn-icon">🔊</span>
                            </button>
                            <div class="volume-slider-container" id="volumeSliderContainer">
                                <input type="range" id="volumeSlider" class="volume-slider" min="0" max="100" value="100"
                                       oninput="callManager.setVolume(this.value)" title="Volume">
                                <div class="volume-level" id="volumeLevel">100%</div>
                            </div>
                        </div>
                        <button class="control-btn screen-btn" onclick="callManager.toggleScreenShare()" title="Share Screen">
                            <span class="btn-icon">📺</span>
                        </button>
                        <button class="control-btn chat-btn" onclick="callManager.openCallChat()" title="Chat">
                            <span class="btn-icon">💬</span>
                        </button>
                        <button class="control-btn settings-btn" onclick="callManager.openCallSettings()" title="Call Settings">
                            <span class="btn-icon">⚙️</span>
                        </button>
                    </div>
                </div>

                <!-- Incoming Call Interface -->
                <div class="incoming-call" id="incomingCall" style="display: none;">
                    <div class="incoming-info">
                        <div class="incoming-avatar" id="incomingAvatar">👤</div>
                        <h3 class="incoming-name" id="incomingName">Contact</h3>
                        <p class="incoming-type" id="incomingType">Incoming call...</p>
                    </div>
                    <div class="incoming-controls" id="incomingControls">
                        <button class="control-btn decline-btn" onclick="callManager.declineCall()" title="Decline">
                            <span class="btn-icon">📞</span>
                        </button>
                        <button class="control-btn accept-btn" onclick="callManager.acceptCall()" title="Accept">
                            <span class="btn-icon">📞</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.isInCall) {
                switch (e.key) {
                    case 'm':
                    case 'M':
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            this.toggleMute();
                        }
                        break;
                    case 'v':
                    case 'V':
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            this.toggleVideo();
                        }
                        break;
                    case 'Escape':
                        e.preventDefault();
                        this.endCall();
                        break;
                }
            }
        });

        // Handle browser tab visibility
        document.addEventListener('visibilitychange', () => {
            if (this.isInCall && document.hidden) {
                this.minimizeCall();
            }
        });

        // Handle before unload
        window.addEventListener('beforeunload', (e) => {
            if (this.isInCall) {
                e.preventDefault();
                e.returnValue = 'You are currently in a call. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
    }

    async startVoiceCall(contactId, contact) {
        console.log('Starting voice call with:', contact?.name || contactId);

        try {
            this.callType = 'voice';
            this.currentCall = { contactId, contact };

            await this.setupCall();
            this.showCallInterface(contact, 'voice');
            this.updateCallStatus('Calling...');

            // Simulate call connection for demo
            this.simulateCall();

        } catch (error) {
            console.error('Failed to start voice call:', error);
            this.showNotification('Failed to start voice call', 'error');
        }
    }

    async startVideoCall(contactId, contact) {
        console.log('Starting video call with:', contact?.name || contactId);

        try {
            this.callType = 'video';
            this.currentCall = { contactId, contact };

            await this.setupCall();
            this.showCallInterface(contact, 'video');
            this.updateCallStatus('Calling...');

            // Simulate call connection for demo
            this.simulateCall();

        } catch (error) {
            console.error('Failed to start video call:', error);
            this.showNotification('Failed to start video call', 'error');
        }
    }

    async setupCall() {
        try {
            // Get user media
            const constraints = {
                audio: true,
                video: this.callType === 'video'
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

            // Setup peer connection
            this.peerConnection = new RTCPeerConnection(this.config);

            // Add local stream tracks
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Handle remote stream
            this.peerConnection.ontrack = (event) => {
                this.remoteStream = event.streams[0];
                this.setupRemoteVideo();
            };

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    // Send candidate to remote peer (implement signaling)
                    console.log('ICE candidate:', event.candidate);
                }
            };

            // Setup local video
            if (this.callType === 'video') {
                this.setupLocalVideo();
            }

        } catch (error) {
            console.error('Failed to setup call:', error);
            throw error;
        }
    }

    setupLocalVideo() {
        const localVideo = document.getElementById('localVideo');
        if (localVideo && this.localStream) {
            localVideo.srcObject = this.localStream;
        }
    }

    setupRemoteVideo() {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && this.remoteStream) {
            remoteVideo.srcObject = this.remoteStream;
        }
    }

    showCallInterface(contact, type) {
        const overlay = document.getElementById('callOverlay');
        const callerName = document.getElementById('callerName');
        const callerAvatar = document.getElementById('callerAvatar');
        const videoContainer = document.getElementById('videoContainer');
        const audioVisualization = document.getElementById('audioVisualization');

        if (!overlay) return;

        // Update contact info
        if (callerName) callerName.textContent = contact?.name || 'Unknown Contact';
        if (callerAvatar) callerAvatar.textContent = contact?.avatar || '👤';

        // Show/hide video container
        if (videoContainer) {
            videoContainer.style.display = type === 'video' ? 'block' : 'none';
        }

        // Show/hide audio visualization
        if (audioVisualization) {
            audioVisualization.style.display = type === 'voice' ? 'flex' : 'none';
        }

        // Update video button
        const videoBtn = document.getElementById('videoBtn');
        if (videoBtn) {
            videoBtn.style.display = type === 'video' ? 'flex' : 'none';
        }

        overlay.style.display = 'flex';
        this.isInCall = true;

        // Start audio visualization for voice calls
        if (type === 'voice') {
            this.startAudioVisualization();
        }
    }

    simulateCall() {
        // Simulate call states for demo
        setTimeout(() => {
            this.updateCallStatus('Ringing...');
        }, 1000);

        setTimeout(() => {
            this.updateCallStatus('Connected');
            this.startCallTimer();
            this.showCallNotification('Call connected', 'success');
        }, 3000);
    }

    updateCallStatus(status) {
        const statusElement = document.getElementById('callStatus');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }

    startCallTimer() {
        this.callStartTime = Date.now();
        const timerElement = document.getElementById('callTimer');
        if (timerElement) {
            timerElement.style.display = 'block';
        }

        this.callTimer = setInterval(() => {
            const elapsed = Date.now() - this.callStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            if (timerElement) {
                timerElement.textContent = timeString;
            }
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
    }

    startAudioVisualization() {
        const waveBars = document.querySelectorAll('.wave-bar');
        if (!waveBars.length) return;

        // Animate wave bars
        waveBars.forEach((bar, index) => {
            const animationDelay = index * 0.1;
            bar.style.animationDelay = `${animationDelay}s`;
            bar.style.animation = 'waveAnimation 1.5s ease-in-out infinite alternate';
        });
    }

    toggleMute() {
        if (!this.localStream) return;

        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            this.isMuted = !this.isMuted;
            audioTrack.enabled = !this.isMuted;

            const muteBtn = document.getElementById('muteBtn');
            const icon = muteBtn?.querySelector('.btn-icon');
            const label = muteBtn?.querySelector('.btn-label');

            if (!this.isMuted) {
                if (icon) icon.textContent = '🎤';
                if (label) label.textContent = 'Mute';
                muteBtn?.classList.remove('muted');
                muteBtn?.setAttribute('aria-pressed', 'false');
                this.showCallNotification('Microphone unmuted', 'success');
            } else {
                if (icon) icon.textContent = '🔇';
                if (label) label.textContent = 'Unmute';
                muteBtn?.classList.add('muted');
                muteBtn?.setAttribute('aria-pressed', 'true');
                this.showCallNotification('Microphone muted', 'info');
            }

            // Visual feedback
            this.addButtonFeedback(muteBtn);
        }
    }

    toggleVideo() {
        if (!this.localStream) return;

        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            this.isVideoEnabled = !this.isVideoEnabled;
            videoTrack.enabled = this.isVideoEnabled;

            const videoBtn = document.getElementById('videoBtn');
            const icon = videoBtn?.querySelector('.btn-icon');
            const label = videoBtn?.querySelector('.btn-label');
            const localVideo = document.getElementById('localVideo');

            if (this.isVideoEnabled) {
                if (icon) icon.textContent = '📹';
                if (label) label.textContent = 'Video';
                videoBtn?.classList.remove('disabled');
                videoBtn?.setAttribute('aria-pressed', 'false');
                if (localVideo) localVideo.style.display = 'block';
                this.showCallNotification('Camera enabled', 'success');
            } else {
                if (icon) icon.textContent = '📹';
                if (label) label.textContent = 'Video';
                videoBtn?.classList.add('disabled');
                videoBtn?.setAttribute('aria-pressed', 'true');
                if (localVideo) localVideo.style.display = 'none';
                this.showCallNotification('Camera disabled', 'info');
            }

            // Update video container visibility
            this.updateVideoInterface();

            // Visual feedback
            this.addButtonFeedback(videoBtn);
        }
    }

    toggleSpeaker() {
        this.isSpeakerOn = !this.isSpeakerOn;

        const speakerBtn = document.querySelector('.speaker-btn');
        const icon = speakerBtn?.querySelector('.btn-icon');

        if (this.isSpeakerOn) {
            if (icon) icon.textContent = '🔊';
            speakerBtn?.classList.add('active');
            speakerBtn?.setAttribute('aria-pressed', 'true');
            this.showCallNotification('Speaker enabled', 'success');
        } else {
            if (icon) icon.textContent = '🔉';
            speakerBtn?.classList.remove('active');
            speakerBtn?.setAttribute('aria-pressed', 'false');
            this.showCallNotification('Speaker disabled', 'info');
        }

        // Apply speaker settings to audio elements
        this.applySpeakerSettings();
        this.addButtonFeedback(speakerBtn);
    }

    setVolume(volume) {
        this.currentVolume = parseInt(volume);

        // Update UI
        const volumeLevel = document.getElementById('volumeLevel');
        if (volumeLevel) {
            volumeLevel.textContent = `${this.currentVolume}%`;
        }

        // Apply volume to audio elements
        this.applyVolumeSettings();

        // Update speaker icon based on volume
        this.updateSpeakerIcon();
    }

    updateSpeakerIcon() {
        const speakerBtn = document.querySelector('.speaker-btn');
        const icon = speakerBtn?.querySelector('.btn-icon');

        if (icon && !this.isSpeakerOn) {
            if (this.currentVolume === 0) {
                icon.textContent = '🔇';
            } else if (this.currentVolume < 30) {
                icon.textContent = '🔈';
            } else if (this.currentVolume < 70) {
                icon.textContent = '🔉';
            } else {
                icon.textContent = '🔊';
            }
        }
    }

    applySpeakerSettings() {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo) {
            // Apply speaker settings to remote audio
            remoteVideo.volume = this.currentVolume / 100;
        }
    }

    applyVolumeSettings() {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo) {
            remoteVideo.volume = this.currentVolume / 100;
        }
    }

    addButtonFeedback(button) {
        if (!button) return;

        button.classList.add('button-pressed');
        setTimeout(() => {
            button.classList.remove('button-pressed');
        }, 150);
    }

    updateVideoInterface() {
        const videoContainer = document.getElementById('videoContainer');
        const audioVisualization = document.getElementById('audioVisualization');

        if (this.callType === 'video' && this.isVideoEnabled) {
            if (videoContainer) videoContainer.style.display = 'flex';
            if (audioVisualization) audioVisualization.style.display = 'none';
        } else {
            if (videoContainer) videoContainer.style.display = 'none';
            if (audioVisualization) audioVisualization.style.display = 'flex';
        }
    }

    openCallSettings() {
        this.showCallSettingsModal();
    }

    showCallSettingsModal() {
        // Create settings modal if it doesn't exist
        let settingsModal = document.getElementById('callSettingsModal');
        if (!settingsModal) {
            settingsModal = this.createCallSettingsModal();
            document.body.appendChild(settingsModal);
        }

        settingsModal.style.display = 'flex';
        this.populateCallSettings();
    }

    createCallSettingsModal() {
        const modal = document.createElement('div');
        modal.id = 'callSettingsModal';
        modal.className = 'call-settings-modal';
        modal.innerHTML = `
            <div class="settings-modal-content">
                <div class="settings-header">
                    <h3>Call Settings</h3>
                    <button class="close-btn" onclick="callManager.closeCallSettings()">×</button>
                </div>
                <div class="settings-body">
                    <div class="setting-group">
                        <label>Microphone</label>
                        <select id="microphoneSelect" onchange="callManager.changeMicrophone(this.value)">
                            <option value="">Default</option>
                        </select>
                        <div class="mic-test">
                            <button onclick="callManager.testMicrophone()">Test Microphone</button>
                            <div class="mic-level" id="micLevel"></div>
                        </div>
                    </div>
                    <div class="setting-group">
                        <label>Camera</label>
                        <select id="cameraSelect" onchange="callManager.changeCamera(this.value)">
                            <option value="">Default</option>
                        </select>
                        <button onclick="callManager.testCamera()">Test Camera</button>
                    </div>
                    <div class="setting-group">
                        <label>Speaker</label>
                        <select id="speakerSelect" onchange="callManager.changeSpeaker(this.value)">
                            <option value="">Default</option>
                        </select>
                        <button onclick="callManager.testSpeaker()">Test Speaker</button>
                    </div>
                    <div class="setting-group">
                        <label>Audio Quality</label>
                        <select id="audioQuality" onchange="callManager.changeAudioQuality(this.value)">
                            <option value="high">High Quality</option>
                            <option value="medium" selected>Medium Quality</option>
                            <option value="low">Low Quality (Data Saver)</option>
                        </select>
                    </div>
                    <div class="setting-group">
                        <label>Video Quality</label>
                        <select id="videoQuality" onchange="callManager.changeVideoQuality(this.value)">
                            <option value="hd">HD (720p)</option>
                            <option value="sd" selected>SD (480p)</option>
                            <option value="low">Low (240p)</option>
                        </select>
                    </div>
                </div>
                <div class="settings-footer">
                    <button class="btn-secondary" onclick="callManager.closeCallSettings()">Close</button>
                    <button class="btn-primary" onclick="callManager.applyCallSettings()">Apply Settings</button>
                </div>
            </div>
        `;
        return modal;
    }

    closeCallSettings() {
        const modal = document.getElementById('callSettingsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async populateCallSettings() {
        try {
            // Get available devices
            const devices = await navigator.mediaDevices.enumerateDevices();

            const micSelect = document.getElementById('microphoneSelect');
            const cameraSelect = document.getElementById('cameraSelect');
            const speakerSelect = document.getElementById('speakerSelect');

            // Clear existing options
            if (micSelect) micSelect.innerHTML = '<option value="">Default</option>';
            if (cameraSelect) cameraSelect.innerHTML = '<option value="">Default</option>';
            if (speakerSelect) speakerSelect.innerHTML = '<option value="">Default</option>';

            devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `${device.kind} ${device.deviceId.slice(0, 8)}`;

                if (device.kind === 'audioinput' && micSelect) {
                    micSelect.appendChild(option.cloneNode(true));
                } else if (device.kind === 'videoinput' && cameraSelect) {
                    cameraSelect.appendChild(option.cloneNode(true));
                } else if (device.kind === 'audiooutput' && speakerSelect) {
                    speakerSelect.appendChild(option.cloneNode(true));
                }
            });
        } catch (error) {
            console.error('Failed to populate call settings:', error);
        }
    }

    async toggleScreenShare() {
        try {
            if (this.isScreenSharing) {
                // Stop screen sharing
                this.stopScreenShare();
            } else {
                // Start screen sharing
                await this.startScreenShare();
            }
        } catch (error) {
            console.error('Screen share error:', error);
            this.showCallNotification('Failed to share screen', 'error');
        }
    }

    async startScreenShare() {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

            // Replace video track
            const videoTrack = screenStream.getVideoTracks()[0];
            const sender = this.peerConnection.getSenders().find(s =>
                s.track && s.track.kind === 'video'
            );

            if (sender) {
                await sender.replaceTrack(videoTrack);
            }

            this.isScreenSharing = true;
            this.showCallNotification('Screen sharing started', 'success');

            // Handle screen share end
            videoTrack.onended = () => {
                this.stopScreenShare();
            };

        } catch (error) {
            throw error;
        }
    }

    async stopScreenShare() {
        try {
            // Get camera stream again
            const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const videoTrack = cameraStream.getVideoTracks()[0];

            const sender = this.peerConnection.getSenders().find(s =>
                s.track && s.track.kind === 'video'
            );

            if (sender) {
                await sender.replaceTrack(videoTrack);
            }

            this.isScreenSharing = false;
            this.showCallNotification('Screen sharing stopped', 'info');

        } catch (error) {
            console.error('Failed to stop screen share:', error);
        }
    }

    openCallChat() {
        // Open chat during call
        this.showCallNotification('Call chat opened', 'info');
        // Implementation would open a chat overlay
    }

    minimizeCall() {
        const overlay = document.getElementById('callOverlay');
        if (overlay) {
            overlay.classList.add('minimized');
        }
    }

    maximizeCall() {
        const overlay = document.getElementById('callOverlay');
        if (overlay) {
            overlay.classList.remove('minimized');
        }
    }

    endCall() {
        try {
            // Stop call timer
            this.stopCallTimer();

            // Stop local stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }

            // Close peer connection
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }

            // Hide call interface
            const overlay = document.getElementById('callOverlay');
            if (overlay) {
                overlay.style.display = 'none';
            }

            // Reset state
            this.isInCall = false;
            this.callType = null;
            this.currentCall = null;
            this.isScreenSharing = false;

            this.showNotification('Call ended', 'info');

        } catch (error) {
            console.error('Error ending call:', error);
        }
    }

    // Incoming call methods
    showIncomingCall(contact, type) {
        const overlay = document.getElementById('callOverlay');
        const incomingCall = document.getElementById('incomingCall');
        const incomingAvatar = document.getElementById('incomingAvatar');
        const incomingName = document.getElementById('incomingName');
        const incomingType = document.getElementById('incomingType');

        if (!overlay || !incomingCall) return;

        // Update incoming call info
        if (incomingAvatar) incomingAvatar.textContent = contact?.avatar || '👤';
        if (incomingName) incomingName.textContent = contact?.name || 'Unknown Contact';
        if (incomingType) incomingType.textContent = `Incoming ${type} call...`;

        // Show incoming call interface
        overlay.style.display = 'flex';
        incomingCall.style.display = 'flex';

        // Play ringtone (implement audio)
        this.playRingtone();
    }

    acceptCall() {
        const incomingCall = document.getElementById('incomingCall');
        if (incomingCall) {
            incomingCall.style.display = 'none';
        }

        this.stopRingtone();
        this.showCallInterface(this.currentCall?.contact, this.callType);
        this.updateCallStatus('Connecting...');

        // Simulate call connection
        this.simulateCall();
    }

    declineCall() {
        this.stopRingtone();
        this.endCall();
    }

    playRingtone() {
        // Implement ringtone audio
        console.log('Playing ringtone...');
    }

    stopRingtone() {
        // Stop ringtone audio
        console.log('Stopping ringtone...');
    }

    showCallNotification(message, type = 'info') {
        // Create floating notification during call
        const notification = document.createElement('div');
        notification.className = `call-notification call-notification-${type}`;
        notification.textContent = message;

        Object.assign(notification.style, {
            position: 'fixed',
            top: '80px',
            right: '20px',
            background: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            zIndex: '10001',
            animation: 'slideInRight 0.3s ease'
        });

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showNotification(message, type = 'info') {
        // Use contact manager's notification system if available
        if (window.contactManager) {
            window.contactManager.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // Public API
    isCallActive() {
        return this.isInCall;
    }

    getCurrentCall() {
        return this.currentCall;
    }

    getCallDuration() {
        if (!this.callStartTime) return 0;
        return Date.now() - this.callStartTime;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.callManager = new CallManager();
    });
} else {
    window.callManager = new CallManager();
}

// Add CSS for call manager
const callStyles = document.createElement('style');
callStyles.textContent = `
.call-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    z-index: 9999;
    display: none;
    flex-direction: column;
    color: white;
}

.call-interface {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 40px;
    text-align: center;
}

.call-header {
    display: flex;
    justify-content: center;
    margin-bottom: 40px;
}

.call-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
}

.caller-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.caller-name {
    font-size: 28px;
    font-weight: 600;
    margin: 0;
}

.call-status {
    font-size: 16px;
    opacity: 0.8;
    margin: 0;
}

.call-timer {
    font-size: 20px;
    font-weight: 500;
    color: #10b981;
}

.video-container {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 20px 0;
    border-radius: 20px;
    overflow: hidden;
    background: #000;
}

.remote-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.local-video {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 200px;
    height: 150px;
    border-radius: 12px;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.audio-visualization {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    margin: 40px 0;
}

.audio-wave {
    display: flex;
    gap: 8px;
    align-items: center;
}

.wave-bar {
    width: 6px;
    height: 20px;
    background: linear-gradient(180deg, #3b82f6, #8b5cf6);
    border-radius: 3px;
    opacity: 0.7;
}

@keyframes waveAnimation {
    0% { height: 20px; opacity: 0.7; }
    100% { height: 80px; opacity: 1; }
}

.call-controls {
    display: flex;
    flex-direction: column;
    gap: 20px;
    align-items: center;
}

.primary-controls {
    display: flex;
    gap: 30px;
    align-items: center;
}

.secondary-controls {
    display: flex;
    gap: 20px;
    align-items: center;
}

.control-btn {
    width: 60px;
    height: 60px;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: all 0.3s ease;
    font-size: 12px;
    font-weight: 500;
}

.secondary-controls .control-btn {
    width: 50px;
    height: 50px;
}

.control-btn .btn-icon {
    font-size: 20px;
}

.control-btn .btn-label {
    font-size: 10px;
    opacity: 0.9;
}

.mute-btn {
    background: rgba(255, 255, 255, 0.15);
    color: white;
}

.mute-btn:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: scale(1.1);
}

.mute-btn.muted {
    background: #ef4444;
}

.end-call-btn {
    background: #ef4444;
    color: white;
    width: 70px;
    height: 70px;
}

.end-call-btn:hover {
    background: #dc2626;
    transform: scale(1.1);
}

.video-btn {
    background: rgba(255, 255, 255, 0.15);
    color: white;
}

.video-btn:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: scale(1.1);
}

.video-btn.disabled {
    background: #ef4444;
}

.speaker-btn,
.screen-btn,
.chat-btn {
    background: rgba(255, 255, 255, 0.1);
    color: white;
}

.speaker-btn:hover,
.screen-btn:hover,
.chat-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
}

.incoming-call {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 40px;
    animation: slideUp 0.3s ease;
}

.incoming-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
}

.incoming-avatar {
    width: 140px;
    height: 140px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 56px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}

.incoming-name {
    font-size: 32px;
    font-weight: 600;
    margin: 0;
}

.incoming-type {
    font-size: 18px;
    opacity: 0.8;
    margin: 0;
}

.incoming-controls {
    display: flex;
    gap: 80px;
    align-items: center;
}

.decline-btn {
    background: #ef4444;
    color: white;
    width: 80px;
    height: 80px;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    transition: all 0.3s ease;
}

.decline-btn:hover {
    background: #dc2626;
    transform: scale(1.1);
}

.accept-btn {
    background: #10b981;
    color: white;
    width: 80px;
    height: 80px;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    transition: all 0.3s ease;
}

.accept-btn:hover {
    background: #059669;
    transform: scale(1.1);
}

.call-overlay.minimized {
    top: auto;
    bottom: 20px;
    right: 20px;
    left: auto;
    width: 300px;
    height: 200px;
    border-radius: 16px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.call-overlay.minimized .call-interface {
    padding: 20px;
}

.call-overlay.minimized .caller-avatar {
    width: 60px;
    height: 60px;
    font-size: 24px;
}

.call-overlay.minimized .caller-name {
    font-size: 16px;
}

.call-overlay.minimized .control-btn {
    width: 40px;
    height: 40px;
}

.call-overlay.minimized .control-btn .btn-icon {
    font-size: 16px;
}

.call-overlay.minimized .control-btn .btn-label {
    display: none;
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@media (max-width: 768px) {
    .call-interface {
        padding: 20px;
    }

    .caller-avatar {
        width: 100px;
        height: 100px;
        font-size: 40px;
    }

    .caller-name {
        font-size: 24px;
    }

    .primary-controls {
        gap: 20px;
    }

    .control-btn {
        width: 50px;
        height: 50px;
    }

    .end-call-btn {
        width: 60px;
        height: 60px;
    }

    .local-video {
        width: 150px;
        height: 110px;
        top: 10px;
        right: 10px;
    }
}
`;

document.head.appendChild(callStyles);

// Global access
window.CallManager = CallManager;