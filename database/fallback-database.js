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

    async getUserById(userId) {
        return this.data.users.find(user => user.id === userId) || null;
    }

    async searchUsers(query, options = {}) {
        const { limit = 20, offset = 0 } = options;
        const searchTerm = query.toLowerCase();

        // Advanced fuzzy search with scoring
        const users = this.data.users
            .map(user => {
                let score = 0;
                const nickname = (user.nickname || '').toLowerCase();
                const displayName = (user.display_name || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
                const bio = (user.bio || '').toLowerCase();

                // Exact matches get highest score
                if (nickname === searchTerm) score += 100;
                if (displayName === searchTerm) score += 90;
                if (email === searchTerm) score += 80;

                // Starts with gets high score
                if (nickname.startsWith(searchTerm)) score += 70;
                if (displayName.startsWith(searchTerm)) score += 60;
                if (email.startsWith(searchTerm)) score += 50;

                // Contains gets medium score
                if (nickname.includes(searchTerm)) score += 40;
                if (displayName.includes(searchTerm)) score += 30;
                if (email.includes(searchTerm)) score += 20;
                if (bio.includes(searchTerm)) score += 10;

                // Fuzzy matching for typos
                if (this.levenshteinDistance(nickname, searchTerm) <= 2) score += 25;
                if (this.levenshteinDistance(displayName, searchTerm) <= 2) score += 20;

                return { user, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.user)
            .slice(offset, offset + limit);

        return users;
    }

    async getAllUsers(options = {}) {
        const { limit = 50, offset = 0, status = 'active' } = options;

        let users = [...this.data.users];

        if (status !== 'all') {
            users = users.filter(user => user.status === status || user.is_online);
        }

        return users.slice(offset, offset + limit);
    }

    async updateUser(userId, updates) {
        const userIndex = this.data.users.findIndex(user => user.id === userId);
        if (userIndex === -1) {
            throw new Error('User not found');
        }

        this.data.users[userIndex] = {
            ...this.data.users[userIndex],
            ...updates,
            updated_at: new Date()
        };

        return this.data.users[userIndex];
    }

    // Levenshtein distance for fuzzy matching
    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    async createUser(userData) {
        const {
            nickname,
            email = null,
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
            is_online: true,
            theme: 'auto',
            status: 'online'
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

    async removeChatParticipant(chatId, userId) {
        const index = this.data.chat_participants.findIndex(
            cp => cp.chat_id === chatId.toString() && cp.user_id === userId
        );

        if (index !== -1) {
            this.data.chat_participants.splice(index, 1);
        }

        return true;
    }

    async updateParticipantRole(chatId, userId, role) {
        const participant = this.data.chat_participants.find(
            cp => cp.chat_id === chatId.toString() && cp.user_id === userId
        );

        if (participant) {
            participant.role = role;
        }

        return participant;
    }

    async getChatParticipants(chatId) {
        return this.data.chat_participants
            .filter(cp => cp.chat_id === chatId.toString())
            .map(cp => {
                const user = this.data.users.find(u => u.id === cp.user_id);
                return {
                    ...cp,
                    user: user ? {
                        id: user.id,
                        nickname: user.nickname,
                        display_name: user.display_name,
                        avatar: user.avatar,
                        is_online: user.is_online
                    } : null
                };
            });
    }

    async deleteChat(chatId) {
        // Remove chat
        const chatIndex = this.data.chats.findIndex(chat => chat.id === chatId.toString());
        if (chatIndex !== -1) {
            this.data.chats.splice(chatIndex, 1);
        }

        // Remove participants
        this.data.chat_participants = this.data.chat_participants.filter(
            cp => cp.chat_id !== chatId.toString()
        );

        // Remove messages
        this.data.messages = this.data.messages.filter(
            msg => msg.chat_id !== chatId.toString()
        );

        return true;
    }

    async updateChat(chatId, updates) {
        const chatIndex = this.data.chats.findIndex(chat => chat.id === chatId.toString());
        if (chatIndex === -1) {
            throw new Error('Chat not found');
        }

        this.data.chats[chatIndex] = {
            ...this.data.chats[chatIndex],
            ...updates,
            updated_at: new Date()
        };

        return this.data.chats[chatIndex];
    }

    async markChatAsRead(chatId, userId) {
        const participant = this.data.chat_participants.find(
            cp => cp.chat_id === chatId.toString() && cp.user_id === userId
        );

        if (participant) {
            participant.last_read_at = new Date();
        }

        return true;
    }

    // ================================
    // NOTIFICATION METHODS
    // ================================

    async getUserNotifications(userId, options = {}) {
        // Since we don't have notifications in the fallback DB, return empty array
        // In a real implementation, this would fetch user notifications
        return [];
    }

    async markNotificationAsRead(notificationId, userId) {
        // Placeholder for notification read marking
        return true;
    }

    // ================================
    // ENHANCED DEMO DATA
    // ================================

    async addMoreDemoUsers() {
        const demoUsers = [
            {
                id: 'demo-user-2',
                nickname: 'john_doe',
                email: 'john@example.com',
                password_hash: 'hashed_password123',
                display_name: 'John Doe',
                bio: 'Senior Developer passionate about clean code',
                account_type: 'personal',
                avatar: null,
                created_at: new Date(),
                updated_at: new Date(),
                last_seen: new Date(),
                is_online: true,
                theme: 'dark',
                status: 'online'
            },
            {
                id: 'demo-user-3',
                nickname: 'sarah_wilson',
                email: 'sarah@company.com',
                password_hash: 'hashed_password456',
                display_name: 'Sarah Wilson',
                bio: 'Product Manager | UX enthusiast',
                account_type: 'business',
                avatar: null,
                created_at: new Date(),
                updated_at: new Date(),
                last_seen: new Date(),
                is_online: false,
                theme: 'light',
                status: 'away'
            },
            {
                id: 'demo-user-4',
                nickname: 'tech_lead',
                email: 'lead@talkpai.com',
                password_hash: 'hashed_password789',
                display_name: 'Tech Lead',
                bio: 'Leading innovation in messaging',
                account_type: 'enterprise',
                avatar: null,
                created_at: new Date(),
                updated_at: new Date(),
                last_seen: new Date(),
                is_online: true,
                theme: 'auto',
                status: 'busy'
            }
        ];

        this.data.users.push(...demoUsers);
    }

    // ================================
    // DATABASE MANAGEMENT
    // ================================

    async clearAllData() {
        console.log('🧹 Clearing all fallback database data...');
        this.data = {
            users: [],
            chats: [],
            messages: [],
            chat_participants: []
        };
        console.log('✅ Fallback database cleared');
        return true;
    }

    async resetToDefaults() {
        console.log('🔄 Resetting fallback database to defaults...');
        await this.clearAllData();
        await this.initializeDefaultData();
        console.log('✅ Fallback database reset to defaults');
        return true;
    }

    async initializeDefaultData() {
        // Add default demo user and AI assistant
        this.data.users = [
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
        ];

        // Add default chats
        this.data.chats = [
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
                type: 'ai',
                description: 'Chat with AI Assistant',
                created_by: 'ai-assistant',
                created_at: new Date(),
                updated_at: new Date(),
                avatar: '🤖',
                settings: {}
            }
        ];

        // Add chat participants
        this.data.chat_participants = [
            {
                id: 'cp-1',
                chat_id: '1',
                user_id: 'demo-user-1',
                role: 'admin',
                joined_at: new Date(),
                last_read_at: new Date()
            },
            {
                id: 'cp-2',
                chat_id: '2',
                user_id: 'demo-user-1',
                role: 'member',
                joined_at: new Date(),
                last_read_at: new Date()
            },
            {
                id: 'cp-3',
                chat_id: '2',
                user_id: 'ai-assistant',
                role: 'bot',
                joined_at: new Date(),
                last_read_at: new Date()
            }
        ];

        // Add demo messages
        this.data.messages = [
            {
                id: 'msg-1',
                chat_id: '1',
                sender_id: 'demo-user-1',
                content: 'Welcome to Talk pAI! 🚀',
                message_type: 'text',
                reply_to_id: null,
                metadata: {},
                created_at: new Date(),
                updated_at: new Date(),
                edited: false,
                sender_nickname: 'demo_user',
                sender_display_name: 'Demo User',
                sender_avatar: null
            },
            {
                id: 'msg-2',
                chat_id: '2',
                sender_id: 'ai-assistant',
                content: 'How can I help you today?',
                message_type: 'text',
                reply_to_id: null,
                metadata: {},
                created_at: new Date(),
                updated_at: new Date(),
                edited: false,
                sender_nickname: 'ai_assistant',
                sender_display_name: 'AI Assistant',
                sender_avatar: '🤖'
            }
        ];
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