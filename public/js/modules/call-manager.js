/**
 * TalkPAI Call Manager Module
 * Handles voice and video call functionality with WebRTC
 */

class CallManager {
    constructor(messenger) {
        this.messenger = messenger;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isInitialized = false;

        this.init();
    }

    async init() {
        try {
            this.setupWebRTC();
            this.isInitialized = true;
            console.log('📞 Call Manager initialized');
        } catch (error) {
            this.messenger.handleError(error, 'Call Manager Initialization');
        }
    }

    setupWebRTC() {
        // Check for WebRTC support
        if (!navigator.mediaDevices || !window.RTCPeerConnection) {
            throw new Error('WebRTC not supported in this browser');
        }

        // Configure peer connection
        this.peerConnectionConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
    }

    async startCall(callType = 'voice', contactId = null) {
        try {
            if (!this.isInitialized) {
                throw new Error('Call manager not initialized');
            }

            const startTime = performance.now();

            console.log(`📞 Starting ${callType} call`);

            // Use WebRTC client if available
            if (window.webrtc && window.webrtc.isConnected) {
                const targetUserId = contactId || 'demo-user-id';
                await window.webrtc.initiateCall(targetUserId, callType);
                return;
            }

            // Fallback to demo call interface
            this.showDemoCallInterface(callType);

            this.messenger.logPerformance('Start Call', startTime);
        } catch (error) {
            console.error('❌ Failed to start call:', error);
            this.messenger.handleError(error, 'Start Call');
        }
    }

