-- Talk pAI Complete Production PostgreSQL Database Schema
-- Enterprise-grade schema with all necessary tables and optimizations

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Drop tables in correct order (respecting foreign key dependencies)
DROP TABLE IF EXISTS call_participants CASCADE;
DROP TABLE IF EXISTS call_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS file_shares CASCADE;
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS message_reactions CASCADE;
DROP TABLE IF EXISTS message_attachments CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chat_participants CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS user_relationships CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table with enhanced fields
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nickname VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64),
    display_name VARCHAR(100),
    bio TEXT DEFAULT 'Hey there! I am using Talk pAI.',
    avatar VARCHAR(255) DEFAULT '/avatars/default.jpg',
    theme VARCHAR(20) DEFAULT 'auto' CHECK (theme IN ('light', 'dark', 'auto')),
    status VARCHAR(20) DEFAULT 'online' CHECK (status IN ('online', 'offline', 'away', 'busy', 'invisible')),
    account_type VARCHAR(20) DEFAULT 'personal' CHECK (account_type IN ('personal', 'business', 'bot')),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL),
    CONSTRAINT nickname_format CHECK (nickname ~* '^[a-zA-Z0-9_]{3,50}$')
);

-- User settings table for extended preferences
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    notification_sound BOOLEAN DEFAULT TRUE,
    notification_desktop BOOLEAN DEFAULT TRUE,
    notification_email BOOLEAN DEFAULT FALSE,
    auto_download_media BOOLEAN DEFAULT TRUE,
    read_receipts BOOLEAN DEFAULT TRUE,
    typing_indicators BOOLEAN DEFAULT TRUE,
    custom_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id)
);

-- User relationships (friends, blocks, etc.)
CREATE TABLE user_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked', 'ignored')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(requester_id, addressee_id),
    CHECK (requester_id != addressee_id)
);

-- Sessions table with enhanced security
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(128) UNIQUE NOT NULL,
    refresh_token VARCHAR(128) UNIQUE,
    expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    refresh_expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    user_agent TEXT,
    ip_address INET,
    device_info JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced chats table
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'private' CHECK (type IN ('private', 'group', 'public', 'broadcast', 'ai')),
    workspace_id UUID NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    avatar VARCHAR(255),
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    max_participants INTEGER DEFAULT 500,
    message_retention_days INTEGER DEFAULT 365,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat participants with enhanced permissions
CREATE TABLE chat_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member', 'guest')),
    permissions JSONB DEFAULT '{}',
    is_muted BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,

    UNIQUE(chat_id, user_id)
);

-- Files table for media and document management
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    storage_provider VARCHAR(50) DEFAULT 'local',
    is_public BOOLEAN DEFAULT FALSE,
    download_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CHECK (file_size > 0 AND file_size <= 104857600) -- 100MB limit
);

-- Enhanced messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT,
    message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file', 'location', 'contact', 'system', 'call')),
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    forward_from_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    edit_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CHECK ((content IS NOT NULL AND LENGTH(content) > 0) OR message_type != 'text')
);

-- Message attachments linking table
CREATE TABLE message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    attachment_order INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(message_id, file_id)
);

-- Message reactions
CREATE TABLE message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reaction VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(message_id, user_id, reaction)
);

-- File sharing permissions
CREATE TABLE file_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    shared_with_chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    shared_by UUID REFERENCES users(id) ON DELETE SET NULL,
    permissions VARCHAR(20) DEFAULT 'read' CHECK (permissions IN ('read', 'write', 'admin')),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CHECK ((shared_with_user_id IS NOT NULL) OR (shared_with_chat_id IS NOT NULL))
);

-- Call logs for WebRTC calls
CREATE TABLE call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id VARCHAR(100) UNIQUE NOT NULL,
    chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
    initiator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    call_type VARCHAR(20) DEFAULT 'audio' CHECK (call_type IN ('audio', 'video', 'screen')),
    status VARCHAR(20) DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'answered', 'ended', 'missed', 'declined', 'failed')),
    duration_seconds INTEGER DEFAULT 0,
    quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
    ended_reason VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP,
    ended_at TIMESTAMP
);

-- Call participants
CREATE TABLE call_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID REFERENCES call_logs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    connection_quality VARCHAR(20) DEFAULT 'good' CHECK (connection_quality IN ('excellent', 'good', 'fair', 'poor')),

    UNIQUE(call_id, user_id)
);

