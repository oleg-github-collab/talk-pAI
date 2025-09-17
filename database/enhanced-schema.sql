-- Enhanced Talk pAI Database Schema with Advanced Features
-- Supports glassmorphism UI, modular components, corporate features, and AI capabilities

-- Core Users table with enhanced profile features
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    nickname VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT DEFAULT 'Hey there! I am using Talk pAI.',
    avatar_url TEXT,
    avatar_data BYTEA, -- For custom avatar storage
    status VARCHAR(20) DEFAULT 'online', -- online, away, busy, dnd, invisible
    status_message TEXT,
    status_expires_at TIMESTAMP,
    account_type VARCHAR(20) DEFAULT 'personal', -- personal, business, enterprise
    role VARCHAR(20) DEFAULT 'user', -- user, admin, moderator
    department VARCHAR(100),
    position VARCHAR(100),
    phone VARCHAR(50),
    location VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    theme_preferences JSONB DEFAULT '{}',
    ui_layout JSONB DEFAULT '{}', -- For storing drag & drop layout
    notification_settings JSONB DEFAULT '{}',
    privacy_settings JSONB DEFAULT '{}',
    keyboard_shortcuts JSONB DEFAULT '{}',
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    website VARCHAR(255),
    settings JSONB DEFAULT '{}',
    subscription_plan VARCHAR(50) DEFAULT 'free',
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workspaces within organizations
CREATE TABLE IF NOT EXISTS workspaces (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(10),
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, slug)
);

-- Enhanced Chats/Channels table
CREATE TABLE IF NOT EXISTS chats (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL, -- dm, group, channel, thread
    name VARCHAR(255),
    description TEXT,
    topic VARCHAR(500),
    avatar_url TEXT,
    organization_id INTEGER REFERENCES organizations(id),
    workspace_id INTEGER REFERENCES workspaces(id),
    parent_chat_id INTEGER REFERENCES chats(id), -- For threads
    is_private BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat participants with enhanced roles
CREATE TABLE IF NOT EXISTS chat_participants (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- owner, admin, moderator, member, guest
    permissions JSONB DEFAULT '{}',
    notification_level VARCHAR(20) DEFAULT 'all', -- all, mentions, none
    is_pinned BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    is_hidden BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chat_id, user_id)
);

-- Enhanced Messages table with rich features
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id),
    parent_message_id INTEGER REFERENCES messages(id), -- For threads
    reply_to_id INTEGER REFERENCES messages(id), -- For replies
    content TEXT,
    content_type VARCHAR(20) DEFAULT 'text', -- text, file, voice, image, video, system
    content_data JSONB DEFAULT '{}', -- Rich content metadata
    message_type VARCHAR(20) DEFAULT 'message', -- message, system, bot
    edited_at TIMESTAMP,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    scheduled_at TIMESTAMP, -- For scheduled messages
    expires_at TIMESTAMP, -- For disappearing messages
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message reactions (emojis)
CREATE TABLE IF NOT EXISTS message_reactions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id, emoji)
);

-- Message mentions (@username)
CREATE TABLE IF NOT EXISTS message_mentions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    mention_type VARCHAR(20) DEFAULT 'user', -- user, channel, everyone, here
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- File attachments
CREATE TABLE IF NOT EXISTS file_attachments (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    file_type VARCHAR(50), -- image, video, audio, document, archive
    metadata JSONB DEFAULT '{}', -- dimensions, duration, etc.
    thumbnail_path TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Voice messages
CREATE TABLE IF NOT EXISTS voice_messages (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    duration_seconds INTEGER,
    waveform_data JSONB, -- For visualization
    transcription TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message read receipts
CREATE TABLE IF NOT EXISTS message_read_receipts (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id)
);

-- Typing indicators
CREATE TABLE IF NOT EXISTS typing_indicators (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(chat_id, user_id)
);

-- User contacts/friends
CREATE TABLE IF NOT EXISTS user_contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, blocked
    nickname VARCHAR(100), -- Custom nickname for contact
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, contact_user_id)
);

-- User sessions for multi-device support
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_name VARCHAR(100),
    device_type VARCHAR(50), -- web, mobile, desktop
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

-- User preferences and settings
CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    preference_key VARCHAR(100) NOT NULL,
    preference_value JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, preference_key)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- message, mention, reaction, system
    title VARCHAR(255),
    content TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    is_pushed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Chat History and Context
CREATE TABLE IF NOT EXISTS ai_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    conversation_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255),
    context_data JSONB DEFAULT '{}',
    model_used VARCHAR(100),
    total_tokens INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Generated Content
CREATE TABLE IF NOT EXISTS ai_generated_content (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    conversation_id VARCHAR(255) REFERENCES ai_conversations(conversation_id),
    content_type VARCHAR(50), -- text, image, spreadsheet, chart, document
    prompt TEXT,
    generated_content TEXT,
    file_path TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled messages
CREATE TABLE IF NOT EXISTS scheduled_messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text',
    scheduled_for TIMESTAMP NOT NULL,
    is_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message drafts
CREATE TABLE IF NOT EXISTS message_drafts (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chat_id, user_id)
);

-- Global search index
CREATE TABLE IF NOT EXISTS search_index (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- message, user, chat, file
    entity_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_parent_message_id ON messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_message_id ON message_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_user_id ON message_mentions(user_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_message_id ON file_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_search_index_entity_type ON search_index(entity_type);
CREATE INDEX IF NOT EXISTS idx_search_index_content ON search_index USING gin(to_tsvector('english', content));

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default AI assistant user
INSERT INTO users (nickname, email, password_hash, display_name, bio, account_type, role)
VALUES (
    'ai-assistant',
    'ai@talkpai.com',
    'no-password-needed',
    'AI Assistant',
    'Advanced AI helper with multiple capabilities',
    'system',
    'ai'
) ON CONFLICT (nickname) DO NOTHING;