    showDemoCallInterface(callType) {
        // Create demo call interface
        const callOverlay = document.createElement('div');
        callOverlay.className = 'call-ui-overlay active';
        callOverlay.innerHTML = `
            <div class="call-interface calling">
                <div class="call-info">
                    <div class="call-avatar">${callType === 'video' ? '📹' : '📞'}</div>
                    <h3>Demo ${callType === 'video' ? 'Video' : 'Voice'} Call</h3>
                    <p>This is a demo call interface</p>
                    <p>WebRTC server not connected</p>
                </div>
                <div class="call-controls">
                    <button class="call-btn end-call" onclick="this.parentElement.parentElement.parentElement.remove()">
                        📞 End Call
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(callOverlay);

        // Auto-close after 5 seconds for demo
        setTimeout(() => {
            if (callOverlay.parentNode) {
                callOverlay.remove();
            }
        }, 5000);
    }

    // Request media permissions
            const constraints = {
                audio: true,
                video: callType === 'video'
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

            // Update messenger state
            this.messenger.callState = 'calling';
            this.messenger.callType = callType;
            this.messenger.callStartTime = Date.now();

            // Show call interface
            this.showCallInterface(callType, contactId);

            // Setup local video if video call
            if (callType === 'video') {
                this.setupLocalVideo();
            }

            // Create peer connection
            this.createPeerConnection();

            // Add local stream to peer connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Start call timer
            this.startCallTimer();

            // Simulate connection process
            this.simulateCallConnection();

            this.messenger.logPerformance('Start Call', startTime);
            console.log(`📞 ${callType} call started`);

        } catch (error) {
            this.messenger.handleError(error, 'Start Call');
            this.showCallError('Failed to start call. Please check your permissions.');
        }
    }

    createPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.peerConnectionConfig);

        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            this.setupRemoteVideo();
        };

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // In a real app, send this to the remote peer
                console.log('ICE candidate:', event.candidate);
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);

            switch (this.peerConnection.connectionState) {
                case 'connected':
                    this.messenger.callState = 'connected';
                    this.updateCallInterface();
                    break;
                case 'disconnected':
                case 'failed':
                    this.endCall();
                    break;
            }
        };
    }

    setupLocalVideo() {
        const localVideo = document.getElementById('localVideo');
        if (localVideo && this.localStream) {
            localVideo.srcObject = this.localStream;
            localVideo.muted = true; // Prevent audio feedback
        }
    }

    setupRemoteVideo() {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && this.remoteStream) {
            remoteVideo.srcObject = this.remoteStream;
        }
    }

    showCallInterface(callType, contactId) {
        const callOverlay = document.getElementById('callOverlay');
        if (callOverlay) {
            callOverlay.classList.add('active');

            // Update call interface based on type
            const videoContainer = callOverlay.querySelector('.video-container');
            if (videoContainer) {
                videoContainer.style.display = callType === 'video' ? 'block' : 'none';
            }

            // Update contact info
            this.updateCallContactInfo(contactId);

            // Update call type indicator
            const callTypeIndicator = callOverlay.querySelector('.call-type');
            if (callTypeIndicator) {
                callTypeIndicator.textContent = callType === 'video' ? '📹 Video Call' : '📞 Voice Call';
            }
        }
    }

    updateCallContactInfo(contactId) {
        // Get contact information (in real app, fetch from API)
        const contactInfo = this.getContactInfo(contactId);

        const callAvatar = document.getElementById('callAvatar');
        const callUserName = document.getElementById('callUserName');

        if (callAvatar && contactInfo.avatar) {
            callAvatar.src = contactInfo.avatar;
        }

        if (callUserName) {
            callUserName.textContent = contactInfo.name;
        }
    }

    getContactInfo(contactId) {
        // Mock contact data
        const contacts = {
            '1': { name: 'Sarah Wilson', avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b3b4?w=100&h=100&fit=crop&crop=face' },
            '2': { name: 'Mike Johnson', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face' },
            '3': { name: 'Emily Chen', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face' }
        };

        return contacts[contactId] || { name: 'Unknown Contact', avatar: null };
    }

    startCallTimer() {
        if (this.messenger.callTimer) {
            clearInterval(this.messenger.callTimer);
        }

        this.messenger.callTimer = setInterval(() => {
            this.updateCallTimer();
        }, 1000);
    }

    updateCallTimer() {
        if (!this.messenger.callStartTime) return;

        const elapsed = Date.now() - this.messenger.callStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        const timerElement = document.getElementById('callTimer');
        if (timerElement) {
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    simulateCallConnection() {
        // Simulate call connection process
        setTimeout(() => {
            this.messenger.callState = 'connected';
            this.updateCallInterface();
            console.log('📞 Call connected');
        }, 2000 + Math.random() * 3000);
    }

    updateCallInterface() {
        const callStatus = document.getElementById('callStatus');
        if (callStatus) {
            switch (this.messenger.callState) {
                case 'calling':
                    callStatus.textContent = 'Calling...';
                    break;
                case 'connected':
                    callStatus.textContent = 'Connected';
                    break;
                case 'incoming':
                    callStatus.textContent = 'Incoming call';
                    break;
            }
        }
    }

    async toggleMute() {
        try {
            if (!this.localStream) return;

            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.messenger.isMuted = !audioTrack.enabled;

                // Update UI
                const muteBtn = document.getElementById('muteBtn');
                if (muteBtn) {
                    muteBtn.classList.toggle('active', this.messenger.isMuted);
                }

                console.log(`🔇 Audio ${this.messenger.isMuted ? 'muted' : 'unmuted'}`);
            }
        } catch (error) {
            this.messenger.handleError(error, 'Toggle Mute');
        }
    }

    async toggleVideo() {
        try {
            if (!this.localStream) return;

            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.messenger.isVideoOn = videoTrack.enabled;

                // Update UI
                const cameraBtn = document.getElementById('cameraBtn');
                if (cameraBtn) {
                    cameraBtn.classList.toggle('active', !this.messenger.isVideoOn);
                }

                console.log(`📹 Video ${this.messenger.isVideoOn ? 'enabled' : 'disabled'}`);
            }
        } catch (error) {
            this.messenger.handleError(error, 'Toggle Video');
        }
    }

    async toggleSpeaker() {
        try {
            this.messenger.isSpeakerOn = !this.messenger.isSpeakerOn;

            // Update UI
            const speakerBtn = document.getElementById('speakerBtn');
            if (speakerBtn) {
                speakerBtn.classList.toggle('active', this.messenger.isSpeakerOn);
            }

            // In a real app, you would change audio output device
            console.log(`🔊 Speaker ${this.messenger.isSpeakerOn ? 'on' : 'off'}`);
        } catch (error) {
            this.messenger.handleError(error, 'Toggle Speaker');
        }
    }

    async toggleScreenShare() {
        try {
            if (!this.messenger.isScreenSharing) {
                // Start screen sharing
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });

                // Replace video track
                if (this.peerConnection && this.localStream) {
                    const videoTrack = this.localStream.getVideoTracks()[0];
                    const sender = this.peerConnection.getSenders().find(s =>
                        s.track && s.track.kind === 'video'
                    );

                    if (sender) {
                        await sender.replaceTrack(screenStream.getVideoTracks()[0]);
                    }
                }

                this.messenger.isScreenSharing = true;
                console.log('🖥️ Screen sharing started');

                // Listen for screen share end
                screenStream.getVideoTracks()[0].addEventListener('ended', () => {
                    this.stopScreenShare();
                });

            } else {
                this.stopScreenShare();
            }

            // Update UI
            const screenShareBtn = document.getElementById('screenShareBtn');
            if (screenShareBtn) {
                screenShareBtn.classList.toggle('active', this.messenger.isScreenSharing);
            }

        } catch (error) {
            this.messenger.handleError(error, 'Toggle Screen Share');
        }
    }

    async stopScreenShare() {
        try {
            if (this.messenger.isScreenSharing && this.localStream) {
                // Get camera stream again
                const cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });

                // Replace screen share track with camera track
                if (this.peerConnection) {
                    const sender = this.peerConnection.getSenders().find(s =>
                        s.track && s.track.kind === 'video'
                    );

                    if (sender) {
                        await sender.replaceTrack(cameraStream.getVideoTracks()[0]);
                    }
                }

                this.messenger.isScreenSharing = false;
                console.log('🖥️ Screen sharing stopped');
            }
        } catch (error) {
            this.messenger.handleError(error, 'Stop Screen Share');
        }
    }

    endCall() {
        try {
            const startTime = performance.now();

            // Stop all media tracks
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }

            // Close peer connection
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }

            // Clear call timer
            if (this.messenger.callTimer) {
                clearInterval(this.messenger.callTimer);
                this.messenger.callTimer = null;
            }

            // Reset call state
            this.messenger.callState = 'idle';
            this.messenger.callType = null;
            this.messenger.callStartTime = null;
            this.messenger.isMuted = false;
            this.messenger.isVideoOn = true;
            this.messenger.isSpeakerOn = false;
            this.messenger.isScreenSharing = false;

            // Hide call interface
            this.hideCallInterface();

            this.messenger.logPerformance('End Call', startTime);
            console.log('📞 Call ended');

        } catch (error) {
            this.messenger.handleError(error, 'End Call');
        }
    }

    hideCallInterface() {
        const callOverlay = document.getElementById('callOverlay');
        if (callOverlay) {
            callOverlay.classList.remove('active');
        }
    }

    showCallError(message) {
        this.messenger.showErrorNotification(message);
        this.endCall();
    }

    // Incoming call handling
    handleIncomingCall(callData) {
        try {
            this.messenger.callState = 'incoming';
            this.messenger.callType = callData.type;

            // Show incoming call notification
            this.showIncomingCallNotification(callData);

            console.log('📞 Incoming call from:', callData.from);
        } catch (error) {
            this.messenger.handleError(error, 'Incoming Call');
        }
    }

    showIncomingCallNotification(callData) {
        const notification = document.getElementById('callNotification');
        if (notification) {
            notification.classList.add('active');

            // Update notification content
            const notificationName = notification.querySelector('.call-notification-name');
            const notificationType = notification.querySelector('.call-notification-type');

            if (notificationName) {
                notificationName.textContent = callData.fromName || 'Unknown';
            }

            if (notificationType) {
                notificationType.textContent = `Incoming ${callData.type} call`;
            }
        }
    }

    answerCall() {
        try {
            this.hideIncomingCallNotification();
            this.startCall(this.messenger.callType);
        } catch (error) {
            this.messenger.handleError(error, 'Answer Call');
        }
    }

    declineCall() {
        try {
            this.hideIncomingCallNotification();
            this.messenger.callState = 'idle';
            this.messenger.callType = null;
        } catch (error) {
            this.messenger.handleError(error, 'Decline Call');
        }
    }

    hideIncomingCallNotification() {
        const notification = document.getElementById('callNotification');
        if (notification) {
            notification.classList.remove('active');
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CallManager;
}

// Global access
window.CallManager = CallManager;