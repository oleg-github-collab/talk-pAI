// In-memory database fallback for Railway compatibility
class MemoryDatabase {
    constructor() {
        this.isConnected = false;
        this.connectionType = 'memory';
        this.data = {
            users: new Map(),
            messages: new Map(),
            chats: new Map(),
            sessions: new Map()
        };

        // Initialize with default data
        this.initializeDefaultData();
    }

    async connect() {
        try {
            console.log('🧠 Using in-memory database fallback...');
            this.isConnected = true;
            console.log('✅ Memory database connected successfully');
            return true;
        } catch (error) {
            console.error('Memory database initialization failed:', error.message);
            return false;
        }
    }

    initializeDefaultData() {
        // Add Aiden AI user
        this.data.users.set('00000000-0000-0000-0000-000000000001', {
            id: '00000000-0000-0000-0000-000000000001',
            nickname: 'aiden',
            display_name: 'Aiden AI Assistant',
            bio: 'I am your intelligent AI companion, here to help with conversations, tasks, and provide assistance.',
            account_type: 'enterprise',
            status: 'online',
            avatar_url: '🤖',
            is_verified: true,
            password_hash: 'ai-no-password-needed',
            created_at: new Date().toISOString()
        });

        // Add default chat
        this.data.chats.set('00000000-0000-0000-0000-000000000001', {
            id: '00000000-0000-0000-0000-000000000001',
            name: 'AI Assistant',
            type: 'ai',
            visibility: 'public',
            created_by: '00000000-0000-0000-0000-000000000001',
            created_at: new Date().toISOString()
        });
    }

    async initializeSchema() {
        // No schema needed for memory database
        console.log('🔧 Memory database schema ready');
    }

    async query(sql, params = []) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        try {
            // Simple query simulation for basic operations
            const sqlLower = sql.toLowerCase().trim();

            if (sqlLower.startsWith('select * from users where nickname')) {
                const nickname = params[0];
                for (const user of this.data.users.values()) {
                    if (user.nickname === nickname) {
                        return [user];
                    }
                }
                return [];
            }

            if (sqlLower.startsWith('insert into users')) {
                const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const user = {
                    id: userId,
                    nickname: params[0],
                    email: params[1],
                    password_hash: params[2],
                    display_name: params[3] || params[0],
                    bio: params[4] || 'Hey there! I am using Talk pAI.',
                    account_type: params[5] || 'personal',
                    status: 'online',
                    created_at: new Date().toISOString()
                };
                this.data.users.set(userId, user);
                return { insertId: userId, rowCount: 1 };
            }

            if (sqlLower.includes('from messages') && sqlLower.includes('where chat_id')) {
                // Return empty messages for now
                return [];
            }

            if (sqlLower.startsWith('insert into messages')) {
                const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const message = {
                    id: messageId,
                    chat_id: params[0],
                    sender_id: params[1],
                    content: params[2],
                    message_type: params[3] || 'text',
                    created_at: new Date().toISOString()
                };
                this.data.messages.set(messageId, message);
                return { insertId: messageId, rowCount: 1 };
            }

            // Default fallback for unknown queries
            return [];

        } catch (error) {
            console.error('❌ Memory database query error:', error.message);
            return [];
        }
    }

    async close() {
        this.isConnected = false;
        this.data = {
            users: new Map(),
            messages: new Map(),
            chats: new Map(),
            sessions: new Map()
        };
        console.log('🔐 Memory database cleared');
    }

    // Utility methods
    async getUserByNickname(nickname) {
        for (const user of this.data.users.values()) {
            if (user.nickname === nickname) {
                return user;
            }
        }
        return null;
    }

    async createUser(userData) {
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const user = {
            id: userId,
            ...userData,
            created_at: new Date().toISOString()
        };
        this.data.users.set(userId, user);
        return { insertId: userId, rowCount: 1 };
    }

    async getMessages(chatId, limit = 50, offset = 0) {
        const messages = Array.from(this.data.messages.values())
            .filter(msg => msg.chat_id === chatId)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(offset, offset + limit);

        return messages.map(msg => ({
            ...msg,
            sender_nickname: 'user',
            sender_display_name: 'User',
            sender_avatar: '👤'
        }));
    }

    async createMessage(messageData) {
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const message = {
            id: messageId,
            ...messageData,
            created_at: new Date().toISOString()
        };
        this.data.messages.set(messageId, message);
        return { insertId: messageId, rowCount: 1 };
    }

    async searchMessages(chatId, searchTerm, limit = 20) {
        const messages = Array.from(this.data.messages.values())
            .filter(msg =>
                msg.chat_id === chatId &&
                msg.content.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, limit);

        return messages.map(msg => ({
            ...msg,
            sender_nickname: 'user',
            sender_display_name: 'User'
        }));
    }
}

module.exports = MemoryDatabase;