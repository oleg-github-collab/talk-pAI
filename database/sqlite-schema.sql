-- Talk pAI SQLite Compatible Schema
-- Simple and clean schema without PostgreSQL specific features

-- Drop existing tables if they exist
DROP TABLE IF EXISTS message_attachments;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS chat_participants;
DROP TABLE IF EXISTS chats;
DROP TABLE IF EXISTS workspace_members;
DROP TABLE IF EXISTS organization_members;
DROP TABLE IF EXISTS workspaces;
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS user_relationships;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS ai_conversations;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS webhooks;
DROP TABLE IF EXISTS users;

-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    nickname TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    phone TEXT,
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    status TEXT DEFAULT 'offline',
    custom_status TEXT,
    account_type TEXT DEFAULT 'personal',
    is_verified INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    last_seen TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    notifications_enabled INTEGER DEFAULT 1,
    email_notifications INTEGER DEFAULT 1,
    push_notifications INTEGER DEFAULT 1,
    dark_mode INTEGER DEFAULT 0,
    privacy_level TEXT DEFAULT 'friends',
    metadata TEXT DEFAULT '{}'
);

-- Organizations table
CREATE TABLE organizations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    name TEXT NOT NULL,
    domain TEXT UNIQUE,
    logo_url TEXT,
    description TEXT,
    industry TEXT,
    size TEXT DEFAULT 'medium',
    plan_type TEXT DEFAULT 'basic',
    subscription_status TEXT DEFAULT 'active',
    settings TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Workspaces
CREATE TABLE workspaces (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    organization_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE,
    icon_url TEXT,
    is_public INTEGER DEFAULT 0,
    settings TEXT DEFAULT '{}',
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Organization members
CREATE TABLE organization_members (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    organization_id TEXT,
    user_id TEXT,
    role TEXT DEFAULT 'member',
    department TEXT,
    title TEXT,
    permissions TEXT DEFAULT '[]',
    joined_at TEXT DEFAULT (datetime('now'))
);

-- Workspace members
CREATE TABLE workspace_members (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    workspace_id TEXT,
    user_id TEXT,
    role TEXT DEFAULT 'member',
    joined_at TEXT DEFAULT (datetime('now'))
);

-- Chats/Channels table
CREATE TABLE chats (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    workspace_id TEXT,
    name TEXT,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'group',
    visibility TEXT DEFAULT 'private',
    is_archived INTEGER DEFAULT 0,
    settings TEXT DEFAULT '{}',
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_activity TEXT DEFAULT (datetime('now')),
    avatar_url TEXT,
    topic TEXT,
    pinned_message_id TEXT,
    member_count INTEGER DEFAULT 0
);

-- Chat participants
CREATE TABLE chat_participants (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    chat_id TEXT,
    user_id TEXT,
    role TEXT DEFAULT 'member',
    permissions TEXT DEFAULT '[]',
    joined_at TEXT DEFAULT (datetime('now')),
    last_read_at TEXT DEFAULT (datetime('now')),
    notifications_enabled INTEGER DEFAULT 1,
    is_muted INTEGER DEFAULT 0
);

-- Messages table
CREATE TABLE messages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    chat_id TEXT,
    sender_id TEXT,
    content TEXT,
    message_type TEXT DEFAULT 'text',
    reply_to_id TEXT,
    thread_id TEXT,
    is_edited INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    reactions TEXT DEFAULT '{}',
    mention_user_ids TEXT,
    ai_conversation_id TEXT,
    ai_model TEXT,
    ai_tokens_used INTEGER
);

-- Additional essential tables
CREATE TABLE message_attachments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    message_id TEXT,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT,
    metadata TEXT DEFAULT '{}',
    uploaded_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE user_relationships (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    requester_id TEXT,
    addressee_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE notifications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    user_id TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    data TEXT DEFAULT '{}',
    is_read INTEGER DEFAULT 0,
    is_pushed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    read_at TEXT
);

CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    user_id TEXT,
    token_hash TEXT NOT NULL UNIQUE,
    device_info TEXT DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT DEFAULT (datetime('now')),
    is_active INTEGER DEFAULT 1
);

CREATE TABLE ai_conversations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    user_id TEXT,
    chat_id TEXT,
    conversation_id TEXT UNIQUE NOT NULL,
    model TEXT NOT NULL,
    context TEXT DEFAULT '[]',
    total_tokens INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    user_id TEXT,
    organization_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details TEXT DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
);

CREATE TABLE webhooks (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    organization_id TEXT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT NOT NULL,
    secret TEXT,
    is_active INTEGER DEFAULT 1,
    last_triggered_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Create indexes for performance
CREATE INDEX idx_users_nickname ON users(nickname);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_last_seen ON users(last_seen);
CREATE INDEX idx_chats_workspace_id ON chats(workspace_id);
CREATE INDEX idx_chats_type ON chats(type);
CREATE INDEX idx_chats_last_activity ON chats(last_activity);
CREATE INDEX idx_chat_participants_chat_id ON chat_participants(chat_id);
CREATE INDEX idx_chat_participants_user_id ON chat_participants(user_id);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);

-- Insert default data
INSERT OR IGNORE INTO users (id, nickname, display_name, bio, account_type, status, avatar_url, is_verified, password_hash)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'aiden',
    'Aiden AI Assistant',
    'I am your intelligent AI companion, here to help with conversations, tasks, and provide assistance.',
    'enterprise',
    'online',
    '🤖',
    1,
    'ai-no-password-needed'
);

INSERT OR IGNORE INTO workspaces (id, name, slug, description, is_public)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'General Workspace',
    'general',
    'Default workspace for all users',
    1
);

INSERT OR IGNORE INTO chats (id, workspace_id, name, type, visibility, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'AI Assistant',
    'ai',
    'public',
    '00000000-0000-0000-0000-000000000001'
);

INSERT OR IGNORE INTO chat_participants (id, chat_id, user_id, role)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin'
);