-- Notifications system
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    action_url VARCHAR(500),
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    is_pushed BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- Performance indexes
CREATE INDEX idx_users_nickname_trgm ON users USING gin(nickname gin_trgm_ops);
CREATE INDEX idx_users_email_active ON users(email, is_active) WHERE email IS NOT NULL;
CREATE INDEX idx_users_status_last_seen ON users(status, last_seen);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_sessions_token_hash ON sessions USING hash(token);
CREATE INDEX idx_sessions_user_active ON sessions(user_id, is_active);
CREATE INDEX idx_sessions_expires ON sessions(expires_at) WHERE is_active = true;

CREATE INDEX idx_chats_type_active ON chats(type, is_active);
CREATE INDEX idx_chats_last_message ON chats(last_message_at DESC);
CREATE INDEX idx_chats_created_by ON chats(created_by);

CREATE INDEX idx_chat_participants_chat_user ON chat_participants(chat_id, user_id);
CREATE INDEX idx_chat_participants_user_active ON chat_participants(user_id) WHERE left_at IS NULL;
CREATE INDEX idx_chat_participants_role ON chat_participants(role);

CREATE INDEX idx_messages_chat_created ON messages(chat_id, created_at DESC);
CREATE INDEX idx_messages_sender_created ON messages(sender_id, created_at DESC);
CREATE INDEX idx_messages_type ON messages(message_type);
CREATE INDEX idx_messages_reply_to ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX idx_messages_search ON messages USING gin(to_tsvector('english', content)) WHERE content IS NOT NULL;

CREATE INDEX idx_files_uploaded_by ON files(uploaded_by, created_at DESC);
CREATE INDEX idx_files_mime_type ON files(mime_type);
CREATE INDEX idx_files_hash ON files(file_hash);

CREATE INDEX idx_call_logs_chat_started ON call_logs(chat_id, started_at DESC);
CREATE INDEX idx_call_logs_initiator ON call_logs(initiator_id, started_at DESC);
CREATE INDEX idx_call_logs_status ON call_logs(status);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);

-- Triggers for automatic updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_relationships_updated_at BEFORE UPDATE ON user_relationships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create demo data
INSERT INTO users (nickname, password_hash, salt, display_name, email, is_admin) VALUES
('admin', '$2b$10$demohashedpassword', 'demo_salt', 'Administrator', 'admin@talkpai.com', true),
('demo_user', '$2b$10$demohashedpassword', 'demo_salt', 'Demo User', 'demo@talkpai.com', false),
('ai_assistant', '$2b$10$demohashedpassword', 'demo_salt', 'AI Assistant', 'ai@talkpai.com', false);

-- Create user settings for demo users
INSERT INTO user_settings (user_id)
SELECT id FROM users WHERE nickname IN ('admin', 'demo_user', 'ai_assistant');

-- Create demo chat
INSERT INTO chats (name, description, type, created_by)
SELECT 'General Chat', 'Welcome to Talk pAI! This is the main discussion channel.', 'public', id
FROM users WHERE nickname = 'admin' LIMIT 1;

-- Add participants to demo chat
INSERT INTO chat_participants (chat_id, user_id, role)
SELECT c.id, u.id,
    CASE
        WHEN u.nickname = 'admin' THEN 'owner'
        WHEN u.nickname = 'ai_assistant' THEN 'moderator'
        ELSE 'member'
    END
FROM chats c, users u
WHERE c.name = 'General Chat' AND u.nickname IN ('admin', 'demo_user', 'ai_assistant');

-- Demo messages with various types
INSERT INTO messages (chat_id, sender_id, content, message_type)
SELECT c.id, u.id, 'Welcome to Talk pAI! 🚀 This is your production-ready messenger with enterprise features.', 'text'
FROM chats c, users u
WHERE c.name = 'General Chat' AND u.nickname = 'admin';

INSERT INTO messages (chat_id, sender_id, content, message_type)
SELECT c.id, u.id, 'Hello everyone! I''m your AI assistant. Feel free to ask me anything! 🤖', 'text'
FROM chats c, users u
WHERE c.name = 'General Chat' AND u.nickname = 'ai_assistant';

INSERT INTO messages (chat_id, sender_id, content, message_type)
SELECT c.id, u.id, 'Thanks! This looks amazing! The interface is beautiful and feature-rich. 😍', 'text'
FROM chats c, users u
WHERE c.name = 'General Chat' AND u.nickname = 'demo_user';

-- Update chat last_message_at
UPDATE chats SET last_message_at = (SELECT MAX(created_at) FROM messages WHERE chat_id = chats.id);

-- Create some sample notifications
INSERT INTO notifications (user_id, type, title, message)
SELECT u.id, 'welcome', 'Welcome to Talk pAI!', 'Your account has been created successfully. Explore all the amazing features!'
FROM users u WHERE u.nickname IN ('demo_user');

ANALYZE; -- Update table statistics for query optimizer