/**
 * Fallback In-Memory Database for Talk pAI
 * Provides same interface as PostgreSQL database for development
 */
class FallbackDatabase {
    constructor() {
        this.isConnected = false;
        this.connectionType = 'fallback';
        this.data = {
            users: [
                {
                    id: 'demo-user-1',
                    nickname: 'demo_user',
                    email: 'demo@talkpai.com',
                    password_hash: 'hashed_demo123',
                    display_name: 'Demo User',
                    bio: 'I am a demo user for Talk pAI!',
                    account_type: 'personal',
                    avatar: null,
                    created_at: new Date(),
                    updated_at: new Date(),
                    last_seen: new Date(),
                    is_online: true
                },
                {
                    id: 'ai-assistant',
                    nickname: 'ai_assistant',
                    email: 'ai@talkpai.com',
                    password_hash: null,
                    display_name: 'AI Assistant',
                    bio: 'I am your AI assistant, ready to help!',
                    account_type: 'bot',
                    avatar: '🤖',
                    created_at: new Date(),
                    updated_at: new Date(),
                    last_seen: new Date(),
                    is_online: true
                }
            ],
            chats: [
                {
                    id: '1',
                    name: 'General',
                    type: 'public',
                    description: 'General discussion channel',
                    created_by: 'demo-user-1',
                    created_at: new Date(),
                    updated_at: new Date(),
                    avatar: null,
                    settings: {}
                },
                {
                    id: '2',
                    name: 'AI Assistant',
                    type: 'direct',
                    description: 'Direct chat with AI assistant',
                    created_by: 'demo-user-1',
                    created_at: new Date(),
                    updated_at: new Date(),
                    avatar: '🤖',
                    settings: {}
                }
            ],
            messages: [
                {
                    id: '1',
                    chat_id: '1',
                    sender_id: 'demo-user-1',
                    content: 'Welcome to Talk pAI! This is a demo message.',
                    message_type: 'text',
                    reply_to_id: null,
                    metadata: {},
                    created_at: new Date(Date.now() - 3600000), // 1 hour ago
                    updated_at: new Date(Date.now() - 3600000),
                    edited: false,
                    sender_nickname: 'demo_user',
                    sender_display_name: 'Demo User',
                    sender_avatar: null
                },
                {
                    id: '2',
                    chat_id: '2',
                    sender_id: 'ai-assistant',
                    content: 'Hello! I am your AI assistant. How can I help you today?',
                    message_type: 'text',
                    reply_to_id: null,
                    metadata: {},
                    created_at: new Date(Date.now() - 1800000), // 30 minutes ago
                    updated_at: new Date(Date.now() - 1800000),
                    edited: false,
                    sender_nickname: 'ai_assistant',
                    sender_display_name: 'AI Assistant',
                    sender_avatar: '🤖'
                }
            ],
            chat_participants: [
                {
                    id: '1',
                    chat_id: '1',
                    user_id: 'demo-user-1',
                    role: 'admin',
                    joined_at: new Date(),
                    last_read_at: new Date()
                },
                {
                    id: '2',
                    chat_id: '2',
                    user_id: 'demo-user-1',
                    role: 'member',
                    joined_at: new Date(),
                    last_read_at: new Date()
                },
                {
                    id: '3',
                    chat_id: '2',
                    user_id: 'ai-assistant',
                    role: 'member',
                    joined_at: new Date(),
                    last_read_at: new Date()
                }
            ],
            workspaces: [],
            files: [],
            notifications: []
        };
    }

    async connect() {
        try {
            console.log('🔗 Initializing fallback in-memory database...');

            // Simulate connection delay
            await new Promise(resolve => setTimeout(resolve, 100));

            this.isConnected = true;
            console.log('✅ Fallback database connected successfully');

            return true;
        } catch (error) {
            console.error('❌ Fallback database connection failed:', error.message);
            return false;
        }
    }

    async query(sql, params = []) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        // This is a simple fallback that just returns demo data
        // In a real implementation, you would parse SQL and execute against in-memory data
        console.log('📊 Fallback DB Query:', sql.substring(0, 100) + '...');

