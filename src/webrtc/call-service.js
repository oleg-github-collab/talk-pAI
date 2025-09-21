const { Pool } = require('pg');
const crypto = require('crypto');
const EventEmitter = require('events');

class WebRTCCallService extends EventEmitter {
    constructor(io) {
        super();
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        this.io = io;
        this.activeCalls = new Map(); // callId -> { participants, status, metadata }
        this.userCalls = new Map(); // userId -> callId
        this.setupSocketHandlers();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            // Initiate call
            socket.on('initiate_call', async (data) => {
                try {
                    if (!socket.userId) return;

                    const { targetUserId, callType = 'audio', chatId } = data;

                    // Check if target user is available
                    const targetStatus = await this.getUserCallStatus(targetUserId);
                    if (targetStatus.inCall) {
                        socket.emit('call_error', {
                            error: 'USER_BUSY',
                            message: 'Target user is already in a call'
                        });
                        return;
                    }

                    // Create call record
                    const call = await this.createCall({
                        initiatorId: socket.userId,
                        targetUserId,
                        callType,
                        chatId
                    });

                    // Add participants to call
                    this.activeCalls.set(call.id, {
                        participants: new Map([
                            [socket.userId, { socketId: socket.id, status: 'calling' }],
                            [targetUserId, { socketId: null, status: 'ringing' }]
                        ]),
                        status: 'initiated',
                        callType,
                        initiatedAt: new Date(),
                        metadata: {}
                    });

                    this.userCalls.set(socket.userId, call.id);
                    this.userCalls.set(targetUserId, call.id);

                    // Join call room
                    socket.join(`call-${call.id}`);

                    // Find target user's socket and notify
                    const targetSocket = this.findUserSocket(targetUserId);
                    if (targetSocket) {
                        targetSocket.join(`call-${call.id}`);
                        this.activeCalls.get(call.id).participants.get(targetUserId).socketId = targetSocket.id;

                        targetSocket.emit('incoming_call', {
                            callId: call.id,
                            from: {
                                id: socket.userId,
                                nickname: data.callerInfo?.nickname,
                                displayName: data.callerInfo?.displayName,
                                avatar: data.callerInfo?.avatar
                            },
                            callType,
                            chatId
                        });

                        // Start ringing timeout
                        setTimeout(() => {
                            this.handleCallTimeout(call.id);
                        }, 60000); // 60 seconds timeout
                    } else {
                        // Target user is offline
                        socket.emit('call_error', {
                            error: 'USER_OFFLINE',
                            message: 'Target user is not available'
                        });
                        await this.endCall(call.id, 'failed');
                    }

                    socket.emit('call_initiated', {
                        callId: call.id,
                        status: 'ringing'
                    });

                } catch (error) {
                    socket.emit('call_error', {
                        error: 'CALL_FAILED',
                        message: error.message
                    });
                }
            });

            // Accept call
            socket.on('accept_call', async (data) => {
                try {
                    if (!socket.userId) return;

                    const { callId } = data;
                    const call = this.activeCalls.get(callId);

                    if (!call || !call.participants.has(socket.userId)) {
                        socket.emit('call_error', {
                            error: 'INVALID_CALL',
                            message: 'Call not found or access denied'
                        });
                        return;
                    }

                    // Update call status
                    call.status = 'answered';
                    call.answeredAt = new Date();
                    call.participants.get(socket.userId).status = 'connected';

                    // Update database
                    await this.pool.query(`
                        UPDATE call_logs SET
                            status = 'answered',
                            answered_at = CURRENT_TIMESTAMP
                        WHERE call_id = $1
                    `, [callId]);

                    // Notify all participants
                    this.io.to(`call-${callId}`).emit('call_accepted', {
                        callId,
                        acceptedBy: socket.userId
                    });

                } catch (error) {
                    socket.emit('call_error', {
                        error: 'ACCEPT_FAILED',
                        message: error.message
                    });
                }
            });

            // Decline call
            socket.on('decline_call', async (data) => {
                try {
                    if (!socket.userId) return;

                    const { callId } = data;
                    await this.endCall(callId, 'declined', socket.userId);

                } catch (error) {
                    socket.emit('call_error', {
                        error: 'DECLINE_FAILED',
                        message: error.message
                    });
                }
            });

            // End call
            socket.on('end_call', async (data) => {
                try {
                    if (!socket.userId) return;

                    const { callId } = data;
                    await this.endCall(callId, 'ended', socket.userId);

                } catch (error) {
                    socket.emit('call_error', {
                        error: 'END_FAILED',
                        message: error.message
                    });
                }
            });

            // WebRTC signaling
            socket.on('webrtc_offer', (data) => {
                const { callId, offer, targetUserId } = data;
                const targetSocket = this.findUserSocket(targetUserId);

                if (targetSocket) {
                    targetSocket.emit('webrtc_offer', {
                        callId,
                        offer,
                        from: socket.userId
                    });
                }
            });

            socket.on('webrtc_answer', (data) => {
                const { callId, answer, targetUserId } = data;
                const targetSocket = this.findUserSocket(targetUserId);

                if (targetSocket) {
                    targetSocket.emit('webrtc_answer', {
                        callId,
                        answer,
                        from: socket.userId
                    });
                }
            });

            socket.on('webrtc_ice_candidate', (data) => {
                const { callId, candidate, targetUserId } = data;
                const targetSocket = this.findUserSocket(targetUserId);

                if (targetSocket) {
                    targetSocket.emit('webrtc_ice_candidate', {
                        callId,
                        candidate,
                        from: socket.userId
                    });
                }
            });

            // Call controls
            socket.on('toggle_audio', (data) => {
                const { callId, muted } = data;
                socket.to(`call-${callId}`).emit('participant_audio_toggle', {
                    userId: socket.userId,
                    muted
                });
            });

            socket.on('toggle_video', (data) => {
                const { callId, disabled } = data;
                socket.to(`call-${callId}`).emit('participant_video_toggle', {
                    userId: socket.userId,
                    disabled
                });
            });

            socket.on('screen_share_start', (data) => {
                const { callId } = data;
                socket.to(`call-${callId}`).emit('screen_share_started', {
                    userId: socket.userId
                });
            });

            socket.on('screen_share_stop', (data) => {
                const { callId } = data;
                socket.to(`call-${callId}`).emit('screen_share_stopped', {
                    userId: socket.userId
                });
            });

            // Group call management
            socket.on('invite_to_call', async (data) => {
                try {
                    if (!socket.userId) return;

                    const { callId, userIds } = data;
                    const call = this.activeCalls.get(callId);

                    if (!call || !call.participants.has(socket.userId)) {
                        socket.emit('call_error', {
                            error: 'INVALID_CALL',
                            message: 'Call not found or access denied'
                        });
                        return;
                    }

                    for (const userId of userIds) {
                        // Check if user is already in call
                        if (call.participants.has(userId)) continue;

                        // Check if user is available
                        const userStatus = await this.getUserCallStatus(userId);
                        if (userStatus.inCall) continue;

                        // Add user to call
                        call.participants.set(userId, { socketId: null, status: 'invited' });
                        this.userCalls.set(userId, callId);

                        // Find user's socket and invite
                        const userSocket = this.findUserSocket(userId);
                        if (userSocket) {
                            userSocket.join(`call-${callId}`);
                            call.participants.get(userId).socketId = userSocket.id;

                            userSocket.emit('call_invitation', {
                                callId,
                                from: {
                                    id: socket.userId,
                                    // Add user info
                                },
                                callType: call.callType,
                                participantCount: call.participants.size
                            });
                        }

                        // Add to database
                        await this.pool.query(`
                            INSERT INTO call_participants (call_id, user_id)
                            VALUES ((SELECT id FROM call_logs WHERE call_id = $1), $2)
                        `, [callId, userId]);
                    }

                } catch (error) {
                    socket.emit('call_error', {
                        error: 'INVITE_FAILED',
                        message: error.message
                    });
                }
            });

            // Call quality reporting
            socket.on('report_call_quality', async (data) => {
                try {
                    const { callId, quality, connectionStats } = data;

                    await this.pool.query(`
                        UPDATE call_participants SET
                            connection_quality = $1
                        WHERE call_id = (SELECT id FROM call_logs WHERE call_id = $2)
                        AND user_id = $3
                    `, [quality, callId, socket.userId]);

                    // Store detailed stats for analysis
                    await this.pool.query(`
                        UPDATE call_logs SET
                            metadata = metadata || $1
                        WHERE call_id = $2
                    `, [JSON.stringify({
                        [`${socket.userId}_stats`]: connectionStats
                    }), callId]);

                } catch (error) {
                    console.error('Failed to report call quality:', error);
                }
            });

            // Handle disconnect during call
            socket.on('disconnect', async () => {
                if (socket.userId && this.userCalls.has(socket.userId)) {
                    const callId = this.userCalls.get(socket.userId);
                    const call = this.activeCalls.get(callId);

                    if (call && call.participants.has(socket.userId)) {
                        // Mark user as disconnected
                        call.participants.get(socket.userId).status = 'disconnected';

                        // Notify other participants
                        socket.to(`call-${callId}`).emit('participant_disconnected', {
                            userId: socket.userId
                        });

                        // If it's a 1-on-1 call, end it
                        if (call.participants.size === 2) {
                            await this.endCall(callId, 'ended', socket.userId);
                        }
                    }
                }
            });
        });
    }

    async createCall({ initiatorId, targetUserId, callType, chatId }) {
        try {
            const callId = crypto.randomUUID();

            const result = await this.pool.query(`
                INSERT INTO call_logs (
                    call_id, chat_id, initiator_id, call_type, status
                ) VALUES ($1, $2, $3, $4, 'initiated')
                RETURNING *
            `, [callId, chatId, initiatorId, callType]);

            const call = result.rows[0];

            // Add participants
            await this.pool.query(`
                INSERT INTO call_participants (call_id, user_id)
                VALUES ($1, $2), ($1, $3)
            `, [call.id, initiatorId, targetUserId]);

            return { ...call, call_id: callId };

        } catch (error) {
            throw new Error(`Failed to create call: ${error.message}`);
        }
    }

    async endCall(callId, reason = 'ended', endedBy = null) {
        try {
            const call = this.activeCalls.get(callId);
            if (!call) return;

            const duration = call.answeredAt
                ? Math.floor((new Date() - call.answeredAt) / 1000)
                : 0;

            // Update database
            await this.pool.query(`
                UPDATE call_logs SET
                    status = $1,
                    ended_at = CURRENT_TIMESTAMP,
                    duration_seconds = $2,
                    ended_reason = $3
                WHERE call_id = $4
            `, [reason, duration, reason, callId]);

            // Update participants
            for (const [userId, participant] of call.participants) {
                await this.pool.query(`
                    UPDATE call_participants SET
                        left_at = CURRENT_TIMESTAMP
                    WHERE call_id = (SELECT id FROM call_logs WHERE call_id = $1)
                    AND user_id = $2
                `, [callId, userId]);

                this.userCalls.delete(userId);
            }

            // Notify all participants
            this.io.to(`call-${callId}`).emit('call_ended', {
                callId,
                reason,
                duration,
                endedBy
            });

            // Clean up
            this.activeCalls.delete(callId);

            // Leave all sockets from call room
            const room = this.io.sockets.adapter.rooms.get(`call-${callId}`);
            if (room) {
                for (const socketId of room) {
                    const socket = this.io.sockets.sockets.get(socketId);
                    if (socket) {
                        socket.leave(`call-${callId}`);
                    }
                }
            }

        } catch (error) {
            console.error('Failed to end call:', error);
        }
    }

    async handleCallTimeout(callId) {
        const call = this.activeCalls.get(callId);
        if (call && call.status === 'initiated') {
            await this.endCall(callId, 'missed');
        }
    }

    findUserSocket(userId) {
        for (const [socketId, socket] of this.io.sockets.sockets) {
            if (socket.userId === userId) {
                return socket;
            }
        }
        return null;
    }

    async getUserCallStatus(userId) {
        const callId = this.userCalls.get(userId);
        if (callId) {
            const call = this.activeCalls.get(callId);
            return {
                inCall: true,
                callId,
                status: call?.status,
                callType: call?.callType
            };
        }
        return { inCall: false };
    }

    // API methods
    async getCallHistory(userId, limit = 50, offset = 0) {
        try {
            const result = await this.pool.query(`
                SELECT
                    cl.*,
                    i.nickname as initiator_nickname,
                    i.display_name as initiator_display_name,
                    i.avatar as initiator_avatar,
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', u.id,
                                'nickname', u.nickname,
                                'display_name', u.display_name,
                                'avatar', u.avatar,
                                'joined_at', cp.joined_at,
                                'left_at', cp.left_at
                            )
                        )
                        FROM call_participants cp
                        JOIN users u ON cp.user_id = u.id
                        WHERE cp.call_id = cl.id
                    ) as participants
                FROM call_logs cl
                LEFT JOIN users i ON cl.initiator_id = i.id
                WHERE EXISTS (
                    SELECT 1 FROM call_participants cp
                    WHERE cp.call_id = cl.id AND cp.user_id = $1
                )
                ORDER BY cl.started_at DESC
                LIMIT $2 OFFSET $3
            `, [userId, limit, offset]);

            return result.rows;

        } catch (error) {
            throw new Error(`Failed to get call history: ${error.message}`);
        }
    }

    async getActiveCall(userId) {
        const callId = this.userCalls.get(userId);
        if (!callId) return null;

        const call = this.activeCalls.get(callId);
        if (!call) return null;

        return {
            callId,
            status: call.status,
            callType: call.callType,
            participants: Array.from(call.participants.entries()).map(([userId, data]) => ({
                userId,
                status: data.status
            })),
            startedAt: call.initiatedAt,
            answeredAt: call.answeredAt
        };
    }

    async getCallStatistics(userId, timeframe = '30d') {
        try {
            const timeCondition = timeframe === '7d' ? "AND cl.started_at >= NOW() - INTERVAL '7 days'" :
                                 timeframe === '30d' ? "AND cl.started_at >= NOW() - INTERVAL '30 days'" :
                                 timeframe === '90d' ? "AND cl.started_at >= NOW() - INTERVAL '90 days'" : '';

            const result = await this.pool.query(`
                SELECT
                    COUNT(*) as total_calls,
                    COUNT(*) FILTER (WHERE cl.status = 'answered') as answered_calls,
                    COUNT(*) FILTER (WHERE cl.status = 'missed') as missed_calls,
                    COUNT(*) FILTER (WHERE cl.status = 'declined') as declined_calls,
                    COUNT(*) FILTER (WHERE cl.call_type = 'audio') as audio_calls,
                    COUNT(*) FILTER (WHERE cl.call_type = 'video') as video_calls,
                    COALESCE(AVG(cl.duration_seconds) FILTER (WHERE cl.status = 'answered'), 0) as avg_duration,
                    COALESCE(SUM(cl.duration_seconds) FILTER (WHERE cl.status = 'answered'), 0) as total_duration
                FROM call_logs cl
                JOIN call_participants cp ON cl.id = cp.call_id
                WHERE cp.user_id = $1 ${timeCondition}
            `, [userId]);

            return result.rows[0];

        } catch (error) {
            throw new Error(`Failed to get call statistics: ${error.message}`);
        }
    }
}

module.exports = WebRTCCallService;