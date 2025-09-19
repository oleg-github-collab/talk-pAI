/**
 * Talk pAI WebRTC Signaling Server with COTURN Integration
 * Production-ready signaling server for video/audio calls
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8080', 'https://*.railway.app'],
    credentials: true
}));

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many API requests from this IP, please try again later.'
});

const callLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 call attempts per minute
    message: 'Too many call attempts, please try again later.'
});

app.use('/api', apiLimiter);
app.use(express.json());

// Socket.IO setup with enhanced security
const io = socketIo(server, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8080', 'https://*.railway.app'],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

// COTURN/TURN server configuration
const TURN_SERVERS = [
    {
        urls: process.env.COTURN_URL || 'turn:localhost:3478',
        username: process.env.COTURN_USERNAME || 'talkpai',
        credential: process.env.COTURN_CREDENTIAL || 'talkpai123'
    },
    {
        urls: 'stun:stun.l.google.com:19302' // Fallback STUN server
    },
    {
        urls: 'stun:stun1.l.google.com:19302' // Additional STUN server
    }
];

// In-memory storage for active calls and rooms
const activeRooms = new Map();
const activeCalls = new Map();
const userSockets = new Map();

// Call states
const CALL_STATES = {
    INITIATING: 'initiating',
    RINGING: 'ringing',
    CONNECTING: 'connecting',
    ACTIVE: 'active',
    ENDED: 'ended',
    FAILED: 'failed'
};

// WebRTC configuration
const RTC_CONFIGURATION = {
    iceServers: TURN_SERVERS,
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
};

// Socket connection handler
io.on('connection', (socket) => {
    console.log(`🔗 Client connected: ${socket.id}`);

    // Handle user authentication/registration
    socket.on('user:register', (userData) => {
        console.log(`👤 User registered: ${userData.userId} (${socket.id})`);
        socket.userId = userData.userId;
        socket.userName = userData.userName;
        userSockets.set(userData.userId, socket);

        socket.emit('user:registered', {
            socketId: socket.id,
            rtcConfiguration: RTC_CONFIGURATION
        });
    });

    // Handle call initiation
    socket.on('call:initiate', callLimiter, async (callData) => {
        try {
            const { targetUserId, callType, chatId } = callData;
            const callId = generateCallId();

            console.log(`📞 Call initiated: ${callId} from ${socket.userId} to ${targetUserId}`);

            // Create call record
            const call = {
                id: callId,
                initiatorId: socket.userId,
                targetUserId,
                callType, // 'voice' or 'video'
                chatId,
                state: CALL_STATES.INITIATING,
                participants: new Map(),
                startTime: Date.now(),
                offers: new Map(),
                answers: new Map(),
                candidates: new Map()
            };

            activeCalls.set(callId, call);
            socket.callId = callId;

            // Add initiator as participant
            call.participants.set(socket.userId, {
                socketId: socket.id,
                userId: socket.userId,
                userName: socket.userName,
                role: 'initiator',
                joined: Date.now(),
                muted: false,
                videoEnabled: callType === 'video'
            });

            // Check if target user is online
            const targetSocket = userSockets.get(targetUserId);
            if (!targetSocket) {
                socket.emit('call:failed', { callId, reason: 'User offline' });
                activeCalls.delete(callId);
                return;
            }

            // Send incoming call to target user
            targetSocket.emit('call:incoming', {
                callId,
                from: {
                    userId: socket.userId,
                    userName: socket.userName
                },
                callType,
                chatId
            });

            call.state = CALL_STATES.RINGING;

            // Set call timeout (30 seconds)
            setTimeout(() => {
                if (activeCalls.has(callId) && call.state === CALL_STATES.RINGING) {
                    endCall(callId, 'timeout');
                }
            }, 30000);

        } catch (error) {
            console.error('❌ Call initiation failed:', error);
            socket.emit('call:failed', { reason: 'Server error' });
        }
    });

    // Handle call answer
    socket.on('call:answer', (data) => {
        const { callId, accept } = data;
        const call = activeCalls.get(callId);

        if (!call) {
            socket.emit('call:failed', { reason: 'Call not found' });
            return;
        }

        console.log(`📞 Call ${accept ? 'accepted' : 'declined'}: ${callId}`);

        if (accept) {
            // Add answerer as participant
            call.participants.set(socket.userId, {
                socketId: socket.id,
                userId: socket.userId,
                userName: socket.userName,
                role: 'participant',
                joined: Date.now(),
                muted: false,
                videoEnabled: call.callType === 'video'
            });

            call.state = CALL_STATES.CONNECTING;
            socket.callId = callId;

            // Notify all participants that call was accepted
            broadcastToCall(callId, 'call:accepted', {
                callId,
                participants: Array.from(call.participants.values())
            });
        } else {
            // Call declined
            endCall(callId, 'declined');
        }
    });

    // Handle WebRTC offer
    socket.on('webrtc:offer', (data) => {
        const { callId, offer, targetUserId } = data;
        const call = activeCalls.get(callId);

        if (!call) return;

        console.log(`🔄 WebRTC offer from ${socket.userId} to ${targetUserId}`);

        call.offers.set(`${socket.userId}-${targetUserId}`, offer);

        const targetSocket = userSockets.get(targetUserId);
        if (targetSocket) {
            targetSocket.emit('webrtc:offer', {
                callId,
                offer,
                from: socket.userId
            });
        }
    });

    // Handle WebRTC answer
    socket.on('webrtc:answer', (data) => {
        const { callId, answer, targetUserId } = data;
        const call = activeCalls.get(callId);

        if (!call) return;

        console.log(`🔄 WebRTC answer from ${socket.userId} to ${targetUserId}`);

        call.answers.set(`${socket.userId}-${targetUserId}`, answer);

        const targetSocket = userSockets.get(targetUserId);
        if (targetSocket) {
            targetSocket.emit('webrtc:answer', {
                callId,
                answer,
                from: socket.userId
            });
        }
    });

    // Handle ICE candidates
    socket.on('webrtc:ice-candidate', (data) => {
        const { callId, candidate, targetUserId } = data;
        const call = activeCalls.get(callId);

        if (!call) return;

        // Store candidate
        const key = `${socket.userId}-${targetUserId}`;
        if (!call.candidates.has(key)) {
            call.candidates.set(key, []);
        }
        call.candidates.get(key).push(candidate);

        // Forward candidate to target user
        const targetSocket = userSockets.get(targetUserId);
        if (targetSocket) {
            targetSocket.emit('webrtc:ice-candidate', {
                callId,
                candidate,
                from: socket.userId
            });
        }
    });

    // Handle call control events
    socket.on('call:mute', (data) => {
        const { callId, muted } = data;
        const call = activeCalls.get(callId);

        if (call && call.participants.has(socket.userId)) {
            call.participants.get(socket.userId).muted = muted;
            broadcastToCall(callId, 'call:participant-muted', {
                userId: socket.userId,
                muted
            }, socket.userId);
        }
    });

    socket.on('call:video-toggle', (data) => {
        const { callId, videoEnabled } = data;
        const call = activeCalls.get(callId);

        if (call && call.participants.has(socket.userId)) {
            call.participants.get(socket.userId).videoEnabled = videoEnabled;
            broadcastToCall(callId, 'call:participant-video', {
                userId: socket.userId,
                videoEnabled
            }, socket.userId);
        }
    });

    // Handle call end
    socket.on('call:end', (data) => {
        const { callId } = data;
        console.log(`📞 Call ended by user: ${callId}`);
        endCall(callId, 'ended-by-user');
    });

    // Handle group call join
    socket.on('call:join', (data) => {
        const { callId } = data;
        const call = activeCalls.get(callId);

        if (!call) {
            socket.emit('call:failed', { reason: 'Call not found' });
            return;
        }

        console.log(`👥 User joining group call: ${socket.userId} -> ${callId}`);

        // Add participant to call
        call.participants.set(socket.userId, {
            socketId: socket.id,
            userId: socket.userId,
            userName: socket.userName,
            role: 'participant',
            joined: Date.now(),
            muted: false,
            videoEnabled: call.callType === 'video'
        });

        socket.callId = callId;

        // Notify existing participants
        broadcastToCall(callId, 'call:participant-joined', {
            participant: call.participants.get(socket.userId),
            participants: Array.from(call.participants.values())
        }, socket.userId);

        // Send current participants to new joiner
        socket.emit('call:participants', {
            callId,
            participants: Array.from(call.participants.values())
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`🔗 Client disconnected: ${socket.id}`);

        // Remove from user mapping
        if (socket.userId) {
            userSockets.delete(socket.userId);
        }

        // Handle active call disconnection
        if (socket.callId) {
            const call = activeCalls.get(socket.callId);
            if (call && call.participants.has(socket.userId)) {
                call.participants.delete(socket.userId);

                // Notify remaining participants
                broadcastToCall(socket.callId, 'call:participant-left', {
                    userId: socket.userId,
                    participants: Array.from(call.participants.values())
                });

                // End call if no participants left
                if (call.participants.size === 0) {
                    endCall(socket.callId, 'all-left');
                }
            }
        }
    });
});

// Helper functions
function generateCallId() {
    return 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function broadcastToCall(callId, event, data, excludeUserId = null) {
    const call = activeCalls.get(callId);
    if (!call) return;

    call.participants.forEach((participant, userId) => {
        if (userId !== excludeUserId) {
            const socket = userSockets.get(userId);
            if (socket) {
                socket.emit(event, data);
            }
        }
    });
}

function endCall(callId, reason) {
    const call = activeCalls.get(callId);
    if (!call) return;

    console.log(`📞 Ending call: ${callId} (${reason})`);

    call.state = CALL_STATES.ENDED;
    call.endTime = Date.now();
    call.duration = call.endTime - call.startTime;

    // Notify all participants
    broadcastToCall(callId, 'call:ended', {
        callId,
        reason,
        duration: call.duration
    });

    // Clean up
    activeCalls.delete(callId);
}

// API endpoints
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeCalls: activeCalls.size,
        connectedUsers: userSockets.size
    });
});

app.get('/api/turn-credentials', (req, res) => {
    // Generate temporary TURN credentials (for security)
    const timestamp = Math.floor(Date.now() / 1000) + 86400; // 24 hours
    const username = `${timestamp}:talkpai`;

    res.json({
        iceServers: [
            ...TURN_SERVERS,
            {
                urls: process.env.COTURN_URL || 'turn:localhost:3478',
                username,
                credential: generateTurnCredential(username, process.env.TURN_SECRET || 'talkpai-secret')
            }
        ]
    });
});

function generateTurnCredential(username, secret) {
    const crypto = require('crypto');
    return crypto.createHmac('sha1', secret).update(username).digest('base64');
}

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`
🚀 Talk pAI WebRTC Signaling Server Started
📍 Port: ${PORT}
🔗 Socket.IO: Ready
🎥 COTURN: ${process.env.COTURN_URL || 'localhost:3478'}
🛡️  Security: Helmet + CORS + Rate Limiting
⚡ Status: Production Ready
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down WebRTC server...');

    // End all active calls
    activeCalls.forEach((call, callId) => {
        endCall(callId, 'server-shutdown');
    });

    server.close(() => {
        console.log('✅ WebRTC server shut down gracefully');
        process.exit(0);
    });
});

module.exports = { app, server, io };