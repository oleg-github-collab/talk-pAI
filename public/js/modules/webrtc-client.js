/**
 * Talk pAI WebRTC Client - Perfect Audio/Video Calls
 * Production-ready WebRTC implementation with advanced features
 */

class TalkPAIWebRTC {
    constructor() {
        this.socket = null;
        this.peerConnections = new Map();
        this.localStream = null;
        this.remoteStreams = new Map();
        this.isConnected = false;
        this.currentCall = null;
        this.userId = null;
        this.userName = null;

        // Call state
        this.callState = {
            active: false,
            muted: false,
            videoEnabled: true,
            screenSharing: false
        };

        // Configuration
        this.config = {
            iceServers: [], // Will be populated from server
            iceCandidatePoolSize: 10,
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };

        // Media constraints
        this.mediaConstraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000
            },
            video: {
                width: { min: 320, ideal: 1280, max: 1920 },
                height: { min: 240, ideal: 720, max: 1080 },
                frameRate: { min: 15, ideal: 30, max: 60 },
                facingMode: 'user'
            }
        };

        this.init();
    }

    async init() {
        try {
            console.log('🎥 Initializing Talk pAI WebRTC Client...');

            await this.connectToSignalingServer();
            this.setupEventHandlers();

            console.log('✅ WebRTC Client initialized successfully');
        } catch (error) {
            console.error('❌ WebRTC Client initialization failed:', error);
        }
    }

    async connectToSignalingServer() {
        // Use existing socket connection if available, or create new one to main server
        if (window.socket && window.socket.connected) {
            console.log('🔗 Using existing socket connection for WebRTC');
            this.socket = window.socket;
            this.isConnected = true;
            return Promise.resolve();
        }

        // Fallback: connect to main server (same as application)
        const serverUrl = window.location.origin;

        this.socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            timeout: 10000,
            forceNew: false
        });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.warn('⚠️ WebRTC connection timeout, using fallback mode');
                this.isConnected = false;
                resolve(); // Don't reject, allow fallback operation
            }, 8000);

            this.socket.on('connect', () => {
                clearTimeout(timeout);
                console.log('🔗 Connected to WebRTC signaling server');
                this.isConnected = true;
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                clearTimeout(timeout);
                console.warn('⚠️ Signaling server connection failed, using fallback mode:', error.message);
                this.isConnected = false;
                resolve(); // Don't reject, allow fallback operation
            });

            this.socket.on('disconnect', (reason) => {
                console.log('🔗 Disconnected from signaling server:', reason);
                this.isConnected = false;
                this.handleDisconnection();
            });
        });
    }

    setupEventHandlers() {
        // User registration response
        this.socket.on('user:registered', (data) => {
            console.log('👤 User registered with WebRTC server');
            this.config.iceServers = data.rtcConfiguration.iceServers;
        });

        // Incoming call
        this.socket.on('call:incoming', (data) => {
            console.log('📞 Incoming call:', data);
            this.handleIncomingCall(data);
        });

        // Call accepted
        this.socket.on('call:accepted', (data) => {
            console.log('✅ Call accepted:', data);
            this.handleCallAccepted(data);
        });

        // Call ended
        this.socket.on('call:ended', (data) => {
            console.log('📞 Call ended:', data);
            this.handleCallEnded(data);
        });

        // WebRTC signaling
        this.socket.on('webrtc:offer', (data) => {
            this.handleOffer(data);
        });

        this.socket.on('webrtc:answer', (data) => {
            this.handleAnswer(data);
        });

        this.socket.on('webrtc:ice-candidate', (data) => {
            this.handleIceCandidate(data);
        });

        // Call participants events
        this.socket.on('call:participant-joined', (data) => {
            console.log('👥 Participant joined:', data);
            this.handleParticipantJoined(data);
        });

        this.socket.on('call:participant-left', (data) => {
            console.log('👥 Participant left:', data);
            this.handleParticipantLeft(data);
        });

        this.socket.on('call:participant-muted', (data) => {
            this.handleParticipantMuted(data);
        });

        this.socket.on('call:participant-video', (data) => {
            this.handleParticipantVideo(data);
        });
    }

    // Register user with signaling server
    registerUser(userId, userName) {
        this.userId = userId;
        this.userName = userName;

        if (this.socket && this.isConnected) {
            this.socket.emit('user:register', { userId, userName });
        }
    }

    // Initiate a call
    async initiateCall(targetUserId, callType = 'video', chatId = null) {
        try {
            console.log(`📞 Initiating ${callType} call to ${targetUserId}`);

            if (!this.isConnected) {
                throw new Error('Not connected to signaling server');
            }

            // Get user media first
            await this.getUserMedia(callType === 'video');

            this.socket.emit('call:initiate', {
                targetUserId,
                callType,
                chatId
            });

            this.callState.active = true;
            this.callState.videoEnabled = callType === 'video';

            // Show calling UI
            this.showCallingInterface(callType);

        } catch (error) {
            console.error('❌ Failed to initiate call:', error);
            this.handleCallError(error);
        }
    }

    // Answer incoming call
    async answerCall(callId, accept = true) {
        try {
            console.log(`📞 ${accept ? 'Accepting' : 'Declining'} call:`, callId);

            if (accept) {
                // Get user media
                const isVideo = this.currentCall?.callType === 'video';
                await this.getUserMedia(isVideo);
            }

            this.socket.emit('call:answer', { callId, accept });

            if (accept) {
                this.callState.active = true;
                this.callState.videoEnabled = this.currentCall?.callType === 'video';
            }

        } catch (error) {
            console.error('❌ Failed to answer call:', error);
            this.socket.emit('call:answer', { callId, accept: false });
        }
    }

    // End current call
    endCall() {
        console.log('📞 Ending call');

        if (this.currentCall) {
            this.socket.emit('call:end', { callId: this.currentCall.id });
        }

        this.cleanup();
    }

    // Get user media (camera/microphone)
    async getUserMedia(includeVideo = true) {
        try {
            console.log(`🎥 Getting user media (video: ${includeVideo})`);

            const constraints = {
                audio: this.mediaConstraints.audio,
                video: includeVideo ? this.mediaConstraints.video : false
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

            // Display local video
            this.displayLocalVideo();

            console.log('✅ User media acquired successfully');
            return this.localStream;

        } catch (error) {
            console.error('❌ Failed to get user media:', error);
            throw error;
        }
    }

    // Create peer connection
    async createPeerConnection(userId) {
        console.log(`🔗 Creating peer connection for user: ${userId}`);

        const peerConnection = new RTCPeerConnection(this.config);

        // Add local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log('🎵 Remote stream received from:', userId);
            this.remoteStreams.set(userId, event.streams[0]);
            this.displayRemoteVideo(userId, event.streams[0]);
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('🧊 Sending ICE candidate to:', userId);
                this.socket.emit('webrtc:ice-candidate', {
                    callId: this.currentCall?.id,
                    candidate: event.candidate,
                    targetUserId: userId
                });
            }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log(`🔗 Connection state changed for ${userId}:`, peerConnection.connectionState);

            if (peerConnection.connectionState === 'connected') {
                this.handlePeerConnected(userId);
            } else if (peerConnection.connectionState === 'disconnected' ||
                       peerConnection.connectionState === 'failed') {
                this.handlePeerDisconnected(userId);
            }
        };

        this.peerConnections.set(userId, peerConnection);
        return peerConnection;
    }

    // Handle incoming call
    async handleIncomingCall(data) {
        this.currentCall = {
            id: data.callId,
            from: data.from,
            callType: data.callType,
            chatId: data.chatId
        };

        // Show incoming call UI
        this.showIncomingCallInterface(data);
    }

    // Handle call accepted
    async handleCallAccepted(data) {
        console.log('✅ Call accepted, setting up peer connections');

        this.currentCall = {
            id: data.callId,
            participants: data.participants
        };

        // Create peer connections for all participants
        for (const participant of data.participants) {
            if (participant.userId !== this.userId) {
                await this.setupPeerConnection(participant.userId);
            }
        }

        this.showActiveCallInterface();
    }

    // Setup peer connection and create offer
    async setupPeerConnection(userId) {
        const peerConnection = await this.createPeerConnection(userId);

        // Create and send offer
        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: this.callState.videoEnabled
        });

        await peerConnection.setLocalDescription(offer);

        this.socket.emit('webrtc:offer', {
            callId: this.currentCall.id,
            offer,
            targetUserId: userId
        });

        console.log(`📤 Offer sent to user: ${userId}`);
    }

    // Handle WebRTC offer
    async handleOffer(data) {
        console.log(`📥 Received offer from: ${data.from}`);

        const peerConnection = await this.createPeerConnection(data.from);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));

        // Create and send answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        this.socket.emit('webrtc:answer', {
            callId: data.callId,
            answer,
            targetUserId: data.from
        });

        console.log(`📤 Answer sent to user: ${data.from}`);
    }

    // Handle WebRTC answer
    async handleAnswer(data) {
        console.log(`📥 Received answer from: ${data.from}`);

        const peerConnection = this.peerConnections.get(data.from);
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    }

    // Handle ICE candidate
    async handleIceCandidate(data) {
        console.log(`🧊 Received ICE candidate from: ${data.from}`);

        const peerConnection = this.peerConnections.get(data.from);
        if (peerConnection && data.candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    }

    // Call control methods
    toggleMute() {
        this.callState.muted = !this.callState.muted;

        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !this.callState.muted;
            });
        }

        this.socket.emit('call:mute', {
            callId: this.currentCall?.id,
            muted: this.callState.muted
        });

        this.updateCallUI();
        console.log(`🔇 Audio ${this.callState.muted ? 'muted' : 'unmuted'}`);
    }

    toggleVideo() {
        this.callState.videoEnabled = !this.callState.videoEnabled;

        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = this.callState.videoEnabled;
            });
        }

        this.socket.emit('call:video-toggle', {
            callId: this.currentCall?.id,
            videoEnabled: this.callState.videoEnabled
        });

        this.updateCallUI();
        console.log(`📹 Video ${this.callState.videoEnabled ? 'enabled' : 'disabled'}`);
    }

    async toggleScreenShare() {
        try {
            if (!this.callState.screenSharing) {
                // Start screen sharing
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });

                // Replace video track in all peer connections
                const videoTrack = screenStream.getVideoTracks()[0];

                this.peerConnections.forEach(async (peerConnection) => {
                    const sender = peerConnection.getSenders().find(s =>
                        s.track && s.track.kind === 'video'
                    );

                    if (sender) {
                        await sender.replaceTrack(videoTrack);
                    }
                });

                // Handle screen share end
                videoTrack.onended = () => {
                    this.stopScreenShare();
                };

                this.callState.screenSharing = true;
                console.log('🖥️ Screen sharing started');

            } else {
                await this.stopScreenShare();
            }

            this.updateCallUI();

        } catch (error) {
            console.error('❌ Screen share failed:', error);
        }
    }

    async stopScreenShare() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];

            this.peerConnections.forEach(async (peerConnection) => {
                const sender = peerConnection.getSenders().find(s =>
                    s.track && s.track.kind === 'video'
                );

                if (sender && videoTrack) {
                    await sender.replaceTrack(videoTrack);
                }
            });
        }

        this.callState.screenSharing = false;
        console.log('🖥️ Screen sharing stopped');
    }

    // UI Methods
    showCallingInterface(callType) {
        const callUI = this.getCallUIContainer();
        callUI.classList.add('active');
        callUI.innerHTML = `
            <div class="call-interface calling">
                <div class="call-info">
                    <div class="call-avatar">📞</div>
                    <h3>Calling...</h3>
                    <p>${callType === 'video' ? 'Video' : 'Voice'} Call</p>
                </div>
                <div class="call-controls">
                    <button class="call-btn end-call" onclick="window.webrtc.endCall()">
                        📞 End Call
                    </button>
                </div>
            </div>
        `;
    }

    showIncomingCallInterface(data) {
        const callUI = this.getCallUIContainer();
        callUI.classList.add('active');
        callUI.innerHTML = `
            <div class="call-interface incoming">
                <div class="call-info">
                    <div class="call-avatar">📞</div>
                    <h3>Incoming Call</h3>
                    <p>From: ${data.from.userName}</p>
                    <p>${data.callType === 'video' ? 'Video' : 'Voice'} Call</p>
                </div>
                <div class="call-controls">
                    <button class="call-btn accept" onclick="window.webrtc.answerCall('${data.callId}', true)">
                        ✅ Accept
                    </button>
                    <button class="call-btn decline" onclick="window.webrtc.answerCall('${data.callId}', false)">
                        ❌ Decline
                    </button>
                </div>
            </div>
        `;
    }

    showActiveCallInterface() {
        const callUI = this.getCallUIContainer();
        callUI.classList.add('active');
        callUI.innerHTML = `
            <div class="call-interface active">
                <div class="video-container">
                    <video id="localVideo" autoplay muted playsinline class="local-video"></video>
                    <div id="remoteVideos" class="remote-videos"></div>
                </div>
                <div class="call-controls">
                    <button class="call-btn ${this.callState.muted ? 'active' : ''}" onclick="window.webrtc.toggleMute()">
                        🔇 ${this.callState.muted ? 'Unmute' : 'Mute'}
                    </button>
                    <button class="call-btn ${!this.callState.videoEnabled ? 'active' : ''}" onclick="window.webrtc.toggleVideo()">
                        📹 ${this.callState.videoEnabled ? 'Stop Video' : 'Start Video'}
                    </button>
                    <button class="call-btn ${this.callState.screenSharing ? 'active' : ''}" onclick="window.webrtc.toggleScreenShare()">
                        🖥️ ${this.callState.screenSharing ? 'Stop Share' : 'Share Screen'}
                    </button>
                    <button class="call-btn end-call" onclick="window.webrtc.endCall()">
                        📞 End Call
                    </button>
                </div>
            </div>
        `;

        // Display local video
        this.displayLocalVideo();
    }

    displayLocalVideo() {
        const localVideo = document.getElementById('localVideo');
        if (localVideo && this.localStream) {
            localVideo.srcObject = this.localStream;
        }
    }

    displayRemoteVideo(userId, stream) {
        const remoteVideos = document.getElementById('remoteVideos');
        if (remoteVideos) {
            const videoElement = document.createElement('video');
            videoElement.id = `remoteVideo-${userId}`;
            videoElement.autoplay = true;
            videoElement.playsinline = true;
            videoElement.srcObject = stream;
            videoElement.className = 'remote-video';

            remoteVideos.appendChild(videoElement);
        }
    }

    updateCallUI() {
        // Update UI based on current call state
        const muteBtn = document.querySelector('.call-controls .call-btn[onclick="window.webrtc.toggleMute()"]');
        if (muteBtn) {
            muteBtn.textContent = `🔇 ${this.callState.muted ? 'Unmute' : 'Mute'}`;
            muteBtn.classList.toggle('active', this.callState.muted);
        }

        const videoBtn = document.querySelector('.call-controls .call-btn[onclick="window.webrtc.toggleVideo()"]');
        if (videoBtn) {
            videoBtn.textContent = `📹 ${this.callState.videoEnabled ? 'Stop Video' : 'Start Video'}`;
            videoBtn.classList.toggle('active', !this.callState.videoEnabled);
        }
    }

    getCallUIContainer() {
        let callUI = document.getElementById('callInterface');
        if (!callUI) {
            callUI = document.createElement('div');
            callUI.id = 'callInterface';
            callUI.className = 'call-ui-overlay';
            document.body.appendChild(callUI);
        }
        return callUI;
    }

    // Event handlers
    handleCallEnded(data) {
        console.log('📞 Call ended:', data.reason);
        this.cleanup();
    }

    handleCallError(error) {
        console.error('❌ Call error:', error);
        this.cleanup();
    }

    handleParticipantJoined(data) {
        console.log('👥 Setting up connection for new participant');
        this.setupPeerConnection(data.participant.userId);
    }

    handleParticipantLeft(data) {
        console.log('👥 Participant left, cleaning up connection');
        this.cleanupPeerConnection(data.userId);
    }

    handleParticipantMuted(data) {
        console.log(`🔇 Participant ${data.userId} ${data.muted ? 'muted' : 'unmuted'}`);
    }

    handleParticipantVideo(data) {
        console.log(`📹 Participant ${data.userId} ${data.videoEnabled ? 'enabled' : 'disabled'} video`);
    }

    handlePeerConnected(userId) {
        console.log(`✅ Peer connection established with: ${userId}`);
    }

    handlePeerDisconnected(userId) {
        console.log(`❌ Peer connection lost with: ${userId}`);
        this.cleanupPeerConnection(userId);
    }

    handleDisconnection() {
        console.log('🔗 Lost connection to signaling server');
        this.cleanup();
    }

    // Cleanup methods
    cleanupPeerConnection(userId) {
        const peerConnection = this.peerConnections.get(userId);
        if (peerConnection) {
            peerConnection.close();
            this.peerConnections.delete(userId);
        }

        this.remoteStreams.delete(userId);

        const remoteVideo = document.getElementById(`remoteVideo-${userId}`);
        if (remoteVideo) {
            remoteVideo.remove();
        }
    }

    cleanup() {
        console.log('🧹 Cleaning up WebRTC resources');

        // Stop all tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Close all peer connections
        this.peerConnections.forEach((peerConnection, userId) => {
            peerConnection.close();
        });
        this.peerConnections.clear();

        // Clear remote streams
        this.remoteStreams.clear();

        // Reset call state
        this.callState = {
            active: false,
            muted: false,
            videoEnabled: true,
            screenSharing: false
        };

        this.currentCall = null;

        // Hide call UI
        const callUI = document.getElementById('callInterface');
        if (callUI) {
            callUI.classList.remove('active');
            callUI.remove();
        }
    }
}

// Global instance
window.webrtc = new TalkPAIWebRTC();

console.log('🎥 Talk pAI WebRTC Client loaded successfully');