        // Return empty array for now - specific methods handle data
        return [];
    }

    async close() {
        this.isConnected = false;
        console.log('🔐 Fallback database connection closed');
    }

    // ================================
    // USER METHODS
    // ================================

    async getUserByNickname(nickname) {
        return this.data.users.find(user => user.nickname === nickname) || null;
    }

    async getUserByEmail(email) {
        return this.data.users.find(user => user.email === email) || null;
    }

    async createUser(userData) {
        const {
            nickname,
            email,
            password_hash,
            display_name = nickname,
            bio = 'Hey there! I am using Talk pAI.',
            account_type = 'personal'
        } = userData;

        const newUser = {
            id: `user-${Date.now()}`,
            nickname,
            email,
            password_hash,
            display_name,
            bio,
            account_type,
            avatar: null,
            created_at: new Date(),
            updated_at: new Date(),
            last_seen: new Date(),
            is_online: true
        };

        this.data.users.push(newUser);
        return newUser;
    }

    // ================================
    // CHAT METHODS
    // ================================

    async getChats(options = {}) {
        const { userId, workspaceId, type, limit = 50, offset = 0 } = options;

        let chats = [...this.data.chats];

        // Filter by type if specified
        if (type) {
            chats = chats.filter(chat => chat.type === type);
        }

        // Apply pagination
        const paginatedChats = chats.slice(offset, offset + limit);

        // Add participants and last message info
        return paginatedChats.map(chat => {
            const participants = this.data.chat_participants.filter(cp => cp.chat_id === chat.id);
            const lastMessage = this.data.messages
                .filter(msg => msg.chat_id === chat.id)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

            return {
                ...chat,
                participant_count: participants.length,
                last_message: lastMessage?.content || 'No messages yet',
                last_message_at: lastMessage?.created_at || chat.created_at,
                unread_count: 0 // Simplified for demo
            };
        });
    }

    async createChat(chatData) {
        const {
            name,
            type = 'private',
            description = '',
            workspace_id = null,
            created_by
        } = chatData;

        const newChat = {
            id: `chat-${Date.now()}`,
            name,
            type,
            description,
            workspace_id,
            created_by,
            created_at: new Date(),
            updated_at: new Date(),
            avatar: null,
            settings: {}
        };

        this.data.chats.push(newChat);
        return newChat;
    }

    async getChatById(chatId) {
        return this.data.chats.find(chat => chat.id === chatId) || null;
    }

    async getChatsByUserId(userId) {
        const userChats = this.data.chat_participants
            .filter(cp => cp.user_id === userId)
            .map(cp => {
                const chat = this.data.chats.find(c => c.id === cp.chat_id);
                return {
                    ...chat,
                    role: cp.role,
                    joined_at: cp.joined_at
                };
            })
            .filter(chat => chat.id); // Remove null entries

        return userChats;
    }

    // ================================
    // MESSAGE METHODS
    // ================================

    async getMessages(options = {}) {
        const { chatId, limit = 50, offset = 0, before, after } = options;

        let messages = this.data.messages.filter(msg => msg.chat_id === chatId.toString());

        // Apply date filters if specified
        if (before) {
            messages = messages.filter(msg => new Date(msg.created_at) < new Date(before));
        }
        if (after) {
            messages = messages.filter(msg => new Date(msg.created_at) > new Date(after));
        }

        // Sort by creation date (newest first)
        messages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Apply pagination
        return messages.slice(offset, offset + limit);
    }

    async createMessage(messageData) {
        const {
            chat_id,
            sender_id,
            content,
            content_type = 'text',
            reply_to_id = null,
            metadata = {}
        } = messageData;

        // Get sender info
        const sender = this.data.users.find(user => user.id === sender_id);

        const newMessage = {
            id: `msg-${Date.now()}`,
            chat_id: chat_id.toString(),
            sender_id,
            content,
            message_type: content_type,
            reply_to_id,
            metadata: typeof metadata === 'string' ? JSON.parse(metadata) : metadata,
            created_at: new Date(),
            updated_at: new Date(),
            edited: false,
            sender_nickname: sender?.nickname || 'Unknown',
            sender_display_name: sender?.display_name || 'Unknown User',
            sender_avatar: sender?.avatar || null
        };

        this.data.messages.push(newMessage);

        // Update chat's updated_at timestamp
        const chat = this.data.chats.find(c => c.id === chat_id.toString());
        if (chat) {
            chat.updated_at = new Date();
        }

        return newMessage;
    }

    async searchMessages(chatId, searchTerm, limit = 20) {
        const messages = this.data.messages
            .filter(msg =>
                msg.chat_id === chatId.toString() &&
                msg.content.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, limit);

        return messages;
    }

    // ================================
    // CHAT PARTICIPANT METHODS
    // ================================

    async addUserToChat(chatId, userId, role = 'member') {
        const existingParticipant = this.data.chat_participants
            .find(cp => cp.chat_id === chatId.toString() && cp.user_id === userId);

        if (existingParticipant) {
            return existingParticipant;
        }

        const newParticipant = {
            id: `cp-${Date.now()}`,
            chat_id: chatId.toString(),
            user_id: userId,
            role,
            joined_at: new Date(),
            last_read_at: new Date()
        };

        this.data.chat_participants.push(newParticipant);
        return newParticipant;
    }

    async addChatParticipant(chatId, userId, role = 'member') {
        return this.addUserToChat(chatId, userId, role);
    }

    async addChatParticipants(chatId, userIds) {
        const results = [];
        for (const userId of userIds) {
            const participant = await this.addUserToChat(chatId, userId);
            results.push(participant);
        }
        return results;
    }

    // ================================
    // HEALTH CHECK
    // ================================

    async healthCheck() {
        try {
            return {
                connected: this.isConnected,
                timestamp: new Date(),
                version: 'Fallback Database v1.0.0',
                type: 'fallback',
                stats: {
                    users: this.data.users.length,
                    chats: this.data.chats.length,
                    messages: this.data.messages.length,
                    participants: this.data.chat_participants.length
                }
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                type: 'fallback'
            };
        }
    }
}

module.exports = FallbackDatabase;