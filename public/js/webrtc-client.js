class WebRTCCallClient {
    constructor(socket) {
        this.socket = socket;
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.currentCall = null;
        this.isInitiator = false;
        this.callStartTime = null;
        this.callTimerInterval = null;
        this.mediaConstraints = {
            audio: true,
            video: false
        };

        // WebRTC configuration with STUN servers
        this.rtcConfiguration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        };

        this.setupEventListeners();
        this.initializeMediaDevices();
    }

    setupEventListeners() {
        // Incoming call
        this.socket.on('incoming_call', (data) => {
            this.handleIncomingCall(data);
        });

        // Call accepted
        this.socket.on('call_accepted', (data) => {
            this.handleCallAccepted(data);
        });

        // Call ended
        this.socket.on('call_ended', (data) => {
            this.handleCallEnded(data);
        });

        // WebRTC signaling
        this.socket.on('webrtc_offer', (data) => {
            this.handleOffer(data);
        });

        this.socket.on('webrtc_answer', (data) => {
            this.handleAnswer(data);
        });

        this.socket.on('webrtc_ice_candidate', (data) => {
            this.handleIceCandidate(data);
        });

        // Call controls
        this.socket.on('participant_audio_toggle', (data) => {
            this.handleParticipantAudioToggle(data);
        });

        this.socket.on('participant_video_toggle', (data) => {
            this.handleParticipantVideoToggle(data);
        });

        this.socket.on('screen_share_started', (data) => {
            this.handleScreenShareStarted(data);
        });

        this.socket.on('screen_share_stopped', (data) => {
            this.handleScreenShareStopped(data);
        });

        // Call errors
        this.socket.on('call_error', (data) => {
            this.handleCallError(data);
        });
    }

    async initializeMediaDevices() {
        try {
            // Get available media devices
            this.mediaDevices = await navigator.mediaDevices.enumerateDevices();
            this.audioDevices = this.mediaDevices.filter(device => device.kind === 'audioinput');
            this.videoDevices = this.mediaDevices.filter(device => device.kind === 'videoinput');
            this.audioOutputDevices = this.mediaDevices.filter(device => device.kind === 'audiooutput');

            console.log('Media devices initialized:', {
                audio: this.audioDevices.length,
                video: this.videoDevices.length,
                audioOutput: this.audioOutputDevices.length
            });

        } catch (error) {
            console.error('Failed to initialize media devices:', error);
        }
    }

    // Initiate a call
    async initiateCall(targetUserId, callType = 'audio', chatId = null) {
        try {
            this.mediaConstraints.video = callType === 'video';
            this.isInitiator = true;

            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia(this.mediaConstraints);

            // Display local video if video call
            if (callType === 'video') {
                this.displayLocalVideo();
            }

            // Create peer connection
            this.createPeerConnection();

            // Add local stream to peer connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Send initiate call signal
            this.socket.emit('initiate_call', {
                targetUserId,
                callType,
                chatId,
                callerInfo: {
                    nickname: window.currentUser?.nickname,
                    displayName: window.currentUser?.displayName,
                    avatar: window.currentUser?.avatar
                }
            });

            // Show calling UI
            this.showCallInterface({
                status: 'calling',
                callType,
                targetUser: { id: targetUserId }
            });

        } catch (error) {
            console.error('Failed to initiate call:', error);
            this.handleCallError({ error: 'MEDIA_ERROR', message: error.message });
        }
    }

    // Accept incoming call
    async acceptCall(callId, callType) {
        try {
            this.currentCall = { id: callId, type: callType };
            this.mediaConstraints.video = callType === 'video';

            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia(this.mediaConstraints);

            // Display local video if video call
            if (callType === 'video') {
                this.displayLocalVideo();
            }

            // Create peer connection
            this.createPeerConnection();

            // Add local stream to peer connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Accept the call
            this.socket.emit('accept_call', { callId });

            // Update UI
            this.updateCallInterface({ status: 'connecting' });

        } catch (error) {
            console.error('Failed to accept call:', error);
            this.declineCall(callId);
        }
    }

    // Decline incoming call
    declineCall(callId) {
        this.socket.emit('decline_call', { callId });
        this.hideCallInterface();
    }

    // End current call
    endCall() {
        if (this.currentCall) {
            this.socket.emit('end_call', { callId: this.currentCall.id });
        }
        this.cleanup();
        this.hideCallInterface();
    }

    // Create WebRTC peer connection
    createPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.rtcConfiguration);

        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            console.log('Received remote stream');
            this.remoteStream = event.streams[0];
            this.displayRemoteVideo();
        };

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('webrtc_ice_candidate', {
                    callId: this.currentCall?.id,
                    candidate: event.candidate,
                    targetUserId: this.getTargetUserId()
                });
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);

            switch (this.peerConnection.connectionState) {
                case 'connected':
                    this.updateCallInterface({ status: 'connected' });
                    this.startCallTimer();
                    break;
                case 'disconnected':
                case 'failed':
                    this.handleConnectionFailure();
                    break;
            }
        };

        // Handle ICE connection state changes
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
            this.reportCallQuality();
        };
    }

    // Handle incoming call
    handleIncomingCall(data) {
        this.currentCall = { id: data.callId, type: data.callType };

        // Show incoming call UI
        this.showIncomingCallInterface({
            callId: data.callId,
            callType: data.callType,
            caller: data.from,
            chatId: data.chatId
        });

        // Play ringtone
        this.playRingtone();
    }

    // Handle call accepted
    async handleCallAccepted(data) {
        if (this.isInitiator) {
            // Create and send offer
            try {
                const offer = await this.peerConnection.createOffer();
                await this.peerConnection.setLocalDescription(offer);

                this.socket.emit('webrtc_offer', {
                    callId: data.callId,
                    offer: offer,
                    targetUserId: this.getTargetUserId()
                });

                this.updateCallInterface({ status: 'connecting' });

            } catch (error) {
                console.error('Failed to create offer:', error);
            }
        }
    }

    // Handle WebRTC offer
    async handleOffer(data) {
        try {
            await this.peerConnection.setRemoteDescription(data.offer);

            // Create and send answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.socket.emit('webrtc_answer', {
                callId: data.callId,
                answer: answer,
                targetUserId: data.from
            });

        } catch (error) {
            console.error('Failed to handle offer:', error);
        }
    }

    // Handle WebRTC answer
    async handleAnswer(data) {
        try {
            await this.peerConnection.setRemoteDescription(data.answer);
        } catch (error) {
            console.error('Failed to handle answer:', error);
        }
    }

    // Handle ICE candidate
    async handleIceCandidate(data) {
        try {
            await this.peerConnection.addIceCandidate(data.candidate);
        } catch (error) {
            console.error('Failed to add ICE candidate:', error);
        }
    }

    // Handle call ended
    handleCallEnded(data) {
        console.log('Call ended:', data.reason);
        this.cleanup();
        this.hideCallInterface();

        // Show end call notification
        this.showCallEndNotification(data);
    }

    // Handle call error
    handleCallError(data) {
        console.error('Call error:', data);
        this.cleanup();
        this.hideCallInterface();

        // Show error notification
        this.showErrorNotification(data);
    }

    // Call controls
    toggleAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;

                this.socket.emit('toggle_audio', {
                    callId: this.currentCall?.id,
                    muted: !audioTrack.enabled
                });

                this.updateAudioButton(!audioTrack.enabled);
                return !audioTrack.enabled;
            }
        }
        return false;
    }

    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;

                this.socket.emit('toggle_video', {
                    callId: this.currentCall?.id,
                    disabled: !videoTrack.enabled
                });

                this.updateVideoButton(!videoTrack.enabled);
                return !videoTrack.enabled;
            }
        }
        return false;
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

            // Handle screen share end
            videoTrack.onended = () => {
                this.stopScreenShare();
            };

            this.socket.emit('screen_share_start', {
                callId: this.currentCall?.id
            });

            this.updateScreenShareButton(true);

        } catch (error) {
            console.error('Failed to start screen share:', error);
        }
    }

    async stopScreenShare() {
        try {
            // Get camera stream back
            const cameraStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });

            const videoTrack = cameraStream.getVideoTracks()[0];
            const sender = this.peerConnection.getSenders().find(s =>
                s.track && s.track.kind === 'video'
            );

            if (sender) {
                await sender.replaceTrack(videoTrack);
            }

            this.socket.emit('screen_share_stop', {
                callId: this.currentCall?.id
            });

            this.updateScreenShareButton(false);

        } catch (error) {
            console.error('Failed to stop screen share:', error);
        }
    }

    // UI Management
    showCallInterface(callData) {
        const callOverlay = document.getElementById('callOverlay');
        if (callOverlay) {
            callOverlay.classList.add('active');

            // Update call info
            this.updateCallInterface(callData);
        }
    }

    showIncomingCallInterface(callData) {
        // Create incoming call UI
        const incomingCallHTML = `
            <div class="incoming-call-overlay active" id="incomingCallOverlay">
                <div class="incoming-call-interface">
                    <div class="caller-info">
                        <div class="caller-avatar">
                            <img src="${callData.caller.avatar || '/avatars/default.jpg'}" alt="Caller">
                        </div>
                        <div class="caller-details">
                            <div class="caller-name">${callData.caller.displayName || callData.caller.nickname}</div>
                            <div class="call-type">${callData.callType === 'video' ? 'Video Call' : 'Voice Call'}</div>
                        </div>
                    </div>
                    <div class="incoming-call-controls">
                        <button class="call-control-btn decline" onclick="webrtcClient.declineCall('${callData.callId}')">
                            <i class="fas fa-phone-slash"></i>
                        </button>
                        <button class="call-control-btn accept" onclick="webrtcClient.acceptCall('${callData.callId}', '${callData.callType}')">
                            <i class="fas fa-phone"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', incomingCallHTML);
    }

    updateCallInterface(data) {
        const statusElement = document.querySelector('.call-status');

        if (statusElement) {
            statusElement.textContent = this.getStatusText(data.status);
        }

        if (data.status === 'connected' && !this.callStartTime) {
            this.callStartTime = Date.now();
            this.startCallTimer();
        }
    }

    startCallTimer() {
        const timerElement = document.querySelector('.call-timer');
        if (!timerElement) return;

        this.callTimerInterval = setInterval(() => {
            if (this.callStartTime) {
                const elapsed = Date.now() - this.callStartTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    hideCallInterface() {
        // Clear call timer
        if (this.callTimerInterval) {
            clearInterval(this.callTimerInterval);
            this.callTimerInterval = null;
        }

        const callOverlay = document.getElementById('callOverlay');
        const incomingCallOverlay = document.getElementById('incomingCallOverlay');

        if (callOverlay) {
            callOverlay.classList.remove('active');
        }

        if (incomingCallOverlay) {
            incomingCallOverlay.remove();
        }

        this.stopRingtone();
    }

    displayLocalVideo() {
        const localVideo = document.getElementById('localVideo');
        if (localVideo && this.localStream) {
            localVideo.srcObject = this.localStream;
        }
    }

    displayRemoteVideo() {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && this.remoteStream) {
            remoteVideo.srcObject = this.remoteStream;
        }
    }

    startCallTimer() {
        if (this.callTimer) clearInterval(this.callTimer);

        this.callTimer = setInterval(() => {
            if (this.callStartTime) {
                const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;

                const timerElement = document.querySelector('.call-timer');
                if (timerElement) {
                    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            }
        }, 1000);
    }

    playRingtone() {
        // Play ringtone sound
        if (this.ringtoneAudio) {
            this.ringtoneAudio.play().catch(console.error);
        }
    }

    stopRingtone() {
        if (this.ringtoneAudio) {
            this.ringtoneAudio.pause();
            this.ringtoneAudio.currentTime = 0;
        }
    }

    reportCallQuality() {
        if (!this.peerConnection) return;

        this.peerConnection.getStats().then(stats => {
            let quality = 'good';
            let connectionStats = {};

            stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                    connectionStats.packetsLost = report.packetsLost;
                    connectionStats.jitter = report.jitter;

                    if (report.packetsLost > 10 || report.jitter > 0.1) {
                        quality = 'poor';
                    } else if (report.packetsLost > 5 || report.jitter > 0.05) {
                        quality = 'fair';
                    }
                }
            });

            this.socket.emit('report_call_quality', {
                callId: this.currentCall?.id,
                quality,
                connectionStats
            });
        });
    }

    cleanup() {
        // Stop all tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Clear timers
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }

        // Reset state
        this.currentCall = null;
        this.isInitiator = false;
        this.callStartTime = null;
        this.remoteStream = null;
    }

    getStatusText(status) {
        const statusMap = {
            calling: 'Calling...',
            ringing: 'Ringing...',
            connecting: 'Connecting...',
            connected: 'Connected'
        };
        return statusMap[status] || status;
    }

    getTargetUserId() {
        // This should be implemented based on your call data structure
        return this.currentCall?.targetUserId;
    }

    // Event handlers for participant actions
    handleParticipantAudioToggle(data) {
        console.log(`User ${data.userId} ${data.muted ? 'muted' : 'unmuted'} audio`);
        // Update UI to show participant audio status
    }

    handleParticipantVideoToggle(data) {
        console.log(`User ${data.userId} ${data.disabled ? 'disabled' : 'enabled'} video`);
        // Update UI to show participant video status
    }

    handleScreenShareStarted(data) {
        console.log(`User ${data.userId} started screen sharing`);
        // Update UI to show screen sharing indicator
    }

    handleScreenShareStopped(data) {
        console.log(`User ${data.userId} stopped screen sharing`);
        // Update UI to remove screen sharing indicator
    }

    handleConnectionFailure() {
        console.log('WebRTC connection failed');
        this.showErrorNotification({
            error: 'CONNECTION_FAILED',
            message: 'Connection lost. Please try again.'
        });
        this.endCall();
    }

    updateAudioButton(muted) {
        const audioBtn = document.querySelector('.call-control-btn.audio');
        if (audioBtn) {
            audioBtn.classList.toggle('muted', muted);
            const icon = audioBtn.querySelector('i');
            if (icon) {
                icon.className = muted ? 'fas fa-microphone-slash' : 'fas fa-microphone';
            }
        }
    }

    updateVideoButton(disabled) {
        const videoBtn = document.querySelector('.call-control-btn.video');
        if (videoBtn) {
            videoBtn.classList.toggle('disabled', disabled);
            const icon = videoBtn.querySelector('i');
            if (icon) {
                icon.className = disabled ? 'fas fa-video-slash' : 'fas fa-video';
            }
        }
    }

    updateScreenShareButton(sharing) {
        const screenBtn = document.querySelector('.call-control-btn.screen-share');
        if (screenBtn) {
            screenBtn.classList.toggle('active', sharing);
        }
    }

    showCallEndNotification(data) {
        // Implement call end notification
        console.log('Call ended:', data);
    }

    showErrorNotification(data) {
        // Implement error notification
        console.error('Call error:', data);
    }
}

// Initialize WebRTC client when socket is available
let webrtcClient = null;

// Export for global access
window.initializeWebRTC = (socket) => {
    webrtcClient = new WebRTCCallClient(socket);
    window.webrtcClient = webrtcClient;
    return webrtcClient;
};